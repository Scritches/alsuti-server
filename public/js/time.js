function renderTimes() {
  $('.uploadTime').each(function(i) {
    var d = new Date(parseInt($(this).text())),
        timeStr = d.toLocaleTimeString() + " on " + d.toLocaleDateString();

    $(this).text(timeStr);
    $(this).show();
  });
}
