// user profile management

// exports:
//   getProfile: retrieve profile information for a userId
//   storeProfile: store profile information for a userId

const database = require('../data/database');
const dbconstants = require('../data/database-constants');

exports.notifyEmail = 'notifyEmail';
exports.notifySMS = 'notifySMS';
exports.negativeReviews = 'negativeReviews';
exports.allReviews = 'all';

// retrieve all metadata for all data entities 
exports.getProfile = async (userId) => {
  try {
    const profile = await database.getUserData(userId, dbconstants.profile);
    return profile;
  } catch (error) {
    console.log(`getProfile: caught exception: ${error}`);
    return null;
  }
}

// store metadata for a particular data entity
exports.storeProfile = async (userId, profile) => {
  try {
    await database.setUserData(userId, dbconstants.profile, profile);
  } catch (error) {
    console.log(`storeProfile: caught exception: ${error}`);
  }
}