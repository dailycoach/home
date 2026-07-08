import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';

const codePath = new URL('./Code.gs', import.meta.url);
const code = await fs.readFile(codePath, 'utf8');

function extractJsonConst(name, nextName) {
  const startToken = `const ${name} = `;
  const endToken = `;\nconst ${nextName}`;
  const start = code.indexOf(startToken);
  const end = code.indexOf(endToken, start + startToken.length);
  if (start < 0 || end < 0) throw new Error(`Missing ${name}`);
  return JSON.parse(code.slice(start + startToken.length, end));
}

const itemMaster = extractJsonConst('KGM210_ITEM_MASTER', 'KGM210_WIDE_HEADERS');
const wideHeaders = extractJsonConst('KGM210_WIDE_HEADERS', 'KGM210_LONG_HEADERS');
const longHeaders = extractJsonConst('KGM210_LONG_HEADERS', 'KGM210_ITEM_ANALYSIS_HEADERS');

function countBy(rows, key) {
  return rows.reduce((acc, row) => {
    const value = row[key];
    acc[value] = (acc[value] || 0) + 1;
    return acc;
  }, {});
}

function samplePayload() {
  const responses = itemMaster.map((item, index) => ({
    no: item.no,
    domain: `${item.domainCode} ${item.domainName}`,
    process: item.processName,
    z: item.z,
    value: (index % 7) + 1,
  }));
  return {
    submissionId: 'KGM-SUB-ITEM-RESEARCH-TEST',
    anonymousResearchId: 'KGM-CODEX-ITEM-RESEARCH',
    createdAt: '2026-07-08T00:00:00.000Z',
    version: 'KGM210 v3.11 research-preflight',
    scale: '7점',
    sampleGroup: '연결테스트',
    ageBand: '40대',
    gender: '응답안함',
    occupationGroup: '코칭/상담',
    testPurpose: '저장위치확인',
    coachingExperience: '있음',
    retestKey: 'R-ITEM-001',
    durationSec: 930,
    researchUseStatus: '사용가능',
    overallAvg: 4.72,
    axes: { X: 4.8, Y: 4.5, Z: 4.9 },
    domains: { K: 4.2, I: 4.4, N: 4.6, G: 4.8, D: 5, O: 4.9, M: 5.1 },
    completed: true,
    answerCount: 210,
    itemResponsesJson: JSON.stringify(responses),
  };
}

function buildRows(payload) {
  const axes = payload.axes || {};
  const domains = payload.domains || {};
  const itemResponses = JSON.parse(payload.itemResponsesJson);
  const byNo = new Map(itemResponses.map((item, index) => [Number(item.no || index + 1), Number(item.value)]));
  const base = [
    payload.submissionId, payload.anonymousResearchId, payload.createdAt, payload.version, payload.scale,
    payload.sampleGroup, payload.ageBand, payload.gender, payload.occupationGroup, payload.testPurpose,
    payload.coachingExperience, payload.retestKey, payload.durationSec, payload.researchUseStatus,
    payload.overallAvg, axes.X, axes.Y, axes.Z, domains.K, domains.I, domains.N, domains.G, domains.D, domains.O, domains.M,
  ];
  const wide = base.concat(itemMaster.map(item => byNo.get(item.no)));
  const long = itemMaster.map(item => [
    payload.submissionId,
    payload.anonymousResearchId,
    payload.createdAt,
    payload.version || item.researchVersion,
    item.no,
    item.code,
    item.displayOrder,
    item.sevenNo,
    item.sevenName,
    item.domainCode,
    item.domainName,
    item.processAxis,
    item.processName,
    item.z,
    item.zName,
    byNo.get(item.no),
  ]);
  return { wide, long };
}

function csvCell(value) {
  const text = String(value ?? '');
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function toCsv(headers, rows) {
  return [headers, ...rows].map(row => row.map(csvCell).join(',')).join('\r\n');
}

const payload = samplePayload();
const rows = buildRows(payload);
const domainCounts = countBy(itemMaster, 'domainCode');
const processCounts = countBy(itemMaster, 'processAxis');
const zCounts = countBy(itemMaster, 'z');
const sevenCounts = countBy(itemMaster, 'sevenNo');

assert.equal(itemMaster.length, 210);
assert.deepEqual(domainCounts, { K: 30, I: 30, N: 30, G: 30, D: 30, O: 30, M: 30 });
assert.deepEqual(processCounts, { X: 70, Y: 70, Z: 70 });
assert.deepEqual(zCounts, { Z1: 21, Z2: 21, Z3: 21, Z4: 21, Z5: 21, Z6: 21, Z7: 21, Z8: 21, Z9: 21, Z10: 21 });
assert.deepEqual(sevenCounts, { 1: 21, 2: 42, 3: 21, 4: 63, 5: 21, 6: 21, 7: 21 });
assert.equal(wideHeaders.length, 235);
assert.equal(wideHeaders[13], '연구사용상태');
assert.equal(wideHeaders.at(-1), 'Q210');
assert.equal(wideHeaders.filter(header => /^Q\d{3}$/.test(header)).length, 210);
assert.equal(longHeaders.length, 16);
assert.deepEqual(longHeaders, ['제출ID', '익명연구ID', '제출일시', '검사버전', '문항번호', '문항코드', '검사노출순서', '7문번호', '7문명', '영역코드', '영역명', '과정축', '과정명', 'Z지표', 'Z지표명', '응답값']);
assert.equal(rows.wide.length, 235);
assert.equal(rows.long.length, 210);
assert.ok(rows.long.every(row => Number.isInteger(row.at(-1)) && row.at(-1) >= 1 && row.at(-1) <= 7));
assert.ok(!wideHeaders.includes('이름'));
assert.ok(!wideHeaders.includes('연락처'));
assert.ok(!longHeaders.includes('이름'));
assert.ok(!longHeaders.includes('연락처'));

const outDir = path.resolve('..', '..', 'kgm210-item-research-samples');
await fs.mkdir(outDir, { recursive: true });
await fs.writeFile(path.join(outDir, 'kgm210_item_research_wide_sample.csv'), `\uFEFF${toCsv(wideHeaders, [rows.wide])}`, 'utf8');
await fs.writeFile(path.join(outDir, 'kgm210_item_research_long_sample.csv'), `\uFEFF${toCsv(longHeaders, rows.long)}`, 'utf8');

console.log(JSON.stringify({
  ok: true,
  itemCount: itemMaster.length,
  domainCounts,
  processCounts,
  zCounts,
  sevenCounts,
  wideColumns: rows.wide.length,
  longColumns: longHeaders.length,
  longRows: rows.long.length,
  qLast: wideHeaders.at(-1),
  anonymousOnly: true,
}, null, 2));
