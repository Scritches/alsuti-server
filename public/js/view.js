binaryThreshold = 15;

lineNumbers = false;
imageScale = undefined;

decryptErrorColour = '#E65C5C';
decryptErrorState = 0; // 0: no error
                       // 1: locked; persists notification
                       // 2: unlocked; allows notification to be cleared

updateDecryptErrorTimeout = null;
passwordChangedInErrorState = false;

decryptNormalStatus = null;
decryptNormalColour = null;

$(function() {
  var pEntry = $('#passwordEntry'),
      dButton = $('#decryptButton');

  if(encrypted) {
    if(window.location.hash && window.location.hash.length > 1) {
      decrypt(window.location.hash.substr(1));
    }
  }
  else if(fileType == 'image') {
    initImage(null);
  }
  else if(fileType == 'text' ||
          fileType == null)
  {
    initText(null);
  }

  pEntry.keyup(function(event) {
    if(event.keyCode == 13 && pEntry.val().length > 0) {
      decrypt();
    }
  });

  pEntry.on('input', function() {
    $('#decryptButton').attr('disabled', pEntry.val().length == 0);
    if(decryptErrorState == 1) {
      passwordChangedInErrorState = true;
    }
    else if(decryptErrorState == 2) {
      $('#decryption').css('background-color', decryptNormalColour);
      $('#decryptionStatus').text(decryptNormalStatus);
      decryptErrorState = 0;
    }
  });
});

function decrypt(pw) {
  if(typeof pw === 'undefined') {
    pw = $('#passwordEntry').val();
  }

  function tryDecrypt() {
    try {
      return CryptoJS.AES.decrypt(cipherText, pw)
               .toString(CryptoJS.enc.Utf8);
    }
    catch(err) {
      return null;
    }
  }

  data = tryDecrypt();
  if(!data) {
    setDecryptError();
    return false;
  }

  $('#decryption').remove();
  $('#tools').show();

  cipherText = null;
  persistPassword = pw;

  function readableSize(size) {
    var units = ['B', 'KB', 'MB', 'GB', 'TB'];

    var u;
    for(u=0; u < 5 && size >= 1024; ++u) {
      size /= 1024;
    }

    return parseFloat(size).toFixed(2) + ' ' + units[u];
  }

  var blob = bytesToBlob(data);
  $('#fileSize').html("Size: <u>" + readableSize(blob.size) + "</u>");

  var url = URL.createObjectURL(blob);
  if(fileType == 'image') {
    initImage(url);
  } else if(fileType == 'audio') {
    initAudio(url);
  } else if(fileType == 'video') {
    initVideo(url);
  } else if(fileType == 'application') {
    initBinary(url);
  } else if(isBinary(data, binaryThreshold)) {
    fileType = 'application';
    subType = 'octet-stream'
    initBinary(url);
  } else {
    initText(url);
  }

  return true;
}

function setDecryptError() {
  if(decryptErrorState != 0) {
    return;
  }

  var d = $('#decryption'),
      ds = $('#decryptionStatus');

  decryptNormalColour = d.css('background-color');
  decryptNormalStatus = ds.text();

  d.css('background-color', decryptErrorColour);
  ds.text('Wrong Password');
  
  decryptErrorState = 1;
  clearDecryptErrorTimeout = window.setTimeout(updateDecryptError, 5000);
}

function updateDecryptError() {
  if(passwordChangedInErrorState) {
    $('#decryption').css('background-color', decryptNormalColour);
    $('#decryptionStatus').text(decryptNormalStatus);
    passwordChangedInErrorState = false;
    decryptErrorState = 0;
  }
  else if(decryptErrorState == 1) {
    decryptErrorState = 2;
  }
}

function saveSettings() {
  if(fileType == 'image') {
    Cookies.set('imageScale', imageScale, {'expires': 90, 'path': '/' + fileName});
  } else if(fileType == 'text' || fileType == null) {
    Cookies.set('lineNumbers', lineNumbers ? 'on' : 'off', {'expires': 90, 'path': '/' + fileName});
  }
}

// images

function initImage(url) {
  var savedScale = Cookies.get('imageScale');
  if(savedScale) {
    $('#imageScale').val(parseInt(savedScale));
  }

  scaleImage(); // propagate initial scale

  if(url != null) {
    var dLink = $('#downloadLink');

    dLink.attr('href', url);
    dLink.show();

    $('#imageLink').attr('href', url);
    $('img#content').attr('src', url);
    $('#imageContainer').show();
  }

  $('#imageTools').show();
}

function scaleImage(perc) {
  if(typeof perc === 'undefined') {
    imageScale = $('#imageScale').val();
  } else {
    imageScale = perc;
  }

  $('img#content').css('max-width', imageScale + '%');
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

function initText(url) {
  setLineNumbers(Cookies.get('lineNumbers') == 'on');
  $('#textTools').show();

  if(url != null) {
    var dLink = $('#downloadLink');

    dLink.attr('href', url);
    dLink.show();

    $('code#content').text(data);
    $('#textContainer').show();
  }

  $('code').each(function(i, block) {
    if(fileType == null || (fileType == 'text' && subType != 'plain')) {
      block.className = subType;
      hljs.highlightBlock(block);
    }
  });
}

function copyToClipboard() {
  var $temp = $("<input>");
  $("body").append($temp);
  $temp.val($('#content').text()).select();
  document.execCommand("copy");
  $temp.remove();
}

function setLineNumbers(state) {
  var code = $('code');

  if(typeof state === 'undefined') {
    state = lineNumbers ? false : true;
  }

  if(state) {
    if(lineNumbers == false) {
      // disable line wrapping
      code.css('white-space', 'pre');
      code.css('overflow-wrap', '');

      // add line numbers
      code.each(function(i, block) {
        hljs.lineNumbersBlock(block);
      });
    }

    $('#lineNumbers').addClass('enabled');
    $('#lineNumbers').removeClass('green');
    $('#lineNumbers').addClass('pink');

    $('code#content').css('border-left-width', "1px");
  }
  else {
    if(lineNumbers) {
      // remove line numbers
      $('code.hljs-line-numbers').each(function(i, block) {
        $(block).remove();
      });
    }

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
  var sliceSize = 2048,
      nSlices = Math.ceil(inputBytes.length / sliceSize),
      byteArrays = new Array(nSlices);

  for(var s=0; s < nSlices; ++s) {
    var start = s * sliceSize,
        end = Math.min(start + sliceSize, inputBytes.length),
        sliceBytes = new Array(end - start);

    for(var i = start, o=0; i < end; ++i, ++o) {
      sliceBytes[o] = inputBytes[i].charCodeAt(0);
    }

    byteArrays[s] = new Uint8Array(sliceBytes);
  }

  return new Blob(byteArrays, { 'type': fileType ? (fileType + '/' + subType) : '' });
}
