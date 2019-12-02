// data pipeline layer
// 
// exports:
//   createDataPipeline: create pubsub machinery for data pipeine
//   dataPipelineHandler: event handler for invoking the data pipeline

const database = require('./database');
const providers = require('../providers/providers');
const dataProviders = providers.providers;
const dal = require('./dal');
const pubsub = require('../services/pubsub');
const scheduler = require('../services/scheduler');

exports.createDataPipeline = async (env) => {
  try {
    // set up the action name, topic name, subscription name based on env
    const invokeLoad = 'invoke-load';
    const topicName = `${invokeLoad}-${env}`;
    const subName = `${invokeLoad}-sub-${env}`;
    const jobName = `${invokeLoad}-job-${env}`;
    const endpoint = `https://saasmaster-api-rlxsdnkh6a-uc.a.run.app/${invokeLoad}`;
    const serviceAccount = 'cloud-run-pubsub-invoker@saasmaster.iam.gserviceaccount.com';

    // get the data pipeline system info object
    const dataPipelineObject = await database.getUserData(database.systemInfo, database.dataPipelineSection);

    // handle prod environent
    if (env === 'prod') {
      if (dataPipelineObject.topicName !== topicName ||
          dataPipelineObject.subName !== subName ||
          dataPipelineObject.jobName !== jobName) {

        // create or get a reference to the topic
        const topic = await pubsub.createTopic(topicName);
        if (!topic) {
          console.log(`createDataPipeline: could not create or find topic ${topicName}`);
          return;
        }

        dataPipelineObject.topicName = topicName;
    
        // set up a push subscription for the production environment
        await pubsub.createPushSubscription(topic, subName, endpoint, serviceAccount);
        dataPipelineObject.subName = subName;

        // create scheduler job
        await scheduler.createPubSubJob(jobName, topic.name);
        dataPipelineObject.jobName = jobName;
      }
    }

    // handle prod environent
    if (env === 'dev') {
      // create or get a reference to the topic
      const topic = await pubsub.createTopic(topicName);
      if (!topic) {
        console.log(`createDataPipeline: could not create or find topic ${topicName}`);
        return;
      }

      dataPipelineObject.topicName = topicName;

      const handlers = {};
      handlers[invokeLoad] = exports.dataPipelineHandler;

      // set up a pull subscription for the dev environment
      await pubsub.createPullSubscription(topic, subName, handlers);
      dataPipelineObject.subName = subName;

      // create the scheduler job if it doesn't exist yet
      if (dataPipelineObject.jobName !== jobName) {
        // create scheduler job
        await scheduler.createPubSubJob(jobName, topic.name);
        dataPipelineObject.jobName = jobName;
      }
    }

    // store the data pipeline system info object
    await database.setUserData(database.systemInfo, database.dataPipelineSection, dataPipelineObject);

  } catch (error) {
    console.log(`createDataPipeline: caught exception: ${error}`);
  }
}

// pubsub handler for invoking the data pipeline
exports.dataPipelineHandler = async (data) => {
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

    // compute the current timestamp and an hour ago
    const now = new Date().getTime();
    const hr1 = 60 * 60000;
    
    // loop over the users in parallel
    await Promise.all(users.map(async userId => {
      try {
        // retrieve all the collections associated with the user
        const collections = await database.getUserCollections(userId);
        console.log(`user: ${userId} collections: ${collections}`);

        // if no results, nothing to do
        if (!collections || !collections.length) {
          return;
        }

        // retrieve each of the collections in parallel
        await Promise.all(collections.map(async collection => {
          // retrieve the __invoke_info document for the collection
          const invokeInfo = await database.getDocument(userId, collection, database.invokeInfo);

          // validate invocation info
          if (invokeInfo && invokeInfo.provider && invokeInfo.name) {
            const providerName = invokeInfo.provider,
            funcName = invokeInfo.name,
            providerObject = dataProviders[providerName],
            provider = providerObject && providerObject[funcName],
            params = invokeInfo.params;

            // utilize the data access layer's getData mechanism to re-retrieve object
            // force the refresh using the forceRefresh = true flag
            await dal.getData(userId, provider, collection, params, true);
          }
        }));
      } catch (error) {
        console.log(`invokeDataPipeline: user ${userId} caught exception: ${error}`);        
      }
    }));

    // update last updated timestamp with current timestamp
    const dataPipelineObject = {};
    const currentTime = new Date();
    dataPipelineObject[database.lastUpdatedTimestamp] = currentTime.getTime();
    dataPipelineObject[database.inProgress] = false;
    await database.setUserData(database.systemInfo, database.dataPipelineSection, dataPipelineObject);
    console.log(`invokeDataPipeline: completed at ${currentTime.toLocaleTimeString()}`);

  } catch (error) {
    console.log(`invokeDataPipeline: caught exception: ${error}`);
  }
}

// return true if the timestamp is older than 59 minutes ago
const isStale = (timestamp) => {
  // compute the current timestamp and an hour ago
  const now = new Date().getTime();
  const min59 = 59 * 60000;
  return (now - timestamp > min59);
}
