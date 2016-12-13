var _ = require('underscore')._,
    bodyParser = require('body-parser'),
    cookieParser = require('cookie-parser'),
    device = require('express-device'),
    express = require('express'),
    favicon = require('serve-favicon'),
    fs = require('fs'),
    logger = require('morgan'),
    multer = require('multer'),
    path = require('path'),
    process = require('process'),
    redis = require('redis'),
    sys = require('sys'),
    isTrue = require('./truthiness.js');

if(!_.has(process.env, 'ALSUTI_INSTANCE')) {
  console.log('You must set the ALSUTI_INSTANCE environment variable');
  process.exit(1);
}

var app = express();

// database handle

var db = redis.createClient();
if(_.has(process.env, 'ALSUTI_DATABASE')) {
  db.select(process.env.ALSUTI_DATABASE);
}

db.on("error", function(err) {
  console.log("Error: " + err);
});

// app globals

app.set('database', db);
app.set('cookieAge', 1000 * 60 * 60 * 24 * 7); // for a maximum of 7 days ..
app.set('sessionAge', 1000 * 60 * 60 * 1);     // .. enforce a 1 hour activity timeout

// view engine setup
app.set('json spaces', 2);
app.set('view engine', 'jade');
app.set('views', path.join(__dirname, 'views'));

// use favicon if it exists
var faviconPath = __dirname + '/public/favicon.ico';
try {
  fs.accessSync(faviconPath, fs.F_OK);
  app.use(favicon(faviconPath));
}
catch(e) {
  console.log("Note: no favicon found");
}

app.use(device.capture({'parseUserAgent': true}));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false, limit: '500mb' }));
app.use(multer());
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

// authentication and api response helpers
app.use(function(req, res, next) {
  // api request flag
  if(req.method == 'POST') {
    req.apiRequest = isTrue(req.body.api) || false;
  } else {
    req.apiRequest = isTrue(req.headers.api) || false;
  }

  // api response helper
  res.api = function(err, data) {
    data.error = err;
    this.setHeader('Content-Type', "application/json");
    this.json(data);
  }.bind(res);

  req.session = {
    'user': null,
    'auth': function(user) {
      if(typeof user === 'undefined') {
        return this.user != null;
      } else {
        return this.user != null && this.user == user;
      }
    },
  };

  if(_.has(req.cookies, 'sessionUser') && _.has(req.cookies, 'sessionKey')) {
    var db = req.app.get('database'),
        sessionUser = req.cookies.sessionUser,
        sessionKey = req.cookies.sessionKey,
        userHash = 'user:' + sessionUser;

    db.hmget(userHash, ['sessionKey', 'sessionExpiry'], function(err, data) {
      if(!err && sessionKey == data[0]) {
        if(data[1] == 'never') {
          req.session.user = sessionUser;
        }
        else {
          var now = Date.now();
          if(now < parseInt(data[1])) {
            var newExpiry = now + req.app.get('sessionAge');
            db.hset(userHash, 'sessionExpiry', newExpiry);
            req.session.user = sessionUser;
          }
        }
      }
    });
  }

  next();
});

// set up primary routes
app.use('/', require('./routes/sessions.js'));
app.use('/', require('./routes/listings.js'));
app.use('/', require('./routes/files.js'));

// catch 404 and forward to error handler
app.use(function(req, res, next) {
  var err = new Error('Not Found');
  err.status = 404;
  next(err);
});

// development error handler; prints stacktrace
if(app.get('env') === 'development') {
  app.use(function(err, req, res, next) {
    res.status(err.status || 500);
    res.render('error', {
      message: err.message,
      error: err
    });
  });
}

// production error handler; no stacktraces
app.use(function(err, req, res, next) {
  res.status(err.status || 500);
  res.render('error', {
    message: err.message,
    error: {}
  });
});

module.exports = app;
