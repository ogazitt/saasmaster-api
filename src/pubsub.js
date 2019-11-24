// set up a subscription on the 

const { PubSub } = require('@google-cloud/pubsub');
const pubsub = new PubSub();

exports.createSubscription = (subName) => {
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

      // validate the message action
      const action = data.action;
      if (action === 'invoke-load') {
        // ensure the message hasn't timed out 
        // (don't process messages older than 1hr)
        const timestamp = data.timestamp;
        const now = new Date().getTime();
        const anHourAgo = now - 3600000;

        if (timestamp > anHourAgo) {
          // process message
          
          // invoke the data load pipeline
          console.log('invoking data load pipeline');
        }
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
