function timeDiff(d) {
  var div = [60, 60, 24, 7],
      unit = ['s', 'm', 'h', 'd', 'w'],
      diff = (Date.now() - d) / 1000;

  var i,j,
      leftover;

  for(i=0, j = -1; i < div.length && diff >= div[i]; ++i, ++j) {
    Math.floor(diff);
    leftover = diff % div[i];
    diff -= leftover;
    diff /= div[i];
  }

  diff = parseFloat(diff).toFixed(0);
  leftover = parseFloat(leftover).toFixed(0);

  return diff + unit[i] + (leftover > 0 && j >= 0 ? (" " + leftover + unit[j]) : "") + " ago";
}

function renderRelativeTimes() {
  $('.uploadTime').each(function(i) {
    var d = new Date(parseInt($(this).text()));

    var rTime = timeDiff(d);
    $(this).text(rTime);

    var container = $(this).closest('.hidden');
    container.removeClass('hidden');
  });
}

function renderAbsoluteTimes() {
  $('.uploadTime').each(function(i) {
    var d = new Date(parseInt($(this).text()));

    var aTime = d.toLocaleDateString() + " at " + d.toLocaleTimeString();
    $(this).text(aTime);

    var container = $(this).closest('.hidden');
    container.removeClass('hidden');
  });
}
