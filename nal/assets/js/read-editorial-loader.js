// Classic deferred scripts execute in document order. Load the editor module only
// after read-session.js has installed its shared session API. No test/preview run.
import('/nal/assets/js/read-editorial.js?v=build05').catch(()=>{
 const status=document.querySelector('[data-daily-status]');
 if(status){status.textContent='편집 화면을 불러오지 못했습니다. 새로고침해 주세요.';status.dataset.state='error';}
});
