importScripts('/js/lib/aes.js');

self.addEventListener('message', function(msg) {
  if(msg.data[0] == 'decrypt') {
    var fileName = msg.data[1],
        password = msg.data[2];

    console.log("[decrypt] fileName: " + fileName + " password: " + password);

    var req = new XMLHttpRequest();
    req.open('GET', '/x/' + msg.data[1]);
    req.overrideMimeType("text/plain; charset=x-user-defined");

    req.onload = function(ev) {
      var cipherText = this.responseText;

      var plainText;
      try {
        plainText = CryptoJS.AES.decrypt(cipherText, password)
                                .toString(CryptoJS.enc.Utf8);
      } catch(e) {
        console.log(e);
        plainText = null;
      }

      if(plainText != null) {
        self.postMessage(['success', plainText]);
      } else {
        self.postMessage(['wrongPassword']);
      }
    }

    req.onerror = function(ev) {
      self.postMessage(['error']);
    };

    req.send();
  }
});
