function requireEnv(env, key) {
  const value = String(env[key] || '').trim();
  if (!value) throw new Error(`MISSING_ENV_${key}`);
  return value;
}

function bytesToBase64(bytes) {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

async function makeSignature(method, path, timestamp, accessKey, secretKey) {
  const message = `${method} ${path}\n${timestamp}\n${accessKey}`;
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secretKey),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(message));
  return bytesToBase64(new Uint8Array(signature));
}

export async function sendInvitationLms(env, { to, subject, content }) {
  const serviceId = requireEnv(env, 'SENS_SERVICE_ID');
  const accessKey = requireEnv(env, 'SENS_ACCESS_KEY');
  const secretKey = requireEnv(env, 'SENS_SECRET_KEY');
  const from = requireEnv(env, 'SENS_FROM');
  const path = `/sms/v2/services/${serviceId}/messages`;
  const timestamp = String(Date.now());
  const signature = await makeSignature('POST', path, timestamp, accessKey, secretKey);
  const body = {
    type: 'LMS',
    contentType: 'COMM',
    countryCode: '82',
    from,
    subject,
    content,
    messages: [{ to }]
  };

  const response = await fetch(`https://sens.apigw.ntruss.com${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-ncp-apigw-timestamp': timestamp,
      'x-ncp-iam-access-key': accessKey,
      'x-ncp-apigw-signature-v2': signature
    },
    body: JSON.stringify(body)
  });
  const json = await response.json().catch(() => ({}));
  if (!response.ok || String(json.statusCode || '') !== '202') {
    throw new Error(`SENS_${response.status}_${json.statusCode || 'FAILED'}`);
  }
  return json;
}
