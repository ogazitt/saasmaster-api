// simple environment management
// 
// exports:
//   getEnv(): gets the current environment (dev | prod)
//   setEnv(): sets the current environment (dev | prod)
//   getConfig(type): gets the config of type 'type' for the current env (dev | prod)
//   getCloudPlatformConfigFile(): gets the GCP config for the current env (dev | prod)
//   getProjectid(): gets the GCP project ID for the current env (dev | prod)

var environment;

exports.auth0 = 'auth0';
exports.google = 'google';
exports.facebook = 'facebook';
exports.twitter = 'twitter';

const configs = {
  auth0: {
    dev: require(`../../config/auth0_config_dev.json`),
    prod: require(`../../config/auth0_config_prod.json`)
  },
  google: {
    dev: require(`../../config/google_auth_config_dev.json`),
    prod: require(`../../config/google_auth_config_prod.json`)
  },
  facebook: {
    dev: require(`../../config/facebook_auth_config_dev.json`),
    prod: require(`../../config/facebook_auth_config_prod.json`)
  },
  twitter: {
    dev: require(`../../config/twitter_auth_config_dev.json`),
    prod: require(`../../config/twitter_auth_config_prod.json`)
  }
};

// get the environment (dev or prod)
exports.getEnv = () => environment;

// set the environment (dev or prod)
exports.setEnv = (env) => {
  environment = env;
}

exports.getConfig = (type) => {
  const config = configs[type][environment];
  return config;
}

// note - keyFilename below assumes a path relative to the app root, NOT the current directory
exports.getCloudPlatformConfigFile = () => {
  const cloudConfigFileName = `./config/cloud_platform_config_${environment}.json`;
  return cloudConfigFileName;
}

exports.getProjectId = () => {
  const projectId = environment === 'dev' ? 'saasmaster' : `saasmaster-${environment}`;
  return projectId;
}


