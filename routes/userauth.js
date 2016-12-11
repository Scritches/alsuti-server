var _ = require('underscore'),
    bcrypt = require('bcrypt-nodejs');

module.exports.required = function(req, res, next) {
  if(req.method == 'POST' &&
     _.has(req.body, 'user') &&
     _.has(req.body, 'password'))
  {
    var db = req.app.get('database'),
        userHash = 'user:' + req.body.user;

    db.hget(userHash, 'password', function(err, pHash) {
      bcrypt.compare(req.body.password, pHash, function(err, result) {
        if(!err && result != null) {
          req.session.user = req.body.user;
          next();
        }
        else {
          res.status(401);
          if(req.apiRequest) {
            res.setHeader('Content-Type', 'application/json');
            res.json({
              'error': true,
              'message': "Invalid user/password"
            });
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
  else if(_.has(req.cookies, 'sessionUser') && _.has(req.cookies, 'sessionKey')) {
    var db = req.app.get('database'),
        sessionUser = req.cookies.sessionUser,
        sessionKey = req.cookies.sessionKey,
        userHash = 'user:' + sessionUser;

    db.hmget(userHash, ['sessionKey', 'sessionExpiry'], function(err, data) {
      if(!err) {
        if(sessionKey == data[0]) {
          if(data[1] == 'never') {
            req.session.user = sessionUser;
            next();
          }
          else {
            var now = Date.now();
            if(now < parseInt(data[1])) {
              var newExpiry = now + req.app.get('sessionAge');
              db.hset(userHash, 'sessionExpiry', newExpiry, function(err, reply) {
                if(!err) {
                  req.session.user = sessionUser;
                  next();
                }
                else {
                  if(req.apiRequest) {
                    res.api(true, {'message': "Database error."});
                  } else {
                    res.render('info', {
                      'title': "Database Error",
                      'message': "Cannot update session data."
                    });
                  }
                }
              });
            }
            else {
              res.status(401);
              if(req.apiRequest) {
                res.api(true, {'message': "Session expired."});
              } else {
                res.render('login', {
                  'error': "Session expired.",
                  'returnPath': req.path != '/logout' ? req.path : '/'
                });
              }
            }
          }
        }
        else {
          res.status(401);
          if(req.apiRequest) {
            res.api(true, {'message': "Invalid session key."});
          } else {
            res.render('login', {
              'error': "Invalid session key.",
              'returnPath': req.path != '/logout' ? req.path : '/'
            });
          }
        }
      }
      else {
        if(req.apiRequest) {
          res.api(true, {'message': "Database error."});
        } else {
          res.render('info', {
            'title': "Database Error",
            'message': "Cannot get session data.",
            'returnPath': req.path
          });
        }
      }
    });
  }
  else {
    res.status(401);
    if(req.apiRequest) {
      res.api(true, "Authentication required.");
      res.api(true, {'message': "Authentication required."});
    } else {
      res.render('login', {
        'error': "Authentication required.",
        'returnPath': req.path
      });
    }
  }
}
