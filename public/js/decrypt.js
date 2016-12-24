importScripts('/js/lib/aes.js');

self.addEventListener('message', function(ev) {
  if(ev.data[0] == 'decrypt') {
    var data = decrypt(ev.data[2], ev.data[1]);
    if(data == null) {
      self.postMessage(['error']);
    } else {
      self.postMessage(['success', data]);
    }
  }
});

function decrypt(cipherText, password) {
  function tryDecrypt() {
    try {
      return CryptoJS.AES.decrypt(cipherText, password)
               .toString(CryptoJS.enc.Utf8);
    }
    catch(err) {
      return null;
    }
  }

  data = tryDecrypt();
  if(!data) {
    return null;
  }

  return data;
}
