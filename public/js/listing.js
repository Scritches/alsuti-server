function updateListing() {
  var newLocation = window.location.pathname + "?count=" + $('#listingCount').val();
  window.location.href = newLocation;
}
