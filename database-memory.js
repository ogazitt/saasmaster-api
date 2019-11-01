// an in-memory implementation of the database API

// initialize the users hash (current storage method)
const users = {};

// get user data by userid 
exports.getUserData = async (userId, connection) => {
  const user = users[userId];
  return user && user[connection];
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

    // store the access token in the users hash
    const user = users[userId] || {};
    const connectionData = user[connection] || {};
    connectionData.accessToken = accessToken;
    connectionData.expiresAt = timestamp;

    // also store / overwrite refresh token only if it was present
    if (refreshToken) {
      connectionData.refreshToken = refreshToken;
    }

    // replace the connection data and store the new user data
    user[connection] = connectionData;
    users[userId] = user;

    // return the refreshed connection data
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

