import {spawnSync} from 'node:child_process';
import {mkdtempSync,writeFileSync,appendFileSync,mkdirSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';

export function parseCheck(result){
 const text=(String(result.stdout||'')+'\n'+String(result.stderr||'')).replace(/\u001b\[[0-9;]*m/g,'');
 if(result.error||result.signal||!Number.isInteger(result.status))throw new Error('QA infrastructure failure');
 const failures=text.split(/\r?\n/).filter(x=>x.startsWith('- ')).map(x=>x.slice(2));
 const count=text.match(/^NAL QA failed \((\d+)\)\s*$/m);
 if(result.status===0){
  if(count||failures.length||!/^NAL QA passed:/m.test(text))throw new Error('QA success output is inconsistent');
  return {status:'PASS',failures:[],exitCode:0,log:text};
 }
 if(!count||Number(count[1])!==failures.length)throw new Error('QA failed without a complete structured failure list');
 return {status:'FAIL',failures,exitCode:result.status,log:text};
}
export function difference(before,after){
 const left=new Map();for(const x of before)left.set(x,(left.get(x)||0)+1);
 const added=[];for(const x of after){if(left.get(x)>0)left.set(x,left.get(x)-1);else added.push(x);}
 const removed=[];for(const [x,n] of left)for(let i=0;i<n;i++)removed.push(x);
 return {newRegressions:added.sort(),resolved:removed.sort()};
}
function git(args,cwd){
 const r=spawnSync('git',args,{cwd,encoding:'utf8',timeout:120000,maxBuffer:20*1024*1024});
 if(r.status!==0||r.error)throw new Error('git command failed: '+args[0]);return r.stdout.trim();
}
function main(){
 const repo=process.cwd();const base=process.env.NAL_BASE_SHA;
 if(!/^[0-9a-f]{40}$/.test(base||''))throw new Error('NAL_BASE_SHA must be a pinned full commit SHA');
 const head=git(['rev-parse','HEAD'],repo);
 const temp=mkdtempSync(path.join(tmpdir(),'nal-read-regression-'));
 const baseDir=path.join(temp,'base');let attached=false;
 const output=path.resolve(process.env.NAL_QA_OUTPUT||'.nal-read-qa');mkdirSync(output,{recursive:true});
 try{
  git(['cat-file','-e',base+'^{commit}'],repo);
  git(['worktree','add','--detach',baseDir,base],repo);attached=true;
  const checker=git(['show',base+':scripts/check-nal-platform.mjs'],repo)+'\n';
  const checkerPath=path.join(temp,'fixed-checker.mjs');writeFileSync(checkerPath,checker);
  const run=(cwd)=>parseCheck(spawnSync(process.execPath,[checkerPath],{cwd,encoding:'utf8',timeout:120000,maxBuffer:20*1024*1024}));
  const baseline=run(baseDir);const current=run(repo);
  const delta=difference(baseline.failures,current.failures);
  const report={baseSha:base,headSha:head,checkerSha256:createHash('sha256').update(checker).digest('hex'),
   baselineStatus:baseline.status,platformStatus:current.status,
   regressionStatus:delta.newRegressions.length?'FAIL':'PASS',
   baselineFailureCount:baseline.failures.length,currentFailureCount:current.failures.length,
   baselineFailures:baseline.failures,currentFailures:current.failures,...delta,
   note:'Regression PASS does not mean platform PASS. Baseline failures are observed, not silently waived.'};
  writeFileSync(path.join(output,'platform-regression.json'),JSON.stringify(report,null,2)+'\n');
  writeFileSync(path.join(output,'baseline.log'),baseline.log);writeFileSync(path.join(output,'head.log'),current.log);
  console.log(JSON.stringify(report,null,2));
  const summary=`## NAL platform QA\n\nBase: ${base}\nHead: ${head}\n\n|Check|Result|\n|---|---|\n|Entire platform|${current.status} (${current.failures.length} failures)|\n|Same-checker baseline|${baseline.status} (${baseline.failures.length} failures)|\n|New regressions|${delta.newRegressions.length}|\n|Resolved|${delta.resolved.length}|\n\nExisting failures are NOT a platform pass.\n`;
  if(process.env.GITHUB_STEP_SUMMARY)appendFileSync(process.env.GITHUB_STEP_SUMMARY,summary);
  if(delta.newRegressions.length)process.exitCode=1;
 }finally{
  if(attached)git(['worktree','remove','--force',baseDir],repo);
  rmSync(temp,{recursive:true,force:true});
 }
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href){
 try{main();}catch(error){console.error('NAL QA HARNESS ERROR:',error.message);process.exitCode=2;}
}
