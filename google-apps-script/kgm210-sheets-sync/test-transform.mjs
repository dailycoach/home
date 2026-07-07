import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';

const wideBaseHeaders = [
  '제출ID', '익명연구ID', '제출일시', '검사버전', '척도',
  '표본구분', '연령대', '성별', '직업군', '검사목적',
  '코칭경험', '재검사키', '검사소요초', '전체평균',
  'X 알아차림', 'Y 세우기', 'Z 해보기',
  'K 주도성', 'I 존재초점', 'N 자기이야기', 'G 고유성',
  'D 책임경계', 'O 실행기회', 'M 성장통합'
];
const wideHeaders = wideBaseHeaders.concat(Array.from({ length: 210 }, (_, i) => `Q${String(i + 1).padStart(3, '0')}`));
const longHeaders = ['제출ID', '익명연구ID', '제출일시', '검사버전', '척도', '문항번호', '영역', '과정', 'Z지표', '응답값'];

function samplePayload() {
  const responses = Array.from({ length: 210 }, (_, index) => ({
    no: index + 1,
    domain: ['K', 'I', 'N', 'G', 'D', 'O', 'M'][index % 7],
    process: ['X', 'Y', 'Z'][index % 3],
    z: index % 2 === 0,
    value: (index % 7) + 1
  }));
  return {
    submissionId: 'KGM-SUB-20260708-GSHEET01',
    anonymousResearchId: 'KGM-20260708-GS01',
    createdAt: '2026-07-08T00:00:00.000Z',
    version: 'KGM210 v3.11 research-preflight',
    scale: '7점',
    sampleGroup: '파일럿',
    ageBand: '40대',
    gender: '기타/무응답',
    occupationGroup: '코치/상담자',
    testPurpose: '파일럿',
    coachingExperience: '2~5회',
    retestKey: 'R-001',
    durationSec: 930,
    overallAvg: 4.72,
    axes: { X: 4.8, Y: 4.5, Z: 4.9 },
    domains: { K: 4.2, I: 4.4, N: 4.6, G: 4.8, D: 5, O: 4.9, M: 5.1 },
    completed: true,
    answerCount: 210,
    itemResponsesJson: JSON.stringify(responses)
  };
}

function buildRows(payload) {
  const axes = payload.axes || {};
  const domains = payload.domains || {};
  const itemResponses = JSON.parse(payload.itemResponsesJson);
  const byNo = new Map(itemResponses.map((item, index) => [Number(item.no || index + 1), item]));
  const base = [
    payload.submissionId, payload.anonymousResearchId, payload.createdAt, payload.version, payload.scale,
    payload.sampleGroup, payload.ageBand, payload.gender, payload.occupationGroup, payload.testPurpose,
    payload.coachingExperience, payload.retestKey, payload.durationSec, payload.overallAvg,
    axes.X, axes.Y, axes.Z, domains.K, domains.I, domains.N, domains.G, domains.D, domains.O, domains.M
  ];
  const wide = base.concat(Array.from({ length: 210 }, (_, index) => Number(byNo.get(index + 1).value)));
  const long = Array.from({ length: 210 }, (_, index) => {
    const item = byNo.get(index + 1);
    return [payload.submissionId, payload.anonymousResearchId, payload.createdAt, payload.version, payload.scale, index + 1, item.domain, item.process, item.z ? 1 : 0, Number(item.value)];
  });
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

assert.equal(rows.wide.length, 234);
assert.equal(rows.long.length, 210);
assert.equal(wideHeaders.at(-1), 'Q210');
assert.ok(rows.long.every(row => Number.isInteger(row.at(-1)) && row.at(-1) >= 1 && row.at(-1) <= 7));
assert.ok(!wideHeaders.includes('이름'));
assert.ok(!wideHeaders.includes('연락처'));
assert.ok(!longHeaders.includes('이름'));
assert.ok(!longHeaders.includes('연락처'));

const outDir = path.resolve('..', '..', 'kgm210-gsheet-samples');
await fs.mkdir(outDir, { recursive: true });
await fs.writeFile(path.join(outDir, 'kgm210_gsheet_wide_sample.csv'), `\uFEFF${toCsv(wideHeaders, [rows.wide])}`, 'utf8');
await fs.writeFile(path.join(outDir, 'kgm210_gsheet_long_sample.csv'), `\uFEFF${toCsv(longHeaders, rows.long)}`, 'utf8');

console.log(JSON.stringify({
  ok: true,
  wideColumns: rows.wide.length,
  longRows: rows.long.length,
  qLast: wideHeaders.at(-1),
  anonymousOnly: true
}, null, 2));

