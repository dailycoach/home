/* BUILD20 — the generic viewer is the sole renderer for legacy participant bookmarks. */
(() => {
 if(document.body.dataset.readRouteInvalid){const root=document.querySelector('[data-private-root]');if(root){root.hidden=false;root.textContent=document.body.dataset.readRouteMessage||'시즌 또는 화면 주소를 확인해 주세요.';}return;}
 const N=window.NalRead,R=window.NalReadRoutes;if(!N)return;
 if(R?.version!==20||typeof N.errorText!=='function'||typeof N.mayLeave!=='function'||typeof N.focus!=='function'){
  N.status('화면 구성 파일의 버전이 서로 다릅니다. 작성한 내용을 보관한 뒤 다시 불러와 주세요.','error');return;
 }
 const baseLink=N.link;
 function generic(raw){
  const u=new URL(raw,location.origin);if(u.origin!==location.origin)return raw;
  const match=u.pathname.match(/^\/nal\/read\/([a-z0-9-]+)\/(before|today|journey|day|try|live|my|report)\/$/);
  if(!match||match[1]!==N.slug)return raw;
  return R.route(N.slug,match[2],u.searchParams);
 }
 N.link=(href,text,cls)=>baseLink(generic(href),text,cls);
 document.querySelectorAll('[data-read-nav] a,[data-report-link]').forEach(a=>a.href=generic(a.href));
 const view=document.body.dataset.readDailyPage||document.body.dataset.readWorkspacePage;
 const file=['before','today','journey','day'].includes(view)?'read-daily.js':view==='report'?'read-report.js':'read-workspace.js';
 const script=document.createElement('script');script.src='/nal/assets/js/'+file+'?v=build20';
 script.onerror=()=>N.status('이 화면을 불러오지 못했습니다. 기록이 없는 것으로 판단하지 않습니다. 작성한 내용을 보관한 뒤 다시 불러와 주세요.','error');document.body.append(script);
})();
