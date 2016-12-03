var _ = require('underscore'),
    bcrypt = require('bcrypt-nodejs');

function requireAuth(req, res, next) {
  var db = req.app.get('database');

  console.log("userauth: " + req.method + " " + req.path);

  // verify user/password and create session
  if(_.has(req.body, 'user') && _.has(req.body, 'password')) {
    var userHash = 'user:' + req.body.user;
    db.hget(userHash, 'password', function(err, pHash) {
      bcrypt.compare(req.body.password, pHash, function(err, result) {
        if(!err && result == true) {
          req.sessionUser = req.body.user;
          next();
        }
        else {
          res.status(401);
          res.render('login', {
            'error': "Invalid user/password."
          });
        }
      });
    });
  }
  // authenticate session
  else if(_.has(req.cookies, 'sessionUser') && _.has(req.cookies, 'sessionKey')) {
    var sessionUser = req.cookies['sessionUser'],
        clientSessionKey = req.cookies['sessionKey'],
        userHash = 'user:' + sessionUser;

    db.hget(userHash, 'sessionKey', function(err, serverSessionKey) {
      if(!err && clientSessionKey == serverSessionKey) {
        db.hget(userHash, 'sessionExpiry', function(err, sessionExpiry) {
          sessionExpiry = parseInt(sessionExpiry);
          if(!err && Date.now() < sessionExpiry) {
            console.log("userauth: session is valid");
            // reset the session's expiry date
            var newExpiry = Date.now() + req.app.get('sessionAge');
            db.hset(userHash, 'sessionExpiry', newExpiry);
            // set session user for other handlers to use
            req.sessionUser = sessionUser;
            next();
          }
          else {
            res.status(401);
            res.render('login', {
              'error': "Session expired."
            });
          }
        })
      }
      else {
        res.status(401);
        res.render('login', {
          'error': "Invalid session key."
        });
      }
    });
  }
  else {
    res.status(401);
    res.render('login', {
      'error': "Authentication required."
    });
  }
}

module.exports = requireAuth;
