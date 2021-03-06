var dotenv = require('dotenv').config({ silent: true });
var express = require('express');
var mongoose = require('mongoose');
var bodyParser = require('body-parser');
var debug = require('debug')('gomeetup:app');
var app = express();
Promise = require('bluebird');

/**
 * Use bluebird for mongoose promises
 */
mongoose.Promise = Promise;

/**
 * Set testing mode
 */
if (process.env.NODE_ENV == 'testing') {
  app.set('testing', true);
  console.log('====# Testing mode! #====');
}
if (process.env.NODE_ENV == 'development') {
  app.set('development', true);
  console.log('====# DEV mode #====');
}

/**
 * Get JWT settings from environment and store in Express.
 */

app.set('jwt_secret', process.env.APP_TOKEN_SECRET || 'DEBUG');
app.set('jwt_expiration', process.env.APP_TOKEN_TIMEOUT || '1d');

/**
 * Default permissions for a new user.
 * These could also be set when a user confirms their account through email(?)
 */

app.set('default_permissions', {
  events: [
    'read'
  ]
});

/**
 * Connect to MongoDB server
 */
if (app.get('testing') == true){
  mongoose.connect(process.env.DB_TEST);
} else if(app.get('development') == true) {
  mongoose.connect(process.env.DB_DEV);
} else {
  mongoose.connect(process.env.DB_PROD);
}
var db = mongoose.connection;

/**
 * Load all mongoose models
 */
require('./models/load_models').load();

/**
 * Start the server when MongoDB connection is succesfull
 */
db.once('open', function () {
  debug('successful database connection!');

  // parse json body as well as url parameters
  app.use(bodyParser.json());
  app.use(bodyParser.urlencoded({
    extended: true
  }));

  /**
   * The base router.
   * Other routes extend from there
   */
  // Load the base router
  app.use('/api', require('./routes/index_route'));
});

/**
 * Report errors
 */
db.on('error', console.error.bind(console, 'connection error:'));
module.exports = app;