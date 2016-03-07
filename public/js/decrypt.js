
$(function() {
  $("#decryptButton").keyup(function(event){
    if(event.keyCode == 13){
        $("#id_of_button").click();
    }
  });
});

function decrypt() {
  var password = $('#password').val();
  var content = $('#content').text();

  var plain = CryptoJS.AES.decrypt(content, password).toString(CryptoJS.enc.Utf8);
  var image = btoa(plain);

  $('#image').attr('src', 'data:image/jpeg;base64,' + image);
  $('#image').show();

  $('#content').text(plain);
  var a = $('#downloadButton');
  a.show()
  a.attr('href', 'data:image/jpeg;base64,'+image);
  a.attr('download', 'file.jpg');
  //document.body.appendChild(image);

/*

				if(!/^data:/.test(decrypted)){
					alert("Invalid pass phrase or file! Please try again.");
					return false;
				}

				a.attr('href', decrypted);
				a.attr('download', file.name.replace('.encrypted',''));
*/
}
