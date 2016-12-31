function onPaste(ev) {
  var eCheckbox = $('#encryptCheckbox');
  if(eCheckbox.prop('checked') == false) {
    return true;
  }

  var password = $('#passwordEntry').val();
  if(password.length == 0) {
    ev.preventDefault();
    return false;
  }

  var content = $('#content'),
      plainText = content.val(),
      cipherText = CryptoJS.AES.encrypt(plainText, password);

  content.val(cipherText);
  return true;
}

function togglePasswordEntry() {
  var pEntry = $('#passwordEntry');
  if($('#encryptCheckbox').prop('checked')) {
    pEntry.attr('disabled', false);
    pEntry.focus();
  } else {
    pEntry.attr('disabled', true);
  }
}
