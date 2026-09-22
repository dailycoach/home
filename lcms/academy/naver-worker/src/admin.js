export const adminHtml = `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>LMC 네이버 운영</title><link rel="stylesheet" href="/admin/style.css"><script src="/admin/app.js" defer></script></head><body><header><strong>LMC ACADEMY</strong><span>NAVER AUTOMATION</span></header><main><h1>주문과 수강등록</h1><p>구매 상태, 등록 결과와 발송 오류를 확인합니다. 안내 재처리는 먼저 발송 결과를 확인하며, 새 코드는 ‘입장코드 재발급’으로만 발송합니다.</p><p id="status" role="status" aria-live="polite"></p><nav id="filters" aria-label="주문 분류"><button data-filter="">전체</button><button data-filter="NAVER_DETECTED">신규 구매</button><button data-filter="REGISTRATION_PENDING">등록 대기</button><button data-filter="REGISTERED">등록 완료</button><button data-filter="ACTIVE">수강 활성</button><button data-filter="SUSPENDED">취소·반품</button><button data-filter="MANUAL_REVIEW">처리 오류</button></nav><div class="scroll"><table><thead><tr><th>상품주문번호</th><th>구매시각 / 상품</th><th>NAVER</th><th>등록 / 수강생</th><th>접근 / 이메일</th><th>최근 동기화 / 오류</th><th>조치</th></tr></thead><tbody id="orders"></tbody></table></div><button id="more">다음 주문 불러오기</button><dialog id="detail"><h2>주문 처리 기록</h2><pre></pre><button id="close">닫기</button></dialog></main></body></html>`;
export const adminCss = `:root{font-family:Arial,'Noto Sans KR',sans-serif;color:#0a1733;background:#f7f9fc}body{margin:0}header{padding:24px 4%;background:#071b3d;color:white;display:flex;gap:20px;flex-wrap:wrap}header span{color:#73e7bd;font-size:12px;letter-spacing:.16em}main{margin:40px auto;padding:0 24px;max-width:1500px}h1{font-size:32px}p{line-height:1.7}nav{display:flex;gap:8px;flex-wrap:wrap;margin:24px 0}.scroll{overflow:auto}table{width:100%;border-collapse:collapse;background:white;font-size:13px}th,td{padding:16px;text-align:left;border-bottom:1px solid #dde4ef;min-width:100px}td:last-child{min-width:250px}button{background:white;color:#071b3d;border:1px solid #cad5e8;border-radius:8px;padding:10px 14px;cursor:pointer;margin:3px}button:focus-visible{outline:3px solid #1f5cff}button:disabled{opacity:.5}dialog{max-width:85vw;width:720px;border:0;border-radius:16px;padding:24px}pre{white-space:pre-wrap;word-break:break-word}#status{min-height:28px;color:#1654d2}`;
export const adminJs = `
const status = document.querySelector('#status');
const tbody = document.querySelector('#orders');
let orders = [], after = '', filter = '';
async function api(path, body) {
  const response = await fetch(path, {method: body ? 'POST' : 'GET', headers: body ? {'Content-Type':'application/json','X-LMC-Admin':'1'} : {}, ...(body ? {body:JSON.stringify(body)} : {})});
  const value = await response.json(); if (!response.ok) throw new Error(value.code || 'REQUEST_FAILED'); return value;
}
function render() {
  tbody.replaceChildren();
  for (const order of orders.filter(x => !filter || x.state === filter || (filter === 'SUSPENDED' && x.terminalStatus))) {
    const row = document.createElement('tr');
    const columns = [order.maskedOrderId, [order.purchasedAt, order.productId].join(' / '), order.naverStatus, [order.state,order.studentId].join(' / '), [order.accessStatus,order.mailStatus].join(' / '), [order.lastSync,order.error].join(' / ')];
    for (const text of columns) { const cell = document.createElement('td'); cell.textContent = text; row.append(cell); }
    const actions = document.createElement('td');
    for (const [action,label] of [['detail','상세'],['resync','주문 재동기화'],['reconcile','등록·안내 재처리'],['reissue','입장코드 재발급'],['suspend','접근정지'],['review','검토 완료 기록']]) {
      const button = document.createElement('button'); button.textContent = label;
      button.addEventListener('click', async () => {
        if (['reissue','suspend'].includes(action) && !confirm(label + '을 실행하시겠습니까?')) return;
        button.disabled = true; status.textContent = '처리 중…';
        try {
          if (action === 'detail') { const data = await api('/admin/api/detail?id='+encodeURIComponent(order.ref)); document.querySelector('#detail pre').textContent = JSON.stringify(data,null,2); document.querySelector('#detail').showModal(); }
          else {
            // Keep this id on the button if a response is lost; retries cannot resend.
            button.dataset.operationId ||= crypto.randomUUID();
            await api('/admin/api/'+action, {ref:order.ref,operationId:button.dataset.operationId});
            await load(true);
          }
          status.textContent = '확인했습니다.';
        } catch(error) { status.textContent = '처리 결과를 확인해 주세요: '+error.message; }
        finally { button.disabled = false; }
      }); actions.append(button);
    }
    row.append(actions); tbody.append(row);
  }
}
async function load(reset = false) { const data = await api('/admin/api/orders'+(reset || !after ? '' : '?after='+encodeURIComponent(after))); orders = reset ? data.orders : [...orders,...data.orders]; after = data.next; document.querySelector('#more').hidden = !after; if(data.sync) status.textContent = '최근 동기화: '+data.sync.at+' · '+(data.sync.disabled?'중지됨':data.sync.ok?'정상':data.sync.code); render(); }
document.querySelector('#filters').addEventListener('click',event=>{if(event.target.matches('button')) {filter=event.target.dataset.filter;render();}});
document.querySelector('#more').addEventListener('click',()=>load().catch(error=>status.textContent=error.message));
document.querySelector('#close').addEventListener('click',()=>document.querySelector('#detail').close());
load().catch(error=>status.textContent=error.message);
`;
