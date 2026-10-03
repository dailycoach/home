(function (scope) {
  'use strict';

  function validateConfig(config) {
    if (!config || config.enabled !== true) return null;
    if (!/^https:\/\/[a-z0-9]{20}\.supabase\.co$/.test(config.url || '')
      || !/^sb_publishable_[A-Za-z0-9_-]+$/.test(config.publishableKey || '')) {
      throw new Error('Invalid NAL public backend configuration');
    }
    return config;
  }

  async function load(config, fetcher = scope.fetch.bind(scope)) {
    config = validateConfig(config);
    if (!config) return null;
    const response = await fetcher(`${config.url}/rest/v1/rpc/nal_public_catalog`, {
      method: 'POST',
      headers: { apikey: config.publishableKey, 'Content-Type': 'application/json' },
      body: '{}',
      cache: 'no-store',
      signal: AbortSignal.timeout(12000)
    });
    if (!response.ok) throw new Error(`NAL backend HTTP ${response.status}`);
    const data = await response.json();
    if (!data?.site || typeof data.site !== 'object' || !Array.isArray(data.launches?.items)
      || !['programs', 'products', 'hosts', 'content'].every((key) => Array.isArray(data[key]))) {
      throw new Error('Incomplete NAL backend response');
    }
    return data;
  }

  scope.NALBackend = Object.freeze({ load, validateConfig });
})(globalThis);
