/* BUILD20 — old bookmarks enter the same renderer; never load a second editor/Auth client. */
(() => {
 'use strict';const routes=window.NalReadRoutes,status=document.querySelector('[data-route-status]'),link=document.querySelector('[data-route-continue]');
 try{
  if(routes?.version!==20)throw new Error('화면 연결 파일을 불러오지 못했습니다. MY NAL에서 다시 열어주세요.');
  const slug=document.body.dataset.legacySeason,view=document.body.dataset.legacyView;
  const path='/nal/read/'+slug+'/'+view+'/';
  if(![path,path+'index.html'].includes(location.pathname))throw new Error('기존 참가자 화면 주소를 확인해 주세요.');
  if(location.hash&&location.hash!=='#main-content')throw new Error('이 주소의 추가 정보를 참가자 화면으로 넘기지 않습니다. MY NAL에서 다시 열어주세요.');
  const next=routes.route(slug,view,new URLSearchParams(location.search));
  if(link){link.href=next;link.hidden=false;}if(status)status.textContent='같은 시즌의 공통 참가자 화면으로 연결합니다.';
  location.replace(next);
 }catch(error){if(link)link.hidden=true;if(status)status.textContent=error.message||'주소를 확인하지 못했습니다. MY NAL에서 다시 열어주세요.';}
})();
