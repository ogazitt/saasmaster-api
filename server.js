const express = require('express');
const jwt = require('express-jwt');
const jwksRsa = require('jwks-rsa');
const cors = require('cors');
const bodyParser = require('body-parser');

// set dependencies 
const jwtAuthz = require('express-jwt-authz');

// create a new express app
const app = express();

// Set up Auth0 configuration
const authConfig = {
  domain: "ogazitt.auth0.com",
  audience: "https://api.saasmaster.co"
};

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
  
  console.log('get api');

  var userId = req.user['https://api.saasmaster.co/email'];
  console.log(`user: ${userId}`);

  var timesheet = {};
  timesheet.user_id = userId;
  timesheet.message = 'hello, world';

  // Save the timesheet to the database...

  //send the response
  res.status(200).send(timesheet);
});

// Create timesheets API endpoint
app.post('/timesheets', checkJwt, jwtAuthz(['create:timesheets']), function(req, res){
  console.log('post api');
  var timesheet = req.body;

  var userId = req.user['https://api.saasmaster.co/email'];
  timesheet.user_id = userId;

  // Save the timesheet to the database...

  //send the response
  res.status(201).send(timesheet);
});

// Launch the API Server at localhost:8080
app.listen(8080);
