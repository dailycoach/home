import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';

const run=()=>spawnSync(process.execPath,['scripts/check-nal-commerce-os-delivery.mjs'],{
 encoding:'utf8',timeout:30000,maxBuffer:1024*1024
});
const baseline=run();
assert.equal(baseline.status,0,baseline.stdout+' '+baseline.stderr);
const json=fn=>source=>{const j=JSON.parse(source);fn(j);return JSON.stringify(j);};
const cases=[
 ['enable unified delivery early','integration/nal-commerce-os/delivery-release-review.json',
  json(j=>j.unifiedWorkerEnabled=true),'unifiedWorkerEnabled'],
 ['enable fake sent emails','integration/nal-commerce-os/delivery-release-review.json',
  json(j=>j.actualEmailSent=true),'actualEmailSent'],
 ['approve fake program page','integration/nal-commerce-os/delivery-release-review.json',
  json(j=>j.programClaimsReleaseApproved=true),'programClaimsReleaseApproved'],
 ['legacy duplicate sender active','integration/nal-commerce-os/delivery-release-review.json',
  json(j=>j.legacyPdfReceiptWorkerEnabled=true),'legacyPdfReceiptWorkerEnabled'],
 ['enable live store checkout','nal/data/site.json',
  json(j=>j.features.checkout=true),'production NAL feature checkout enabled'],
 ['remove SQL isolated db','integration/nal-commerce-os/PROPOSAL_ONLY_delivery_engine.sql',
  s=>s.replace("current_database() IS DISTINCT FROM 'nal_ci_ledger'","false"),
  'P7-D SQL lacks execution restriction'],
 ['remove SQL session guard','integration/nal-commerce-os/PROPOSAL_ONLY_delivery_engine.sql',
  s=>s.replace("current_setting('nal.commerce_os_ci_approval',true) IS DISTINCT FROM 'isolated'","false"),
  'P7-D SQL lacks execution restriction'],
 ['remove post-refund email cancellation','integration/nal-commerce-os/PROPOSAL_ONLY_delivery_engine.sql',
  s=>s.replace("state='cancelled',lease_id=NULL,lease_until=NULL","state='queued',lease_id=NULL,lease_until=NULL"),
  'refund must cancel unsent notices'],
 ['remove private role grants','integration/nal-commerce-os/PROPOSAL_ONLY_delivery_engine.sql',
  s=>s.replace('FROM PUBLIC,anon,authenticated','FROM PUBLIC'),
  'P7-D private grant/RLS security boundary missing'],
 ['allow null authorization','integration/nal-commerce-os/PROPOSAL_ONLY_delivery_engine.sql',
  s=>s.replace('valid_state IS DISTINCT FROM TRUE','NOT valid_state'),
  'nullable authorization must fail closed'],
 ['remove email worker refund recheck','integration/nal-commerce-os/server/unified-delivery-worker.mjs',
  s=>s.replace('eligibility.recheck(job)','eligibility.unsafeCheck(job)'),
  'unified email worker lacks fail-closed'],
 ['remove program one-time token hash','integration/nal-commerce-os/server/delivery-links.mjs',
  s=>s.replace("'SHA-256'","'MD5'"),
  'program pass secret/hash and private link protocol missing']
];
let rejected=0;
for(const [name,file,mutator,expected] of cases){
 const original=await readFile(file,'utf8');
 try{
  const updated=mutator(original);
  assert.notEqual(updated,original,'No mutation: '+name);
  await writeFile(file,updated,'utf8');
  const result=run(),combined=result.stdout+'\n'+result.stderr;
  assert.notEqual(result.status,0,'Unsafe mutation accepted: '+name+'\n'+combined);
  assert(combined.includes(expected),'Wrong failure type: '+name+'\n'+combined);
  rejected++;
 }finally{
  await writeFile(file,original,'utf8');
 }
}
const restored=run();
assert.equal(restored.status,0,'Baseline not restored: '+restored.stdout+' '+restored.stderr);
console.log('NAL P7-D negative guards PASS: '+rejected+' unsafe delivery/SQL/refund/release mutations rejected; files restored');
