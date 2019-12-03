![SaaSMaster](https://github.com/ogazitt/saasmaster/blob/master/public/SaaSMaster-logo-220.png)
# SaaSMaster-API
## Master your online reputation

This repository contains the API for the SaaSMaster single-page applciation.  

SaaSMaster-API is utilizes the express web server.

## Available scripts

### `npm start` (or `npm run start:dev`)

Runs the backend with NODE_ENV=dev, which invokes the dev environment.  
This will append "-dev" to the Firebase collection (`users-dev`), the pubsub topic (`invoke-load-dev`), etc.

The pub-sub subscription will run in pull mode.

The express webserver will default to listening on port 8080.  Override with PORT=xxxx variable.

### `npm run start:prod`

Runs the backend with NODE_ENV=prod, which invokes the production environment.
This will choose the main Firebase collection (`users`), and append "-prod" to various resources such as 
the pubsub topic (`invoke-load-prod`), etc.  

The pub-sub subscription will run in push mode, calling the /invoke-load API.

The express webserver will default to listening on port 8080.  Override with PORT=xxxx variable.

### `npm run build-spa` and `npm run copy`

These will build the production (minified) version of the [SaaSMaster](https://github.com/ogazitt/saasmaster) front-end, 
and copy the files into the `build` subdirectory.  It assumes that the saasmaster project is in a peer directory to 
the saasmaster-api project.

### `npm run build` and `npm run deploy`

These will build the Docker container for the API (including the SPA) on Google Cloud Build, and deploy it to 
Google Cloud Run.

### `npm run push` 

This combines the `build-spa`, `copy`, `build`, and `deploy` operations to automate the deployment of the current
source code with one command.

## Directory structure

The app is bootstrapped out of `server.js`, which pulls in all other source dependencies out of the `src` directory.

### `config`

Contains all the config for the project.  These files aren't committed to source control since they contain secrets.
The API expects an `auth_config.json` file for application keys and secret keys for Auth0, Google, Facebook, Twitter, and a 
`firebase_config.json` file for the Google Cloud Platform service account used with this application.

### `scripts`

Contains scripts to build and deploy the app to GCP, as well as to set up the IAM rules for the app.

### `src`

#### `data`

Contains the data access layer, database abstraction layer, and data pipeline

#### `providers`

Contains the provider implementations for the supported social media accounts.  `providers.js` pulls these all together and 
consumers can import all providers by importing `providers.js`.

#### `services`

Contains wrappers around all of the services used: Auth0, Facebook, Google, Twitter, 
and GCP (pubsub, scheduler, sentiment servcies).

### `utils`

Contains various utilities.

