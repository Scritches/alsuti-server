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

function saveSettings() {
  Cookies.set('lineNumbers', lineNumbers ? 'on' : 'off', { expires: 365, path: '/' });
  Cookies.set('imageScale', $('#imageScale').val() + '%');
}

$(function() {
  var pEntry = $('#passwordEntry'),
      dButton = $('#decryptButton');

  if(encrypted) {
    pEntry.focus();
    if(window.location.hash) {
      pEntry.val(window.location.hash.substr(1));
      decrypt();
    }
  }
  else if(fileType == 'image') {
    initImage();
  }
  else if(fileType == 'text') {
    initText();
  }

  pEntry.keyup(function(event) {
    if(event.keyCode == 13) {
      decrypt();
    }
  });

  pEntry.on('input', function() {
    $('#decryptButton').attr('disabled', pEntry.val().length == 0);
    if(decryptErrorState == 1) {
      passwordChangedInErrorState = true;
    } else if(decryptErrorState == 2) {
      $('#decryption').css('background-color', decryptNormalColour);
      $('#decryptionStatus').text(decryptNormalStatus);
      decryptErrorState = 0;
    }
  });
});

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

    $('#lineNumbers').text('on');
    $('#lineNumbers').removeClass('red');
    $('#lineNumbers').addClass('green');
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

    $('#lineNumbers').text('off');
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

function renderImage(data) {
  if(data != null) {
    var blob = bytesToBlob(data, mimeType),
        blobURL = URL.createObjectURL(blob),
        dLink = $('#downloadLink');

    dLink.attr('href', blobURL);
    dLink.show();

    $('#imageLink').attr('href', blobURL);
    $('img#content').attr('src', blobURL);
    $('#imageContainer').show();
  }

  initImage();
}

function initImage() {
  var scaleSetting = Cookies.get('imageScale');
  if(scaleSetting != undefined) {
    scaleImage(parseInt(scaleSetting));
  }

  $('#imageTools').show();
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
  var blob = bytesToBlob(data, 'text/plain'),
      blobURL = URL.createObjectURL(blob),
      dLink = $('#downloadLink');

  dLink.attr('href', blobURL);
  dLink.show();

  $('code#content').text(data);
  $('#textContainer').show();

  initText();
}

function initText() {
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
