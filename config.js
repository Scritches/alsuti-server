var fs = require('fs'),

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

module.exports = config;
