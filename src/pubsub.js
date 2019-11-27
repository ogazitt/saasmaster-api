// set up a subscription on the subscription name passed, invoking handler

const { PubSub } = require('@google-cloud/pubsub');
const pubsub = new PubSub();

exports.createTopic = async (topicName) => {
  try {
    // create the topic
    const [topic] = await pubsub.createTopic(topicName);
    return topic;
  } catch (error) {
    // check for an error indicating that a topic already exists
    if (error.code === 6) {
      // return the topic
      return await pubsub.topic(topicName);
    }
    console.log(`createTopic caught exception: ${error}`);
  }
}

// create a subscription on the subscription topic name, with a set 
// of message handlers passed in as a map.
// format of messages:
// {
//   action: 'action name'    // e.g. 'invoke-load'
//   ...                      // message specific fields
// }
exports.createSubscription = async (topic, subName, handlers) => {
  // create or retrieve the subscription
  let subscription;
  try {
    [subscription] = await pubsub.createSubscription(topic, subName, 
      { ackDeadlineSeconds: 60 });
  } catch (error) {
    // check for an error indicating that a topic already exists
    if (error.code === 6) {
      // use the existing subscription
      subscription = await pubsub.subscription(subName,
        { ackDeadlineSeconds: 60 });
      } else {
      console.log(`createSubscription caught exception: ${error}`);
      return null;
    }
  }
  
  // message handler
  const messageHandler = async (message) => {
    console.log(`Received message ${message.id}:`);
    console.log(`\tData: ${message.data}`);
    console.log(`\tAttributes: ${message.attributes}`);

    try {
      // convert the message data to a JSON string, and parse into a map
      const data = JSON.parse(message.data.toString());

      // retrieve the action and the handler associated with it
      const action = data.action;
      const handler = action && handlers[action];

      // validate the message action
      if (!action || !handler) {
        console.log(`messageHandler: unknown action ${action}`);
      } else {
        // invoke handler
        await handler(data);
      }
    } catch (error) {
      console.log(`messageHandler: caught exception ${error}`);
    }
  
    // always ack the message
    message.ack();
  };
  
  try {
    // listen for new messages
    subscription.on(`message`, messageHandler);
    console.log(`listening on subscription ${subName}`);
  } catch (error) {
    console.log(`createSubscription: caught exception ${error}`);
  }
}
