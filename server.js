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

// initialize the users hash (current storage method)
const users = {};

// Get timesheets API endpoint
app.get('/timesheets', checkJwt, jwtAuthz(['read:timesheets']), function(req, res){
  
  const email = req.user[`${authConfig.audience}/email`];
  const userId = req.user['sub'];
  console.log(`/timesheets: user: ${userId}; email: ${email}`);

  const getManagementAPIAccessToken = async () => {
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
      return null;
    } catch (error) {
      await error.response;
      console.log(`getManagementAPIAccessToken: caught exception: ${error}`);
      return null;
    }
  };

  const getGoogleTokenFromManagementAPI = async (userId, managementToken) => {
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
      const userIdentity = user && user.identities && user.identities[0];
      if (!userIdentity) {
        return null;
      }

      var accessToken = userIdentity.access_token;
      var refreshToken = userIdentity.refresh_token; // could be empty
      const timestamp = user.updated_at;
      const expiresIn = userIdentity.expires_in;

      // if no access token, no way to proceed
      if (!accessToken) {
        return null;
      }

      // store / cache the access token 
      const thisUser = setUserData(
        userId,
        accessToken,
        timestamp,
        expiresIn,
        refreshToken);

      // check for token expiration
      if (tokenExpired(thisUser)) {
        accessToken = null;

        // get a new access token using the refresh token
        if (thisUser.refreshToken) {
          accessToken = await getAccessTokenForGoogleRefreshToken(userId, thisUser.refreshToken);
        } 
      }

      // if couldn't obtain a valid access token, return null
      if (!accessToken) {
        return null;
      }

      // return the (potentially refreshed) access token
      return accessToken;
    } catch (error) {
      await error.response;
      console.log(`getGoogleTokenFromManagementAPI: caught exception: ${error}`);
      return null;
    }
  };

  // get user data by userid 
  // FEATURE: this should be moved to a DB in the future
  const getUserData = (userId) => {
    return users[userId];
  };

  // store user data by userid
  // FEATURE: this should be moved to a DB in the future
  const setUserData = (
      userId,            // userid to store data for
      accessToken,       // access token
      created,           // timestamp when token was created
      expiresIn,         // expires in (seconds)
      refreshToken) => { // refresh token (may be null)

    try {
      // compute the expiration timestamp
      const timestamp = new Date(created);
      timestamp.setSeconds(timestamp.getSeconds() + expiresIn);

      // store the access token in the users hash
      if (!users[userId]) {
        // if an entry doesn't yet exist, create it
        users[userId] = 
        { 
          accessToken: accessToken,
          expiresAt: timestamp
        };
      } else {
        users[userId].accessToken = accessToken;
        users[userId].expiresAt = timestamp;
      }

      // also store / overwrite refresh token only if it was present
      if (refreshToken) {
        // store refresh token (entry in users hash must exist)
        users[userId].refreshToken = refreshToken;
      }

      // return the refreshed user hash
      return users[userId];
    } catch (error) {
      console.log(`setUserData: caught exception: ${error}`);
      return null;
    }
  }

  const tokenExpired = (user) => {
    try {
      const timestamp = user.expiresAt;
      const now = Date.now();
      if (timestamp > now) {
        return false;
      }
      return true;
    } catch (error) {
      console.log(`tokenExpired: caught exception: ${error}`);
      return true;
    }
  }

  const getAccessTokenForGoogleRefreshToken = async(userId, refreshToken) => {
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
      const accessToken = data && data.access_token;
      if (!accessToken) {
        return null;
      }

      // store the new user data
      setUserData(userId, accessToken, Date.now(), data.expires_in, null);

      return accessToken;
    } catch (error) {
      await error.response;
      console.log(`getAccessTokenForGoogleRefreshToken: caught exception: ${error}`);
      return null;
    }
  };

  const getGoogleAccessToken = async (userId) => {

    const user = getUserData(userId);

    // if an access token is already cached, and not expired, return it
    if (user && !tokenExpired(user)) {
      return user.accessToken;
    }

    // we don't have a token, or it's already expired; need to 
    // obtain a new one from the management API
    try {
      const managementToken = await getManagementAPIAccessToken();
      if (!managementToken) {
        console.log('callAPI: getManagementAPIAccessToken failed');
        return null;
      }
      var token = await getGoogleTokenFromManagementAPI(userId, managementToken);
      if (!token) {
        console.log('callAPI: getGoogleTokenFromManagementAPI failed');
        return null;
      }
      // return the google access token
      return token;
    } catch (error) {
      await error.response;
      console.log(`getGoogleAccessToken: caught exception: ${error}`);
      return null;
    }
  };

  const callAPI = async () => {
    try {
      const accessToken = await getGoogleAccessToken(userId);
      if (!accessToken) {
        console.log('callAPI: getGoogleAccessToken failed');
        res.status(200).send({ message: 'no access token'});
        return;
      }

      const url = 'https://www.googleapis.com/calendar/v3/users/me/calendarList';
      //const url = 'https://www.google.com/m8/feeds/contacts/ogazitt%40gmail.com/full';
      const headers = { 
        'content-type': 'application/json',
        'authorization': `Bearer ${accessToken}`
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
