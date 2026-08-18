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
const failures = [];

async function getWithRetry(path, expectedStatus, marker) {
  let last = '';
  for (let attempt = 1; attempt <= 10; attempt++) {
    try {
      const res = await fetch(base + path, { redirect: 'follow', headers: { 'user-agent': 'APILOS-QA/1.0' } });
      const text = await res.text();
      if (res.status === expectedStatus && text.includes(marker)) return { ok:true, attempt };
      last = `status=${res.status}, marker=${text.includes(marker)}`;
    } catch (e) { last = e.message; }
    await sleep(12000);
  }
  return { ok:false, error:last };
}

for (const [path,status,marker] of checks) {
  const r = await getWithRetry(path,status,marker);
  if (r.ok) console.log(`PASS ${path} (${status}) attempt=${r.attempt}`);
  else { console.error(`FAIL ${path}: ${r.error}`); failures.push(path); }
}

try {
  const r = await fetch(base + '/apilos/assets/ycc-logo.webp', { redirect:'follow' });
  const b = new Uint8Array(await r.arrayBuffer());
  const riff = String.fromCharCode(...b.slice(0,4));
  const webp = String.fromCharCode(...b.slice(8,12));
  if (r.status !== 200 || riff !== 'RIFF' || webp !== 'WEBP') { console.error(`FAIL logo: status=${r.status} header=${riff}/${webp}`); failures.push('logo'); }
  else console.log(`PASS /apilos/assets/ycc-logo.webp (${b.length} bytes)`);
} catch (e) { console.error(`FAIL logo: ${e.message}`); failures.push('logo'); }

if (failures.length) process.exit(1);
