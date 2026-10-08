/** Shared structural guard for editable manifests; not a product QA test suite. */
export const STEP_TYPES=['HOOK','IDEA','MIRROR','QUESTION','MULTI_SELECT','SCALE','TRY','RECORD','LIVE'];
export const INPUT_TYPES=['QUESTION','MULTI_SELECT','SCALE','TRY'];
const slug=/^[a-z0-9-]{1,120}$/;
export function validateManifest(doc,{complete=false}={}){
 const errors=[];const err=(at,msg)=>errors.push(`${at}: ${msg}`);
 if(!doc||typeof doc!=='object'||Array.isArray(doc))return ['원고는 JSON 객체여야 합니다.'];
 if(doc.schemaVersion!==2)err('schemaVersion','2가 필요합니다.');
 if(!slug.test(doc.season?.slug||''))err('season.slug','영문 소문자·숫자·하이픈만 사용합니다.');
 if(typeof doc.season?.title!=='string'||!doc.season.title.trim()||doc.season.title.length>120)err('season.title','1~120자 제목이 필요합니다.');
 if(doc.season?.totalDays!==28)err('season.totalDays','이번 엔진은 28일 시즌입니다.');
 if(!Array.isArray(doc.weeks)||doc.weeks.length>4||!Array.isArray(doc.days)||doc.days.length>29)return [...errors,'주차·DAY 배열의 길이를 확인해 주세요.'];
 const wn=new Set(),dn=new Set(),metrics=new Map();
 for(const w of doc.weeks){if(!Number.isInteger(w.number)||w.number<1||w.number>4||wn.has(w.number))err('weeks','주차 번호가 중복되거나 잘못됐습니다.');wn.add(w.number);if(!slug.test(w.slug||'')||!w.title?.trim())err('weeks','주차 이름이 필요합니다.');}
 for(const d of doc.days){const at=`DAY ${d.number}`;
  if(!Number.isInteger(d.number)||d.number<0||d.number>28||dn.has(d.number))err(at,'DAY 번호가 중복되거나 잘못됐습니다.');dn.add(d.number);
  if(d.number===0?d.week!==null:!wn.has(d.week))err(at,'주차 연결을 확인해 주세요.');
  if(!['before','daily','try','live','final'].includes(d.type))err(at,'DAY 종류를 확인해 주세요.');
  if(typeof d.title!=='string'||!d.title.trim()||d.title.length>160)err(at,'제목은 1~160자입니다.');
  if(!Number.isInteger(d.minutes)||d.minutes<1||d.minutes>180)err(at,'예상 시간은 1~180분입니다.');
  if(!Array.isArray(d.steps)||d.steps.length<1||d.steps.length>100){err(at,'STEP은 1~100개입니다.');continue;}
  const keys=new Set();
  for(const s of d.steps){const pos=at+'/'+s.key;
   if(!slug.test(s.key||'')||keys.has(s.key))err(pos,'고유한 STEP 키가 필요합니다.');keys.add(s.key);
   if(!STEP_TYPES.includes(s.type))err(pos,'지원하지 않는 STEP입니다.');
   for(const k of ['content','prompt','placeholder'])if(s[k]!=null&&(typeof s[k]!=='string'||s[k].length>(k==='content'?4000:1000)))err(pos,k+' 길이/형식 오류');
   if(s.required!=null&&typeof s.required!=='boolean')err(pos,'필수 여부는 true/false입니다.');
   if(INPUT_TYPES.includes(s.type)&&!s.prompt?.trim())err(pos,'질문이 필요합니다.');
   if(!INPUT_TYPES.includes(s.type)&&s.required)err(pos,'설명/표시 STEP은 필수 답변으로 설정하지 않습니다.');
   if(s.type==='MULTI_SELECT'&&(!Array.isArray(s.options)||!s.options.length||s.options.length>30||s.options.some(x=>typeof x!=='string'||!x.trim()||x.length>160)||new Set(s.options).size!==s.options.length))err(pos,'서로 다른 텍스트 선택지가 필요합니다.');
   if(s.measureKey){if(s.type!=='SCALE'||![0,28].includes(d.number)||!slug.test(s.measureKey)||!slug.test(s.measureVersion||''))err(pos,'시작/마지막 척도 연결 오류');
    const id=s.measureKey+'@'+s.measureVersion;const m=metrics.get(id)||[];m.push({day:d.number,prompt:s.prompt});metrics.set(id,m);}
   if(s.reportKey&&!slug.test(s.reportKey))err(pos,'리포트 키 형식 오류');
  }
 }
 if(complete){if(wn.size!==4||dn.size!==29||![...Array(29).keys()].every(n=>dn.has(n)))err('manifest','DAY 0~28과 4주가 모두 필요합니다.');
  for(const [id,pairs] of metrics)if(pairs.length!==2||new Set(pairs.map(x=>x.day)).size!==2||pairs[0].prompt!==pairs[1].prompt)err(id,'시작·마지막 문항이 동일해야 비교합니다.');
 }
 return errors;
}
export function blankManifest(slug='new-season'){
 return {schemaVersion:2,season:{slug,title:'새 NAL READ',subtitle:'',totalDays:28,reportTitle:'MY NAL',timezone:'Asia/Seoul'},
  provenance:{origin:'operator',reviewStatus:'draft',attributionStatus:'editorial-review-required',note:''},
  weeks:[1,2,3,4].map(n=>({number:n,slug:'week-'+n,title:'WEEK '+n,subtitle:''})),
  days:Array.from({length:29},(_,n)=>({number:n,week:n===0?null:Math.ceil(n/7),title:n===0?'BEFORE':'DAY '+n,type:n===0?'before':n===28?'final':'daily',minutes:5,steps:[{key:'hook',type:'HOOK',content:'오늘의 문장'},{key:'question',type:'QUESTION',prompt:'오늘 내게 묻고 싶은 것은?',required:true},{key:'record',type:'RECORD',content:'내 답을 다시 읽습니다.'}]}))};
}
