(async () => {
  const version = '20260724-v7-question';

  for (const styleFile of ['micro-polish-v6.css', 'question-engine-v7.css']) {
    const style = document.createElement('link');
    style.rel = 'stylesheet';
    style.href = `./${styleFile}?v=${version}`;
    document.head.appendChild(style);
  }

  async function loadScript(file) {
    await new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = `./${file}?v=${version}`;
      script.onload = resolve;
      script.onerror = () => reject(new Error(`${file} 로드 실패`));
      document.head.appendChild(script);
    });
  }

  for (const file of [
    'data.js',
    'core.js',
    'game.js',
    'end.js',
    'micro-polish-v6.js',
    'job-content-v7.js',
    'question-engine-v7.js'
  ]) {
    await loadScript(file);
  }
})().catch(error => {
  console.error(error);
  document.body.innerHTML = '<main style="min-height:100vh;display:grid;place-items:center;padding:24px;background:#10172f;color:white;font-family:system-ui,sans-serif;text-align:center"><div><div style="font-size:4rem">🎮</div><h1>JOB BATTLE을 불러오지 못했어요.</h1><p>잠시 후 새로고침해 주세요.</p></div></main>';
});
