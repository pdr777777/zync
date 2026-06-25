function listarUrls() {
  return (process.env.FRONTEND_URL || '')
    .split(',')
    .map((url) => url.trim())
    .filter(Boolean);
}

function urlPrincipal() {
  return listarUrls()[0] || '';
}

module.exports = { listarUrls, urlPrincipal };
