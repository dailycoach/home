(() => {
  'use strict';

  const DATA = window.DISC16_DATA;
  const STORAGE_KEY = 'disc16:answers:v2';
  const EXPECTED_PAIRS = ['DI','DS','DC','ID','IS','IC','SD','SI','SC','CD','CI','CS'];
  const PROFILE_FIELDS = ['name','tagline','core','motivation','fear','preferred','strength','work','relationship','communication','conflict','pressure','overuse','seen','needs','growth','coaching'];
  const PAIR_FIELDS = ['name','summary','contribution','motivation','tension','meeting','close','communication','pressure','needs','growth','coaching'];
  const PRESETS = ['D','I','S','C',...EXPECTED_PAIRS];
  const checks = [];

  function addCheck(name, pass, detail) {
    checks.push({ name, pass, detail });
  }

  function isPermutation(values, expected) {
    return values.length === expected.length && [...values].sort().join('') === [...expected].sort().join('');
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

  function calculateCode(answers) {
    const scores = Object.fromEntries(DATA.TYPES.map((type) => [type, 0]));
    answers.forEach((order) => order.forEach((type, rank) => { scores[type] += 4 - rank; }));
    const sorted = DATA.TYPES.map((type) => [type, scores[type]])
      .sort((a, b) => b[1] - a[1] || DATA.TYPES.indexOf(a[0]) - DATA.TYPES.indexOf(b[0]));
    const gap = sorted[0][1] - sorted[1][1];
    return {
      code: gap >= 8 ? sorted[0][0] : sorted[0][0] + sorted[1][0],
      scores,
      total: Object.values(scores).reduce((sum, value) => sum + value, 0)
    };
  }

  function validate() {
    addCheck('문항 수', DATA.QUESTIONS.length === 16, `${DATA.QUESTIONS.length}개`);
    addCheck('표시순서 수', DATA.DISPLAY.length === DATA.QUESTIONS.length, `${DATA.DISPLAY.length}개`);

    const questionShape = DATA.QUESTIONS.every((question) => {
      const types = question.choices.map(([type]) => type);
      return typeof question.scene === 'string' && question.scene.length >= 50 && question.choices.length === 4 && isPermutation(types, DATA.TYPES);
    });
    addCheck('상황지문·보기 구조', questionShape, '모든 문항에 50자 이상 지문과 D·I·S·C 보기 4개');

    const displayShape = DATA.DISPLAY.every((order) => isPermutation(order, [0,1,2,3]));
    addCheck('보기 위치 분산', displayShape, '모든 DISPLAY가 0·1·2·3 순열');

    const profileShape = DATA.TYPES.every((type) => PROFILE_FIELDS.every((field) => typeof DATA.PROFILES[type]?.[field] === 'string' && DATA.PROFILES[type][field].trim().length > 0));
    addCheck('기본유형 해설 필드', profileShape, `D·I·S·C × ${PROFILE_FIELDS.length}개 필드`);

    const pairKeys = Object.keys(DATA.PAIRS).sort();
    addCheck('조합형 12개', pairKeys.join(',') === [...EXPECTED_PAIRS].sort().join(','), pairKeys.join(' · '));

    const pairShape = EXPECTED_PAIRS.every((code) => PAIR_FIELDS.every((field) => typeof DATA.PAIRS[code]?.[field] === 'string' && DATA.PAIRS[code][field].trim().length > 0));
    addCheck('조합형 해설 필드', pairShape, `12조합 × ${PAIR_FIELDS.length}개 필드`);

    const targetNeeds = DATA.TYPES.every((type) => typeof DATA.TARGET_NEEDS[type] === 'string' && DATA.TARGET_NEEDS[type].length > 0);
    addCheck('상대유형 대화지침', targetNeeds, 'D·I·S·C 4개');

    const selfWatch = DATA.TYPES.every((primary) => DATA.TYPES.every((target) => typeof DATA.SELF_WATCH[primary]?.[target] === 'string' && DATA.SELF_WATCH[primary][target].length > 0));
    addCheck('주성향별 교류주의', selfWatch, '4×4 교류 매트릭스');

    const presetResults = PRESETS.map((code) => ({ expected: code, ...calculateCode(makePreset(code)) }));
    const presetPass = presetResults.every((item) => item.expected === item.code && item.total === 160);
    const failedPresets = presetResults.filter((item) => item.expected !== item.code || item.total !== 160);
    addCheck('16유형 합성결과', presetPass, failedPresets.length ? failedPresets.map((item) => `${item.expected}→${item.code}/${item.total}`).join(', ') : '16개 코드 및 총점 160점 일치');

    const scalePass = presetResults.every((item) => Object.values(item.scores).every((score) => {
      const scale = ((score - DATA.QUESTIONS.length) / (DATA.QUESTIONS.length * 3)) * 10;
      return scale >= 0 && scale <= 10;
    }));
    addCheck('10척도 범위', scalePass, '모든 합성결과 0.0~10.0');
  }

  function render() {
    const passCount = checks.filter((check) => check.pass).length;
    document.querySelector('#summary').innerHTML = `
      <div class="metric"><small>검증 항목</small><strong>${checks.length}</strong></div>
      <div class="metric"><small>통과</small><strong style="color:var(--ok)">${passCount}</strong></div>
      <div class="metric"><small>실패</small><strong style="color:${checks.length === passCount ? 'var(--muted)' : 'var(--bad)'}">${checks.length - passCount}</strong></div>`;

    document.querySelector('#checks').innerHTML = checks.map((check) => `
      <div class="check ${check.pass ? 'ok' : 'fail'}"><b>${check.pass ? '통과' : '실패'} · ${check.name}</b><span>${check.detail}</span></div>`).join('');

    const types = document.querySelector('#types');
    PRESETS.forEach((code) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'type-btn';
      button.textContent = code;
      button.addEventListener('click', () => preview(code));
      types.appendChild(button);
    });
  }

  function preview(code) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(makePreset(code)));
    document.querySelector('#viewerTitle').textContent = `${code} 결과 미리보기`;
    const viewer = document.querySelector('#viewer');
    viewer.onload = () => {
      window.setTimeout(() => {
        const button = viewer.contentDocument?.querySelector('#startBtn');
        if (button) button.click();
      }, 80);
    };
    viewer.src = `./?qa=${encodeURIComponent(code)}&ts=${Date.now()}`;
  }

  document.querySelector('#clear').addEventListener('click', () => {
    localStorage.removeItem(STORAGE_KEY);
    document.querySelector('#viewer').src = 'about:blank';
    document.querySelector('#viewerTitle').textContent = '결과 미리보기';
  });

  validate();
  render();
})();
