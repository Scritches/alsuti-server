binaryThreshold = 15;
lineNumbers = false;

decryptErrorColour = '#E65C5C';
decryptErrorState = 0; // 0: no error
                       // 1: locked; persists notification
                       // 2: unlocked; allows notification to be cleared

updateDecryptErrorTimeout = null;
passwordChangedInErrorState = false;

decryptNormalStatus = null;
decryptNormalColour = null;

persist = undefined;
persistPassword = null;

$(function() {
  var pEntry = $('#passwordEntry'),
      dButton = $('#decryptButton');

  if(encrypted) {
    var pw = localStorage.getItem(fileName);
    if(pw != null) {
      setPersist(true);
      pEntry.val(atob(pw));
      decrypt();
    }
    else {
      setPersist(false);
      pEntry.focus();
      if(window.location.hash) {
        pw = window.location.hash.substr(1);
        decrypt(pw);
      }
    }
  }
  else if(fileType == 'image') {
    initImage(null);
  }
  else if(fileType == 'text') {
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

function saveSettings() {
  Cookies.set('lineNumbers', lineNumbers ? 'on' : 'off', { expires: 365, path: '/' });
  Cookies.set('imageScale', $('#imageScale').val(), { expires: 365, path: '/' });
}

function setPersist(state) {
  if(typeof state === 'undefined') {
    state = persist ? false : true;
  }

  var pLink = $('#persistLink');
  if(state) {
    if(persist == false) {
      localStorage.setItem(fileName, btoa(persistPassword));
    }

    pLink.removeClass('red');
    pLink.addClass('green');
  }
  else {
    if(persist) {
      localStorage.removeItem(fileName);
    }

    pLink.removeClass('green');
    pLink.addClass('red');
  }

  persist = state;
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

    $('#lineNumbers').removeClass('red');
    $('#lineNumbers').addClass('green');
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

    $('#lineNumbers').removeClass('green');
    $('#lineNumbers').addClass('red');
    $('code#content').css('border-left-width', "0px");
  }

  lineNumbers = state;
}

function scaleImage(perc) {
  if(typeof perc === 'undefined') {
    perc = $('#imageScale').val();
  } else {
    $('#imageScale').val(perc);
  }

  $('img#content').css('max-width', perc + '%');
}

function decrypt(password) {
  var pw = $('#passwordEntry').val();

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
    return;
  }

  cipherText = null;
  if(persistPassword == null)
    persistPassword = pw;

  function readableSize(rawSize) {
    var readableSize = rawSize,
        units = ['B', 'KB', 'MB', 'GB', 'TB'];

    var u;
    for(u=0; u < 5 && readableSize >= 1000; ++u) {
      readableSize /= 1024;
    }

    return parseFloat(readableSize).toFixed(2) + ' ' + units[u];
  }

  $('#fileSize').text("File size: " + readableSize(data.length));

  $('#decryption').remove();
  $('#genericTools').show();

  var blob = bytesToBlob(data),
      url = URL.createObjectURL(blob);

  if(fileType == 'image') {
    initImage(url);
  } else if(fileType == 'audio') {
    initAudio(url);
  } else if(fileType == 'video') {
    initVideo(url);
  } else if(isBinary(data, binaryThreshold)) {
    initBinary(url);
  } else {
    initText(url);
  }
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

function initImage(url) {
  if(url != null) {
    var dLink = $('#downloadLink');

    dLink.attr('href', url);
    dLink.show();

    $('#imageLink').attr('href', url);
    $('img#content').attr('src', url);
    $('#imageContainer').show();
  }

  var scaleSetting = Cookies.get('imageScale');
  if(scaleSetting != undefined) {
    scaleImage(parseInt(scaleSetting));
  }

  $('#imageTools').show();
}

function initAudio(url) {
  var dLink = $('#downloadLink');

  dLink.attr('href', url);
  dLink.show();

  $('audio#content').attr('src', url);
  $('#audioContainer').show();
}

function initVideo(url) {
  var dLink = $('#downloadLink');

  dLink.attr('href', url);
  dLink.show();

  $("video#content").attr('src', url);
  $('#videoContainer').show();
}

function initBinary(url) {
  var dLink = $('#downloadLink');

  dLink.attr('href', url);
  dLink.show();

  $('#binaryNotice').show();
}

function initText(url) {
  if(url != null) {
    var dLink = $('#downloadLink');

    dLink.attr('href', url);
    dLink.show();

    $('code#content').text(data);
    $('#textContainer').show();
  }

  $('code').each(function(i, block) {
    if(fileExt != 'txt' && fileExt != 'log') {
      block.className = fileExt;
      hljs.highlightBlock(block);
    }
  });

  setLineNumbers(Cookies.get('lineNumbers') == 'on');
  $('#textTools').show();
}

// binary hueristics
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

  return new Blob(byteArrays, { 'type': mimeType || '' });
}
