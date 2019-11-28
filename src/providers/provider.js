// provider layer for calling provider functions
// 
// exports:
//   callProvider: calls a provider to retrieve an entity 

exports.callProvider = async (provider, params) => {
  try {
    const func = provider && provider.func;
    // basic error checking
    if (!func) {
      console.log('callProvider: failed to validate provider function');
      return null;
    }
  
    // retrieve data from provider
    const data = await func(params);
    if (!data) {
      console.log(`callProvider: no data returned from ${provider.provider}:${provider.name}`);
      return null;
    }

    // get array of returned data
    const array = provider.arrayKey ? data[provider.arrayKey] : data;

    // return the data
    return array;
  } catch (error) {
    console.log(`callProvider: caught exception: ${error}`);
    return null;
  }
}
