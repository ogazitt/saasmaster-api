// an in-memory implementation of the database API

// initialize the users hash (current storage method)
const users = {};

// get user data by userid 
exports.getUserData = async (userId, connection) => {
  const user = users[userId];
  // if a connection name was passed, return that data, otherwise the entire user struct
  return connection ? 
         user && user[connection] : 
         user;
};

// store user data by userid
exports.setUserData = async (
  userId,            // userid to store data for
  connection,        // connection key
  data) => {         // data to store
  try {
    // store the access token in the users hash
    const user = users[userId] || {};
    const connectionData = user[connection] || {};
    const mergedData = {...connectionData, ...data };

    // store the new connection data for this user
    user[connection] = mergedData;
    users[userId] = user;

    // return the refreshed connection data
    return mergedData;
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

