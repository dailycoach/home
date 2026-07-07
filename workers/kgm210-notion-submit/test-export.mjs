import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { handleRequest } from './worker.mjs';

const ORIGIN = 'https://daily-coach-ing.com';
const WIDE_URL = `${ORIGIN}/wp-json/kgm210/v1/export-wide-csv`;
const LONG_URL = `${ORIGIN}/wp-json/kgm210/v1/export-long-csv`;

function itemResponses() {
  return Array.from({ length: 210 }, (_, index) => ({
    no: index + 1,
    domain: ['K', 'I', 'N', 'G', 'D', 'O', 'M'][index % 7],
    process: ['X', 'Y', 'Z'][index % 3],
    z: index % 2 === 0,
    value: (index % 7) + 1
  }));
}

function richText(value) {
  return { type: 'rich_text', rich_text: [{ plain_text: String(value), text: { content: String(value) } }] };
}

function title(value) {
  return { type: 'title', title: [{ plain_text: String(value), text: { content: String(value) } }] };
}

function select(value) {
  return { type: 'select', select: { name: value } };
}

function number(value) {
  return { type: 'number', number: value };
}

function checkbox(value) {
  return { type: 'checkbox', checkbox: value };
}

function date(value) {
  return { type: 'date', date: { start: value } };
}

function pageFixture() {
  const responses = itemResponses();
  return {
    object: 'page',
    id: 'page-1',
    url: 'https://notion.test/page-1',
    properties: {
      '검사기록': title('KGM210_KGM-20260708-TEST01_2026-07-08'),
      '제출ID': richText('KGM-SUB-20260708-TEST0001'),
      '익명연구ID': richText('KGM-20260708-TEST01'),
      '제출일시': date('2026-07-08T00:00:00.000Z'),
      '검사버전': richText('KGM210 v3.11 research-preflight'),
      '척도': select('7점'),
      '표본구분': select('파일럿'),
      '연령대': select('40대'),
      '성별': select('기타/무응답'),
      '직업군': select('코치/상담자'),
      '검사목적': select('파일럿'),
      '코칭경험': select('2~5회'),
      '재검사키': richText('R-001'),
      '검사소요초': number(930),
      '전체평균': number(4.72),
      'X 알아차림': number(4.8),
      'Y 세우기': number(4.5),
      'Z 해보기': number(4.9),
      'K 주도성': number(4.2),
      'I 존재초점': number(4.4),
      'N 자기이야기': number(4.6),
      'G 고유성': number(4.8),
      'D 책임경계': number(5.0),
      'O 실행기회': number(4.9),
      'M 성장통합': number(5.1),
      '연구사용상태': select('사용가능'),
      '완료여부': checkbox(true),
      '응답수': number(210),
      '문항응답JSON': richText(JSON.stringify(responses)),
      '스프레드시트동기화': select('대기')
    }
  };
}

function makeEnv() {
  const calls = [];
  const updates = [];
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
        results: [pageFixture()],
        has_more: false,
        next_cursor: null
      }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }
    if (String(url).includes('/pages/page-1')) {
      const body = JSON.parse(init.body || '{}');
      updates.push(body.properties?.['스프레드시트동기화']?.select?.name);
      return new Response(JSON.stringify({ id: 'page-1' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    return new Response(JSON.stringify({ message: 'unexpected url' }), { status: 500 });
  };
  return {
    env,
    calls,
    updates,
    restore() {
      globalThis.fetch = originalFetch;
    }
  };
}

async function getCsv(url, env) {
  const response = await handleRequest(new Request(url, {
    method: 'GET',
    headers: { Origin: ORIGIN }
  }), env);
  const text = await response.text();
  return { response, text };
}

function stripBom(text) {
  return text.replace(/^\uFEFF/, '');
}

async function run() {
  const { env, updates, restore } = makeEnv();
  let wideText;
  let longText;
  try {
    const wide = await getCsv(WIDE_URL, env);
    assert.equal(wide.response.status, 200);
    assert.match(wide.response.headers.get('Content-Type') || '', /text\/csv/);
    wideText = stripBom(wide.text);
    const wideLines = wideText.split(/\r?\n/);
    assert.equal(wideLines.length, 2);
    assert.ok(wideLines[0].includes('Q001'));
    assert.ok(wideLines[0].includes('Q210'));
    assert.ok(!wideLines[0].includes('이름'));
    assert.ok(!wideLines[0].includes('연락처'));
    assert.ok(wideLines[1].includes('KGM-20260708-TEST01'));

    const long = await getCsv(LONG_URL, env);
    assert.equal(long.response.status, 200);
    longText = stripBom(long.text);
    const longLines = longText.split(/\r?\n/);
    assert.equal(longLines.length, 211);
    assert.ok(longLines[0].includes('문항번호'));
    assert.ok(longLines[0].includes('응답값'));
    const scores = longLines.slice(1).map((line) => Number(line.split(',').at(-1)));
    assert.ok(scores.every((score) => Number.isInteger(score) && score >= 1 && score <= 7));
    assert.equal(updates.filter((status) => status === '완료').length, 2);
  } finally {
    restore();
  }

  if (process.env.KGM210_EXPORT_SAMPLE_DIR) {
    const outDir = path.resolve(process.env.KGM210_EXPORT_SAMPLE_DIR);
    await fs.mkdir(outDir, { recursive: true });
    await fs.writeFile(path.join(outDir, 'kgm210_wide_sample.csv'), `\uFEFF${wideText}`, 'utf8');
    await fs.writeFile(path.join(outDir, 'kgm210_long_sample.csv'), `\uFEFF${longText}`, 'utf8');
  }

  console.log(JSON.stringify({
    ok: true,
    checked: ['wideHeadersQ001ToQ210', 'long210RowsPerPerson', 'scores1To7', 'anonymousOnly', 'syncStatusComplete']
  }, null, 2));
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});

