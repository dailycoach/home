var DC = DC || {};

DC.Security = (function () {
  function normalizeString(value) {
    var text = String(value == null ? '' : value).replace(/\r\n?/g, '\n');
    return typeof text.normalize === 'function' ? text.normalize('NFC') : text;
  }

  function bytesToHex(bytes) {
    return bytes.map(function (value) {
      return ('0' + ((value + 256) % 256).toString(16)).slice(-2);
    }).join('');
  }

  function bytesToBase64Url(bytes) {
    return Utilities.base64EncodeWebSafe(bytes).replace(/=+$/g, '');
  }

  function sha256Hex(value) {
    var bytes = Array.isArray(value)
      ? value
      : Utilities.newBlob(normalizeString(value), 'text/plain').getBytes();
    return bytesToHex(Utilities.computeDigest(
      Utilities.DigestAlgorithm.SHA_256,
      bytes
    ));
  }

  function hmacBytes(value, key) {
    return Utilities.computeHmacSha256Signature(
      normalizeString(value),
      normalizeString(key),
      Utilities.Charset.UTF_8
    );
  }

  function hmacHex(value, key) {
    return bytesToHex(hmacBytes(value, key));
  }

  function hmacBase64Url(value, key) {
    return bytesToBase64Url(hmacBytes(value, key));
  }

  function randomToken() {
    return (
      Utilities.getUuid().replace(/-/g, '') +
      Utilities.getUuid().replace(/-/g, '')
    ).toLowerCase();
  }

  function randomId(prefix) {
    return String(prefix || '') + Utilities.getUuid();
  }

  function isValidInvitationToken(token) {
    return /^[a-f0-9]{64}$/.test(String(token || ''));
  }

  function hashInvitationToken(token, version) {
    if (!isValidInvitationToken(token)) throw new Error('INVALID_TOKEN');
    var v = version || DC.Config.activeCryptoVersion();
    return hmacHex(token, DC.Config.pepper('TOKEN', v));
  }

  function hashIdempotency(actorContext, operation, requestId, version) {
    var id = String(requestId || '');
    if (!/^[A-Za-z0-9_-]{16,128}$/.test(id)) {
      throw new Error('INVALID_REQUEST_ID');
    }
    var v = version || DC.Config.activeCryptoVersion();
    return hmacHex(
      normalizeString(actorContext) + '|' + normalizeString(operation) + '|' + id,
      DC.Config.pepper('IDEMPOTENCY', v)
    );
  }

  function otpCode() {
    var seed = randomToken();
    var key = DC.Config.pepper('OTP', DC.Config.activeCryptoVersion());
    for (var counter = 0; counter < 32; counter += 1) {
      var bytes = hmacBytes(seed + '|' + counter, key);
      var value =
        (((bytes[0] + 256) % 256) << 16) |
        (((bytes[1] + 256) % 256) << 8) |
        ((bytes[2] + 256) % 256);
      if (value < 16000000) {
        return String(value % 1000000).padStart(6, '0');
      }
    }
    throw new Error('OTP_GENERATION_FAILED');
  }

  function hashOtp(signerId, challengeId, otp, version) {
    var v = version || DC.Config.activeCryptoVersion();
    return hmacHex(
      normalizeString(signerId) + '|' + normalizeString(challengeId) + '|' + String(otp),
      DC.Config.pepper('OTP', v)
    );
  }

  function deriveAuthSession(signerId, challengeId, otp, version) {
    var v = version || DC.Config.activeCryptoVersion();
    return hmacBase64Url(
      'SESSION|' + normalizeString(signerId) + '|' +
        normalizeString(challengeId) + '|' + String(otp),
      DC.Config.pepper('SESSION', v)
    );
  }

  function hashAuthSession(sessionToken, version) {
    if (!/^[A-Za-z0-9_-]{32,128}$/.test(String(sessionToken || ''))) {
      throw new Error('INVALID_SESSION');
    }
    var v = version || DC.Config.activeCryptoVersion();
    return hmacHex(sessionToken, DC.Config.pepper('SESSION', v));
  }

  function constantTimeEqual(left, right) {
    var a = String(left || '');
    var b = String(right || '');
    var length = Math.max(a.length, b.length);
    var difference = a.length ^ b.length;
    for (var index = 0; index < length; index += 1) {
      difference |= (a.charCodeAt(index % Math.max(a.length, 1)) || 0) ^
        (b.charCodeAt(index % Math.max(b.length, 1)) || 0);
    }
    return difference === 0;
  }

  function canonicalize(value) {
    if (value === null) return null;
    if (value instanceof Date) return value.toISOString();
    if (Array.isArray(value)) return value.map(canonicalize);
    if (typeof value === 'string') return normalizeString(value);
    if (typeof value === 'number') {
      if (!Number.isFinite(value)) throw new Error('NON_FINITE_NUMBER');
      return value;
    }
    if (typeof value === 'boolean') return value;
    if (typeof value === 'object') {
      var result = {};
      Object.keys(value).sort().forEach(function (key) {
        if (typeof value[key] === 'undefined') {
          throw new Error('UNDEFINED_CANONICAL_VALUE');
        }
        result[normalizeString(key)] = canonicalize(value[key]);
      });
      return result;
    }
    throw new Error('UNSUPPORTED_CANONICAL_VALUE');
  }

  function canonicalJson(value) {
    return JSON.stringify(canonicalize(value));
  }

  function documentHash(value) {
    return sha256Hex(canonicalJson(value));
  }

  function sheetText(value) {
    var text = normalizeString(value);
    return /^[=+\-@]/.test(text) ? "'" + text : text;
  }

  function htmlEscape(value) {
    return normalizeString(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function maskEmail(email) {
    var text = normalizeString(email).trim();
    var parts = text.split('@');
    if (parts.length !== 2) return '***';
    var local = parts[0];
    var visible = local.slice(0, Math.min(3, local.length));
    return visible + '***@' + parts[1];
  }

  return Object.freeze({
    normalizeString: normalizeString,
    bytesToHex: bytesToHex,
    sha256Hex: sha256Hex,
    hmacHex: hmacHex,
    hmacBase64Url: hmacBase64Url,
    randomToken: randomToken,
    randomId: randomId,
    isValidInvitationToken: isValidInvitationToken,
    hashInvitationToken: hashInvitationToken,
    hashIdempotency: hashIdempotency,
    otpCode: otpCode,
    hashOtp: hashOtp,
    deriveAuthSession: deriveAuthSession,
    hashAuthSession: hashAuthSession,
    constantTimeEqual: constantTimeEqual,
    canonicalJson: canonicalJson,
    documentHash: documentHash,
    sheetText: sheetText,
    htmlEscape: htmlEscape,
    maskEmail: maskEmail
  });
})();
