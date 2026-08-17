const API_BASE = (() => {
  try { return localStorage.getItem('bjob_api_base') || ''; } catch { return ''; }
})();

export function apiUrl(path) {
  if (!path.startsWith('/')) path = `/${path}`;
  return `${API_BASE}${path}`;
}

export async function apiFetch(path, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeout ?? 3500);
  try {
    return await fetch(apiUrl(path), {
      ...options,
      signal: options.signal || controller.signal,
      headers: { Accept: 'application/json', ...(options.headers || {}) }
    });
  } finally {
    clearTimeout(timeout);
  }
}

export async function apiAvailable() {
  try {
    const response = await apiFetch('/api/health', { timeout: 1500 });
    return response.ok;
  } catch {
    return false;
  }
}
