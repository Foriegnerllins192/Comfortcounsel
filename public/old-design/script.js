// Shared nav auth state
(function () {
  const token = localStorage.getItem('cc_token');
  const user = JSON.parse(localStorage.getItem('cc_user') || 'null');

  const loginLink = document.getElementById('nav-login');
  const dashboardLink = document.getElementById('nav-dashboard');

  if (token && user) {
    if (loginLink) loginLink.style.display = 'none';
    if (dashboardLink) dashboardLink.style.display = 'inline-block';
  }

  // Mobile nav toggle
  const toggle = document.getElementById('nav-toggle');
  const links = document.getElementById('nav-links');
  if (toggle && links) {
    toggle.addEventListener('click', () => links.classList.toggle('open'));
    // Close on link click
    links.querySelectorAll('a').forEach(a => a.addEventListener('click', () => links.classList.remove('open')));
  }

  // Handle Hubtel callback — verify payment if reference in URL
  const params = new URLSearchParams(window.location.search);
  const ref = params.get('reference') || params.get('trxref');
  if (ref && token) {
    fetch(`/api/verify/${ref}`, { headers: { Authorization: 'Bearer ' + token } })
      .then(async r => {
        if (!r.ok || !r.headers.get('content-type')?.includes('application/json')) return;
        return r.json();
      })
      .then(data => {
        if (data?.message) {
          alert('Payment successful! Your session is confirmed.');
          window.location.href = 'dashboard.html';
        }
      })
      .catch(() => {});
  }
})();
