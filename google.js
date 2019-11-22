// google utility functions

// exports:
// getGoogleAccessToken(userId): abstracts all logic to retrieve a google access token
// getCalendarData(userId): get calendar data for the userId
// getGoogleLocations(userId): get google mybusiness location data

const axios = require('axios');
const database = require('./database');
const authConfig = require('./auth_config.json');
const auth0 = require('./auth0');

// api's defined by this provider
// the actual function is added after it is defined below
exports.apis = {
  getCalendarData: {
    provider: 'google-oauth2',
    func: null,
    arrayKey: 'items',
    itemKey: 'id'
  },
  getGoogleLocations: {
    provider: 'google-oauth2',
    func: null,
  },
};

exports.getGoogleAccessToken = async (userId) => {

  const user = await database.getUserData(userId, 'google-oauth2');

  // if an access token is already cached, and not expired, return it
  if (user && !database.tokenExpired(user)) {
    return user.accessToken;
  }

  // we don't have a token, or it's already expired; need to 
  // obtain a new one from the management API
  try {
    const profile = await auth0.getAuth0Profile(userId);
    if (!profile) {
      console.log('getGoogleAccessToken: getAuth0Profile failed');
      return null;
    }
    const token = await getGoogleTokenFromAuth0Profile(userId, profile);
    if (!token) {
      console.log('getGoogleAccessToken: getGoogleTokenFromAuth0Profile failed');
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

exports.apis.getCalendarData.func = async ([userId]) => {
  try {
    const accessToken = await exports.getGoogleAccessToken(userId);
    if (!accessToken) {
      console.log('getCalendarData: getGoogleAccessToken failed');
      return null;
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

      // response received successfully
    return response.data;
  } catch (error) {
    await error.response;
    console.log(`getCalendarData: caught exception: ${error}`);
    return null;
  }
};

exports.apis.getGoogleLocations.func = async ([userId]) => {
  try {
    const accessToken = await exports.getGoogleAccessToken(userId);
    if (!accessToken) {
      console.log('getGoogleLocations: getGoogleAccessToken failed');
      return null;
    }

    const url = 'https://mybusiness.googleapis.com/v4/googleLocations:search';
    const headers = { 
      'content-type': 'application/json',
      'authorization': `Bearer ${accessToken}`
    };
    const body = {
      resultCount: 10,
      search_query: 'fatburger'
    }

    const response = await axios.post(
      url,
      body,
      {
        headers: headers
      },
    );

    // response received successfully
    console.log(`getGoogleLocations data: ${response.data}`);
    return response.data;
  } catch (error) {
    await error.response;
    console.log(`getGoogleLocations: caught exception: ${error}`);
    return null;
  }
};

// extract google access token from auth0 profile information
// this method will cache the access token, check for expiration, and refresh it if 
// necessary
//   userId is the Auth0 userid (key)
//   user is the struct returned from Auth0 management API
const getGoogleTokenFromAuth0Profile = async (userId, user) => {
  try {
    const userIdentity = user && user.identities && 
                         user.identities.find(i => i.provider === 'google-oauth2');
    if (!userIdentity) {
      return null;
    }

    var accessToken = userIdentity.access_token;
    const refreshToken = userIdentity.refresh_token; // could be empty
    const timestamp = user.updated_at;
    const expiresIn = userIdentity.expires_in;

    // if no access token, no way to proceed
    if (!accessToken) {
      return null;
    }

    const userData = {
      accessToken: accessToken,
      userId: userIdentity.user_id
    };

    // store / overwrite expiration if passed in
    if (timestamp && expiresIn) {
      // compute the expiration timestamp
      const ts = new Date(timestamp);
      ts.setSeconds(ts.getSeconds() + expiresIn);
      userData.expiresAt = ts.getTime();
    }
    
    // store / overwrite refresh token if passed in
    if (refreshToken) {
      userData.refreshToken = refreshToken;
    }
    
    // store / cache the access token 
    const thisUser = await database.setUserData(
      userId,
      'google-oauth2',
      userData);

    // check for token expiration
    if (database.tokenExpired(thisUser)) {
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
    console.log(`getGoogleTokenFromAuth0Profile: caught exception: ${error}`);
    return null;
  }
};

// retrieve an access token from a refresh token, and cache the resulting 
// access token for that userId
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

    const userData = {
      accessToken: accessToken
    };

    // compute the expiration timestamp
    const ts = new Date();
    ts.setSeconds(ts.getSeconds() + data.expires_in);
    userData.expiresAt = ts.getTime();
        
    // store / cache the user data 
    const thisUser = await database.setUserData(
      userId,
      'google-oauth2',
      userData);

    return accessToken;
  } catch (error) {
    await error.response;
    console.log(`getAccessTokenForGoogleRefreshToken: caught exception: ${error}`);
    return null;
  }
};

