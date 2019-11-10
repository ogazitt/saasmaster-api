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
  if (user && !database.tokenExpired(user)) {
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
      'content-type': 'application/json',
      //'authorization': `Bearer ${accessToken}`
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
    var refreshToken = userIdentity.refresh_token; // could be empty
    const timestamp = user.updated_at;
    const expiresIn = userIdentity.expires_in;

    // if no access token, no way to proceed
    if (!accessToken) {
      return null;
    }

    // HACK: return the access token for now
    return accessToken;

    // store / cache the access token 
    const thisUser = await database.setUserData(
      userId,
      'facebook',
      accessToken,
      timestamp,
      expiresIn,
      refreshToken);

    // check for token expiration
    if (database.tokenExpired(thisUser)) {
      accessToken = null;

      // get a new access token using the refresh token
      if (thisUser.refreshToken) {
        accessToken = await getAccessTokenForFacebookRefreshToken(userId, thisUser.refreshToken);
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
    console.log(`getFacebookTokenFromAuth0Profile: caught exception: ${error}`);
    return null;
  }
};

// retrieve an access token from a refresh token, and cache the resulting 
// access token for that userId
const getAccessTokenForFacebookRefreshToken = async(userId, refreshToken) => {
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
    database.setUserData(userId, 'facebook', accessToken, new Date(), data.expires_in, null);

    return accessToken;
  } catch (error) {
    await error.response;
    console.log(`getAccessTokenForFacebookRefreshToken: caught exception: ${error}`);
    return null;
  }
};
