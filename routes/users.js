var _ = require('underscore'),
    express = require('express'),
    shortid = require('shortid'),
    auth = require('./userauth');

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
      userHash = 'user:' + req.body.user,
      sessionKey = shortid.generate();

  var sessionExpiry;
  if(_.has(req.body, 'noExpiry') && req.body.noExpiry) {
    sessionExpiry = 'never';
  } else {
    sessionExpiry = Date.now() + req.app.get('sessionAge');
  }

  var sessionData = {
    'sessionKey': sessionKey,
    'sessionExpiry': sessionExpiry
  };

  // store sessionKey in database
  db.hmset(userHash, sessionData, function(err, reply) {
    if(!err) {
      var cookieOptions = {
        httpOnly: true
      };

      if(req.apiRequest) {
        res.api(false, {
          'sessionUser': req.session.user,
          'sessionKey': sessionKey
        });
      } else {
        if(sessionExpiry != 'never')
          cookieOptions.maxAge = req.app.get('cookieAge');

        // set session cookies
        res.cookie('sessionUser', req.session.user, cookieOptions);
        res.cookie('sessionKey', sessionKey, cookieOptions);

        // redirect
        var returnPath;
        if(_.has(req.body, 'returnPath')) {
          returnPath = req.body.returnPath;
        } else {
          returnPath = '/';
        }

        res.redirect(returnPath);
      }
    }
    else {
      if(req.apiRequest) {
        res.api(true, "Database error.");
      } else {
        res.render('info', {
          'title': "Database Error",
          'message': "Cannot store session data."
        });
      }
    }
  });
});

// web logout
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

  db.hdel(userHash, 'sessionKey', 'sessionExpiry');
  res.redirect(req.headers.referer || '/');
});

module.exports = router;
