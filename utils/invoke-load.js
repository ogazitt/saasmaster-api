// publish a message on the 'invoke-load' topic, to cause the app 
// to initiate an invocation of the data load pipeline

const { PubSub } = require('@google-cloud/pubsub');
const pubsub = new PubSub();

const topicName = 'invoke-load';

// create an 'invoke-load' message
const message = JSON.stringify({ 
  action: 'invoke-load',
  timestamp: new Date().getTime()
});

const messageBuffer = Buffer.from(message);

const publish = async () => {
  const messageId = await pubsub.topic(topicName).publish(messageBuffer);
  console.log(`Message ${messageId} published.`);
}

publish();