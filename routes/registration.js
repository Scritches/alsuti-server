var _ = require('underscore'),
    bcrypt = require('bcrypt-nodejs'),
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
  if(req.session.validate()) {
    res.redirect('/');
    return;
  }

  var db = req.app.get('database'),
      iHash = 'invite:' + req.params.code;

  db.get(iHash, function(err, user) {
    if(user != null) {
      res.render('register', {
        'inviteUser': user,
        'inviteCode': req.params.code,
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
  var db = req.app.get('database'),
      m = db.multi();

  m.hget('settings', 'inviteOnly');
  if(_.has(req.body, 'code')) {
    m.get('invite:' + req.body.code);
  }

  m.exec(function(err, data) {
    if(!err) {
      var inviteOnly = isTrue(data[0]);
      if(inviteOnly == false || data[1] != null) {
        bcrypt.hash(req.body.password, null, null, function(err, pHash) {
          var m = db.multi();
          if(data[1] != null) {
            var userHash = 'user:' + data[1];
            m.del('invite:' + data[1] + ':' + req.body.code);
            m.lrem(userHash + ':invites', 1, req.body.code);
          }
          m.hmset('user:' + req.body.user, ['password', pHash]);
          m.exec(function(err, replies) {
            sessions.start(req, res);
          });
        });
      }
      else {
        res.render('info', {
          'title': "LOL",
          'message': "No."
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
