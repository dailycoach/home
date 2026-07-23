(async () => {
  const version = '20260723-v6-micro';

  const polishStyle = document.createElement('link');
  polishStyle.rel = 'stylesheet';
  polishStyle.href = `./micro-polish-v6.css?v=${version}`;
  document.head.appendChild(polishStyle);

  async function loadScript(file) {
    await new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = `./${file}?v=${version}`;
      script.onload = resolve;
      script.onerror = () => reject(new Error(`${file} 로드 실패`));
      document.head.appendChild(script);
    });
  }

  for (const file of ['data.js', 'core.js', 'game.js', 'end.js', 'micro-polish-v6.js']) {
    await loadScript(file);
  }
})().catch(error => {
  console.error(error);
  document.body.innerHTML = '<main style="min-height:100vh;display:grid;place-items:center;padding:24px;background:#10172f;color:white;font-family:system-ui,sans-serif;text-align:center"><div><div style="font-size:4rem">🎮</div><h1>JOB BATTLE을 불러오지 못했어요.</h1><p>잠시 후 새로고침해 주세요.</p></div></main>';
});
