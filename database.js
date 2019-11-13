// some generic database get/set functions for various entities
// 
// setup:
//   setProvider: sets the provider
//   setEnv: set enviroment (dev / prod)
// wrapper methods:
//   getUserData: get user info from provider
//   setUserData: set user info in provider
//   removeConnection: remove connection for user in provider
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
  data) => {             // data to store
  return await provider.setUserData(userId, connection, data)
}

// remove a section for a particular connection
exports.removeConnection = async (
  userId,                // userid to store data for
  connection) => {       // which connection to remove
  return await provider.removeConnection(userId, connection)
}

exports.tokenExpired = (user) => {
  return provider.tokenExpired(user);
}

exports.connections = async (userId) => {
  const connectionList = {
    'google-oauth2': {
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
    const [provider] = userId.split('|');
    const connections = Object.keys(connectionList).map((key) => {
      // connected can be 'base' for base connection, 'linked' for linked connection, or null
      var connected = user[key] ? 'linked' : null;

      // if the connection is the same as the provider of the base userId, note it that way
      if (key === provider) {
        connected = 'base';
      }

      const uid = user[key] && user[key].userId;

      return ({ 
        provider: key, 
        connected: connected,
        image: connectionList[key].image,
        userId: uid
      })
    });

    return connections;
  } catch (error) {
    console.log(`connections: caught exception: ${error}`);
    return {}
  }
}