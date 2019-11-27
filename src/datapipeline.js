// data pipeline layer
// 
// exports:
//   createDataPipeline: create pubsub machinery for data pipeine

const database = require('./database');
const providers = require('./providers');
const dataProviders = providers.providers;
const storage = require('./storage');
const pubsub = require('./pubsub');
const scheduler = require('./scheduler');

exports.createDataPipeline = async (env) => {
  try {
    // set up the action name, topic name, subscription name based on env
    const invokeLoad = 'invoke-load';
    const topicName = `${invokeLoad}-${env}`;
    const subName = `${invokeLoad}-sub-${env}`;
    const jobName = `${invokeLoad}-job-${env}`;

    // create or retrieve topic
    const topic = await pubsub.createTopic(topicName);

    // set up handlers
    const handlers = {};
    handlers[invokeLoad] = dataPipelineHandler;

    // create subscription
    await pubsub.createSubscription(topic, subName, handlers)

    // create scheduler job
    await scheduler.createPubSubJob(jobName, topic.name);
      
  } catch (error) {
    console.log(`createDataPipeline: caught exception: ${error}`);
  }
}

// return true if the timestamp is older than 59 minutes ago
const isStale = (timestamp) => {
  // compute the current timestamp and an hour ago
  const now = new Date().getTime();
  const min59 = 59 * 60000;
  return (now - timestamp > min59);
}

// pubsub handler for invoking the data pipeline
const dataPipelineHandler = async (data) => {
  try {
    // compute the current timestamp and an hour ago
    const now = new Date().getTime();
    const hr1 = 60 * 60000;

    // retrieve last data pipeline run timestamp 
    const dataPipelineObject = await database.getUserData(database.systemInfo, database.dataPipelineSection);
    const timestamp = dataPipelineObject && dataPipelineObject[database.lastUpdatedTimestamp] || 
          now - hr1;  // if the timestamp doesn't exist, set it to 1 hour ago
    
    // if the timestamp is older than 59 minutes, invoke the data load pipeline
    if (isStale(timestamp) && !dataPipelineObject.inProgress) {
      console.log('invoking data load pipeline');

      // set a flag indicating data pipeline is "inProgress"
      dataPipelineObject[database.inProgress] = true;
      await database.setUserData(database.systemInfo, database.dataPipelineSection, dataPipelineObject);

      // invoke data pipeline
      await invokeDataPipeline();
    }
  } catch (error) {
    console.log(`dataPipelineHandler: caught exception: ${error}`);
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

          // if the collection isn't stale, skip retrieval
          if (!isStale(invokeInfo.lastRetrieved)) {
            return;
          }

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
              await storage.invokeProviderAndStoreData(userId, provider, collection, params);
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
    dataPipelineObject[database.inProgress] = false;
    await database.setUserData(database.systemInfo, database.dataPipelineSection, dataPipelineObject);
    
  } catch (error) {
    console.log(`invokeDataPipeline: caught exception: ${error}`);
  }
}

