(() => {
 if(document.body.dataset.readRouteInvalid){const root=document.querySelector('[data-private-root]');if(root){root.hidden=false;root.textContent='시즌 또는 화면 주소를 확인해 주세요.';}return;}
 const N=window.NalRead;if(!N)return;
 const baseLink=N.link;
 function generic(raw){
  const u=new URL(raw,location.origin);if(u.origin!==location.origin)return raw;
  const match=u.pathname.match(/^\/nal\/read\/([a-z0-9-]+)\/(before|today|journey|day|try|live|my|report)\/$/);
  if(!match||match[1]!==N.slug)return raw;
  const result=new URL('/nal/read/open/',location.origin);result.search=u.search;result.searchParams.set('season',N.slug);result.searchParams.set('view',match[2]);return result.pathname+result.search;
 }
 N.link=(href,text,cls)=>baseLink(generic(href),text,cls);
 document.querySelectorAll('[data-read-nav] a,[data-report-link]').forEach(a=>a.href=generic(a.href));
 const view=document.body.dataset.readDailyPage||document.body.dataset.readWorkspacePage;
 const file=['before','today','journey','day'].includes(view)?'read-daily.js':view==='report'?'read-report.js':'read-workspace.js';
 const script=document.createElement('script');script.src='/nal/assets/js/'+file+'?v=build10';script.onerror=()=>N.status('화면을 불러오지 못했습니다. 새로고침 후 다시 열어주세요.','error');document.body.append(script);
})();
