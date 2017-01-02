var _ = require('underscore')._,
    bodyParser = require('body-parser'),
    cookieParser = require('cookie-parser'),
    device = require('express-device'),
    express = require('express'),
    favicon = require('serve-favicon'),
    fs = require('fs'),
    path = require('path'),
    process = require('process'),
    redis = require('redis'),
    sys = require('sys'),
    sessions = require('./routes/sessions.js'),
    types = require('./types.js'),
    isTrue = require('./truthiness.js');

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
app.set('cookieAge', 1000 * 60 * 60 * 24 * 14); // for a maximum of 2 weeks
app.set('sessionAge', 1000 * 60 * 60 * 4);      // .. enforce a 4 hour activity timeout
app.set('maxCookieAge', 1000 * 60 * 60 * 720);  // but 2 years for non-expiring sessions

// view engine setup
app.set('json spaces', 2);
app.set('view engine', 'jade');
app.set('views', path.join(__dirname, 'views'));

// pretty html output
app.locals.pretty = true;

// use favicon if it exists
var faviconPath = __dirname + '/public/favicon.ico';
try {
  fs.accessSync(faviconPath, fs.F_OK);
  app.use(favicon(faviconPath));
}
catch(e) {
  console.log("Note: no favicon found");
}

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true, limit: '1kb' }));

app.use(cookieParser());
app.use(device.capture({'parseUserAgent': true}));
app.use(express.static(path.join(__dirname, 'public')));

app.use(function(req, res, next) {
  // api request flag
  if(req.method == 'POST') {
    req.apiRequest = _.has(req.body, 'api') && isTrue(req.body.api);
  } else {
    req.apiRequest = _.has(req.body, 'api') && isTrue(req.headers.api);
  }

  // api response helper
  res.api = function(err, data) {
    data.error = err;
    this.setHeader('Content-Type', "application/json");
    this.json(data);
  }.bind(res);

  next();
});

// primary route handlers
app.use(sessions.handler);
app.use('/', sessions.router);
app.use('/', require('./routes/registration.js'));
app.use('/', require('./routes/listings.js'));
app.use('/', require('./routes/files.js'));

// catch 404 and forward to error handler
app.use(function(req, res, next) {
  var err = new Error("Not Found");
  err.status = 404;
  next(err);
});

var mode = process.env.NODE_ENV || 'development';
if(mode == 'development') {
  // development error handler; prints stacktrace
  app.use(function(err, req, res, next) {
    if(res.headersSent) {
      return next(err);
    }

    res.status(err.status || 500);
    res.render('error', {
      'e': err
    });
  });
}
else {
  // production error handler; no stacktrace
  app.use(function(err, req, res, next) {
    if(res.headersSent) {
      return next(err);
    }

    err.stack = null;
    res.status(err.status || 500);
    res.render('error', {
      'e': err
    });
  });
}

module.exports = app;
