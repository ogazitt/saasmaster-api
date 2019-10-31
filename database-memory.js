// an in-memory implementation of the database API

// initialize the users hash (current storage method)
const users = {};

// get user data by userid 
exports.getUserData = async (userId) => {
  return users[userId];
};

// store user data by userid
exports.setUserData = async (
    userId,            // userid to store data for
    accessToken,       // access token
    created,           // timestamp when token was created
    expiresIn,         // expires in (seconds)
    refreshToken) => { // refresh token (may be null)

  try {
    // compute the expiration timestamp
    const timestamp = new Date(created);
    timestamp.setSeconds(timestamp.getSeconds() + expiresIn);

    // store the access token in the users hash
    if (!users[userId]) {
      // if an entry doesn't yet exist, create it
      users[userId] = 
      { 
        accessToken: accessToken,
        expiresAt: timestamp
      };
    } else {
      users[userId].accessToken = accessToken;
      users[userId].expiresAt = timestamp;
    }

    // also store / overwrite refresh token only if it was present
    if (refreshToken) {
      // store refresh token (entry in users hash must exist)
      users[userId].refreshToken = refreshToken;
    }

    // return the refreshed user hash
    return users[userId];
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

