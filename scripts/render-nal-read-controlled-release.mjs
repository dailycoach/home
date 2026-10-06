import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';

const input='docs/NAL_READ_FIX01_PATCH.sql';
const original=readFileSync(input,'utf8');
const guard=readFileSync('docs/NAL_READ_FIX02_GUARD.sql','utf8');
const wrong=String.raw`E' \t\n\r\f\v'`;
const correct=String.raw`E' \t\n\r\f'||chr(11)`;
if(original.split(wrong).length!==2)throw new Error('Unexpected FIX-01 whitespace source; review before rendering');
if(!/^begin;$/m.test(original)||!/^commit;\s*$/m.test(original))throw new Error('Unexpected FIX-01 transaction');
const body=original.replace(wrong,correct).replace(/^begin;\r?\n/m,'').replace(/^commit;\s*$/m,'');
const out=process.argv[2]||'/tmp/nal-read-controlled-release.sql';
mkdirSync(path.dirname(out),{recursive:true});
const sql='-- NAL-FIX-02: tested FIX-01 + whitespace correction + fail-closed test scope.\n'
 +'-- No real-user grants or payment data changes. Effective runtime mode remains OFF.\nbegin;\n'
 +body+'\n'+guard+'\ncommit;\n';
writeFileSync(out,sql);
console.log(JSON.stringify({output:out,sha256:createHash('sha256').update(sql).digest('hex'),
 fix01Sha256:createHash('sha256').update(original).digest('hex'),guardSha256:createHash('sha256').update(guard).digest('hex')},null,2));
