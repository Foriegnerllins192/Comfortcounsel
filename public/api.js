// Shared API helper — works locally and on Render
// Since Express serves the frontend, all API calls use relative paths.

const API_URL = '';  // empty = same origin (works locally + on Render)

async function apiFetch(path, opts = {}) {
  const token = localStorage.getItem('cc_token');
  const res = await fetch(API_URL + path, {
    ...opts,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { 'Authorization': 'Bearer ' + token } : {}),
      ...(opts.headers || {})
    }
  });

  // Guard against HTML error pages (404/500 from server)
  const contentType = res.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    throw new Error(`Server error (${res.status}): unexpected response format`);
  }

  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}
