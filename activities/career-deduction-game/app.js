(async()=>{
  const version='20260722';
  for(const file of ['data.js','core.js','game.js','end.js']){
    await new Promise((resolve,reject)=>{
      const script=document.createElement('script');
      script.src=`./${file}?v=${version}`;
      script.onload=resolve;
      script.onerror=()=>reject(new Error(`${file} 로드 실패`));
      document.head.appendChild(script);
    });
  }
})().catch(error=>{
  console.error(error);
  document.body.innerHTML='<main style="min-height:100vh;display:grid;place-items:center;padding:24px;background:#071a35;color:white;font-family:system-ui,sans-serif;text-align:center"><div><h1>게임을 불러오지 못했습니다.</h1><p>잠시 후 새로고침해 주세요.</p></div></main>';
});
