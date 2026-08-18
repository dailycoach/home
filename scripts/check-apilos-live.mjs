const base = 'https://daily-coach-ing.com';
const checks = [
  ['/apilos/', 200, '융합과 통섭으로'],
  ['/apilos/center/', 200, '한 분야로'],
  ['/apilos/programs/', 200, 'PROFESSIONAL ECOSYSTEM'],
  ['/apilos/programs/professional-academy/', 200, '전문가'],
  ['/apilos/programs/youth-family-school/', 200, '청소년'],
  ['/apilos/programs/pastoral-coaching/', 200, '목회'],
  ['/apilos/programs/professional-network/', 200, '전문기관'],
  ['/apilos/programs/social-impact/', 200, '사회공헌'],
  ['/apilos/programs/research-publication/', 200, '연구'],
  ['/apilos/archive/', 200, 'LIVE BLOG ARCHIVE'],
  ['/apilos/books/', 200, 'KNOWLEDGE ASSETS'],
  ['/apilos/books/sachungi-coaching-psychology/', 200, '사춘기 자녀'],
  ['/apilos/news/', 200, 'LIVE JOURNAL'],
  ['/apilos/__qa_not_found__/', 404, '404 / NOT FOUND']
];

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function checkPage([path, expectedStatus, marker]) {
  try {
    const res = await fetch(base + path, { redirect:'follow', headers:{'user-agent':'APILOS-QA/2.0'} });
    const text = await res.text();
    return { path, ok:res.status===expectedStatus && text.includes(marker), status:res.status, marker:text.includes(marker) };
  } catch (e) {
    return { path, ok:false, error:e.message };
  }
}

async function checkLogo() {
  try {
    const res = await fetch(base + '/apilos/assets/ycc-logo.webp', { redirect:'follow', headers:{'user-agent':'APILOS-QA/2.0'} });
    const b = new Uint8Array(await res.arrayBuffer());
    const riff = String.fromCharCode(...b.slice(0,4));
    const webp = String.fromCharCode(...b.slice(8,12));
    return { path:'/apilos/assets/ycc-logo.webp', ok:res.status===200 && riff==='RIFF' && webp==='WEBP', status:res.status, bytes:b.length, header:`${riff}/${webp}` };
  } catch (e) { return { path:'/apilos/assets/ycc-logo.webp', ok:false, error:e.message }; }
}

let pending = [...checks.map(c => c[0]), '/apilos/assets/ycc-logo.webp'];
let lastResults = [];
for (let round=1; round<=24; round++) {
  const pageResults = await Promise.all(checks.map(checkPage));
  const logoResult = await checkLogo();
  lastResults = [...pageResults, logoResult];
  pending = lastResults.filter(r => !r.ok).map(r => r.path);
  console.log(`ROUND ${round}: ${lastResults.length-pending.length}/${lastResults.length} passed`);
  for (const r of lastResults.filter(r=>r.ok)) console.log(`PASS ${r.path}${r.bytes ? ` (${r.bytes} bytes)` : ''}`);
  if (!pending.length) break;
  console.log('WAITING:', pending.join(', '));
  if (round < 24) await sleep(15000);
}

const failures = lastResults.filter(r => !r.ok);
for (const r of failures) console.error(`FAIL ${r.path}: ${r.error || `status=${r.status} marker=${r.marker} header=${r.header||''}`}`);
if (failures.length) process.exit(1);
