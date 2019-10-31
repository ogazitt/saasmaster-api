// a firestore-based implementation of the database API

const Firestore = require('@google-cloud/firestore');

const db = new Firestore({
  projectId: 'saasmaster',
  keyFilename: './firestore_config.json',
});

const users = db.collection('users');

// get user data by userid 
exports.getUserData = async (userId) => {
  try {
    const doc = await users.doc(userId).get();
    if (!doc.exists) {
      return null;
    }
    const data = doc.data();
    return data;
  } catch (error) {
    console.log(`getUserData: caught exception: ${error}`);
    return null;
  }
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

    // get the current user record and copy its fields
    const user = await exports.getUserData(userId) || {};
    user.accessToken = accessToken;
    user.expiresAt = timestamp.getTime();

    // also store / overwrite refresh token only if it was present
    if (refreshToken) {
      user.refreshToken = refreshToken;
    }

    // store the modified user
    const u = await users.doc(userId).set(user);

    // return the refreshed user hash
    return user;
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

