var _ = require('underscore'),
    express = require('express'),
    shortid = require('shortid'),
    requireAuth = require('./userauth');

var router = express.Router();

// login handler. provides a user/token pair to the client.
router.post('/login', requireAuth);
router.post('/login', function(req, res) {
  var db = req.app.get('database');
      userHash = 'user:' + req.body.user,
      sessionKey = shortid.generate(),
      sessionExpiry = Date.now() + req.app.get('sessionAge');

  // store sessionKey in database
  db.hmset(userHash, ['sessionKey', sessionKey, 'sessionExpiry', sessionExpiry],
  function(err, reply) {
    if(!err) {
      var cookieOptions = {
        maxAge: req.app.get('cookieAge'),
        httpOnly: true
      };

      if(req.apiRequest) {
        res.setHeader('Content-Type', 'application/json');
        res.json({
          'sessionUser': req.sessionUser,
          'sessionKey': sessionKey
        });
      }
      else {
        // set session cookies
        res.cookie('sessionUser', req.sessionUser, cookieOptions);
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
        res.setHeader('Content-Type', 'application/json');
        res.json({'error': "Database error"});
      }
      else {
        res.render('info', {
          'title': "Database Error",
          'message': "Cannot store session"
        });
      }
    }
  });
});

// web logout
router.get('/logout', requireAuth);
router.get('/logout', function(req, res) {
  var db = req.app.get('database'),
      userHash = 'user:' + req.cookies.sessionUser;

  if(_.has(req.cookies, 'sessionUser')) {
    var options = {
      'expires': new Date(0),
      'httpOnly': true
    }

    res.cookie("sessionUser", "", options);
    res.cookie("sessionKey", "", options);
  }

  db.hdel(userHash, 'sessionKey', 'sessionExpiry');
  res.redirect(req.headers.referer || '/');
});

router.post('/auth', function(req, res) {
});

// generic api logout
router.post('/deauth', requireAuth);
router.post('/deauth', function(req, res) {
  if(_.has(req.body, 'api') && req.body.api) {
    res.setHeader('Content-Type', 'application/json');

    var db = req.app.get('database'),
        userHash = 'user:' + req.body.user;

    db.hdel(userHash, 'sessionKey', 'sessionExpiry');
    res.json({'success': "Logged out"});
  }
  else {
    res.setHeader('Content-Type', 'application/text');
    res.send("This is only meant for API requests");
  }
});

module.exports = router;
