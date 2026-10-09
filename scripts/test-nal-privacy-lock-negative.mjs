import assert from 'node:assert/strict';
import { access, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import path from 'node:path';

const cmd = () => spawnSync(process.execPath,['scripts/check-nal-privacy-release-lock.mjs'],{
  encoding:'utf8',timeout:30000,maxBuffer:1024*1024
});
const baseline=cmd();
assert.equal(baseline.status,0,`Privacy audit baseline failed:\n${baseline.stdout}\n${baseline.stderr}`);
const scenarios=[
  {
    title:'owner review UI accidentally enabled',file:'nal/data/read-privacy-review.release.json',
    mutate:s=>{const j=JSON.parse(s);j.uiEnabled=true;return JSON.stringify(j);},
    expect:'owner review release uiEnabled must remain false'
  },
  {
    title:'owner auth review approved without audit',file:'nal/data/read-privacy-review.release.json',
    mutate:s=>{const j=JSON.parse(s);j.ownerAuthBindingReviewed=true;return JSON.stringify(j);},
    expect:'owner review release ownerAuthBindingReviewed must remain false'
  },
  {
    title:'admin destructive command advertised',file:'nal/data/read-privacy-review.release.json',
    mutate:s=>{const j=JSON.parse(s);j.actions.push('approve-journal');return JSON.stringify(j);},
    expect:'owner review actions must be queue/preview/start-review only'
  },
  {
    title:'destructive admin API flag enabled',file:'nal/data/read-privacy-review.release.json',
    mutate:s=>{const j=JSON.parse(s);j.destructiveApiExposed=true;return JSON.stringify(j);},
    expect:'owner review release destructiveApiExposed must remain false'
  },
  {
    title:'owner UI skips remote release guard',file:'nal/assets/js/read-privacy-review.js',
    mutate:s=>{assert(s.includes('if(!await reviewUiReleased())'));return s.replace('if(!await reviewUiReleased())','if(false)');},
    expect:'owner UI must stop before any server call'
  },
  {
    title:'browser permits privileged delete command',file:'nal/assets/js/account-session.js',
    mutate:s=>{assert(s.includes("['queue','preview','start-review'].includes(action)"));return s.replace("['queue','preview','start-review'].includes(action)","['queue','preview','start-review','execute-journal'].includes(action)");},
    expect:'browser transport must keep exact allowlist'
  },
  {
    title:'member form introduces request before consent',file:'nal/assets/js/read-privacy-member.js',
    mutate:s=>s+"\nA.call('privacy','request',{});\n",
    expect:'member UI must not initiate new privacy request'
  },
  {
    title:'admin page indexed',file:'nal/read/admin/privacy/index.html',
    mutate:s=>{assert(s.includes('noindex,nofollow,noarchive'));return s.replace('noindex,nofollow,noarchive','index,follow');},
    expect:'privacy route must remain noindex/noarchive'
  },
  {
    title:'staging server connected early',file:'nal/data/read-backend.staging.json',
    mutate:s=>{const j=JSON.parse(s);j.enabled=true;return JSON.stringify(j);},
    expect:'READ staging backend must remain disconnected'
  },
  {
    title:'customer account enabled before release',file:'nal/data/site.json',
    mutate:s=>{const j=JSON.parse(s);j.features.account=true;return JSON.stringify(j);},
    expect:'site feature account must remain OFF'
  }
];
let passed=0;
for(const t of scenarios){
 const original=await readFile(t.file,'utf8');
 try{
  const tampered=t.mutate(original);
  assert.notEqual(tampered,original,`No test mutation: ${t.title}`);
  await writeFile(t.file,tampered,'utf8');
  const result=cmd(),out=`${result.stdout}\n${result.stderr}`;
  assert.notEqual(result.status,0,`Privacy guard wrongly accepted: ${t.title}\n${out}`);
  assert(out.includes(t.expect),`Wrong detector for ${t.title}: ${out}`);
  passed++;
 }finally{await writeFile(t.file,original,'utf8');}
}
const root='supabase/functions/nal-read-privacy-admin', testFile=path.join(root,'index.ts');
await assert.rejects(()=>access(testFile),undefined,'No privileged admin route can exist in P4 baseline');
try{
 await mkdir(root,{recursive:true});
 await writeFile(testFile,'// synthetic CI-only test, never deployed\n');
 const result=cmd(),out=`${result.stdout}\n${result.stderr}`;
 assert.notEqual(result.status,0,'Unreviewed server route should fail');
 assert(out.includes('unreviewed privileged privacy owner Edge endpoint appeared'),out);
 passed++;
}finally{await rm(root,{force:true,recursive:true});}
const done=cmd();
assert.equal(done.status,0,`Restored release lock not PASS:\n${done.stdout}\n${done.stderr}`);
console.log(`NAL P4 privacy static fail-closed guards PASS: ${passed} injected conditions, restored baseline PASS`);
