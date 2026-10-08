// BUILD18: retain the original editor; require its shared location adapter before loading.
if(!window.NalRead||!window.NalAdminContext){
 const status=document.querySelector('[data-daily-status]');
 if(status){status.hidden=false;status.textContent='계정·운영 경로 파일의 버전을 다시 확인해 주세요.';status.dataset.state='error';}
}else import('/nal/assets/js/read-editorial.js?v=read29-54ef9714').catch(()=>{
 window.NalRead.status('편집 화면을 불러오지 못했습니다. 작성한 내용을 보관한 뒤 다시 불러와 주세요.','error');
});
