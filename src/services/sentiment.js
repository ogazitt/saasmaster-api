// sentiment analysis using google cloud API
// 
// exports:
//   analyze(text): returns the sentiment (scale: [-0.5,0.5]) of a block of text

const language = require('@google-cloud/language');
const client = new language.LanguageServiceClient({
  projectId: 'saasmaster',
  keyFilename: './config/firestore_config.json',
});

exports.analyze = async (text) => {
  const document = {
    content: text,
//  gcsContentUri: `gs://${bucketName}/${fileName}`,
    type: 'PLAIN_TEXT',
  };

  try {
    const [result] = await client.analyzeSentiment({document});
    const sentiment = result.documentSentiment;
    return sentiment.score;
  } catch (error) {
    console.log(`analyze: caught  exception: ${error}`);
  }
}
