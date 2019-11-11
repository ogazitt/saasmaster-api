// facebook utility functions

// exports:
// getFacebookAccessToken(userId): abstracts all logic to retrieve a FB access token
// getCalendarData(userId): get calendar data for the userId
// getGoogleLocations(userId): get google mybusiness location data

const bizSdk = require('facebook-nodejs-business-sdk');

const axios = require('axios');
const database = require('./database');
const authConfig = require('./auth_config.json');
const auth0 = require('./auth0');

exports.getFacebookAccessToken = async (userId) => {

  const user = await database.getUserData(userId, 'facebook');

  // if an access token is already cached, and not expired, return it
  if (user && user.accessToken) {
    return user.accessToken;
  }

  // we don't have a token, or it's already expired; need to 
  // obtain a new one from the management API
  try {
    const profile = await auth0.getAuth0Profile(userId);
    if (!profile) {
      console.log('getFacebookAccessToken: getAuth0Profile failed');
      return null;
    }
    const token = await getFacebookTokenFromAuth0Profile(userId, profile);
    if (!token) {
      console.log('getFacebookAccessToken: getFacebookTokenFromAuth0Profile failed');
      return null;
    }

    // return the google access token
    return token;
  } catch (error) {
    await error.response;
    console.log(`getFacebookAccessToken: caught exception: ${error}`);
    return null;
  }
};

exports.getPagesData = async (userId) => {
  try {
    // get userid from the auth0 userid format (provider|userid)
    const fb_userid = userId.split('|')[1];// '10157590277899002'; // HACK: hardcode for now
    
    const accessToken = await exports.getFacebookAccessToken(userId);
    if (!accessToken) {
      console.log('getPagesData: getFacebookAccessToken failed');
      return null;
    }

    const url = `https://graph.facebook.com/${fb_userid}/accounts?access_token=${accessToken}`;

    const headers = { 
      'content-type': 'application/json'
     };

    const response = await axios.get(
      url,
      {
        headers: headers
      });

      // response received successfully
    return response.data;
  } catch (error) {
    await error.response;
    console.log(`getPagesData: caught exception: ${error}`);
    return null;
  }
};

// extract facebook access token from auth0 profile information
// this method will cache the access token, check for expiration, and refresh it if 
// necessary
//   userId is the Auth0 userid (key)
//   user is the struct returned from Auth0 management API
const getFacebookTokenFromAuth0Profile = async (userId, user) => {
  try {
    const userIdentity = user && user.identities && 
                         user.identities.find(i => i.provider === 'facebook');
    if (!userIdentity) {
      return null;
    }

    var accessToken = userIdentity.access_token;

    // if no access token, no way to proceed
    if (!accessToken) {
      return null;
    }

    // store / cache the access token 
    const thisUser = await database.setUserData(
      userId,
      'facebook',
      accessToken,
      null,
      null,
      null);

    // BUGBUG: need to exchange for long-lived access token
    const longLivedToken = await getLongLivedFacebookAccessToken(userId, accessToken);

    // return the long lived access token if not null, otherwise access token
    return longLivedToken || accessToken;
  } catch (error) {
    await error.response;
    console.log(`getFacebookTokenFromAuth0Profile: caught exception: ${error}`);
    return null;
  }
};

// retrieve a long-lived access token, and cache the resulting 
// access token for that userId
const getLongLivedFacebookAccessToken = async(userId, accessToken) => {
  // this call has not been debugged yet
  // and it appears that the FB token is long-lived anyway
  return null;

  try {
    const url = `https://graph.facebook.com/oauth/access_token?             
client_id=${authConfig.fb_client_id}&
client_secret=${authConfig.fb_client_secret}&
grant_type=fb_exchange_token&
fb_exchange_token=${accessToken}`;

    const headers = { 
      'content-type': 'application/json',
    };

    const response = await axios.get(
      url,
      {
        headers: headers
      },
    );
    const data = response.data;
    const longLivedToken = data && data.access_token;
    if (!longLivedToken) {
      return null;
    }

    // store the new user data
    database.setUserData(userId, 'facebook', longLivedToken, null, null, null);

    return longLivedToken;
  } catch (error) {
    await error.response;
    console.log(`getLongLivedFacebookAccessToken: caught exception: ${error}`);
    return null;
  }
};
