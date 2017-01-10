var bytes = require('bytes'),
    fs = require('fs'),
    multer = require('multer'),
    path = require('path'),
    process = require('process');

var types = require('./types');

var config;
try {
  config = JSON.parse(fs.readFileSync(__dirname + '/config.json'));
}
catch(e) {
  if(e.code == 'ENOENT') {
    console.log("No configuration found. Using default.");

    try {
      var defData = fs.readFileSync(__dirname + '/config.json.def');
      data = defData;
    }
    catch(e) {
      console.log("No default config found. Now what did you do?");
      process.exit(1);
    }

  }
  else {
    console.log("Invalid configuration. Exiting.");
    process.exit(1);
  }

  fs.writeFileSync('config.json', defData);
}

config.setUploadLimits = function(app, pasteSize, fileSize) {
  var upload = multer({
    limits: {
      fields: 5,
      fieldSize: bytes.parse(pasteSize) || this.upload_limits.paste_size,
      fileSize: bytes.parse(fileSize)   || this.upload_limits.file_size
    },
    storage: multer.diskStorage({
      destination: function(req, file, callback) {
        callback(null, path.resolve(__dirname + '/files/'));
      },
      filename: function(request, file, callback) {
        var fileExt = types.fileExtension(file.originalname);
        if(fileExt != null) {
          callback(null, shortid.generate() + '.' + fileExt);
        } else {
          callback(null, shortid.generate());
        };
      },
    }),
  });
  
  var pasteUploader = upload.array(),
      fileUploader = upload.single('file');

  app.set('pasteUploader', fileUploader);
  app.set('fileUploader', fileUploader);

  this.upload_limits.paste_size = pasteSize;
  this.upload_limits.file_size = fileSize;
}.bind(config);

module.exports = config;
