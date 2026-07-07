import assert from 'node:assert/strict';
import { handleRequest } from './worker.mjs';

const ORIGIN = 'https://daily-coach-ing.com';
const API_URL = `${ORIGIN}/api/kgm210-submit`;

function itemResponses() {
  return Array.from({ length: 210 }, (_, index) => ({
    no: index + 1,
    domain: ['K', 'I', 'N', 'G', 'D', 'O', 'M'][index % 7],
    process: ['X', 'Y', 'Z'][index % 3],
    z: index % 2 === 0,
    value: (index % 7) + 1
  }));
}

function samplePayload(overrides = {}) {
  const responses = itemResponses();
  return {
    submissionId: 'KGM-SUB-20260708-TEST0001',
    recordTitle: 'KGM210_KGM-20260708-TEST01_2026-07-08',
    createdAt: '2026-07-08T00:00:00.000Z',
    name: 'API 테스트',
    contact: '010-0000-0000',
    version: 'KGM210 v3.11 research-preflight',
    scale: '7점',
    growthType: '탐색형',
    growthLevel: '성장 확인',
    overallAvg: 4.72,
    axes: { X: 4.8, Y: 4.5, Z: 4.9 },
    domains: { K: 4.2, I: 4.4, N: 4.6, G: 4.8, D: 5.0, O: 4.9, M: 5.1 },
    topDomain: 'M 성장통합',
    priorityDomain: 'K 주도성',
    summary: '테스트용 결과 요약',
    experiments: '테스트용 추천 실험',
    answerCount: 210,
    completed: true,
    itemResponsesJson: JSON.stringify(responses),
    rawAnswers: Object.fromEntries(responses.map((item) => [String(item.no), item.value])),
    rawJson: '',
    userAgent: 'mock-agent',
    pageUrl: 'https://daily-coach-ing.com/tests/kgm210/',
    anonymousResearchId: 'KGM-20260708-TEST01',
    sampleGroup: '파일럿',
    ageBand: '40대',
    gender: '기타/무응답',
    occupationGroup: '코치/상담자',
    testPurpose: '파일럿',
    coachingExperience: '2~5회',
    retestKey: 'R-001',
    consentVersion: 'KGM210-ANON-2026-07-v1',
    researchUseStatus: '사용가능',
    researchConsent: true,
    durationSec: 930,
    ...overrides
  };
}

async function post(payload, env, origin = ORIGIN) {
  return handleRequest(new Request(API_URL, {
    method: 'POST',
    headers: { Origin: origin, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  }), env);
}

function makeEnv({ duplicate = false } = {}) {
  const calls = [];
  const env = {
    NOTION_TOKEN: 'test-token',
    NOTION_KGM210_DATA_SOURCE_ID: '367cc114-9118-43e4-9920-0decf9ae3e75',
    KGM210_ALLOWED_ORIGIN: ORIGIN,
    NOTION_API_BASE: 'https://notion.test/v1'
  };
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, init = {}) => {
    calls.push({ url: String(url), init });
    if (String(url).endsWith('/query')) {
      return new Response(JSON.stringify({
        object: 'list',
        results: duplicate ? [{ id: 'existing-page-id', url: 'https://notion.test/existing' }] : []
      }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }
    if (String(url).endsWith('/pages')) {
      const body = JSON.parse(init.body);
      assert.equal(body.properties['저장API상태'].select.name, '성공');
      assert.equal(body.properties['제출ID'].rich_text[0].text.content, 'KGM-SUB-20260708-TEST0001');
      assert.equal(body.properties['X 알아차림'].number, 4.8);
      assert.equal(body.properties['M 성장통합'].number, 5.1);
      assert.ok(body.properties['문항응답JSON'].rich_text.length > 0);
      return new Response(JSON.stringify({ id: 'created-page-id', url: 'https://notion.test/created' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    return new Response(JSON.stringify({ message: 'unexpected url' }), { status: 500 });
  };
  return {
    env,
    calls,
    restore() {
      globalThis.fetch = originalFetch;
    }
  };
}

async function run() {
  {
    const { env, calls, restore } = makeEnv();
    const response = await post(samplePayload(), env);
    const data = await response.json();
    restore();
    assert.equal(response.status, 200);
    assert.equal(data.ok, true);
    assert.equal(data.duplicate, false);
    assert.equal(data.pageId, 'created-page-id');
    assert.equal(calls.length, 2);
  }

  {
    const { env, calls, restore } = makeEnv({ duplicate: true });
    const response = await post(samplePayload(), env);
    const data = await response.json();
    restore();
    assert.equal(response.status, 200);
    assert.equal(data.ok, true);
    assert.equal(data.duplicate, true);
    assert.equal(calls.length, 1);
  }

  {
    const { env, restore } = makeEnv();
    const response = await post(samplePayload({ answerCount: 209 }), env);
    const data = await response.json();
    restore();
    assert.equal(response.status, 400);
    assert.equal(data.ok, false);
    assert.ok(data.errors.includes('answerCount=210 required'));
  }

  {
    const { env, restore } = makeEnv();
    const response = await post(samplePayload(), env, 'https://example.com');
    const data = await response.json();
    restore();
    assert.equal(response.status, 403);
    assert.equal(data.message, 'forbidden_origin');
  }

  {
    const { env, restore } = makeEnv();
    const response = await handleRequest(new Request(API_URL, {
      method: 'OPTIONS',
      headers: { Origin: ORIGIN }
    }), env);
    restore();
    assert.equal(response.status, 204);
  }

  console.log(JSON.stringify({
    ok: true,
    checked: ['create', 'duplicate', 'invalidPayload', 'originGuard', 'corsPreflight']
  }, null, 2));
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});

