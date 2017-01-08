var _ = require('underscore')._,
    bcrypt = require('bcrypt-nodejs');
    express = require('express'),
    shortid = require('shortid');

var isTrue = require('./truthiness.js');

// helper functions for handleSession() below

function authorize(req, res, next, userName, password) {
  var db = req.app.get('database'),
      userHash = 'user:' + userName;

  db.hgetall(userHash, function(err, user) {
    if(!err) {
      if(user != null) {
        bcrypt.compare(password, user.password, function(err, result) {
          if(result) {
            req.session.user = userName;
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
        req.session.status = 2;
        next();
      }
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

function cookieAuth(req, res, next) {
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
        req.session.status = 2; // invalid auth
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

function Session(res) {
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
}

// used in app.js for handling sessions globally
function handleSession(req, res, next) {
  req.session = new Session();
  res.locals.session = req.session;

  // api authentication
  if(_.has(req.headers, 'authorization')) {
    var auth = parseAuth(req.headers.authorization);
    if(auth.scheme == 'Basic' && auth.user != null && auth.password != null) {
      authorize(req, res, next, auth.user, auth.password);
    }
    else {
      if(req.apiRequest) {
        res.api(true, {'message': "Invalid authorization header."});
      }
      else {
        res.status(400);
        res.render('info', {
          'error': true,
          'title': "Client Error",
          'message': "Invalid authorization header."
        });
      }
    }
  }
  // login form authorization
  else if(_.has(req.body, 'user') && _.has(req.body, 'password')) {
    authorize(req, res, next, req.body.user, req.body.password);
  }
  // cookie authentication
  else if(_.has(req.cookies, 'sessionUser') && _.has(req.cookies, 'sessionKey')) {
    cookieAuth(req, res, next);
  }
  else {
    next();
  }
}

// used by auth routes and /register route to start sessions
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

        res.redirect(req.body.returnPath || '/private');
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

// convenient middleware for routes requiring authentication
function requireAuth(req, res, next) {
  if(req.session.status == 0) {
    next();
  }
  else if(req.session.status == 1) {
    res.status(401);
    if(req.apiRequest) {
      res.api(true, {'message': "Session expired."});
    } else {
      res.render('login', {
        'error': "Session expired.",
        'returnPath': req.path
      });
    }
  }
  else if(req.session.status == 2) {
    res.status(401);
    if(req.apiRequest) {
      res.api(true, {'message': "Invalid user/password."});
    }
    else {
      res.render('login', {
        'error': "Invalid user/password.",
        'returnPath': req.body.returnPath
      });
    }
  }
  else {
    res.status(401);
    if(req.apiRequest) {
      res.api(true, {'message': "Authentication required."});
    }
    else {
      var env = {
        'error': "Authentication required.",
        'returnPath': req.path
      };

      if(env.returnPath == '/login') {
        env.returnPath = '/private';
      } else {
        env.returnPath = req.headers.referer || '/private';
      }

      res.render('login', env);
    }
  }
}

module.exports = {
  'handleSession': handleSession,
  'startSession': startSession,
  'require': requireAuth
};
