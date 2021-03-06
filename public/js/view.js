binaryThreshold = 15;

// settings
lineNumbers = undefined;
imageScale = undefined;

// decryption notification ticker

decryptNotifyIter = 0;
decryptNotifyIterMax = 3;
decryptNotifyTail = ".";
decryptNotifyTimeout = null;

// decryption error stuff
//
// state values:
//  0: no error
//  1: locked; notification persists
//  2: unlocked; notification can be cleared

decryptNormalStatus = null;
decryptErrorState = 0;

updateDecryptErrorTimeout = null;
passwordChangedInErrorState = false;

$(function() {
  var pEntry = $('#password'),
      dButton = $('button#decrypt');

  decryptNormalStatus = $('#decryptionStatus').text();

  if(encrypted) {
    if(window.location.hash) {
      decrypt(window.location.hash.substr(1));
    }
  }
  else if(fileType == 'text' || fileType == null) {
    initText(null, null);
  }

  pEntry.keyup(function(event) {
    if(event.keyCode == 13 && pEntry.val().length > 0) {
      decrypt();
    }
  });

  pEntry.on('input', function() {
    $('button#decrypt').attr('disabled', pEntry.val().length == 0);
    if(decryptErrorState == 1) {
      passwordChangedInErrorState = true;
    } else if(decryptErrorState == 2) {
      resetDecryptError();
    }
  });
});

function decrypt(password) {
  var pEntry = $('input#password'),
      dTools = $('#decryptionTools'),
      dStatus = $('#decryptionStatus');

  if(typeof password === 'undefined') {
    password = pEntry.val();
  }

  if(decryptErrorState) {
    resetDecryptError();
  }

  dTools.hide();

  // do initial notification tick and set timeout for subsequent ticks
  $('#decryption').addClass('notify');
  decryptNotifyTick();
  decryptNotifyInterval = window.setInterval(decryptNotifyTick, 750);

  var w = new Worker('/js/decrypt.js');

  w.addEventListener('message', function(msg) {
    decryptNotifyReset();

    if(msg.data[0] == 'success') {
      function readableSize(size) {
        var i;
        for(i=0; i < 5 && size >= 1024; ++i) {
          size /= 1024;
        }

        var units = ['B', 'KB', 'MB', 'GB', 'TB']
        return parseFloat(size).toFixed(2) + ' ' + units[i];
      }

      var plainText = msg.data[1],
          blob = bytesToBlob(plainText),
          url = URL.createObjectURL(blob);

      $('#fileSize').html("Size: <u>" + readableSize(blob.size) + "</u>");
      $('#decryption').remove();
      $('#genericTools').show();

      if(fileType == 'image') {
        initImage(url);
      } else if(fileType == 'audio') {
        initAudio(url);
      } else if(fileType == 'video') {
        initVideo(url);
      } else if(fileType == 'application' || isBinary(plainText, binaryThreshold)) {
        initBinary(url);
      } else {
        initText(url, plainText);
      }
    }
    else if(msg.data[0] == 'wrongPassword') {
      dTools.show();
      setDecryptError("Wrong password.");
      pEntry.focus();
    }
    else {
      setDecryptError("Error.");
    }
  });

  w.postMessage(['decrypt', fileName, password]);
}

function decryptNotifyTick() {
  if(decryptNotifyIter == decryptNotifyIterMax) {
    decryptNotifyIter = 1;
  } else {
    ++decryptNotifyIter;
  }

  $('#decryptionStatus').text("Decrypting" +
      decryptNotifyTail.repeat(decryptNotifyIter) +
      " ".repeat(decryptNotifyIterMax - decryptNotifyIter));

  return true;
}

function decryptNotifyReset() {
  $('#decryption').removeClass('notify');
  window.clearInterval(decryptNotifyInterval);
  decryptNotifyIter = 0;
  decryptNotifyTimeout = null;
}

function setDecryptError(message) {
  if(decryptErrorState != 0) {
    return;
  }

  var d = $('#decryption'),
      ds = $('#decryptionStatus');

  d.addClass('error');
  ds.text(message);

  decryptErrorState = 1;
  clearDecryptErrorTimeout = window.setTimeout(updateDecryptError, 5000);
}

function updateDecryptError() {
  if(passwordChangedInErrorState) {
    resetDecryptError();
  } else if(decryptErrorState == 1) {
    decryptErrorState = 2;
  }
}

function resetDecryptError() {
  $('#decryption').removeClass('error');
  $('#decryptionStatus').text(decryptNormalStatus);
  passwordChangedInErrorState = false;
  decryptErrorState = 0;
}

function saveSettings() {
  if(fileType == 'text' || (fileType == null && $('#textTools').css('display') != 'none')) {
    Cookies.set('lineNumbers', lineNumbers ? 'on' : 'off', {'expires': 90, 'path': '/' + fileName});
  }
}

// images

function initImage(url) {
  var dLink = $('#downloadLink');

  dLink.attr('href', url);
  dLink.show();

  $('#imageLink').attr('href', url);
  $('img#content').attr('src', url);
  $('#imageContainer').show();
}

// audio

function initAudio(url) {
  var dLink = $('#downloadLink');

  dLink.attr('href', url);
  dLink.show();

  $('audio#content').attr('src', url);
  $('#audioContainer').show();
}

// video

function initVideo(url) {
  var dLink = $('#downloadLink');

  dLink.attr('href', url);
  dLink.show();

  $("video#content").attr('src', url);
  $('#videoContainer').show();
}

// binary

function initBinary(url) {
  var dLink = $('#downloadLink');

  dLink.attr('href', url);
  dLink.show();

  $('#binaryNotice').show();
}

function isBinary(data, threshold) {
  var nSusp = 0,
      nMax = Math.min(2048, data.length);

  for(var i=0; i < nMax; ++i) {
    var c = data.codePointAt(i);
    if(c == 0) {
      console.log('isBinary(): null byte found; definitely binary');
      return true;
    }
    else if((c <= 31 && c != 10 && c != 13) || c == 127) {
      ++nSusp;
    }
  }

  var percSusp = (nSusp / nMax) * 100,
      result = percSusp >= threshold;

  console.log("isBinary(): " + percSusp + "% suspicious; " + (result ? "likely binary" : "plain text"));
  return result;
}

// text

function initText(url, text) {
  if(url != null) {
    var dLink = $('#downloadLink');

    dLink.attr('href', url);
    dLink.show();

    if(text != null) {
      $('code#content').text(text);
      $('#textContainer').show();
    }
  }

  $('code').each(function(i, block) {
    if(fileType == null || (fileType == 'text' && subType != 'plain')) {
      if(subType != null) {
        block.className = "hljs " + subType;
      }
      hljs.highlightBlock(block);
    }
  });

  setLineNumbers(Cookies.get('lineNumbers') == 'on');
  $('#textTools').show();
}

var inhibitCopy = false;
function copyToClipboard() {
  if(inhibitCopy) {
    return;
  }

  var $temp = $("<input>");
  $('body').append($temp);
  $temp.val($('#content').text()).select();
  document.execCommand('copy');
  $temp.remove();

  var copyLink = $('#copyLink'),
      copyTextNormal = copyLink.text();

  inhibitCopy = true;
  copyLink.text("Copied!");
  copyLink.addClass("enabled pink");

  window.setTimeout(function() {
    copyLink.text(copyTextNormal);
    copyLink.removeClass("enabled pink");
    inhibitCopy = false;
  }, 4000);
}

function setLineNumbers(state) {
  var code = $('code');

  if(typeof state === 'undefined') {
    state = lineNumbers ? false : true;
  }

  if(state) {
    // disable line wrapping
    code.css('white-space', 'pre');
    code.css('overflow-wrap', '');

    // add line numbers
    code.each(function(i, block) {
      hljs.lineNumbersBlock(block);
    });

    $('#lineNumbers').addClass('enabled');
    $('#lineNumbers').removeClass('green');
    $('#lineNumbers').addClass('pink');

    $('code#content').css('border-left-width', "1px");
  }
  else {
    // remove line numbers
    $('code.hljs-line-numbers').each(function(i, block) {
      $(block).remove();
    });

    // re-enable line wrapping
    code.css('white-space', 'pre-wrap');
    code.css('overflow-wrap', 'break-word');

    $('#lineNumbers').removeClass('enabled');
    $('#lineNumbers').removeClass('pink');
    $('#lineNumbers').addClass('green');

    $('code#content').css('border-left-width', "0px");
  }

  lineNumbers = state;
}

// blob generation

function bytesToBlob(inputBytes) {
  var sliceSize = 1024,
      nSlices = Math.ceil(inputBytes.length / sliceSize),
      byteArrays = new Array(nSlices);

  for(var s=0; s < nSlices; ++s) {
    var start = sliceSize * s,
        end = Math.min(start + sliceSize, inputBytes.length),
        sliceBytes = new Array(end - start);

    for(var i = start, o=0; i < end; ++i, ++o) {
      sliceBytes[o] = inputBytes[i].charCodeAt(0);
    }

    byteArrays[s] = new Uint8Array(sliceBytes);
  }

  return new Blob(byteArrays, { 'type': fileType ? (fileType + '/' + subType) : '' });
}
