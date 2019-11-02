// a firestore-based implementation of the database API

const Firestore = require('@google-cloud/firestore');

const db = new Firestore({
  projectId: 'saasmaster',
  keyFilename: './firestore_config.json',
});

var users = db.collection('users');

// set the environment
exports.setEnv = (env) => {
  // the only impact for dev environment is to use a different collection
  if (env === 'dev') {
    users = db.collection('users-dev');
  }
};

// get user data by userid 
exports.getUserData = async (userId, connection) => {
  try {
    const doc = await users.doc(userId).get();
    if (!doc.exists) {
      return null;
    }
    const data = doc.data();

    // if a connection name was passed, return that data, otherwise the entire user struct
    return connection ? 
           data[connection] :
           data;
  } catch (error) {
    console.log(`getUserData: caught exception: ${error}`);
    return null;
  }
};

// store user data by userid
exports.setUserData = async (
    userId,            // userid to store data for
    connection,        // connection key
    accessToken,       // access token
    created,           // timestamp when token was created
    expiresIn,         // expires in (seconds)
    refreshToken) => { // refresh token (may be null)

  try {
    // compute the expiration timestamp
    const timestamp = new Date(created);
    timestamp.setSeconds(timestamp.getSeconds() + expiresIn);

    // get the current user record 
    const doc = await users.doc(userId).get();
    const user = doc.exists ? doc.data() : {};
    const connectionData = user[connection] || {};
    connectionData.accessToken = accessToken;
    connectionData.expiresAt = timestamp.getTime();

    // also store / overwrite refresh token only if it was present
    if (refreshToken) {
      connectionData.refreshToken = refreshToken;
    }

    // store the new connection data for this user
    user[connection] = connectionData;

    // store the modified user
    const u = await users.doc(userId).set(user);

    // return the refreshed user hash
    return connectionData;
  } catch (error) {
    console.log(`setUserData: caught exception: ${error}`);
    return null;
  }
}

exports.tokenExpired = (user) => {
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

