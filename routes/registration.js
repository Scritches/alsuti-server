var _ = require('underscore'),
    bcrypt = require('bcrypt-nodejs'),
    express = require('express'),
    shortid = require('shortid'),
    auth = require('./auth'),
    sessions = require('./sessions'),
    isTrue = require('../truthiness');

var router = express.Router();

router.get('/register/:code', function(req, res) {
  if(req.session.validate()) {
    res.redirect('/private');
    return;
  }

  var db = req.app.get('database'),
      m = db.multi(),
      iHash = 'invite:' + req.params.code;

  db.hgetall(iHash, function(err, invite) {
    if(!err && invite != null) {
      var env = {
        'sender': invite.sender,
        'code': req.params.code,
        'user': "",
      };

      if(_.has(req.query, 'user')) {
        env.user = req.query.user;
      }

      res.render('register', env);
    }
    else {
      res.render('info', {
        'title': "Error",
        'error': true,
        'message': "Invalid invite code.",
      });
    }
  });
});

router.post('/register', function(req, res) {
  if(_.has(req.body, 'user') == false ||
     _.has(req.body, 'password') == false ||
     _.has(req.body, 'confirmPassword') == false ||
     _.has(req.body, 'code') == false)
  {
    res.render('info', {
      'title': "Client Error",
      'message': "Invalid request."
    });
    return;
  }

  var iHash = 'invite:' + req.body.code,
      db = req.app.get('database');

  db.hgetall(iHash, function(err, invite) {
    if(!err) {
      if(invite != null) {
        var userHash = 'user:' + req.body.user;
        db.exists(userHash, function(err, userExists) {
          if(userExists == false) {
            if(req.body.password == req.body.confirmPassword) {
              // create password hash for account
              bcrypt.hash(req.body.password, null, null, function(err, pHash) {
                var m = db.multi(),
                    senderHash = 'user:' + invite.sender;

                m.lrem(senderHash + ':invites', 1, req.body.code);
                m.del(iHash);

                // create user hashmap
                m.hmset(userHash, [
                  'admin', false,
                  'inviteQuota', 20,
                  'password', pHash
                ]);

                m.exec(function(err, replies) {
                  sessions.start(req, res);
                });
              });
            }
            else {
              if(req.apiRequest) {
                res.json(true, {
                  'message': "Passwords do not match."
                });
              }
              else {
                res.render('register', {
                  'error': "Passwords do not match.",
                  'code': req.body.code,
                  'user': req.body.user
                });
              }
            }
          }
          else {
            if(req.apiRequest) {
              res.json(true, {'message': "Sorry. That user name is already taken."});
            }
            else {
              res.render('register', {
                'error': "Sorry. That user name is already taken.",
                'code': req.body.code,
                'user': req.body.user
              });
            }
          }
        });
      }
      else {
        res.render('info', {
          'title': "Error",
          'message': "Invalid invite code."
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
