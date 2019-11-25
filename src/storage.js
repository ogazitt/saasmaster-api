// import database layer
const database = require('./database');

exports.getLastAccessTime = async (providerSection, entity) => {
  try {
    const lastAccessTime = 
      providerSection.lastAccessTimes && 
      providerSection.lastAccessTimes[entity];
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

exports.invokeProviderAndStoreData = async (userId, provider, entity, params) => {
  try {
    const func = provider && provider.func;
    const providerName = provider && provider.provider;
    //const collectionName = `${providerName}:${entity}`;
    // basic error checking
    if (!func || !providerName) {
      console.log('getData: failed to validate provider info');
      return null;
    }
  
    // retrieve data from provider
    const data = await func(params);
    const array = provider.arrayKey ? data[provider.arrayKey] : data;

    // create an object that stores the invocation information
    const invokeInfo = {
      provider: provider.provider,
      name: provider.name,
      params: params
    }

    // store the invocation information as a well-known document in the collection
    await database.storeDocument(userId, entity, "__invoke_info", invokeInfo);

    // shred the data returned into a batch of documents in the collection
    await database.storeBatch(userId, entity, array, provider.itemKey);

    // update the last access time
    await exports.setLastAccessTime(userId, providerName, entity);

    // return the data
    return array;
  } catch (error) {
    console.log(`invokeProviderAndStoreData: caught exception: ${error}`);
    return null;
  }
}

exports.getData = async (userId, provider, entity, forceRefresh, params) => {
  try {
    const providerName = provider && provider.provider;
    //const collectionName = `${providerName}:${entity}`;
    // basic error checking
    if (!providerName) {
      console.log('getData: failed to validate provider info');
      return null;
    }

    // get the provider section of the user document
    const providerSection = await database.getUserData(userId, providerName);
    if (!providerSection) {
      return null;
    }

    // get last access time and current time
    const lastAccessTime = await exports.getLastAccessTime(providerSection, entity);
    const now = new Date().getTime();
    const anHourAgo = now - 3600000;

    // if a refresh isn't forced, and the collection is fresh, return it from cache
    if (!forceRefresh && lastAccessTime > anHourAgo) {
      console.log(`getData: serving ${userId}:${entity} from cache`);
      return await database.query(userId, entity);
    }

    // retrieve data from provider, and store it in the cache
    console.log(`getData: retrieving ${userId}:${entity} from provider`);
    const array = await exports.invokeProviderAndStoreData(userId, provider, entity, params);
    return array;      
  } catch (error) {
    console.log(`getData: caught exception: ${error}`);
    return null;
  }
}