// google utility functions

// exports:
// getGoogleAccessToken(userId): abstracts all logic to retrieve a google access token
// getCalendarData(userId): get calendar data for the userId
// getGoogleLocations(userId): get google mybusiness location data

const axios = require('axios');
const database = require('./database');
const authConfig = require('./auth_config.json');

exports.getGoogleAccessToken = async (userId) => {

  const user = database.getUserData(userId);

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

exports.getCalendarData = async (userId) => {
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

exports.getGoogleLocations = async (userId) => {
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
    const thisUser = database.setUserData(
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
    database.setUserData(userId, accessToken, Date.now(), data.expires_in, null);

    return accessToken;
  } catch (error) {
    await error.response;
    console.log(`getAccessTokenForGoogleRefreshToken: caught exception: ${error}`);
    return null;
  }
};

