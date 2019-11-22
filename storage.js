// import database layer
const database = require('./database');

exports.getLastAccessTime = async (userId, providerName, entity) => {
  try {
    const user = await database.getUserData(userId, providerName);
    if (!user) {
      return null;
    }

    const lastAccessTime = user.lastAccessTimes && user.lastAccessTimes[entity];
    return lastAccessTime;
  } catch (error) {
    console.log(`getLastAccessTime: caught exception: ${error}`);
    return null;
  }
}

exports.setLastAccessTime = async (userId, providerName, entity) => {
  try {
    const userData = await database.getUserData(userId, providerName);
    if (!userData) {
      return null;
    }

    const lastAccessTimes = userData.lastAccessTimes || {};
    lastAccessTimes[entity] = new Date().getTime();
    userData.lastAccessTimes = lastAccessTimes;
    await database.setUserData(userId, providerName, userData);
  } catch (error) {
    console.log(`setLastAccessTime: caught exception: ${error}`);
    return null;
  }
}

exports.getData = async (userId, provider, entity, forceRefresh, ...params) => {
  try {
    const providerName = provider && provider.provider;
    const func = provider && provider.func;
    // basic error checking
    if (!providerName || !func) {
      console.log('getData: failed to validate provider info');
      return null;
    }

    const lastAccessTime = await exports.getLastAccessTime(userId, providerName, entity);
    const now = new Date().getTime();
    const anHourAgo = now - 3600000;
    const collectionName = `${providerName}:${entity}`;

    // if a refresh isn't forced, and the collection is fresh, return it from cache
    if (!forceRefresh && lastAccessTime > anHourAgo) {
      return await database.query(userId, collectionName);
    }

    // need to retrieve data from provider
    const data = await func(...params);
    const array = provider.arrayKey ? data[provider.arrayKey] : data;

    // store the data in the database
    // do not wait for the operation to finish
    database.storeBatch(userId, collectionName, array, provider.itemKey);

    // update the last access time
    await exports.setLastAccessTime(userId, providerName, entity);

    return array;      
  } catch (error) {
    console.log(`getData: caught exception: ${error}`);
    return null;
  }
}