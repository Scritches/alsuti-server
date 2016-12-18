var _ = require('underscore'),
    bcrypt = require('bcrypt-nodejs'),
    sessions = require('./sessions'),
    isTrue = require('../truthiness');

function authRequired(req, res, next) {
  if(req.session.status == 0) {
    next();
  }
  else if(req.method == 'POST' &&
     _.has(req.body, 'user') &&
     _.has(req.body, 'password'))
  {
    var db = req.app.get('database'),
        userHash = 'user:' + req.body.user;

    db.hget(userHash, 'password', function(err, pHash) {
      bcrypt.compare(req.body.password, pHash, function(err, result) {
        if(!err && result) {
          req.session.user = req.body.user;
          req.session.status = 0;
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
  else if(req.session.status == 1) {
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

module.exports.required = authRequired;
