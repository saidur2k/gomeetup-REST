var mongoose = require('mongoose');
var user_authentication_schema = require('../schemas/user_authentication_schema');

module.exports = mongoose.model('user_authentication', user_authentication_schema);