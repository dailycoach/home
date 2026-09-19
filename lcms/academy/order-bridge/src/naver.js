import bcrypt from 'bcryptjs';

const COMMERCE_BASE = 'https://api.commerce.naver.com/external';
const TOKEN_CACHE_KEY = 'auth:naver-commerce';

function requireEnv(env, key) {
  const value = String(env[key] || '').trim();
  if (!value) throw new Error(`MISSING_ENV_${key}`);
  return value;
}

function makeClientSecretSign(clientId, clientSecret, timestamp) {
  const password = `${clientId}_${timestamp}`;
  const hashed = bcrypt.hashSync(password, clientSecret);
  return btoa(hashed);
}

async function parseJson(response) {
  const text = await response.text();
  try {
    return text ? JSON.parse(text) : {};
  } catch {
    return { raw: text };
  }
}

export function createNaverCommerceClient(env) {
  async function getAccessToken(forceRefresh = false) {
    if (!forceRefresh) {
      const cached = await env.ORDER_STATE.get(TOKEN_CACHE_KEY, 'json');
      if (cached?.accessToken) return cached.accessToken;
    }

    const clientId = requireEnv(env, 'NAVER_CLIENT_ID');
    const clientSecret = requireEnv(env, 'NAVER_CLIENT_SECRET');
    const timestamp = Date.now();
    const tokenType = String(env.NAVER_TOKEN_TYPE || 'SELF').trim().toUpperCase();
    const body = new URLSearchParams({
      client_id: clientId,
      timestamp: String(timestamp),
      grant_type: 'client_credentials',
      client_secret_sign: makeClientSecretSign(clientId, clientSecret, timestamp),
      type: tokenType
    });
    if (tokenType === 'SELLER') {
      body.set('account_id', requireEnv(env, 'NAVER_SELLER_ACCOUNT_ID'));
    }

    const response = await fetch(`${COMMERCE_BASE}/v1/oauth2/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json'
      },
      body
    });
    const json = await parseJson(response);
    if (!response.ok || !json.access_token) {
      throw new Error(`NAVER_TOKEN_${response.status}_${json.code || 'FAILED'}`);
    }

    const ttl = Math.max(60, Number(json.expires_in || 10800) - 600);
    await env.ORDER_STATE.put(TOKEN_CACHE_KEY, JSON.stringify({ accessToken: json.access_token }), {
      expirationTtl: ttl
    });
    return json.access_token;
  }

  async function request(path, init = {}, retryAuth = true) {
    const token = await getAccessToken(false);
    const headers = new Headers(init.headers || {});
    headers.set('Authorization', `Bearer ${token}`);
    headers.set('Accept', 'application/json;charset=UTF-8');
    const response = await fetch(`${COMMERCE_BASE}${path}`, { ...init, headers });
    const json = await parseJson(response);

    if (retryAuth && response.status === 401 && json?.code === 'GW.AUTHN') {
      await env.ORDER_STATE.delete(TOKEN_CACHE_KEY);
      const freshToken = await getAccessToken(true);
      headers.set('Authorization', `Bearer ${freshToken}`);
      const retryResponse = await fetch(`${COMMERCE_BASE}${path}`, { ...init, headers });
      const retryJson = await parseJson(retryResponse);
      if (!retryResponse.ok) {
        throw new Error(`NAVER_API_${retryResponse.status}_${retryJson.code || 'FAILED'}`);
      }
      return retryJson;
    }

    if (!response.ok) throw new Error(`NAVER_API_${response.status}_${json.code || 'FAILED'}`);
    return json;
  }

  async function getPaidChanges({ lastChangedFrom, lastChangedTo, moreSequence = '' }) {
    const query = new URLSearchParams({
      lastChangedFrom,
      lastChangedTo,
      lastChangedType: 'PAYED',
      limitCount: '300'
    });
    if (moreSequence) query.set('moreSequence', moreSequence);
    return request(`/v1/pay-order/seller/product-orders/last-changed-statuses?${query.toString()}`);
  }

  async function queryProductOrders(productOrderIds) {
    const ids = [...new Set(productOrderIds.map(String).filter(Boolean))];
    if (!ids.length) return [];
    if (ids.length > 300) throw new Error('NAVER_QUERY_LIMIT_EXCEEDED');
    const json = await request('/v1/pay-order/seller/product-orders/query', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ productOrderIds: ids, quantityClaimCompatibility: true })
    });
    return Array.isArray(json?.data) ? json.data : [];
  }

  return { getPaidChanges, queryProductOrders };
}
