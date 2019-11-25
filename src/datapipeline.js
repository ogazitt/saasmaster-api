// data pipeline layer
// 
// exports:
//   dataPipelineHandler: pubsub handler for invoking the data pipeline

const database = require('./database');
const providers = require('./providers');
const dataProviders = providers.providers;
const storage = require('./storage');

// pubsub handler for invoking the data pipeline
exports.dataPipelineHandler = (data) => {
  // ensure the message hasn't timed out 
  // (don't process messages older than 1hr)
  const timestamp = data.timestamp;
  const now = new Date().getTime();
  const anHourAgo = now - 3600000;

  if (timestamp > anHourAgo) {
    // invoke the data load pipeline
    console.log('invoking data load pipeline');
    invokeDataPipeline();
  }
}

const invokeDataPipeline = async () => {
  try {
    // get all the users in the database
    const users = await database.getAllUsers();

    // loop over the users asynchronously
    users.forEach(async userId => {
      try {
        // retrieve all the collections associated with the user
        const collections = await database.getUserCollections(userId);
        console.log(`user: ${userId} collections: ${collections}`);

        // loop over each of the collections, and re-retrieve them
        collections && collections.forEach(async collection => {
          // retrieve the __invoke_info document for the collection
          const invokeInfo = await database.getDocument(userId, collection, '__invoke_info');

          // validate invocation info
          if (invokeInfo && invokeInfo.provider && invokeInfo.name) {
            const providerName = invokeInfo.provider,
            funcName = invokeInfo.name,
            providerObject = dataProviders[providerName],
            provider = providerObject && providerObject[funcName],
            params = invokeInfo.params;

            // validate more invocation info
            if (userId && provider && collection && params) {
              // invoke async function without an await
              storage.invokeProviderAndStoreData(userId, provider, collection, params);
            }
          }
        });
      } catch (error) {
        console.log(`invokeDataPipeline: user ${userId} caught exception: ${error}`);        
      }
    });
  } catch (error) {
    console.log(`invokeDataPipeline: caught exception: ${error}`);
  }
}

