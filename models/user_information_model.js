var mongoose = require('mongoose');
var user_information_schema = require('../schemas/user_information_schema');

module.exports = mongoose.model('user_information', user_information_schema);