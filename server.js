const express = require('express');
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

// Set up Auth0 configuration
/*
const authConfig = {
  domain: "ogazitt.auth0.com",
  audience: "https://api.saasmaster.co"
};
*/

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
        grant_type:"client_credentials"
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
      console.log(`catch error from getToken: ${error}`);
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
      const access_token = user && user.identities[0].access_token;
      if (!access_token) {
        console.log('error - did not find token');
        res.status(500).send(error);
        return null;
      }
      return access_token;
    } catch (error) {
      console.log(`catch error from getGoogleToken: ${error}`);
      return null;
    }
  };

  const callAPI = async () => {
    try {
      const managementToken = await(getManagementAccessToken());
      const token = await(getGoogleToken(managementToken));
      if (!token) {
        console.log('callAPI did not receive token');
        res.status(500).send({ message: 'no token'});
        return null;
      }

      const url = 'https://www.googleapis.com/calendar/v3/users/me/calendarList';
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
      const err = await error.response;
      console.log(`error: ${error}`);
      res.status(500).send(err.response);
      return null;
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

// Launch the API Server at localhost:8080
app.listen(8080);
