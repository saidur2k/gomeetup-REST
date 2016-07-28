var mongoose = require('mongoose');

/**
 * This document contains the permissions for a certain user.
 * The user is identified by his/her ObjectId.
 * The permissions is built as follow:
{
  "events": ["read", "create", "update"],
  "tokens": ["create"]
}
 */
module.exports = new mongoose.Schema({
  permissions: {type: Object, required: true},
});