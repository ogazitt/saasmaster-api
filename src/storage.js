// storage layer for caching entities in the database
// exports:
//   getData: retrieve an entity via a provider, either from cache or data source
//   invokeProviderAndStoreData: retrieve an entity from data source and cache it

const database = require('./database');

exports.getData = async (userId, provider, entity, params, forceRefresh = false) => {
  try {
    const providerName = provider && provider.provider;
    const entityName = entity || provider.entityName;
    // basic error checking
    if (!providerName || !entityName) {
      console.log(`getData: failed to validate provider ${providerName} / entity ${entityName}`);
      return null;
    }

    // get the __invoke_info document
    const invokeInfo = await database.getDocument(userId, entity, database.invokeInfo);
    const lastRetrieved = invokeInfo.lastRetrieved;
    const now = new Date().getTime();
    const anHourAgo = now - 3600000;

    // if a refresh isn't forced, and the collection is fresh, return it from cache
    if (!forceRefresh && lastRetrieved > anHourAgo) {
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

exports.invokeProviderAndStoreData = async (userId, provider, entity, params) => {
  try {
    const func = provider && provider.func;
    const providerName = provider && provider.provider;
    // basic error checking
    if (!func || !providerName) {
      console.log('getData: failed to validate provider info');
      return null;
    }
  
    // retrieve data from provider
    const data = await func(params);
    if (data == null) {
      console.log(`invokeProviderAndStoreData: no data returned from ${provider.provider}:${provider.name}`);
      return null;
    }

    // get array of returned data
    const array = provider.arrayKey ? data[provider.arrayKey] : data;

    // create an object that stores the invocation information
    const invokeInfo = {
      provider: provider.provider,
      name: provider.name,
      params: params,
      lastRetrieved: new Date().getTime()
    }

    // store the invocation information as a well-known document (__invoke_info) in the collection
    await database.storeDocument(userId, entity, database.invokeInfo, invokeInfo);

    // shred the data returned into a batch of documents in the collection
    await database.storeBatch(userId, entity, array, provider.itemKey);

    // return the data
    return array;
  } catch (error) {
    console.log(`invokeProviderAndStoreData: caught exception: ${error}`);
    return null;
  }
}