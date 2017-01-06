function updateListingCount() {
  Cookies.set('listingCount', $('#listingCount').val(), {
    'expires': 90,
    'path': window.location.pathname
  });

  window.location.href = window.location.pathname + "?offset=" + offset;
}
