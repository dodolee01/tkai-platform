// Radical header/cookie optimizer for the Hostinger Horizons platform.
//
// "Request Header Fields Too Large" is caused by cookies piling up on the
// shared preview domain and being sent with EVERY request (API, WebSocket
// handshake, HMR, event API). This app stores all of its state in
// localStorage and never relies on cookies, so we purge the entire cookie
// jar on load and periodically thereafter — keeping the Cookie header empty.

function deleteCookie(name) {
  const host = window.location.hostname;
  const parts = host.split('.');
  const domains = [undefined, host, `.${host}`];
  // Also try parent domains (e.g. .app-preview.com) where shared cookies live.
  for (let i = 1; i < parts.length - 1; i++) {
    domains.push(`.${parts.slice(i).join('.')}`);
  }
  const paths = ['/', window.location.pathname];
  for (const d of domains) {
    for (const p of paths) {
      const base = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=${p}`;
      try { document.cookie = d ? `${base}; domain=${d}` : base; } catch { /* noop */ }
    }
  }
}

export function pruneCookies() {
  if (typeof document === 'undefined' || !document.cookie) return;
  const pairs = document.cookie.split(';').map((c) => c.trim()).filter(Boolean);
  for (const pair of pairs) {
    const eq = pair.indexOf('=');
    const name = (eq === -1 ? pair : pair.slice(0, eq)).trim();
    if (name) deleteCookie(name);
  }
}

export function initHeaderOptimizer() {
  pruneCookies();
  setInterval(pruneCookies, 15000);
}

export default initHeaderOptimizer;
