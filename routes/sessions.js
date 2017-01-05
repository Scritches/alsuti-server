var _ = require('underscore'),
    bcrypt = require('bcrypt-nodejs'),
    express = require('express'),
    shortid = require('shortid'),
    auth = require('./auth'),
    isTrue = require('../truthiness');

function Session(req, res) {
  this.user = null;
  this.admin = false;
  this.status = -1;
  this.validate = function(user) {
    if(typeof user !== 'undefined') {
      return this.user == user && this.status == 0;
    } else {
      return this.status == 0;
    }
  };

  res.locals.session = this;
}

function parseAuth(str) {
  var auth = { 'user': null, 'password': null },
      parts = str.split(" ");

  auth.scheme = parts[0];
  if(auth.scheme != 'Basic')
    return auth;

  str = new Buffer(parts[1], 'base64').toString('utf8');

  var index = str.indexOf(':');
  auth.user = str.substr(0, index);
  auth.password = str.substr(index + 1);

  return auth;
}

function sessionHandler(req, res, next) {
  req.session = new Session(req, res);

  if(_.has(req.headers, 'authorization')) {
    var auth = parseAuth(req.headers.authorization);
    if(auth.scheme == 'Basic' && auth.user != null && auth.password != null) {
      var db = req.app.get('database'),
          userHash = 'user:' + auth.user;

      db.hgetall(userHash, function(err, user) {
        if(!err) {
          bcrypt.compare(auth.password, user.password, function(err, result) {
            if(!err && result) {
              req.session.user = auth.user;
              req.session.admin = isTrue(user.admin);
              req.session.status = 0;
            }
            else {
              req.session.status = 2;
            }

            next();
          });
        }
        else {
          res.status(401);
          if(req.apiRequest) {
            res.api(true, {'message': "Database error."});
          }
          else {
            res.render('info', {
              'error': true,
              'title': "Database Error",
              'error': "Something went wrong."
            });
          }
        }
      });
    }
    else {
      if(req.apiRequest) {
        res.api(true, {'message': "Invalid authorization header."});
      }
      else {
        res.render('info', {
          'error': true,
          'title': "Client Error",
          'message': "Invalid authorization header."
        });
      }
    }
  }
  else if(_.has(req.cookies, 'sessionUser') && _.has(req.cookies, 'sessionKey')) {
    var db = req.app.get('database'),
        userHash = 'user:' + req.cookies.sessionUser;

    db.hgetall(userHash, function(err, user) {
      if(!err) {
        if(user != null && req.cookies.sessionKey == user.sessionKey) {
          req.session.user = req.cookies.sessionUser;
          req.session.admin = isTrue(user.admin);

          if(user.sessionExpiry == 'never') {
            req.session.status = 0;
          }
          else if(Date.now() < parseInt(user.sessionExpiry)) {
            db.hset(userHash, 'sessionExpiry', Date.now() + req.app.get('sessionAge'));
            req.session.status = 0;
          }
          else {
            req.session.status = 1; // session expired
          }
        }
        else {
          req.session.status = 2; // invalid auth info
        }

        next();
      }
      else {
        res.status(401);
        if(req.apiRequest) {
          res.api(true, {'message': "Database error."});
        }
        else {
          res.render('info', {
            'error': true,
            'title': "Database Error",
            'error': "Something went wrong."
          });
        }
      }
    });
  }
  else {
    next();
  }
}

function startSession(req, res) {
  var db = req.app.get('database');
      userHash = 'user:' + req.body.user;

  db.hget(userHash, 'sessionKey', function(err, sessionKey) {
    var sessionExpiry,
        sessionData;

    if(_.has(req.body, 'noExpiry') && isTrue(req.body.noExpiry)) {
      sessionExpiry = 'never';
    } else {
      sessionExpiry = Date.now() + req.app.get('sessionAge');
    }

    if(sessionKey == null) {
      // create new session
      sessionKey = shortid.generate();
      sessionData = [
        'sessionKey', sessionKey,
        'sessionExpiry', sessionExpiry
      ];
    }
    else {
      // renew current session
      sessionData = [
        'sessionExpiry', sessionExpiry
      ];
    }

    // store updated session data
    db.hmset(userHash, sessionData, function(err, reply) {
      if(!err) {
        // set cookies
        var cookieOptions = { httpOnly: true };
        if(sessionExpiry == 'never') {
          cookieOptions.maxAge = req.app.get('maxCookieAge');
        } else {
          cookieOptions.maxAge = req.app.get('cookieAge');
        }

        res.cookie('sessionUser', req.body.user, cookieOptions);
        res.cookie('sessionKey', sessionKey, cookieOptions);

        res.redirect(req.body.returnPath || '/public');
      }
      else {
        if(req.apiRequest) {
          res.api(true, {'message': "Database error."});
        } else {
          res.render('info', {
            'title': "Database Error",
            'message': "Something went wrong."
          });
        }
      }
    });
  });
}

var router = express.Router();

router.get('/login', function(req, res) {
  var returnPath = req.headers.referer || '/private';
  if(req.session.validate()) {
    res.redirect(returnPath);
  } else {
    res.render('login', {
      'title': "Log In",
      'returnPath': returnPath
    });
  }
});

router.post('/login', auth.required);
router.post('/login', startSession);

router.get('/logout', function(req, res) {
  var returnPath = req.headers.referer || '/public';

  if(req.session.validate() == false) {
    res.redirect(returnPath);
    return;
  }

  var db = req.app.get('database'),
      userHash = 'user:' + req.session.user;

  var cookieOptions = {
    'expires': new Date(0), // makes the cookies expire immediately
    'httpOnly': true
  }

  res.cookie('sessionUser', '', cookieOptions);
  res.cookie('sessionKey', '', cookieOptions);

  db.hdel(userHash, ['sessionKey', 'sessionExpiry'], function(err, reply) {
    res.redirect(returnPath);
  });
});

module.exports = {
  'handler': sessionHandler,
  'router': router,
  'start': startSession,
};
