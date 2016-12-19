binaryThreshold = 15;

decryptError = false;
notifyDecryptError = false;

clearDecryptErrorTimeout = null;

decryptNormalColour = null;
decryptErrorColour = '#B35A5A';

function setDecryptError() {
  decryptError = true;
  window.clearTimeout(decryptErrorTimeout);
  clearDecryptErrorTimeout = window.setTimeout(clearDecryptError, 3000);

  if(notifyDecryptError == false) {
    notifyDecryptError = true;
    var d = $('#decryption');
    decryptNormalColour = d.css('background-color');
    d.css('background-color', decryptErrorColour);
  }
}

function clearDecryptError() {
  decryptError = false;
}

$(function() {
  var pEntry = $('#passwordEntry'),
      dButton = $('#decryptButton');

  loadOptions();

  if(encrypted) {
    pEntry.focus();
    if(window.location.hash) {
      pEntry.val(window.location.hash.substr(1));
      decrypt();
    }
  } else {
    renderText(null);
  }

  pEntry.keyup(function(event) {
    if(event.keyCode == 13) {
      decrypt();
    }
  });

  pEntry.on('input', function() {
    $('#decryptButton').attr('disabled', pEntry.val().length == 0);
    if(decryptError == false && notifyDecryptError) {
      notifyDecryptError = false;
      $('#decryption').css('background-color', decryptNormalColour);
    }
  });
});

function saveOptions() {
  Cookies.set('lineNumbers', $('#lineNumbersCheckbox').prop('checked') ? 'on' : 'off',
              { expires: 365, path: '/' });
}

function loadOptions() {
  $('#lineNumbersCheckbox').prop('checked', Cookies.get('lineNumbers') == 'on');
}

function toggleLineNumbers() {
  var code = $('code');

  if($('#lineNumbersCheckbox').prop('checked')) {
    // disable line wrapping
    code.css('white-space', 'pre');
    code.css('overflow-wrap', '');

    // add line numbers
    code.each(function(i, block) {
      hljs.lineNumbersBlock(block);
    });
  }
  else {
    // remove line numbers
    $('code.hljs-line-numbers').each(function(i, block) {
      $(block).remove();
    });
    // re-enable line wrapping
    code.css('white-space', 'pre-wrap');
    code.css('overflow-wrap', 'break-word');
  }

  saveOptions();
}

function copyToClipboard() {
  var $temp = $("<input>");
  $("body").append($temp);
  $temp.val($('#content').text()).select();
  document.execCommand("copy");
  $temp.remove();
}

function decrypt() {
  var password = $('#passwordEntry').val();
  if(password.length == 0) {
    return;
  }

  function tryDecrypt() {
    try {
      return CryptoJS.AES.decrypt(cipherText, password).toString(CryptoJS.enc.Utf8);
    } catch(err) {
      return null;
    }
  }

  data = tryDecrypt();
  if(!data) {
    setDecryptError();
    return;
  }

  cipherText = null;
  $('#decryption').remove();

  if(fileType == 'image') {
    renderImage(data);
  } else if(fileType == 'audio') {
    renderAudio(data);
  } else if(fileType == 'video') {
    renderVideo(data);
  } else if(isBinary(data, binaryThreshold)) {
    renderBinary(data);
  } else {
    renderText(data);
  }
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

function renderImage(data) {
  var blob = bytesToBlob(data, mimeType),
      blobURL = URL.createObjectURL(blob),
      dLink = $('#downloadLink');

  dLink.attr('href', blobURL);
  dLink.show();

  $('img#content').attr('src', blobURL);
  $('#imageContainer').show();
}

function renderAudio(data) {
  var blob = bytesToBlob(data, mimeType),
      blobURL = URL.createObjectURL(blob),
      dLink = $('#downloadLink');

  dLink.attr('href', blobURL);
  dLink.show();

  $('audio#content').attr('src', blobURL);
  $('#audioContainer').show();
}

function renderVideo(data) {
  var blob = bytesToBlob(data, mimeType),
      blobURL = URL.createObjectURL(blob),
      dLink = $('#downloadLink');

  dLink.attr('href', blobURL);
  dLink.show();

  $("video#content").attr('src', blobURL);
  $('#videoContainer').show();
}

function renderBinary(data) {
  var blob = bytesToBlob(data, 'application/octet-stream'),
      blobURL = URL.createObjectURL(blob),
      dLink = $('#downloadLink');

  dLink.attr('href', blobURL);
  dLink.show();

  $('#binaryNotice').show();
}

function renderText(data) {
  if(data != null) {
    var blob = bytesToBlob(data, 'text/plain'),
        blobURL = URL.createObjectURL(blob),
        dLink = $('#downloadLink');

    dLink.attr('href', blobURL);
    dLink.show();

    $('code#content').text(data);
    $('#textContainer').show();
  }

  $('#textTools').show();

  $('code').each(function(i, block) {
    if(fileExt != 'txt' && fileExt != 'log') {
      block.className = fileExt;
      hljs.highlightBlock(block);
    }
  });

  toggleLineNumbers();
}

function bytesToBlob(inputBytes, contentType) {
  contentType = contentType || '';

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

  return new Blob(byteArrays, { type: contentType });
}
