// data access layer for abstracting the retrieval of entities
// 
// exports:
//   getData: retrieve an entity and its enriched data - from cache or from the provider

const database = require('./database');
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
      const enrichedData = mergeMetadataWithData(provider, data, invokeInfo);
      return enrichedData;        
    }

    console.log(`getData: retrieving ${userId}:${entityName} from provider`);

    // retrieve data from provider
    const data = await callProvider(provider, params);
    if (!data) {
      return null;
    }

    // perform sentiment analysis for new data records, storing results in invokeInfo
    await retrieveSentimentMetadata(provider, data, invokeInfo);

    // store the data (including invokeInfo document), but do NOT await the operation
    storeData(userId, provider, entityName, params, data, invokeInfo);

    // merge any metadata information to the records to return
    const enrichedData = mergeMetadataWithData(provider, data, invokeInfo);
    return enrichedData;      
  } catch (error) {
    console.log(`getData: caught exception: ${error}`);
    return null;
  }
}

exports.storeMetadata = async (userId, provider, entity, metadata) => {
  try {
    const providerName = provider && provider.provider;
    const entityName = entity || provider.entity;
    // basic error checking
    if (!providerName || !entityName) {
      console.log(`storeMetadata: failed to validate provider ${providerName} / entity ${entityName}`);
      return null;
    }

    // get the __invoke_info document
    const invokeInfo = await database.getDocument(userId, entityName, database.invokeInfo);
    if (!invokeInfo) {
      console.log(`storeMetadata: could not find invokeInfo doc for ${entity}`);
      return;
    }

    // merge the current data with the new metadata
    const mergedData = deepMerge(invokeInfo, metadata);

    // store the resulting invokeInfo document
    await database.storeDocument(userId, entityName, database.invokeInfo, mergedData);

  } catch (error) {
    console.log(`storeMetadata: caught exception: ${error}`);
    return null;
  }
}

// call the provider to retrieve the entity
const callProvider = async (provider, params) => {
  try {
    const func = provider && provider.func;
    // basic error checking
    if (!func) {
      console.log('callProvider: failed to validate provider function');
      return null;
    }
  
    // retrieve data from provider
    const data = await func(params);
    if (!data) {
      console.log(`callProvider: no data returned from ${provider.provider}:${provider.name}`);
      return null;
    }

    // get array of returned data
    const array = provider.arrayKey ? data[provider.arrayKey] : data;

    // return the data
    return array;
  } catch (error) {
    console.log(`callProvider: caught exception: ${error}`);
    return null;
  }
}

// store the retrieved data along with invocation information in the database
const storeData = async (userId, provider, entity, params, data, invokeInfo) => {
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

// retrieve the sentiment score associated with the data
const retrieveSentimentMetadata = async (provider, data, invokeInfo) => {
  try {
    // determine whether there is a sentiment text field
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
      if (sentimentScore === undefined) {
        // call the sentiment analysis API
        const score = await sentiment.analyze(text);
        console.log(`retrieved sentiment score ${score} for item ${id}`);

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

// enrich the returned dataset with any additional information stored in invokeInfo doc
const mergeMetadataWithData = (provider, data, invokeInfo) => {
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
    console.log(`enrichData: caught exception: ${error}`);
    return null;
  }
}

const deepMerge = (data1, data2) => {
  const newObj = { ...data1 };
  for (const key of Object.keys(data2)) {
    newObj[key] = { ...newObj[key], ...data2[key] };
  }
  return newObj;
}