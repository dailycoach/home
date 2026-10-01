(() => {
  'use strict';
  const config = window.LMC_REGISTRATION_CONFIG || {};
  const verify = document.querySelector('#verifyForm'), student = document.querySelector('#studentForm'), status = document.querySelector('#status');
  let token = '', busy = false;
  const messages = {
    ORDER_VERIFICATION_FAILED: '구매정보를 확인하지 못했습니다. 입력 내용을 확인하거나 기존 신청서를 이용해 주세요.',
    INVALID_ORDER: '상품주문번호를 다시 확인해 주세요.', RATE_LIMIT: '확인 횟수가 초과되었습니다. 10분 후 다시 시도해 주세요.',
    REGISTRATION_SESSION_INVALID: '구매 확인 시간이 만료되었습니다. 구매정보를 다시 확인해 주세요.',
    REGISTRATION_ALREADY_CLAIMED: '이미 접수된 정보와 다릅니다. 기존 신청서를 통해 운영자에게 문의해 주세요.',
    INVALID_STUDENT: '이름, 이메일, 휴대전화번호와 필수 동의를 확인해 주세요.',
    REGISTRATION_NOT_OPEN: '자동 수강등록을 준비하고 있습니다. 아래 기존 신청서를 이용해 주세요.'
  };
  function stage(number) {
    for (let i = 1; i <= 3; i++) { const el = document.querySelector('#step'+i); if (i === number) el.setAttribute('aria-current','step'); else el.removeAttribute('aria-current'); }
    verify.hidden = number !== 1; student.hidden = number !== 2; document.querySelector('#complete').hidden = number !== 3;
    document.querySelector('#formStep').textContent = 'STEP 0'+number;
    document.querySelector('#formTitle').textContent = ['','구매 내역을 확인할게요.','수강생 정보를 알려주세요.','등록 결과를 확인해 주세요.'][number];
    document.querySelector('#formDescription').textContent = number === 2 ? '입장코드를 받을 이메일을 정확하게 입력해 주세요. 구매 확인은 15분 동안 유효합니다.' : number === 3 ? '수강 안내는 등록한 이메일로 보내드립니다.' : '스마트스토어 주문상세에 표시된 정보를 입력해 주세요.';
  }
  async function post(path, body) {
    if (!/^https:\/\/[a-z0-9.-]+(?::\d+)?\/?$/i.test(config.apiBase || '')) throw new Error('REGISTRATION_NOT_OPEN');
    let response;
    try { response = await fetch(config.apiBase.replace(/\/$/,'') + path, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(body), credentials:'omit', referrerPolicy:'no-referrer', signal:AbortSignal.timeout(45000) }); }
    catch { throw new Error('NETWORK_ERROR'); }
    let data; try { data = await response.json(); } catch { throw new Error('NETWORK_ERROR'); }
    if (!response.ok || !data.ok) throw new Error(data.code || 'NETWORK_ERROR'); return data;
  }
  async function submit(form, fn) {
    if (busy || !form.reportValidity()) return; busy = true;
    form.querySelectorAll('button').forEach(x=>x.disabled=true); status.textContent='확인하고 있습니다…';
    try { await fn(); }
    catch(error) { status.textContent = messages[error.message] || '처리 결과를 확인하지 못했습니다. 잠시 후 같은 정보로 다시 시도해 주세요. 이미 접수된 주문은 중복 발급되지 않습니다.'; }
    finally { busy=false;form.querySelectorAll('button').forEach(x=>x.disabled=false); }
  }
  verify.addEventListener('submit',event=>{event.preventDefault();submit(verify,async()=>{
    const data = await post('/registration/verify',Object.fromEntries(new FormData(verify)));
    token=data.token;verify.reset();stage(2);status.textContent='구매정보를 확인했습니다.';document.querySelector('#studentName').focus();
  });});
  student.addEventListener('submit',event=>{event.preventDefault();submit(student,async()=>{
    const data = await post('/registration/complete',{...Object.fromEntries(new FormData(student)),consent:document.querySelector('#consent').checked,token});
    stage(3);token='';student.reset();status.textContent='';
    document.querySelector('#receipt').textContent = data.state === 'ACTIVE' ? '수강등록이 완료되었습니다. 이메일에서 8자리 입장코드를 확인해 주세요. 메일이 보이지 않으면 스팸함도 확인해 주세요.' : '신청을 접수했습니다. 운영자가 등록 또는 발송 상태를 확인한 뒤 안내해 드립니다. 기존 신청서에 상품주문번호를 남기시면 확인에 도움이 됩니다.';
    document.querySelector('#formTitle').setAttribute('tabindex','-1');document.querySelector('#formTitle').focus();
  });});
  document.querySelector('#restart').addEventListener('click',()=>{token='';student.reset();stage(1);status.textContent='';});
  if (!config.apiBase) { status.textContent=messages.REGISTRATION_NOT_OPEN;verify.querySelector('button').disabled=true; }
})();
