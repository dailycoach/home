import fs from 'node:fs';

const fail = msg => { console.error('FAIL:', msg); process.exitCode = 1; };
const exists = p => fs.existsSync(p);
const app = fs.readFileSync('apilos/app.js','utf8');
const archiveJs = fs.readFileSync('apilos/archive/archive.js','utf8');
const home = fs.readFileSync('apilos/index.html','utf8');
const qa = fs.readFileSync('apilos/qa.css','utf8');

if (exists('apilos/app-core.js')) fail('superseded app-core.js must not return');
if (exists('apilos/assets/ycc-logo-base64.txt')) fail('superseded base64 logo source must not return');
if (app.includes('app-core.js')) fail('app.js must remain self-contained');
if (app.includes('ycc-logo-base64')) fail('app.js must use canonical WebP logo directly');
if (!app.includes("/apilos/assets/ycc-logo.webp")) fail('app.js canonical YCC WebP reference missing');
if (app.includes('224371249575') || archiveJs.includes('224371249575')) fail('unverified Naver mapping 224371249575 must not return');
if (!app.includes('224351456999')) fail('verified 4th expert-training RSS record missing');
if (!app.includes('224339731348')) fail('verified Happy People support RSS record missing');

if (!home.includes('/apilos/home-polish.css')) fail('home polish stylesheet missing');
if (!home.includes('class="home-closing"')) fail('cohesive home closing section missing');
if (home.includes('class="fusion-entry"')) fail('legacy four-row home menu reintroduced');
if (home.includes('class="fusion-live"')) fail('legacy gradient BLOG/LIVE strip reintroduced');
if (!qa.includes('.portal-footer .portal-mark') || !qa.includes('background-image:var(--ycc-logo)')) fail('footer must use canonical YCC mark');

if (!process.exitCode) console.log('APILOS runtime regression gate: PASS');
