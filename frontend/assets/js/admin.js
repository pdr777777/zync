Auth.requireAuth();

if (!Auth.isAdmin()) {
  window.location.href = 'dashboard.html';
}
