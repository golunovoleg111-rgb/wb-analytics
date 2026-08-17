async function request(baseUrl, token, path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, { ...options, headers: { ...(options.headers || {}), 'X-BJOB-LAN-Token': token, 'Content-Type': 'application/json' } });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || `LAN request failed: ${response.status}`);
  return data;
}

function createLanClient(baseUrl, token) {
  const normalized = baseUrl.replace(/\/$/, '');
  return {
    hello: () => request(normalized, token, '/lan/hello'),
    getStore: (name) => request(normalized, token, `/lan/store?name=${encodeURIComponent(name)}`),
    putStore: (name, rows) => request(normalized, token, '/lan/store', { method: 'POST', body: JSON.stringify({ name, rows }) }),
    clearStore: (name) => request(normalized, token, '/lan/clear', { method: 'POST', body: JSON.stringify({ name }) }),
  };
}

module.exports = { createLanClient };
