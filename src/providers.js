// import providers
const google = require('./google');
const facebook = require('./facebook');
const twitter = require('./twitter');

exports.providers = {
  'google-oauth2': google.apis,
  'facebook': facebook.apis,
  'twitter': twitter.apis
}