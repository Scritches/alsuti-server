decryptError = true;
decryptErrorColour = "#C02020"
decryptErrorTimeout = null;

function setDecryptError() {
  clearTimeout(decryptErrorTimeout);

  decryptError = true;
  decryptErrorTimeout = null;

  $('#passwordEntry').css('color', decryptErrorColour);
}

function clearDecryptError() {
  $('#passwordEntry').css('color', 'unset');
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
  }
  else if(isImage == false) {
    renderText(null);
  }

  pEntry.keyup(function(event) {
    if(event.keyCode == 13) {
      decrypt();
    }
  });

  pEntry.on('input', function() {
    $('#decryptButton').attr('disabled', pEntry.val().length == 0);
    if(decryptError) {
      decryptError = false;
      decryptErrorTimeout = window.setTimeout(clearDecryptError, 800);
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

  $('#decryption').remove();

  if(isImage) {
    renderImage(data);
  } else if(isBinary(data)) {
    renderBinary(data);
  } else {
    renderText(data);
  }
}

// binary hueristics
function isBinary(data) {
  var nSusp = 0;
  for(var i=0; i < Math.min(512, data.length); ++i) {
    var c = data.codePointAt(i);
    if(c == 0) {
      console.log('isBinary(): null byte found; definitely binary');
      return true;
    }
    else if((c <= 31 && c != 10 && c != 13) || c == 127) {
      ++nSusp;
    }
  }

  var percSusp = (nSusp / data.length) * 100,
      result = percSusp >= 15;

  console.log("isBinary(): " + percSusp + "% suspicious; " + (result ? "likely binary" : "plain text"));
  return result;
}

function renderImage(data) {
  var blob = bytesToBlob(data, 'image/' + fileExt),
      blobURL = URL.createObjectURL(blob);

  $('img#content').attr('src', blobURL);
  $('#imageContainer').show();
}

function renderBinary(data) {
  var blob = bytesToBlob(data),
      blobURL = URL.createObjectURL(blob);

  var dLink = $('#downloadLink');
  dLink.attr('href', blobURL);
  dLink.show();

  $('#binaryNotice').show();
  $('#textContainer').hide();
}

function renderText(data) {
  if(data != null) {
    var blob = bytesToBlob(data, 'image/plain'),
        blobURL = URL.createObjectURL(blob),
        dLink = $('#downloadLink');

    dLink.attr('href', blobURL);
    dLink.show();

    $('code#content').text(data);
    $('#textContainer').show();
  }

  $('#textTools').show();

  $('code').each(function(i, block) {
    block.className = fileExt;
    if(fileExt == 'txt' || fileExt == 'log' || fileExt == null) {
      block.className = 'hljs txt';
    } else {
      hljs.highlightBlock(block);
    }
  });

  toggleLineNumbers();
}

function bytesToBlob(inputBytes, contentType) {
  contentType = contentType || '';

  var sliceSize = 1024,
      byteSize = inputBytes.length,
      slicesCount = Math.ceil(byteSize / sliceSize),
      byteArrays = new Array(slicesCount);

  for(var si = 0; si < slicesCount; ++si) {
    var begin = si * sliceSize,
        end = Math.min(begin + sliceSize, byteSize),
        bytes = new Array(end - begin);

    for(var offset = begin, i = 0 ; offset < end; ++i, ++offset) {
      bytes[i] = inputBytes[offset].charCodeAt(0);
    }

    byteArrays[si] = new Uint8Array(bytes);
  }

  return new Blob(byteArrays, { type: contentType });
}
