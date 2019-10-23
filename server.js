const express = require('express');
const path = require('path');
const jwt = require('express-jwt');
const jwksRsa = require('jwks-rsa');
const cors = require('cors');
const bodyParser = require('body-parser');
const axios = require('axios');
const authConfig = require('./auth_config.json');
const google = require('./google');

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

// Get timesheets API endpoint
app.get('/timesheets', checkJwt, jwtAuthz(['read:timesheets']), function(req, res){
  
  const email = req.user[`${authConfig.audience}/email`];
  const userId = req.user['sub'];
  console.log(`/timesheets: user: ${userId}; email: ${email}`);

 

  const callAPI = async () => {
    try {
      const accessToken = await google.getGoogleAccessToken(userId);
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
