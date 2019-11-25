// twitter utility functions

// exports:
// getTwitterAccessInfo(userId): abstracts all logic to retrieve a google access token
// getTweets(userId): get tweet data for the userId (note - userid is ignored in favor of access token)

const axios = require('axios');
const database = require('./database');
const authConfig = require('../config/auth_config.json');
const auth0 = require('./auth0');
const oauthSignature = require('oauth-signature');

// api's defined by this provider
exports.apis = {
  getTweets: {
    name: 'getTweets',
    provider: 'twitter',
    arrayKey: null,
    itemKey: 'id_str'
  },
};

// could never get the Twitter client to work :(
// const Twitter = require('twitter');

exports.getTwitterAccessInfo = async (userId) => {

  const user = await database.getUserData(userId, 'twitter');

  // if an access token is already cached, and not expired, return it
  if (user && user.accessToken && user.accessTokenSecret && user.userId) {
    return user;
  }

  // we don't have a token, or it's already expired; need to 
  // obtain a new one from the management API
  try {
    const profile = await auth0.getAuth0Profile(userId);
    if (!profile) {
      console.log('getTwitterAccessInfo: getAuth0Profile failed');
      return null;
    }
    const info = await getTwitterInfoFromAuth0Profile(userId, profile);
    if (!info) {
      console.log('getTwitterAccessInfo: getTwitterInfoFromAuth0Profile failed');
      return null;
    }

    // return the twitter access info
    return info;
  } catch (error) {
    await error.response;
    console.log(`getTwitterAccessInfo: caught exception: ${error}`);
    return null;
  }
};

exports.apis.getTweets.func = async ([userId]) => {
  try {
    const user = await exports.getTwitterAccessInfo(userId);
    if (!user) {
      console.log('getTweets: getTwitterAccessInfo failed');
      return null;
    }

    /* couldn't get the twitter javascript client to work :(
    const twitter = new Twitter({
      consumerKey: authConfig.twitter_consumer_key,
      consumerSecret: authConfig.twitter_consumer_secret,
      access_token_key: user.accessToken,
      access_token_secrets: user.accessTokenSecret});        
      
    const response = await twitter.get('statuses/mentions_timeline', {});
    return response.data;
    */

    const httpMethod = 'GET',
    d = new Date(),
    timestamp = Math.round(d.getTime() / 1000),
    url = 'https://api.twitter.com/1.1/statuses/mentions_timeline.json?count=5',
    parameters = {
        oauth_consumer_key: authConfig.twitter_consumer_key,
        oauth_nonce: 'B1R6tk7SguJ', // BUGBUG: generate new nonce
        oauth_signature_method: 'HMAC-SHA1',
        oauth_timestamp: timestamp,
        oauth_token: user.accessToken,
        oauth_version: '1.0',
        count: '5'
    },
    consumerSecret = authConfig.twitter_consumer_secret,
    tokenSecret = user.accessTokenSecret,
    // generates a RFC 3986 encoded, BASE64 encoded HMAC-SHA1 hash
    encodedSignature = oauthSignature.generate(httpMethod, url, parameters, consumerSecret, tokenSecret),
    // generates a BASE64 encode HMAC-SHA1 hash
    signature = oauthSignature.generate(httpMethod, url, parameters, consumerSecret, tokenSecret,
        { encodeSignature: false});        
        
    // construct authorization header - very order-dependent!
    const headers = { 
      'content-type': 'application/json',
      'authorization': `OAuth oauth_consumer_key="${authConfig.twitter_consumer_key}",oauth_token="${user.accessToken}",oauth_signature_method="HMAC-SHA1",oauth_timestamp="${timestamp}",oauth_nonce="B1R6tk7SguJ",oauth_version="1.0",oauth_signature="${encodedSignature}"`
      // 'authorization': `Bearer ${user}`
     };

    const response = await axios.get(
      url,
      {
        headers: headers
      });

    // do some processing on the results, to remove arrays within arrays
    // the latter breaks the firestore data model
    response.data.forEach(element => {
      if (element.place && element.place.bounding_box) {
        element.place.bounding_box = null;
      }
    });

    // response received successfully
    return response.data;
  } catch (error) {
    await error.response;
    console.log(`getTweets: caught exception: ${error}`);
    return null;
  }
};

// extract twitter access token from auth0 profile information
// this method will cache the userid, access token, and access token secret  
//   userId is the Auth0 userid (key)
//   user is the struct returned from Auth0 management API
const getTwitterInfoFromAuth0Profile = async (userId, user) => {
  try {
    const userIdentity = user && user.identities && 
                         user.identities.find(i => i.provider === 'twitter');
    if (!userIdentity) {
      return null;
    }

    const accessToken = userIdentity.access_token;

    // if no access token, no way to proceed
    if (!accessToken) {
      return null;
    }

    const userData = {
      accessToken: accessToken,
      userId: userIdentity.user_id,
      accessTokenSecret: userIdentity.access_token_secret
    };
    
    // store / cache the user data 
    const mergedUserData = await database.setUserData(
      userId,
      'twitter',
      userData);

    // return the (potentially refreshed) user data
    return mergedUserData;
  } catch (error) {
    await error.response;
    console.log(`getTwitterInfoFromAuth0Profile: caught exception: ${error}`);
    return null;
  }
};

