// scheduler (cron) system based on google cloud scheduler
// exports:
//   createPubSubJob: creates a pub-sub cron job 

const scheduler = require('@google-cloud/scheduler');

// create a pubsub job with the fully-qualified topicname and a default schedule
// default cron schedule: every hour on the hour
exports.createPubSubJob = async (jobName, topicName, schedule = '0 */1 * * *') => {
  const client = new scheduler.CloudSchedulerClient();
  const parent = client.locationPath('saasmaster', 'us-central1');
  const name = `${parent}/jobs/${jobName}`;

  try {
    const jobObject = {
      name: name,
      pubsubTarget: {
        topicName: topicName,
        data: Buffer.from('{ "action": "invoke-load" }')
      },
      schedule: schedule,
      timeZone: 'America/Los_Angeles',
    };

    const request = {
      parent: parent,
      job: jobObject,
    };

    // Use the client to send the job creation request.
    const [job] = await client.createJob(request);
    console.log(`Created job: ${job.name}`);

    return job;
  } catch (error) {
    // check for an error indicating that a topic already exists
    if (error.code === 6) {
      // return the job
      return await client.getJob({ name: name });
    }
    
    console.log(`createPubSubJob: caught exception: ${error}`);
  }
}