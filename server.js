const express = require('express');
const path = require('path');
const jwt = require('express-jwt');
const jwksRsa = require('jwks-rsa');
const cors = require('cors');
const bodyParser = require('body-parser');
const jwtAuthz = require('express-jwt-authz');

const authConfig = require('./auth_config.json');
const auth0 = require('./auth0');
const google = require('./google');
const facebook = require('./facebook');
const database = require('./database');

// get environment (dev or prod) based on environment variable
const env = process.env.NODE_ENV || 'prod';
console.log('environment:', env);

// get persistence provider based on environment variable
const provider = process.env.PROVIDER || 'firestore';
console.log('provider:', provider);

// set database persistence layer based on provider and environment
database.setProvider(provider);
database.setEnv(env);

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

// Get timesheets API endpoint (old)
app.get('/timesheets', checkJwt, jwtAuthz(['read:timesheets']), function(req, res){
  res.status(200).send({});
});

// Get google api data endpoint
app.get('/google', checkJwt, function(req, res){
  const email = req.user[`${authConfig.audience}/email`];
  const userId = req.user['sub'];
  console.log(`/google: user: ${userId}; email: ${email}`);

  const callGoogle = async () => {
    try {
      const data = await google.getCalendarData(userId);
      //const data = await google.getGoogleLocations(userId);
      if (!data) {
        console.log('callGoogle: no data returned');
        res.status(200).send({ message: 'no data returned'});
        return;
      }

      // SUCCESS! send the data back to the client
      res.status(200).send(data);
      return;
    } catch (error) {
      await error.response;
      console.log(`callGoogle: caught exception: ${error}`);
      res.status(200).send({ message: error });
      return;
    }
  };
  
  callGoogle();
});

// Get facebook api data endpoint
app.get('/facebook', checkJwt, function(req, res){
  const email = req.user[`${authConfig.audience}/email`];
  const userId = req.user['sub'];
  console.log(`/facebook: user: ${userId}; email: ${email}`);

  const callFacebook = async () => {
    try {
      // BUGBUG - make a FB API call!
      const data = await facebook.getPagesData(userId);
      if (!data) {
        console.log('callFacebook: no data returned');
        res.status(200).send({ message: 'no data returned'});
        return;
      }

      // SUCCESS! send the data back to the client
      res.status(200).send(data);
      return;
    } catch (error) {
      await error.response;
      console.log(`callFacebook: caught exception: ${error}`);
      res.status(200).send({ message: error });
      return;
    }
  };
  
  callFacebook();
});

// Get connections API endpoint
//app.get('/connections', checkJwt, jwtAuthz(['read:timesheets']), function(req, res){
app.get('/connections', checkJwt, function(req, res){
  
  const email = req.user[`${authConfig.audience}/email`];
  const userId = req.user['sub'];
  console.log(`/connections: user: ${userId}; email: ${email}`);

  const returnUserInfo = async () => {
    const user = await database.getUserData(userId) || {};
    res.status(200).send(user);
  }

  returnUserInfo();
});

// Get profile API endpoint
//app.get('/profile', checkJwt, jwtAuthz(['read:timesheets']), function(req, res){
app.get('/profile', checkJwt, function(req, res){
  
  const email = req.user[`${authConfig.audience}/email`];
  const userId = req.user['sub'];
  console.log(`/profile: user: ${userId}; email: ${email}`);

  const returnProfile = async () => {
    const profile = await auth0.getAuth0Profile(userId) || {};
    res.status(200).send(profile);
  }

  returnProfile();
});

// Create profile API endpoint
app.post('/link', checkJwt, function(req, res){

  const userId = req.user['sub'];
  var action = req.body && req.body.action;
  var secondaryUserId = req.body && req.body.secondaryUserId;
  console.log(`POST /link: ${action} ${userId}, ${secondaryUserId}`);

  const link = async () => {
    const data = await auth0.linkAccounts(userId, secondaryUserId);
    res.status(200).send(data || { message: 'link failed' });
  }

  const unlink = async () => {
    const data = await auth0.unlinkAccounts(userId, secondaryUserId);
    res.status(200).send(data || { message: 'unlink failed' });
  }

  if (action === 'link' && userId && secondaryUserId) {
    link();
    return;
  }

  if (action === 'unlink' && userId && secondaryUserId) {
    unlink();
    return;
  }

  res.status(200).send({ message: 'Unknown action'});
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
