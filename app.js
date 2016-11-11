var express = require('express');
var fs = require('fs');
var path = require('path');
var favicon = require('serve-favicon');
var logger = require('morgan');
var multer = require('multer');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');
var _ = require('underscore')._;
var process = require('process');
var sys = require('sys');
var device = require('express-device');

var routes = require('./routes/index');

if(!_.has(process.env, 'ALSUTI_API_KEY')) {
  console.log('You must set the ALSUTI_API_KEY environment variable');
  process.exit(1);
}
if(!_.has(process.env, 'ALSUTI_ENDPOINT')) {
  console.log('You must set the ALSUTI_ENDPOINT environment variable');
  process.exit(1);
}

var app = express();

// required for date formatting in listing template
app.locals.moment = require('moment');

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'jade');

// use favicon if it exists
var faviconPath = __dirname + '/public/favicon.ico';
try {
  fs.accessSync(faviconPath, fs.F_OK);
  app.use(favicon(faviconPath));
} catch(e) {
  console.log("Note: no favicon found in /public.");
}

app.use(logger('dev'));
app.use(device.capture({'parseUserAgent':true}));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false, limit: '500mb' }));
app.use(multer());
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

// Add some stuff to the req
app.use(function(req, res, next) {
  req.api_key = process.env.ALSUTI_API_KEY;
  req.external_path = process.env.ALSUTI_ENDPOINT;
  next();
});

app.use('/', routes);

// catch 404 and forward to error handler
app.use(function(req, res, next) {
  var err = new Error('Not Found');
  err.status = 404;
  next(err);
});

// error handlers

// development error handler
// will print stacktrace
if(app.get('env') === 'development') {
  app.use(function(err, req, res, next) {
    res.status(err.status || 500);
    res.render('error', {
      message: err.message,
      error: err
    });
  });
}

// production error handler
// no stacktraces leaked to user
app.use(function(err, req, res, next) {
  res.status(err.status || 500);
  res.render('error', {
    message: err.message,
    error: {}
  });
});

module.exports = app;
