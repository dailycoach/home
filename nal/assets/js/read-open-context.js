/* BUILD20 — a valid URL selects a screen; the original server access gates still decide access. */
(() => {
 try{
  if(window.NalReadRoutes?.version!==20)throw new Error('참가자 경로 파일의 버전을 확인해 주세요.');
  const {slug,view}=window.NalReadRoutes.parse(location.search);
  document.body.dataset.season=slug;document.body.dataset.readBundle='build20';
  if(['before','today','journey','day'].includes(view))document.body.dataset.readDailyPage=view;
  else document.body.dataset.readWorkspacePage=view;
  document.title=view.toUpperCase()+' | NAL READ';
 }catch(error){document.body.dataset.readRouteInvalid='true';document.body.dataset.season='route-unavailable';document.body.dataset.readRouteMessage=error.message;}
})();
