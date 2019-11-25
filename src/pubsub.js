// set up a subscription on the subscription name passed, invoking handler

const { PubSub } = require('@google-cloud/pubsub');
const pubsub = new PubSub();

// create a subscription on the subscription topic name, with a set 
// of message handlers passed in as a map.
// format of messages:
// {
//   action: 'action name'    // e.g. 'invoke-load'
//   timestamp: 'ts in msecs' // timestamp when message was generated
//   ...                      // message specific fields
// }
exports.createSubscription = (subName, handlers) => {
  const subscriptionName = subName && 'invoke-load-sub';  
  const subscription = pubsub.subscription(subscriptionName);
  
  // message handler
  const messageHandler = message => {
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
        handler(data);
      }
    } catch (error) {
      console.log(`messageHandler: caught exception ${error}`);
    }
  
    // always ack the message
    message.ack();
  };
  
  // listen for new messages
  subscription.on(`message`, messageHandler);
  console.log(`listening on subscription ${subscriptionName}`);
}
