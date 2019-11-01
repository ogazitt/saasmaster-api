// some generic database get/set functions for various entities

// import providers
const firestore = require('./database-firestore')
const memory = require('./database-memory')

// define providers hash
const providers = {
  firestore: firestore,
  memory: memory
}

// set the provider
var provider = providers['firestore']

// set the provider to use for persistence (default to firestore)
exports.setProvider = (prov = 'firestore') => {
  provider = providers[prov]
}

// set the environment (dev or prod)
exports.setEnv = (env = 'prod') => {
  // ensure there is a setEnv method before calling it
  provider.setEnv && provider.setEnv(env)
}

// get user data by userid 
exports.getUserData = async (userId, connection = 'google') => {
  return await provider.getUserData(userId, connection)
}

// store user data by userid
exports.setUserData = async (
    userId,                // userid to store data for
    connection = 'google', // which connection to use
    accessToken,           // access token
    created,               // timestamp when token was created
    expiresIn,             // expires in (seconds)
    refreshToken) => {     // refresh token (may be null)

    return await provider.setUserData(userId, connection, accessToken, created, expiresIn, refreshToken)
}

exports.tokenExpired = (user) => {
  return provider.tokenExpired(user);
}