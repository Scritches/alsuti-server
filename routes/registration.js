var _ = require('underscore'),
    bcrypt = require('bcrypt-nodejs'),
    express = require('express'),
    shortid = require('shortid'),
    auth = require('./auth'),
    sessions = require('./sessions'),
    isTrue = require('../truthiness');

var router = express.Router();

router.get('/invites', auth.required);
router.get('/invites', function(req, res) {
  var db = req.app.get('database'),
      m = db.multi(),
      userHash = 'user:' + req.session.user;

  m.hget(userHash, 'inviteQuota');
  m.lrange(userHash + ':invites', 0, -1);

  m.exec(function(err, data) {
    res.render('invites', {
      'session': req.session,
      'quota': parseInt(data[0]),
      'invites': data[1],
      'listingType': 'invites'
    });
  });
});

router.post('/invites/create', auth.required);
router.post('/invites/create', function(req, res) {
  var db = req.app.get('database'),
      userHash = 'user:' + req.session.user;

  db.hmget(userHash, ['admin', 'inviteQuota'], function(err, data) {
    var admin = isTrue(data[0]),
        invites = parseInt(data[1]);

    if(admin || invites > 0) {
      var m = db.multi(),
          code = shortid.generate(),
          iHash = 'invite:' + code;

      m.lpush(userHash + ':invites', code);
      m.hmset(iHash, ['sender', req.session.user]);

      if(admin == false) {
        m.hset(userHash, 'inviteQuota', invites - 1);
      }

      m.exec(function(err, replies) {
        if(req.apiRequest) {
          res.json(false, {'code': code});
        } else {
          res.redirect('/invites');
        }
      });
    }
  });
});

router.get('/invites/delete/:code', auth.required);
router.get('/invites/delete/:code', function(req, res) {
  var db = req.app.get('database'),
      iHash = 'invite:' + req.params.code;

  db.hget(iHash, 'sender', function(err, sender) {
    if(!err) {
      if(sender == req.session.user) {
        var senderHash = 'user:' + sender;
        db.hmget(senderHash, 'inviteQuota', function(err, quota) {
          var m = db.multi();

          if(!err) {
            m.hset(senderHash, 'inviteQuota', parseInt(quota) + 1);
          } else {
            m.hset(senderHash, 'inviteQuota', 20);
          }

          m.lrem(senderHash + ':invites', 1, req.params.code);
          m.del(iHash);

          m.exec(function(err, replies) {
            if(req.apiRequest) {
              res.json(false, {
                'message': "Invite code deleted."
              });
            }
            else {
              res.redirect('/invites');
            }
          });
        });
      }
      else {
        if(req.apiRequest) {
          res.json(true, {
            'message': "You are not allowed to delete this invite code."
          });
        }
        else {
          res.redirect(req.headers.referer || '/');
        }
      }
    }
    else {
      // no such invite
      if(req.apiRequest) {
        res.json(true, {'message':"Invalid invite code."});
      } else {
        res.render('info', {
          'error': true,
          'title': "Error",
          'message': "Invalid invite code."
        });
      }
    }
  });
});

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
      res.render('register', {
        'sender': invite.sender,
        'code': req.params.code,
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
  if(_.has(req.body, 'user') == false ||
     _.has(req.body, 'password') == false ||
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
        db.exists('user:' + req.body.user, function(err, userExists) {
          if(userExists == false) {
            // create password hash for account
            bcrypt.hash(req.body.password, null, null, function(err, pHash) {
              var m = db.multi(),
                  senderHash = 'user:' + invite.sender,
                  userHash = 'user:' + req.body.user;

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
              res.json(true, {'message': "User name already exists."});
            }
            else {
              res.render('info', {
                'error': true,
                'title': "Error",
                'message': "User name already exists.",
                'returnPath': '/register/' + req.body.code
              });
            }
          }
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
