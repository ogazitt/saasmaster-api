const express = require('express');
const path = require('path');
const jwt = require('express-jwt');
const jwksRsa = require('jwks-rsa');
const cors = require('cors');
const bodyParser = require('body-parser');
const axios = require('axios');
const authConfig = require('./auth_config.json');

// set dependencies 
const jwtAuthz = require('express-jwt-authz');

// create a new express app
const app = express();

// Enable CORS
app.use(cors());

// Create middleware for checking the JWT
const checkJwt = jwt({
  // Dynamically provide a signing key based on the kid in the header and the singing keys provided by the JWKS endpoint
  secret: jwksRsa.expressJwtSecret({
    cache: true,
    rateLimit: true,
    jwksRequestsPerMinute: 5,
    jwksUri: `https://${authConfig.domain}/.well-known/jwks.json`
  }),

  // Validate the audience and the issuer
  audience: authConfig.audience, 
  issuer: `https://${authConfig.domain}/`,
  algorithms: [ 'RS256' ]
});
  
// Enable the use of request body parsing middleware
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({
  extended: true
}));

// configure a static file server
app.use(express.static(path.join(__dirname, 'build')));

const users = {};

// Get timesheets API endpoint
app.get('/timesheets', checkJwt, jwtAuthz(['read:timesheets']), function(req, res){
  
  const email = req.user[`${authConfig.audience}/email`];
  const userId = req.user['sub'];
  console.log(`/timesheets: user: ${userId}; email: ${email}`);

  const getManagementAccessToken = async () => {
    try {
      const url = `https://${authConfig.domain}/oauth/token`;
      const headers = { 'content-type': 'application/json' };
      const body = { 
        client_id: authConfig.client_id,
        client_secret: authConfig.client_secret,
        audience: `https://${authConfig.domain}/api/v2/`,
        grant_type: 'client_credentials'
      };
  
      const response = await axios.post(
        url,
        body,
        {
          headers: headers
        });
      const data = response.data;
      if (data && data.access_token) {
        return data.access_token;
      }
      console.log('error - did not find token');
      return null;
    } catch (error) {
      console.log(`getManagementAccessToken: caught exception: ${error}`);
      res.status(500).send(error);
    }
  };

  const getGoogleToken = async (managementToken) => {
    try {
      const url = encodeURI(`https://${authConfig.domain}/api/v2/users/${userId}`);
      const headers = { 
        'content-type': 'application/json',
        'authorization': `Bearer ${managementToken}`
      };

      const response = await axios.get(
        url,
        {
          headers: headers
        });
      const user = response.data;
      var access_token = user && user.identities[0].access_token;
      if (!access_token) {
        return null;
      }

      const refresh_token = user && user.identities[0].refresh_token;
      if (refresh_token) {
        // store refresh token in DB
        users[userId] = refresh_token;
      }

      // check for token expiration
      if (tokenExpired(user)) {
        access_token = null;
        const refreshToken = users[userId];
        if (refreshToken) {
          access_token = await getAccessTokenForGoogleRefreshToken(refreshToken);
        } else {
          // no refresh token
          return null;
        }
      }
      if (!access_token) {
        return null;
      }

      // return the (potentially refreshed) access token
      return access_token;
    } catch (error) {
      console.log(`getGoogleToken: caught exception: ${error}`);
      return null;
    }
  };

  const tokenExpired = (user) => {
    try {
      const lastUpdated = new Date(user.updated_at);
      const expiresIn = user.identities[0].expires_in;
      lastUpdated.setSeconds(lastUpdated.getSeconds() + expiresIn);
      const now = Date.now();
      if (lastUpdated > now) {
        return false;
      }
      return true;
    } catch (error) {
      console.log(`tokenExpired: caught exception: ${error}`);
      return true;
    }
  }

  const getAccessTokenForGoogleRefreshToken = async(refreshToken) => {
    try {
      const url = 'https://www.googleapis.com/oauth2/v4/token';
      const headers = { 
        'content-type': 'application/json',
      };
      const body = {
        client_id: authConfig.google_client_id,
        client_secret: authConfig.google_client_secret,
        refresh_token: refreshToken,
        grant_type: 'refresh_token'
      }

      const response = await axios.post(
        url,
        body,
        {
          headers: headers
        },
      );
      const data = response.data;
      console.log(data);
      const access_token = data && data.access_token;
      if (!access_token) {
        return null;
      }
      return access_token;
    } catch (error) {
      await error.response;
      console.log(`getAccessTokenForGoogleRefreshToken: caught exception: ${error}`);
      return null;
    }
  };

  const callAPI = async () => {
    try {
      const managementToken = await(getManagementAccessToken());
      if (!managementToken) {
        console.log('callAPI: getManagementAccessToken failed');
        res.status(200).send({ message: 'no management token'});
        return;
      }
      var token = await(getGoogleToken(managementToken));
      if (!token) {
        console.log('callAPI: getGoogleToken failed');
        res.status(200).send({ message: 'no google token'});
        return;
      }

      const url = 'https://www.googleapis.com/calendar/v3/users/me/calendarList';
      //const url = 'https://www.google.com/m8/feeds/contacts/ogazitt%40gmail.com/full';
      const headers = { 
        'content-type': 'application/json',
        'authorization': `Bearer ${token}`
       };
  
      const response = await axios.get(
        url,
        {
          headers: headers
        });
      const data = response.data;
      if (data) {
        // SUCCESS! send the data from google
        data.user_id = email;
        data.message = 'hello, world';
        res.status(200).send(data);
        return;
      }
      res.status(404).send({ message: 'no data returned from google'});
    } catch (error) {
      await error.response;
      console.log(`callAPI: caught exception: ${error}`);
      res.status(500).send({ message: error });
      return;
    }
  };
  
  callAPI();
});

// Create timesheets API endpoint
app.post('/timesheets', checkJwt, jwtAuthz(['create:timesheets']), function(req, res){
  console.log('post api');
  var timesheet = req.body;

  var userId = req.user[`${authConfig.audience}/email`];
  timesheet.user_id = userId;

  // Save the timesheet to the database...

  //send the response
  res.status(201).send(timesheet);
});

// main endpoint serves react bundle from /build
app.get('/*', function(req, res) {
  res.sendFile(path.join(__dirname, 'build', 'index.html'));
});

// Launch the API Server at PORT, or default port 8080
const port = process.env.PORT || 8080;
app.listen(port, () => {
  console.log('SaaSMaster listening on port', port);
});
