/* BUILD20 — one participant route contract. Location only; no Auth, network or storage. */
(() => {
 'use strict';
 const VIEWS=new Set(['before','today','journey','day','try','live','my','report']);
 const RESERVED=new Set(['admin','auth','open','join','start','cohorts','checkout']);
 const SLUG=/^[a-z0-9-]{1,120}$/;
 const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
 const SECRET_KEYS=new Set(['access_token','refresh_token','token','token_hash','code','paymentKey']);
 function one(q,key){const values=q.getAll(key);if(values.length>1)throw new Error('같은 위치 정보가 중복되었습니다. MY NAL에서 다시 열어주세요.');return values.length?values[0]:null;}
 function integer(q,key,min,max){const raw=one(q,key);if(raw===null)return null;if(!/^\d{1,3}$/.test(raw)||Number(raw)<min||Number(raw)>max)throw new Error('질문·주차 위치를 확인해 주세요.');return String(Number(raw));}
 function route(slug,view,query=new URLSearchParams()){
  const q=query instanceof URLSearchParams?query:new URLSearchParams(query);
  if(!SLUG.test(slug||'')||RESERVED.has(slug)||!VIEWS.has(view))throw new Error('시즌 또는 화면 주소를 확인해 주세요.');
  for(const key of SECRET_KEYS)if(q.has(key))throw new Error('인증·결제 응답은 이 주소로 전달하지 않습니다. 원래 로그인 또는 주문 화면에서 확인해 주세요.');
  const fromSeason=one(q,'season'),fromView=one(q,'view');
  if((fromSeason!==null&&fromSeason!==slug)||(fromView!==null&&fromView!==view))throw new Error('선택한 시즌과 이동 주소가 다릅니다. 다른 기록으로 대신 열지 않습니다.');
  const target=new URLSearchParams({season:slug,view});
  if(view==='day'){
   const day=integer(q,'day',1,366);if(day===null)throw new Error('열어볼 DAY를 선택해 주세요.');target.set('day',day);
  }
  if(['before','day'].includes(view)){const step=integer(q,'step',1,100);if(step!==null)target.set('step',step);}
  if(view==='before'&&q.has('day')&&integer(q,'day',0,0)!=='0')throw new Error('시작 전 질문 주소를 확인해 주세요.');
  if(['try','live'].includes(view)){
   const week=integer(q,'week',1,52);if(week!==null)target.set('week',week);
   const key=view==='try'?'experiment':'session',id=one(q,key);
   if(id!==null){if(!UUID.test(id))throw new Error('연결한 기록의 주소를 확인해 주세요.');target.set(key,id);}
  }
  return '/nal/read/open/?'+target.toString();
 }
 function parse(search){const q=new URLSearchParams(search),slug=one(q,'season'),view=one(q,'view')||'today';route(slug,view,q);return {slug,view};}
 window.NalReadRoutes=Object.freeze({version:20,route,parse});
})();
