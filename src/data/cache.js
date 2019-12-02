// cache layer for caching entities in the database
// 
// exports:
//   getData: retrieve an entity either from cache, or from data source and cache it
//   storeData: store the entity in the cache

const database = require('./database');
const callProvider = require('../providers/provider');
const sentiment = require('../services/sentiment');

exports.getData = async (userId, provider, entity, params, forceRefresh = false) => {
  try {
    const providerName = provider && provider.provider;
    const entityName = entity || provider.entity;
    // basic error checking
    if (!providerName || !entityName) {
      console.log(`getData: failed to validate provider ${providerName} / entity ${entityName}`);
      return null;
    }

    // get the __invoke_info document
    const invokeInfo = await database.getDocument(userId, entityName, database.invokeInfo) || {};
    const lastRetrieved = invokeInfo && invokeInfo.lastRetrieved;
    const now = new Date().getTime();
    const anHourAgo = now - 3600000;

    // if a refresh isn't forced, and the collection is fresh, return it from cache
    if (!forceRefresh && lastRetrieved > anHourAgo) {
      console.log(`getData: serving ${userId}:${entityName} from cache`);
      const data = await database.query(userId, entityName, invokeInfo);
      if (!data) {
        return null;
      }
      // add any sentiment information to the records to return
      const enrichedData = enrichData(provider, data, invokeInfo);
      return enrichedData;        
    }

    console.log(`getData: retrieving ${userId}:${entityName} from provider`);

    // retrieve data from provider
    const data = await callProvider.callProvider(provider, params);
    if (!data) {
      return null;
    }

    // perform sentiment analysis for new data records, storing results in invokeInfo
    await retrieveSentimentData(provider, data, invokeInfo);

    // store the data (including invokeInfo document), but do NOT await the operation
    exports.storeData(userId, provider, entityName, params, data, invokeInfo);

    // add any sentiment information to the records to return
    const enrichedData = enrichData(provider, data, invokeInfo);
    return enrichedData;      
  } catch (error) {
    console.log(`getData: caught exception: ${error}`);
    return null;
  }
}

exports.storeData = async (userId, provider, entity, params, data, invokeInfo) => {
  try {
    // add invocation information to invokeInfo document
    invokeInfo.provider = provider.provider;
    invokeInfo.name = provider.name;
    invokeInfo.params = params;
    invokeInfo.lastRetrieved = new Date().getTime();

    // store the invocation information as a well-known document (__invoke_info) in the collection
    await database.storeDocument(userId, entity, database.invokeInfo, invokeInfo);

    // shred the data returned into a batch of documents in the collection
    await database.storeBatch(userId, entity, data, provider.itemKey);
  } catch (error) {
    console.log(`storeData: caught exception: ${error}`);
    return null;
  }
}

const retrieveSentimentData = async (provider, data, invokeInfo) => {
  try {
    const sentimentTextField = provider.sentimentTextField;
    const itemKeyField = provider.itemKey;
    if (!sentimentTextField) {
      return;
    }

    // iterate over every result in the dataset
    for (const element of data) {
      // use the key to retrieve the sentiment score, if one is stored
      const id = element[itemKeyField];
      const text = element[sentimentTextField];
      const invokeInfoForElement = invokeInfo[id] || {};
      const sentimentScore = invokeInfoForElement.__sentimentScore;
      if (!sentimentScore) {
        // call the sentiment analysis API
        const score = await sentiment.analyze(text);

        // store the sentiment score returend
        invokeInfoForElement.__sentimentScore = score;
        invokeInfo[id] = invokeInfoForElement;
      }
    }    
  } catch (error) {
    console.log(`retrieveSentimentData: caught exception: ${error}`);
    return null;
  }
}

const enrichData = async (provider, data, invokeInfo) => {
  try {
    const itemKeyField = provider.itemKey;
    // create a combined array with an entry from each document
    const array = data.map(element => {
      const id = element[itemKeyField];

      // combine document data with enriched data in invokeInfo document
      const invokeInfoData = invokeInfo[id];
      return { ...element, ...invokeInfoData };
    });

    // return the array containing the enriched data
    return array;
  } catch (error) {
    console.log(`retrieveSentimentData: caught exception: ${error}`);
    return null;
  }
}