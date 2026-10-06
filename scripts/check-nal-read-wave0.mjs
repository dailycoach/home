import assert from "node:assert/strict";
import { readFile, access } from "node:fs/promises";
import path from "node:path";

const root=process.cwd();
const required=[
"nal/data/read-seasons.json","nal/data/read-backend.staging.json","nal/assets/css/nal-read.css","nal/assets/js/read.js",
"nal/read/index.html","nal/read/trend-2027/index.html","nal/read/trend-2027/welcome/index.html",
"nal/read/trend-2027/before/index.html","nal/read/auth/callback/index.html",
"supabase/functions/nal-read-enroll/index.ts","supabase/functions/nal-read-enroll/handler.mjs",
"docs/NAL_READ_WAVE0_SCHEMA_DRAFT.sql"
];
for(const file of required)await access(path.join(root,file));
const seasons=JSON.parse(await readFile(path.join(root,"nal/data/read-seasons.json"),"utf8"));
assert.equal(seasons.schemaVersion,"1.0");
assert.equal(seasons.seasons[0].slug,"trend-2027");
assert.equal(seasons.seasons[0].published,false);
const js=await readFile(path.join(root,"nal/assets/js/read.js"),"utf8");
assert.match(js,/signInWithOtp/);assert.match(js,/nal-read-enroll/);assert.match(js,/safeNext/);assert.match(js,/read-backend\.staging\.json/);assert.match(js,/daily-coach-ing\.com/);
assert.ok(!/service_role|SUPABASE_SERVICE_ROLE_KEY/i.test(js));
const edge=await readFile(path.join(root,"supabase/functions/nal-read-enroll/index.ts"),"utf8");
assert.match(edge,/NAL_READ_ENABLED/);assert.match(edge,/SUPABASE_SERVICE_ROLE_KEY/);
for(const file of required.filter(x=>x.endsWith(".html"))){
 const html=await readFile(path.join(root,file),"utf8");
 assert.match(html,/<html lang="ko">/);assert.match(html,/noindex,nofollow/);assert.ok(!html.includes("TossPayments"));
}
console.log(`NAL READ W0 QA passed: ${required.length} required files`);
