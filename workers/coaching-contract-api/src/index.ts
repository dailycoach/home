import { enforceRateLimit, requestId, verifyAdminRequest } from './auth';
import {
  cancelAdminContract,
  createAdminContract,
  exchangeFinalAccessToken,
  exchangeInviteToken,
  finalizeAdminContract,
  getAdminContract,
  getAdminFinalDocument,
  getContractFinalDocument,
  getCustomerSnapshot,
  getFinalAccessDocument,
  getFinalAccessSessionSummary,
  getInviteExchangeSummary,
  issueAdminFinalAccess,
  issueAdminContract,
  listAdminContracts,
  reissueAdminContract,
  saveCustomerConsents,
  signCustomerContract,
  terminateAdminContract,
  updateAdminContract,
  verifyInviteIdentity,
  withdrawFinalConsents,
} from './contracts';
import type { ServiceResult } from './contracts';
import { assertApprovedServerTemplate, approvedPolicyVariables } from './templates';
import type { Env, ExecutionContextLike } from './types';
import { HttpError, readJsonBody, validateRuntimeConfiguration } from './validation';

const API_VERSION = 'coaching-contract-api-v1';

function corsHeaders(request: Request, env: Env): Headers {
  const headers = new Headers({
    'Cache-Control': 'no-store, max-age=0',
    'Content-Security-Policy': "default-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'",
    'Cross-Origin-Resource-Policy': 'same-site',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=(), usb=()',
    'Referrer-Policy': 'no-referrer',
    'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
  });
  const origin = request.headers.get('Origin');
  if (origin === env.ALLOWED_ORIGIN) {
    headers.set('Access-Control-Allow-Origin', env.ALLOWED_ORIGIN);
    headers.set('Access-Control-Allow-Credentials', 'true');
    headers.set('Vary', 'Origin');
  }
  return headers;
}

function assertAllowedOrigin(request: Request, env: Env): void {
  const origin = request.headers.get('Origin');
  if (origin !== null && origin !== env.ALLOWED_ORIGIN) {
    throw new HttpError(403, 'ORIGIN_NOT_ALLOWED', 'Request origin is not allowed');
  }
}

function jsonResponse(request: Request, env: Env, value: unknown, status = 200): Response {
  const headers = corsHeaders(request, env);
  headers.set('Content-Type', 'application/json; charset=utf-8');
  return new Response(JSON.stringify(value), { status, headers });
}

function serviceResponse(request: Request, env: Env, result: ServiceResult): Response {
  if (result.html !== undefined) {
    const headers = corsHeaders(request, env);
    headers.set('Content-Type', 'text/html; charset=utf-8');
    headers.set(
      'Content-Security-Policy',
      "default-src 'none'; style-src 'unsafe-inline'; img-src 'self' data:; frame-ancestors 'none'; base-uri 'none'; form-action 'none'",
    );
    return new Response(result.html, { status: result.status ?? 200, headers });
  }
  return jsonResponse(request, env, result.body ?? null, result.status ?? 200);
}

function errorResponse(request: Request, env: Env, error: unknown, traceId: string): Response {
  if (error instanceof HttpError) {
    return jsonResponse(request, env, {
      code: error.code,
      message: error.message,
      request_id: traceId,
      ...(error.details ? { details: error.details } : {}),
    }, error.status);
  }
  return jsonResponse(request, env, {
    code: 'INTERNAL_ERROR',
    message: 'The contract service could not process this request.',
    request_id: traceId,
  }, 500);
}

async function serviceReadiness(env: Env): Promise<boolean> {
  try {
    validateRuntimeConfiguration(env);
    const schema = await env.DB.prepare(
      `SELECT COUNT(*) AS table_count FROM sqlite_master
        WHERE type = 'table' AND name IN (
          'contracts', 'contract_parties', 'contract_versions', 'contract_consents',
          'contract_invites', 'contract_audit_events', 'contract_final_documents'
        )`,
    ).first<{ table_count: number }>();
    if (schema?.table_count !== 7) return false;
    if (env.LEGAL_REVIEW_STATUS !== 'APPROVED'
      || env.CONTRACT_RETENTION_POLICY === 'LEGAL_REVIEW_REQUIRED'
      || env.PROCESSOR_AND_TRANSFER_POLICY === 'LEGAL_REVIEW_REQUIRED'
      || env.DISPUTE_AND_REFUND_POLICY === 'LEGAL_REVIEW_REQUIRED') {
      return false;
    }
    approvedPolicyVariables(env);
    await Promise.all((['life', 'business', 'career'] as const).map(async (contractType) => {
      const manifests = JSON.parse(env.APPROVED_TEMPLATE_MANIFESTS) as Record<string, string>;
      const key = Object.keys(manifests).find((item) => item.startsWith(`${contractType}:`));
      if (!key) throw new Error('Template manifest missing');
      await assertApprovedServerTemplate(env, contractType, key.slice(contractType.length + 1));
    }));
    return true;
  } catch {
    return false;
  }
}

function routeContractId(pathname: string, suffix = ''): string | undefined {
  const escapedSuffix = suffix.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
  const match = pathname.match(new RegExp(`^/v1/(?:admin/)?contracts/([0-9a-f-]{36})${escapedSuffix}$`, 'iu'));
  return match?.[1];
}

async function handleAdmin(
  request: Request,
  env: Env,
  url: URL,
): Promise<Response> {
  const identity = await verifyAdminRequest(request, env);
  await enforceRateLimit(request, env, 'admin', 120, 60, identity.subject);
  if (request.method === 'GET' && url.pathname === '/v1/admin/session') {
    const ready = await serviceReadiness(env);
    return jsonResponse(request, env, {
      authenticated: true,
      access_protected: true,
      contract_service_ready: ready,
      legal_review_status: env.LEGAL_REVIEW_STATUS,
      legal_review_ready: ready && env.LEGAL_REVIEW_STATUS === 'APPROVED',
      legal_review_reference: ready ? env.LEGAL_REVIEW_REFERENCE : null,
    });
  }
  if (url.pathname === '/v1/admin/contracts') {
    if (request.method === 'GET') return serviceResponse(request, env, await listAdminContracts(env, url));
    if (request.method === 'POST') {
      return serviceResponse(
        request,
        env,
        await createAdminContract(request, env, identity, await readJsonBody(request)),
      );
    }
  }
  const issueId = routeContractId(url.pathname, '/issue');
  if (issueId && request.method === 'POST') {
    return serviceResponse(
      request,
      env,
      await issueAdminContract(request, env, identity, issueId, await readJsonBody(request)),
    );
  }
  const cancelId = routeContractId(url.pathname, '/cancel');
  if (cancelId && request.method === 'POST') {
    await readJsonBody(request, 20_000);
    return serviceResponse(request, env, await cancelAdminContract(request, env, cancelId));
  }
  const reissueId = routeContractId(url.pathname, '/reissue');
  if (reissueId && request.method === 'POST') {
    return serviceResponse(
      request,
      env,
      await reissueAdminContract(request, env, identity, reissueId, await readJsonBody(request)),
    );
  }
  const terminateId = routeContractId(url.pathname, '/terminate');
  if (terminateId && request.method === 'POST') {
    await readJsonBody(request, 20_000);
    return serviceResponse(request, env, await terminateAdminContract(request, env, terminateId));
  }
  const finalDocumentId = routeContractId(url.pathname, '/final-document');
  if (finalDocumentId && request.method === 'GET') {
    return serviceResponse(request, env, await getAdminFinalDocument(request, env, finalDocumentId));
  }
  const finalizeId = routeContractId(url.pathname, '/finalize');
  if (finalizeId && request.method === 'POST') {
    await readJsonBody(request, 20_000);
    return serviceResponse(request, env, await finalizeAdminContract(request, env, finalizeId));
  }
  const finalAccessId = routeContractId(url.pathname, '/final-access');
  if (finalAccessId && request.method === 'POST') {
    return serviceResponse(
      request,
      env,
      await issueAdminFinalAccess(request, env, finalAccessId, await readJsonBody(request, 20_000)),
    );
  }
  const contractId = routeContractId(url.pathname);
  if (contractId) {
    if (request.method === 'GET') return serviceResponse(request, env, await getAdminContract(env, contractId));
    if (request.method === 'PATCH') {
      return serviceResponse(
        request,
        env,
        await updateAdminContract(request, env, identity, contractId, await readJsonBody(request)),
      );
    }
  }
  throw new HttpError(404, 'ENDPOINT_NOT_FOUND', 'Endpoint was not found');
}

async function handleCustomer(request: Request, env: Env, url: URL): Promise<Response> {
  if (/^\/v1\/(?:invites|final-access)\/[A-Za-z0-9_-]+(?:\/summary|\/verify)?$/u.test(url.pathname)) {
    throw new HttpError(
      410,
      'TOKEN_IN_URL_DISABLED',
      'Path-based token endpoints are disabled; exchange the token in a POST body.',
    );
  }
  if (url.pathname === '/v1/invites/exchange' && request.method === 'POST') {
    await enforceRateLimit(request, env, 'invite-exchange', 20, 60);
    return serviceResponse(request, env, await exchangeInviteToken(request, env, await readJsonBody(request, 10_000)));
  }
  if (url.pathname === '/v1/invites/summary' && request.method === 'GET') {
    await enforceRateLimit(request, env, 'invite-summary', 60, 60);
    return serviceResponse(request, env, await getInviteExchangeSummary(request, env));
  }
  if (url.pathname === '/v1/invites/verify' && request.method === 'POST') {
    await enforceRateLimit(request, env, 'invite-verify', 10, 600);
    return serviceResponse(
      request,
      env,
      await verifyInviteIdentity(request, env, await readJsonBody(request, 10_000)),
    );
  }
  if (url.pathname === '/v1/final-access/exchange' && request.method === 'POST') {
    await enforceRateLimit(request, env, 'final-access-exchange', 20, 60);
    return serviceResponse(
      request,
      env,
      await exchangeFinalAccessToken(request, env, await readJsonBody(request, 10_000)),
    );
  }
  if (url.pathname === '/v1/final-access' && request.method === 'GET') {
    await enforceRateLimit(request, env, 'final-access-summary', 60, 60);
    return serviceResponse(request, env, await getFinalAccessSessionSummary(request, env));
  }
  if (url.pathname === '/v1/final-access/document' && request.method === 'GET') {
    await enforceRateLimit(request, env, 'final-access-document', 30, 60);
    return serviceResponse(request, env, await getFinalAccessDocument(request, env));
  }

  const snapshotId = routeContractId(url.pathname, '/snapshot');
  if (snapshotId && request.method === 'GET') {
    await enforceRateLimit(request, env, 'contract-snapshot', 60, 60);
    return serviceResponse(request, env, await getCustomerSnapshot(request, env, snapshotId));
  }
  const consentId = routeContractId(url.pathname, '/consents');
  if (consentId && request.method === 'POST') {
    await enforceRateLimit(request, env, 'contract-consents', 30, 60);
    return serviceResponse(
      request,
      env,
      await saveCustomerConsents(request, env, consentId, await readJsonBody(request, 80_000)),
    );
  }
  const signId = routeContractId(url.pathname, '/sign');
  if (signId && request.method === 'POST') {
    await enforceRateLimit(request, env, 'contract-sign', 10, 60);
    return serviceResponse(
      request,
      env,
      await signCustomerContract(request, env, signId, await readJsonBody(request, 30_000)),
    );
  }
  const withdrawalId = routeContractId(url.pathname, '/consents/withdraw');
  if (withdrawalId && request.method === 'POST') {
    await enforceRateLimit(request, env, 'consent-withdrawal', 10, 60);
    return serviceResponse(
      request,
      env,
      await withdrawFinalConsents(request, env, withdrawalId, await readJsonBody(request, 20_000)),
    );
  }
  const finalDocumentId = routeContractId(url.pathname, '/final-document');
  if (finalDocumentId && request.method === 'GET') {
    await enforceRateLimit(request, env, 'contract-final-document', 30, 60);
    return serviceResponse(request, env, await getContractFinalDocument(request, env, finalDocumentId));
  }
  throw new HttpError(404, 'ENDPOINT_NOT_FOUND', 'Endpoint was not found');
}

async function handleRequest(request: Request, env: Env): Promise<Response> {
  assertAllowedOrigin(request, env);
  const url = new URL(request.url);
  if (request.method === 'OPTIONS') {
    const headers = corsHeaders(request, env);
    headers.set('Access-Control-Allow-Methods', 'GET, POST, PATCH, OPTIONS');
    headers.set(
      'Access-Control-Allow-Headers',
      'Authorization, Cf-Access-Jwt-Assertion, Content-Type, X-Requested-With',
    );
    headers.set('Access-Control-Max-Age', '600');
    return new Response(null, { status: 204, headers });
  }
  if (request.method === 'GET' && url.pathname === '/v1/health') {
    return jsonResponse(request, env, {
      status: 'ok',
      api_version: API_VERSION,
      contract_service_ready: await serviceReadiness(env),
      deployment_state: 'code_ready_external_configuration_required',
    });
  }
  if (url.pathname.startsWith('/v1/admin/')) return handleAdmin(request, env, url);
  return handleCustomer(request, env, url);
}

export default {
  async fetch(request: Request, env: Env, _context: ExecutionContextLike): Promise<Response> {
    const traceId = requestId(request);
    try {
      return await handleRequest(request, env);
    } catch (error) {
      return errorResponse(request, env, error, traceId);
    }
  },
};
