import assert from 'node:assert/strict';
import {parseCheck,difference} from './nal-read-platform-regression.mjs';
let checks=0;
function eq(a,b){assert.deepEqual(a,b);checks++;}
function bad(x){assert.throws(()=>parseCheck(x));checks++;}
eq(parseCheck({status:0,stdout:'NAL QA passed: pages=1\n'}).status,'PASS');
eq(parseCheck({status:1,stderr:'NAL QA failed (2)\n- old A\n- new B\n'}).failures,['old A','new B']);
bad({status:1,stderr:'TypeError: crashed'});
bad({status:1,stderr:'NAL QA failed (2)\n- truncated\n'});
bad({status:0,stderr:'NAL QA failed (1)\n- suppressed\n'});
bad({status:0,stdout:'arbitrary success message'});
bad({status:null,signal:'SIGTERM'});
eq(difference(['old'],['old','new outside nal/read']),{newRegressions:['new outside nal/read'],resolved:[]});
eq(difference(['a','a'],['a','a','a']),{newRegressions:['a'],resolved:[]});
eq(difference(['old','fixed'],['old']),{newRegressions:[],resolved:['fixed']});
eq(difference(['old A'],['new B']),{newRegressions:['new B'],resolved:['old A']});
console.log(`NAL-FIX-01 QA harness: ${checks} assertions PASS`);
