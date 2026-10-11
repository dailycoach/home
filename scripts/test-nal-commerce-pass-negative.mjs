import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';

const run=()=>spawnSync(process.execPath,['scripts/check-nal-commerce-os-pass.mjs'],{
 encoding:'utf8',timeout:30000,maxBuffer:1024*1024
});
const baseline=run();
assert.equal(baseline.status,0,'Clean release lock must pass: '+baseline.stdout+' '+baseline.stderr);
const json=fn=>src=>{const j=JSON.parse(src);fn(j);return JSON.stringify(j);};
const cases=[
 ['release customer pass without review','nal/data/commerce-pass.release.json',
  json(j=>{j.uiEnabled=true;}),'P7-E public pass release uiEnabled must stay OFF'],
 ['premature email resend','nal/data/commerce-pass.release.json',
  json(j=>{j.resendEnabled=true;}),'P7-E public pass release resendEnabled must stay OFF'],
 ['expose pass route to indexing','nal/commerce/pass/index.html',
  s=>s.replace('noindex,nofollow,noarchive','index,follow'),'Noindex private pass UI'],
 ['remove one-time URL wipe','nal/assets/js/nal-commerce-pass.js',
  s=>s.replace('history.replaceState','history.replaceUnsafe'),'browser fragment secret removal'],
 ['allow claims before server release','nal/assets/js/nal-commerce-pass.js',
  s=>s.replace('if(!approved(gate))','if(false)'),'browser fragment secret removal'],
 ['allow email resend without same-tab proof','nal/assets/js/nal-commerce-pass.js',
  s=>s.replace('if(!proof||!button)return;','if(!button)return;'),
  'resend must require original checkout buyer proof'],
 ['inject HTML into customer ticket','nal/assets/js/nal-commerce-pass.js',
  s=>s+'\\n// Unsafe dummy: innerHTML', 'browser pass script may expose secrets'],
 ['allow resend of refunded orders','integration/nal-commerce-os/server/pass-claim-handler.mjs',
  s=>s.replace("owner.status==='paid'","owner.status==='refunded'"),
  'non-enumerating proof-gated pass API must fail closed'],
 ['remove private SQL approval check','integration/nal-commerce-os/PROPOSAL_ONLY_pass_resend.sql',
  s=>s.replace("current_database() IS DISTINCT FROM 'nal_ci_ledger'","false"),
  'P7-E SQL must reject live Supabase'],
 ['remove 15-min resend cooldown','integration/nal-commerce-os/PROPOSAL_ONLY_pass_resend.sql',
  s=>s.replace("created_at>now()-interval '15 minutes'","created_at>now()-interval '1 second'"),
  'buyer proof, 15-min cooldown'],
 ['remove refund-triggered resend cancel','integration/nal-commerce-os/PROPOSAL_ONLY_pass_resend.sql',
  s=>s.replace("OLD.status='active' AND NEW.status='revoked'","OLD.status='revoked' AND NEW.status='active'"),
  'refund must cancel unfinished resend jobs'],
 ['expose private resale table','integration/nal-commerce-os/PROPOSAL_ONLY_pass_resend.sql',
  s=>s.replace('FROM PUBLIC,anon,authenticated','FROM PUBLIC'),
  'no public DB grants'],
 ['remove post-token refund recheck','integration/nal-commerce-os/server/pass-resend-worker.mjs',
  s=>s.replace("if(await eligibility.recheck(job)!==true)throw Error('REFUND_BEFORE_SEND');",
               "if(false)throw Error('REFUND_BEFORE_SEND');"),
  'worker must default OFF']
];
let rejected=0;
for(const [name,path,mutator,expected] of cases){
 const original=await readFile(path,'utf8');
 try{
  const modified=mutator(original);
  assert.notEqual(modified,original,'Missing mutation target '+name);
  await writeFile(path,modified,'utf8');
  const result=run(),output=result.stdout+'\n'+result.stderr;
  assert.notEqual(result.status,0,'Unsafe mutation accepted: '+name+'\n'+output);
  assert(output.includes(expected),'Unexpected guard failure: '+name+'\n'+output);
  rejected++;
 }finally{
  await writeFile(path,original,'utf8');
 }
}
const final=run();assert.equal(final.status,0,'Guard baseline not restored '+final.stdout+' '+final.stderr);
console.log('NAL P7-E negative release tests PASS: '+rejected+' customer token/privacy/SQL/resend/PG alterations rejected, files restored');
