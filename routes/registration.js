var bcrypt = require('bcrypt-nodejs'),
    express = require('express'),
    sessions = require('./sessions'),
    isTrue = require('../truthiness');

var router = express.Router();

router.get('/register', function(req, res) {
  if(req.session.validate()) {
    res.redirect('/');
    return;
  }

  var db = req.app.get('database');
  db.hget('settings', 'inviteOnly', function(err, inviteOnly) {
    if(!err) {
      if(isTrue(inviteOnly)) {
        res.render('info', {
          'title': "Registration is invite-only",
          'message': "Sorry about that."
        });
      }
      else {
        res.render('register');
      }
    }
    else {
      res.render('info', {
        'title': "Database Error",
        'message': "Something went wrong."
      });
    }
  });
});

router.get('/register/:code', function(req, res) {
  if(req.session.auth()) {
    res.redirect('/');
  }

  var db = req.app.get('database');
  db.hexists('invites', req.params.code, function(err, validCode) {
    if(!err && validCode) {
      res.render('register', {
        'inviteCode': req.params.code
      });
    }
    else {
      res.render('info', {
        'title': "Error",
        'error': true,
        'message': "Invalid invitation code."
      });
    }
  });
});

router.post('/register', function(req, res) {
  var db = req.app.get('database');
  db.hget('settings', 'inviteOnly', function(err, inviteOnly) {
    if(!err) {
      if(isTrue(inviteOnly)) {
        res.render('info', {
          'title': "Stop it.",
          'message': "No means no."
        });
      }
      else {
        bcrypt.hash(req.body.password, null, null, function(err, pHash) {
          db.hmset('user:' + req.body.user, ['password', pHash], function(err, replies) {
            sessions.start(req, res);
          });
        });
      }
    }
    else {
      res.render('info', {
        'title': "Database Error",
        'message': "Something went wrong."
      });
    }
  });
});

module.exports = router;
