// some generic database get/set functions for various entities
// 
// setup:
//   setProvider: sets the provider
//   setEnv: set enviroment (dev / prod)
// wrapper methods:
//   getUserData: get user info from provider
//   setUserData: set user info in provider
//   tokenExpired: check whether access token expired
//   connections: return user connections

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
exports.getUserData = async (userId, connection) => {
  return await provider.getUserData(userId, connection)
}

// store user data by userid
exports.setUserData = async (
    userId,                // userid to store data for
    connection = 'google', // which connection to use
    data) => {              // data to store
    return await provider.setUserData(userId, connection, data)
}

exports.tokenExpired = (user) => {
  return provider.tokenExpired(user);
}

exports.connections = async (userId) => {
  const connectionList = {
    google: {
      image: 'google-logo.png'
    },
    facebook: {
      image: 'facebook-logo.png'
    },
    instagram: {
      image: 'instagram-logo.png'
    }
  };

  try {
    const user = await exports.getUserData(userId) || {};
    const connections = Object.keys(connectionList).map((key) => {
      const connected = user[key] ? true : false;
      return ({ 
        key: key, 
        connected: connected,
        image: connectionList[key].image
      })
    });

    return connections;
  } catch (error) {
    console.log(`connections: caught exception: ${error}`);
    return {}
  }
}