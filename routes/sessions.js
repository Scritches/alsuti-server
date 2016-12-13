var _ = require('underscore'),
    express = require('express'),
    shortid = require('shortid'),
    auth = require('./auth'),
    isTrue = require('../truthiness');

var router = express.Router();

router.get('/login', function(req, res) {
  if(req.session.auth()) {
    res.redirect(req.headers.referer || '/');
    return;
  }

  res.render('login', {
    'title': "Log In",
    'returnPath': req.headers.referer || '/'
  });
});

router.post('/login', auth.required);
router.post('/login', function(req, res) {
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
      ]
    }
    else {
      // renew current session
      sessionData = [
        'sessionExpiry', sessionExpiry
      ]
    }

    // store updated session data
    db.hmset(userHash, sessionData, function(err, reply) {
      if(!err) {
        if(req.apiRequest) {
          res.api(false, {
            'sessionUser': req.session.user,
            'sessionKey': sessionKey,
            'sessionExpiry': sessionExpiry
          });
        } else {
          // set cookies
          var cookieOptions = { httpOnly: true };
          if(sessionExpiry != 'never')
            cookieOptions.maxAge = req.app.get('cookieAge');

          res.cookie('sessionUser', req.session.user, cookieOptions);
          res.cookie('sessionKey', sessionKey, cookieOptions);

          // redirect
          res.redirect(req.body.returnPath || '/');
        }
      }
      else {
        if(req.apiRequest) {
          res.api(true, {'message': "Database error."});
        } else {
          res.render('info', {
            'title': "Database Error",
            'message': "Cannot store session data."
          });
        }
      }
    });
  });
});

router.get('/logout', auth.required);
router.get('/logout', function(req, res) {
  var db = req.app.get('database'),
      userHash = 'user:' + req.cookies.sessionUser;

  if(_.has(req.cookies, 'sessionUser') ||
     _.has(req.cookies, 'sessionKey'))
  {
    var options = {
      'expires': new Date(0),
      'httpOnly': true
    }

    res.cookie('sessionUser', '', options);
    res.cookie('sessionKey', '', options);
  }

  db.hdel(userHash, 'sessionKey', 'sessionExpiry', function(err, reply) {
    res.redirect(req.headers.referer || '/');
  });
});

module.exports = router;
