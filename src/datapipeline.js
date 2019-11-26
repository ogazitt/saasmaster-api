// data pipeline layer
// 
// exports:
//   dataPipelineHandler: pubsub handler for invoking the data pipeline

const database = require('./database');
const providers = require('./providers');
const dataProviders = providers.providers;
const storage = require('./storage');

// pubsub handler for invoking the data pipeline
exports.dataPipelineHandler = async (data) => {
  // compute the current timestamp and an hour ago
  const now = new Date().getTime();
  const min59 = 59 * 60000;
  const hr1 = 60 * 60000;

  // retrieve last data pipeline run timestamp 
  const systemInfo = await database.getUserData(database.systemInfo, database.dataPipelineSection);
  const timestamp = systemInfo && systemInfo[database.lastUpdatedTimestamp] || 
        now - hr1;  // if the timestamp doesn't exist, set it to 1 hour ago

  // if the timestamp is older than 59 minutes, invoke the data load pipeline
  if (now - timestamp > min59) {
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
          const invokeInfo = await database.getDocument(userId, collection, database.invokeInfo);

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

    // update last updated timestamp with current timestamp
    const dataPipelineObject = {};
    dataPipelineObject[database.lastUpdatedTimestamp] = new Date().getTime();
    await database.setUserData(database.systemInfo, database.dataPipelineSection, dataPipelineObject);
    
  } catch (error) {
    console.log(`invokeDataPipeline: caught exception: ${error}`);
  }
}

