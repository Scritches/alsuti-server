function renderTimes() {
  $('.uploadTime').each(function(i) {
    var d = new Date(parseInt($(this).text())),
        timeStr = d.toLocaleDateString() + " at " + d.toLocaleTimeString();

    $(this).text(timeStr);
    $(this).parent().show();
  });
}
