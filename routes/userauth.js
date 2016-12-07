var _ = require('underscore'),
    bcrypt = require('bcrypt-nodejs');

function requireAuth(req, res, next) {
  var db = req.app.get('database');

  // verify user/password and create session
  if(req.method == 'POST' &&
     _.has(req.body, 'user') &&
     _.has(req.body, 'password'))
  {
    var userHash = 'user:' + req.body.user;
    db.hget(userHash, 'password', function(err, pHash) {
      bcrypt.compare(req.body.password, pHash, function(err, result) {
        if(!err && result != null) {
          req.sessionUser = req.body.user;
          next();
        }
        else {
          res.status(401);
          if(req.apiRequest) {
            res.setHeader('Content-Type', 'application/json');
            res.json({'error': "Invalid user/password"});
          }
          else {
            res.render('login', {
              'error': "Invalid user/password.",
              'returnPath': req.path
            });
          }
        }
      });
    });
  }
  // authenticate session
  else if(_.has(req.cookies, 'sessionUser') &&
          _.has(req.cookies, 'sessionKey'))
  {
    var sessionUser = req.cookies.sessionUser,
        clientSessionKey = req.cookies.sessionKey,
        userHash = 'user:' + sessionUser;

    db.hget(userHash, 'sessionKey', function(err, serverSessionKey) {
      if(!err && clientSessionKey == serverSessionKey) {
        db.hget(userHash, 'sessionExpiry', function(err, sessionExpiry) {
          if(!err) {
            if(sessionExpiry == 'never') {
              req.sessionUser = sessionUser;
              next();
            }
            else if(Date.now() < parseInt(sessionExpiry)) {
              var newExpiry = Date.now() + req.app.get('sessionAge');
              db.hset(userHash, 'sessionExpiry', newExpiry);
              req.sessionUser = sessionUser;
              next();
            }
            else {
              res.status(401);
              if(req.apiRequest) {
                res.setHeader('Content-Type', 'application/json');
                res.json({'error': "Session expired."});
              }
              else {
                res.render('login', {
                  'error': "Session expired.",
                  'returnPath': req.path != '/logout' ? req.path : '/'
                });
              }
            }
          }
          else {
            if(req.apiRequest) {
              res.setHeader('Content-Type', 'application/json');
              res.json({'error': "Database error."});
            }
            else {
              res.render('info', {
                'title': "Database Error",
                'message': "Cannot get session data.",
                'returnPath': req.path
              });
            }
          }
        })
      }
      else {
        res.status(401);
        if(req.apiRequest) {
          res.setHeader('Content-Type', 'application/json');
          res.json({'error': "Invalid session key."});
        }
        else {
          res.render('login', {
            'error': "Invalid session key.",
            'returnPath': req.path != '/logout' ? req.path : '/'
          });
        }
      }
    });
  }
  else {
    res.status(401);
    if(req.apiRequest) {
      res.setHeader('Content-Type', 'application/json');
      res.json({'error': "Authentication required."});
    }
    else {
      res.render('login', {
        'error': "Authentication required.",
        'returnPath': req.path
      });
    }
  }
}

module.exports = requireAuth;
