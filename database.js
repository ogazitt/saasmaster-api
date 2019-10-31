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
const provider = providers['firestore']
//const provider = providers['memory']


// get user data by userid 
exports.getUserData = async (userId) => {
  return await provider.getUserData(userId)
}

// store user data by userid
exports.setUserData = async (
    userId,            // userid to store data for
    accessToken,       // access token
    created,           // timestamp when token was created
    expiresIn,         // expires in (seconds)
    refreshToken) => { // refresh token (may be null)

    return await provider.setUserData(userId, accessToken, created, expiresIn, refreshToken)
}

exports.tokenExpired = (user) => {
  return provider.tokenExpired(user);
}