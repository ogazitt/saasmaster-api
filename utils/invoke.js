// publish a message on the 'invoke-load' topic, to cause the app 
// to initiate an invocation of the data load pipeline

const { PubSub } = require('@google-cloud/pubsub');
const pubsub = new PubSub();

const env = process.env.NODE_ENV || 'prod';
console.log('environment:', env);

const action = process.env.ACTION || 'load';
console.log('action:', action)

const topicName = `invoke-${env}`;

// create an 'load' message
const message = JSON.stringify({ 
  action: action
});

const messageBuffer = Buffer.from(message);

const publish = async () => {
  const messageId = await pubsub.topic(topicName).publish(messageBuffer);
  console.log(`Message ${messageId} published.`);
}

publish();