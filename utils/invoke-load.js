// publish a message on the 'invoke-load' topic, to cause the app 
// to initiate an invocation of the data load pipeline

const { PubSub } = require('@google-cloud/pubsub');
const pubsub = new PubSub();

const env = process.env.NODE_ENV || 'prod';
console.log('environment:', env);

const topicName = `invoke-load-${env}`;

// create an 'invoke-load' message
const message = JSON.stringify({ 
  action: 'invoke-load'
});

const messageBuffer = Buffer.from(message);

const publish = async () => {
  const messageId = await pubsub.topic(topicName).publish(messageBuffer);
  console.log(`Message ${messageId} published.`);
}

publish();