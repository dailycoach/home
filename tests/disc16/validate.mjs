import fs from 'node:fs';
import vm from 'node:vm';
import process from 'node:process';

const dataPath = new URL('./data.js', import.meta.url);
const source = fs.readFileSync(dataPath, 'utf8');
const sandbox = { window: {} };
vm.createContext(sandbox);
vm.runInContext(source, sandbox, { filename: 'data.js' });

const DATA = sandbox.window.DISC16_DATA;
if (!DATA) throw new Error('window.DISC16_DATA를 불러오지 못했습니다.');

const EXPECTED_TYPES = ['D', 'I', 'S', 'C'];
const EXPECTED_PAIRS = ['DI','DS','DC','ID','IS','IC','SD','SI','SC','CD','CI','CS'];
const PROFILE_FIELDS = ['name','tagline','core','motivation','fear','preferred','strength','work','relationship','communication','conflict','pressure','overuse','seen','needs','growth','coaching'];
const PAIR_FIELDS = ['name','summary','contribution','motivation','tension','meeting','close','communication','pressure','needs','growth','coaching'];
const PRESETS = [...EXPECTED_TYPES, ...EXPECTED_PAIRS];
const failures = [];
const passes = [];

function check(name, condition, detail = '') {
  if (condition) passes.push({ name, detail });
  else failures.push({ name, detail });
}

function isPermutation(values, expected) {
  return values.length === expected.length && [...values].sort().join('|') === [...expected].sort().join('|');
}

function hasText(value, min = 1) {
  return typeof value === 'string' && value.trim().length >= min;
}

function makePreset(code) {
  const types = DATA.TYPES;
  if (code.length === 1) {
    const rest = types.filter((type) => type !== code);
    return DATA.QUESTIONS.map((_, index) => [code, rest[index % 3], rest[(index + 1) % 3], rest[(index + 2) % 3]]);
  }
  const [first, second] = code;
  const rest = types.filter((type) => type !== first && type !== second);
  return DATA.QUESTIONS.map((_, index) => index < 9
    ? [first, second, rest[0], rest[1]]
    : [second, first, rest[0], rest[1]]);
}

function calculate(answers) {
  const scores = Object.fromEntries(DATA.TYPES.map((type) => [type, 0]));
  answers.forEach((order) => order.forEach((type, rank) => { scores[type] += 4 - rank; }));
  const sorted = DATA.TYPES.map((type) => [type, scores[type]])
    .sort((a, b) => b[1] - a[1] || DATA.TYPES.indexOf(a[0]) - DATA.TYPES.indexOf(b[0]));
  const gap = sorted[0][1] - sorted[1][1];
  const code = gap >= 8 ? sorted[0][0] : sorted[0][0] + sorted[1][0];
  const scales = Object.fromEntries(DATA.TYPES.map((type) => [
    type,
    ((scores[type] - DATA.QUESTIONS.length) / (DATA.QUESTIONS.length * 3)) * 10
  ]));
  return { code, scores, scales, total: Object.values(scores).reduce((sum, score) => sum + score, 0) };
}

check('유형 코드', isPermutation(DATA.TYPES, EXPECTED_TYPES), JSON.stringify(DATA.TYPES));
check('문항 수', DATA.QUESTIONS.length === 16, `${DATA.QUESTIONS.length}개`);
check('표시 순서 수', DATA.DISPLAY.length === DATA.QUESTIONS.length, `${DATA.DISPLAY.length}개`);

DATA.QUESTIONS.forEach((question, index) => {
  const types = question.choices?.map(([type]) => type) ?? [];
  const keywords = question.choices?.map(([, keyword]) => keyword) ?? [];
  check(`문항 ${index + 1} 지문`, hasText(question.scene, 50), `${question.scene?.length ?? 0}자`);
  check(`문항 ${index + 1} 보기 유형`, isPermutation(types, EXPECTED_TYPES), types.join(','));
  check(`문항 ${index + 1} 보기 키워드`, keywords.length === 4 && keywords.every((keyword) => hasText(keyword, 2) && keyword.length <= 12), keywords.join(' / '));
  check(`문항 ${index + 1} 표시 순열`, isPermutation(DATA.DISPLAY[index] ?? [], [0,1,2,3]), JSON.stringify(DATA.DISPLAY[index]));
});

EXPECTED_TYPES.forEach((type) => {
  const profile = DATA.PROFILES[type];
  check(`${type} 기본 해설 존재`, Boolean(profile), '');
  PROFILE_FIELDS.forEach((field) => check(`${type}.${field}`, hasText(profile?.[field], 4), profile?.[field] ?? '누락'));
});

const pairKeys = Object.keys(DATA.PAIRS).sort();
check('조합형 코드 12개', pairKeys.join(',') === [...EXPECTED_PAIRS].sort().join(','), pairKeys.join(','));
EXPECTED_PAIRS.forEach((code) => {
  const pair = DATA.PAIRS[code];
  check(`${code} 조합 해설 존재`, Boolean(pair), '');
  PAIR_FIELDS.forEach((field) => check(`${code}.${field}`, hasText(pair?.[field], 4), pair?.[field] ?? '누락'));
});

EXPECTED_TYPES.forEach((type) => {
  check(`${type} 상대 대화지침`, hasText(DATA.TARGET_NEEDS?.[type], 4), DATA.TARGET_NEEDS?.[type] ?? '누락');
  EXPECTED_TYPES.forEach((target) => check(`${type}→${target} 교류지침`, hasText(DATA.SELF_WATCH?.[type]?.[target], 4), DATA.SELF_WATCH?.[type]?.[target] ?? '누락'));
});

PRESETS.forEach((expected) => {
  const result = calculate(makePreset(expected));
  check(`${expected} 합성 코드`, result.code === expected, `${expected} → ${result.code}`);
  check(`${expected} 총점`, result.total === 160, String(result.total));
  check(`${expected} 척도 범위`, Object.values(result.scales).every((value) => value >= 0 && value <= 10), JSON.stringify(result.scales));
  check(`${expected} 척도 합`, Math.abs(Object.values(result.scales).reduce((sum, value) => sum + value, 0) - 20) < 1e-9, JSON.stringify(result.scales));
});

const allInterpretationText = [
  ...Object.values(DATA.PROFILES).flatMap((profile) => PROFILE_FIELDS.map((field) => profile[field])),
  ...Object.values(DATA.PAIRS).flatMap((pair) => PAIR_FIELDS.map((field) => pair[field]))
].join('\n');
const forbidden = ['최고의 유형', '가장 우수한 유형', '정확한 진단', '영원히 변하지'];
forbidden.forEach((phrase) => check(`금지 표현: ${phrase}`, !allInterpretationText.includes(phrase), phrase));

console.log(`DISC16 검증: ${passes.length}개 통과, ${failures.length}개 실패`);
passes.forEach(({ name }) => console.log(`✓ ${name}`));

if (failures.length) {
  console.error('\n실패 항목');
  failures.forEach(({ name, detail }) => console.error(`✗ ${name}: ${detail}`));
  process.exit(1);
}

console.log('\n모든 DISC16 검증을 통과했습니다.');
