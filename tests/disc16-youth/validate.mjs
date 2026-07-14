import fs from 'node:fs';
import vm from 'node:vm';
import process from 'node:process';

const source=fs.readFileSync(new URL('./data.js',import.meta.url),'utf8');
const sandbox={window:{}};vm.createContext(sandbox);vm.runInContext(source,sandbox,{filename:'data.js'});
const D=sandbox.window.DISC16_YOUTH_DATA;
if(!D)throw new Error('DISC16 청소년 데이터를 불러오지 못했습니다.');
const TYPES=['D','I','S','C'];
const PAIRS=['DI','DS','DC','ID','IS','IC','SD','SI','SC','CD','CI','CS'];
const PROFILE_FIELDS=['name','title','tagline','core','motivation','fear','family','peers','groupRole','communication','conflict','pressure','overuse','needs','growth','coaching','$parent','$friend'];
const PAIR_FIELDS=['name','summary','family','peers','groupRole','tension','communication','pressure','needs','growth','coaching'];
const failures=[];
const check=(name,ok,detail='')=>{if(!ok)failures.push(`${name}: ${detail}`)};
const permutation=(a,b)=>Array.isArray(a)&&a.length===b.length&&[...a].sort().join('|')===[...b].sort().join('|');
const text=(v,min=2)=>typeof v==='string'&&v.trim().length>=min;

check('유형코드',permutation(D.TYPES,TYPES),JSON.stringify(D.TYPES));
check('문항수',D.QUESTIONS.length===16,String(D.QUESTIONS.length));
check('표시순서수',D.DISPLAY.length===16,String(D.DISPLAY.length));
check('가정문항',D.QUESTIONS.filter(q=>q.domain==='family').length===8,String(D.QUESTIONS.filter(q=>q.domain==='family').length));
check('또래문항',D.QUESTIONS.filter(q=>q.domain==='peer').length===8,String(D.QUESTIONS.filter(q=>q.domain==='peer').length));
D.QUESTIONS.forEach((q,i)=>{check(`문항${i+1} 지문`,text(q.scene,60),String(q.scene?.length||0));check(`문항${i+1} 유형`,permutation(q.choices.map(c=>c[0]),TYPES),JSON.stringify(q.choices));check(`문항${i+1} 키워드`,q.choices.every(c=>text(c[1])&&c[1].length<=12),q.choices.map(c=>c[1]).join('/'));check(`문항${i+1} 순열`,permutation(D.DISPLAY[i],[0,1,2,3]),JSON.stringify(D.DISPLAY[i]))});
TYPES.forEach(type=>{const p=D.PROFILES[type];check(`${type} 해설`,Boolean(p));PROFILE_FIELDS.forEach(field=>check(`${type}.${field}`,text(p?.[field]),p?.[field]||'누락'))});
check('조합형코드',Object.keys(D.PAIRS).sort().join(',')===[...PAIRS].sort().join(','),Object.keys(D.PAIRS).join(','));
PAIRS.forEach(code=>{const p=D.PAIRS[code];check(`${code} 해설`,Boolean(p));PAIR_FIELDS.forEach(field=>check(`${code}.${field}`,text(p?.[field]),p?.[field]||'누락'))});

function preset(code){if(code.length===1){const rest=TYPES.filter(t=>t!==code);return D.QUESTIONS.map((_,i)=>[code,rest[i%3],rest[(i+1)%3],rest[(i+2)%3]])}const [a,b]=code,rest=TYPES.filter(t=>t!==a&&t!==b);return D.QUESTIONS.map((_,i)=>i<9?[a,b,...rest]:[b,a,...rest])}
function calculate(answers){const scores=Object.fromEntries(TYPES.map(t=>[t,0]));answers.forEach(order=>order.forEach((t,r)=>scores[t]+=4-r));const sorted=TYPES.map(t=>[t,scores[t]]).sort((a,b)=>b[1]-a[1]||TYPES.indexOf(a[0])-TYPES.indexOf(b[0]));const gap=sorted[0][1]-sorted[1][1],code=gap>=8?sorted[0][0]:sorted[0][0]+sorted[1][0];const scales=Object.values(scores).map(v=>((v-16)/48)*10);return{code,total:Object.values(scores).reduce((a,b)=>a+b,0),scales}}
[...TYPES,...PAIRS].forEach(expected=>{const r=calculate(preset(expected));check(`${expected} 결과코드`,r.code===expected,r.code);check(`${expected} 총점`,r.total===160,String(r.total));check(`${expected} 척도`,r.scales.every(v=>v>=0&&v<=10),JSON.stringify(r.scales));check(`${expected} 척도합`,Math.abs(r.scales.reduce((a,b)=>a+b,0)-20)<1e-9,JSON.stringify(r.scales))});

const forbidden=['문제 있는 성격','나쁜 유형','진단 결과','친구를 지배','부모에게 순종해야'];
const allText=JSON.stringify({profiles:D.PROFILES,pairs:D.PAIRS});forbidden.forEach(word=>check(`금지표현 ${word}`,!allText.includes(word),word));
if(failures.length){console.error(`DISC16 YOUTH 검증 실패 ${failures.length}개`);failures.forEach(f=>console.error(`✗ ${f}`));process.exit(1)}
console.log('DISC16 YOUTH 모든 검증 통과');
