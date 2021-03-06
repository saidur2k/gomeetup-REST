/**
 * api.authentication 
 */

// Requirements
var basicAuth = require('basic-auth');
var debug = require('debug')('gomeetup:authentication');
var error = require('debug')('gomeetup:internal_errors')
var uuid = require('uuid');
var jwt = require('jsonwebtoken');
var mongoose = require('mongoose');
var user_information_model = mongoose.model('user_information');
var user_authentication_model = mongoose.model('user_authentication');
var revoked_jwt_model = mongoose.model('revoked_jwt');
// Exceptions
var InvalidRequestException = require('../exceptions/InvalidRequestException');
var UnauthorizedRequestException = require('../exceptions/UnauthorizedRequestException');
var ForbiddenRequestException = require('../exceptions/ForbiddenRequestException');
var ConflictRequestException = require('../exceptions/ConflictRequestException');


module.exports = {};

/**
 * GET authenticates a user and creates a jwt with 100% permissions
 * URL: /api/authentication/user
 * JWT REQUIRED: no
 * PERMISSIONS: none
 * HEADER: BASIC AUTH required
 * BODY: none
 */
module.exports.authenticate_user = (req, res) => {
  var user = basicAuth(req);
  if (!user || !user.name || !user.pass) {
    res.status(400);
    return res.send({ error: 'BASIC Authorization missing'});
  }
  user_authentication_model.findOne({ username: user.name }).populate('user').then((user_auth) => {
    // Check if the user exists and password is correct (this if check is a bit double/redundant)
    if (!user_auth || user.pass !== user_auth.password) {
      throw new UnauthorizedRequestException('Failed to authorize user');
    }
    if(!user_auth.user) {
      throw new Error('No user information associated with this user');
    }
    // Create JWT payload
    var payload = {
      uuid: uuid.v4(),
      user_id: user_auth.id,
      permissions: user_auth.user.permissions
    };
    // Sign the token with the payload
    var token = jwt.sign(payload, req.app.get('jwt_secret'), {
      expiresIn: req.app.get('jwt_expiration')
    });
    res.send({token});
  }).catch(mongoose.Error.ValidationError, e => {
    res.status(400).send({ error: e.message });
  }).catch(UnauthorizedRequestException, e => {
    res.status(401);
    res.set('WWW-Authenticate', 'Basic realm="Authentication required"');
    res.send({ error: e.message });
  }).catch(e => {
    error(e);
    res.status(500).send({ error: e.message, error_type: e.name });
  });
};

/**
 * POST creates a new user with the default permissions
 * URL: /api/authentication/user
 * JWT REQUIRED: no
 * PERMISSIONS: none
 * BODY:
 * {
 *  username: string,
 *  password: string,
 *  first_name: string,
 *  last_name: string,
 *  email: string 
 * }
 */
module.exports.create_user = (req, res) => {
  // Create an unique ObjectId for new_user_information
  // this way new_user_authentication can already make a reference
  user_information_id = mongoose.Types.ObjectId();
  // Create both models assume everything is good.
  new_user_information = new user_information_model({
    _id: user_information_id,
    first_name: req.body.first_name,
    last_name: req.body.last_name,
    email: req.body.email,
    permissions: req.app.get('default_permissions')
  });
  new_user_authentication = new user_authentication_model({
    username: req.body.username,
    password: req.body.password,
    user: user_information_id
  });

  // Things we have to do
  Promise.all([
    user_information_model.findOne({ email: req.body.email }),
    user_authentication_model.findOne({ username: req.body.username })
  ]).spread((user_information_result, user_authentication_result) => {
    // Check if username or email already exist.
    if (user_information_result) {
      throw new ConflictRequestException('Duplicate email adress');
    }
    if (user_authentication_result) {
      throw new ConflictRequestException('Duplicate username');
    }
    // Now save both models to database
    return Promise.all([
      new_user_information.save(),
      new_user_authentication.save()
    ]);
  }).spread((created_user_information, created_user_authentication) => {
    // Succesfully created the user.
    res.status(200).send({ message: 'User created'});
  }).catch(ConflictRequestException, e => {
    // Try to remove both entries, we don't remains in our DB if inserting failed!
    new_user_information.remove();
    new_user_authentication.remove();
    res.status(409).send({ error: e.message });
  }).catch(e => {
    error(e);
    // Try to remove both entries, we don't remains in our DB if inserting failed!
    new_user_information.remove();
    new_user_authentication.remove();
    res.status(500).send({ error: e.message, error_type: e.name });
  });
}

/**
 * POST revokes a jwt
 * URL: /api/authentication/jwt/revoke/:jwt_uuid
 * JWT REQUIRED: yes
 * PERMISSIONS: 'jwt:revoke'
 * BODY: 
 * {
 *  reason: string, optional
 * }
 */
module.exports.jwt_revoke = (req, res) => {
  var revoked_jwt = new revoked_jwt_model({
    jwt_uuid: req.params.jwt_uuid,
    reason: req.body.reason,
    expires_at: new Date(Date.now() + req.app.get('jwt_expiration') * 1000) // HAS to be expired after this time
  });
  revoked_jwt.save().then(result => {
    res.status(200).send(result);
  }).catch(InvalidRequestException, e => {
    res.status(400).send({ error: e.message });
  }).catch(e => {
    error(e);
    res.status(500).send({ error: e.message, error_type: e.name });
  });
};