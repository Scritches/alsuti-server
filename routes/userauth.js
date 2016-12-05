var _ = require('underscore'),
    bcrypt = require('bcrypt-nodejs');

function requireAuth(req, res, next) {
  var db = req.app.get('database');

  // verify user/password and create session
  if(_.has(req.body, 'user') && _.has(req.body, 'password')) {
    var userHash = 'user:' + req.body.user;
    db.hget(userHash, 'password', function(err, pHash) {
      bcrypt.compare(req.body.password, pHash, function(err, result) {
        if(!err && result) {
          req.sessionUser = req.body.user;
          next();
        }
        else {
          res.status(401);
          res.render('login', {
            'error': "Invalid user/password",
            'returnPath': req.path
          });
        }
      });
    });
  }
  // authenticate session
  else if(_.has(req.cookies, 'sessionUser') && _.has(req.cookies, 'sessionKey')) {
    var sessionUser = req.cookies.sessionUser,
        clientSessionKey = req.cookies.sessionKey,
        userHash = 'user:' + sessionUser;

    db.hget(userHash, 'sessionKey', function(err, serverSessionKey) {
      if(!err && clientSessionKey == serverSessionKey) {
        db.hget(userHash, 'sessionExpiry', function(err, sessionExpiry) {
          sessionExpiry = parseInt(sessionExpiry);
          if(!err && Date.now() < sessionExpiry) {
            req.sessionUser = sessionUser;
            // reset the session's expiry date
            var newExpiry = Date.now() + req.app.get('sessionAge');
            db.hset(userHash, 'sessionExpiry', newExpiry);
            // set session user for other handlers to use
            next();
          }
          else {
            res.status(401);
            res.render('login', {
              'error': "Session expired",
              'returnPath': req.path
            });
          }
        })
      }
      else {
        res.status(401);
        res.render('login', {
          'error': "Invalid session key",
          'returnPath': req.path
        });
      }
    });
  }
  else {
    res.status(401);
    res.render('login', {
      'error': "Authentication required",
      'returnPath': req.path
    });
  }
}

module.exports = requireAuth;
