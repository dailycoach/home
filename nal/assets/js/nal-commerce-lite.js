/* NAL COMMERCE LITE · Guest-first storefront, PG-agnostic, RELEASE OFF by default.
 * No login, payment widget, token-in-URL, private storage path or service key in this script.
 * This client cannot authorize payment/delivery; server must re-verify every transition.
 */
(function (scope) {
  'use strict';
  const API_ROUTE='/functions/v1/nal-commerce-lite';
  const RECEIPT_KEY='nal-commerce-lite:tab-proof:v1';
  const PRODUCT_ID=/^[a-z0-9-]{1,120}$/;
  const ORDER_ID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  const SAFE_TOKEN=/^[A-Za-z0-9_-]{40,128}$/;
  const $=(selector)=>scope.document?.querySelector(selector);
  const fmt=amount=>Number.isInteger(amount)?new Intl.NumberFormat('ko-KR').format(amount)+'원':'가격 준비 중';

  function canRelease(gate){
    return gate?.schemaVersion===1 && gate?.module==='nal-commerce-lite'
      && gate.clientEnabled===true && gate.serverReady===true
      && gate.pgConfigured===true && gate.approvedPrivacyNotice===true
      && gate.approvedTermsAndRefunds===true && gate.settlementGuardReviewed===true
      && gate.fulfillmentReady===true && gate.emailReceiptReady===true
      && gate.customerReleaseApproved===true && typeof gate.provider==='string'
      && gate.provider.length>0 && Number.isInteger(gate.minimumAmountWon)
      && gate.minimumAmountWon>=100
      && Array.isArray(gate.allowedCheckoutOrigins) && gate.allowedCheckoutOrigins.length>0;
  }

  function safeCheckout(url,gate){
    if(typeof url!=='string')return null;
    try{
      const u=new URL(url);
      if(u.protocol!=='https:'||u.username||u.password||u.hash
        ||!gate?.allowedCheckoutOrigins?.includes(u.origin)
        ||u.origin===scope.location?.origin)return null;
      return u.href;
    }catch{return null;}
  }
  function validProduct(product,gate){
    return product?.published===true && product?.deliveryType==='digital'
      && product.stockStatus==='available'
      && Number.isInteger(product.price) && product.price>=gate.minimumAmountWon
      && PRODUCT_ID.test(product.id||'');
  }
  function safeFreeLink(product){
    const u=product?.purchaseUrl;
    return product?.published===true&&product?.price===0
      &&product?.stockStatus==='available'&&product?.deliveryType==='digital'
      &&typeof u==='string'&&/^\/nal\/assets\/downloads\/free\/[a-z0-9-]+\.pdf$/.test(u)?u:null;
  }
  async function publicJson(path){
    const response=await scope.fetch(path,{method:'GET',cache:'no-store',redirect:'error',credentials:'omit'});
    if(!response.ok)throw new Error('상품 안내를 불러오지 못했습니다.');
    return response.json();
  }
  function storeProof(proof){
    if(!ORDER_ID.test(proof?.orderId||'')||!SAFE_TOKEN.test(proof?.claimToken||''))return false;
    try{
      scope.sessionStorage?.setItem(RECEIPT_KEY,JSON.stringify({
        orderId:proof.orderId,claimToken:proof.claimToken,savedAt:Date.now()
      }));
      return true;
    }catch{return false;}
  }
  function recoverProof(){
    try{
      const proof=JSON.parse(scope.sessionStorage?.getItem(RECEIPT_KEY)||'null');
      if(!ORDER_ID.test(proof?.orderId||'')||!SAFE_TOKEN.test(proof?.claimToken||'')
        ||!Number.isFinite(proof.savedAt)||Date.now()-proof.savedAt>3600000
        ||Date.now()-proof.savedAt < -60000)return null;
      return proof;
    }catch{return null;}
  }
  function wipeProof(){
    try{scope.sessionStorage?.removeItem(RECEIPT_KEY);}catch{}
  }
  function setMessage(message,kind=''){
    const el=$('#ncl-status')||$('#ncl-result-message');
    if(el){el.textContent=message;el.dataset.kind=kind;}
  }
  function addText(parent,tag,klass,text){
    const el=scope.document.createElement(tag);
    if(klass)el.className=klass;
    el.textContent=text;
    parent.append(el);return el;
  }
  function addProduct(parent,product,free,active,onSelect){
    const node=scope.document.createElement(free?'a':'button');
    node.className='ncl-product'+(free?' ncl-product--free':'');
    if(free){node.href=safeFreeLink(product);node.setAttribute('download','');}
    else{node.type='button';node.setAttribute('aria-pressed',String(active));node.addEventListener('click',()=>onSelect(product));}
    const meta=addText(node,'span','ncl-product__meta','');
    addText(meta,'small','ncl-product__eyebrow',free?'NAL / FREE PDF':'NAL / DIGITAL PDF');
    addText(meta,'strong','',product.title);
    addText(meta,'small','',free?'로그인·결제 없이 PDF 바로 받기':
      product.stockStatus==='comingSoon'?'아직 판매하지 않습니다.':'디지털 PDF · 개인 이용');
    addText(node,'span','ncl-product__price',free?'무료 다운로드':fmt(product.price));
    parent.append(node);
    return node;
  }
  function selectProducts(productIds,products){
    const list=Array.isArray(products)?products:[];
    const selected=productIds&&PRODUCT_ID.test(productIds)?list.find(p=>p.id===productIds):null;
    return {
      selected:selected?.published && selected.deliveryType==='digital'&&selected.price>0?selected:null,
      paid:list.filter(p=>p.published===true&&p.deliveryType==='digital'&&Number.isInteger(p.price)&&p.price>0),
      free:list.filter(p=>Boolean(safeFreeLink(p)))
    };
  }
  async function serverJson(config,action,payload){
    if(!config?.enabled || !/^https:\/\/[a-z0-9]{20}\.supabase\.co$/.test(config.url||'')
      || !/^sb_publishable_[A-Za-z0-9_-]+$/.test(config.publishableKey||''))throw new Error('구매 서버가 아직 연결되지 않았습니다.');
    const response=await scope.fetch(config.url+API_ROUTE,{
      method:'POST',redirect:'error',cache:'no-store',credentials:'omit',
      headers:{apikey:config.publishableKey,'Content-Type':'application/json'},
      body:JSON.stringify({action,...payload}),
      signal:AbortSignal.timeout(12000)
    });
    const data=await response.json().catch(()=>({}));
    if(!response.ok)throw new Error(
      response.status===503?'결제 기능이 아직 준비 중입니다.':
      response.status===429?'잠시 후 다시 시도해 주세요.':
      '요청을 처리할 수 없습니다. 결제되었다면 재결제하지 말고 고객지원에 문의해 주세요.'
    );
    return data;
  }
  function validSignedUrl(value,config){
    if(typeof value!=='string')return null;
    try{
      const u=new URL(value);
      if(u.origin!==new URL(config.url).origin
        ||!u.pathname.startsWith('/storage/v1/object/sign/nal-products-private/')
        ||!u.searchParams.has('token'))return null;
      return u.href;
    }catch{return null;}
  }
  async function beginCheckout(product,gate,config){
    const input=$('#ncl-email'),consent=$('#ncl-consent'),buy=$('#ncl-buy');
    if(!canRelease(gate)||!validProduct(product,gate))return setMessage('판매 연결을 준비하고 있습니다.','error');
    if(!input?.validity.valid||!consent?.checked)return setMessage('이메일과 이용 안내 확인이 필요합니다.','error');
    buy.disabled=true;setMessage('안전한 결제 페이지를 준비하고 있습니다.');
    try{
      const result=await serverJson(config,'create',{
        productId:product.id,
        email:input.value.trim(),
        accepted:true,
        requestId:scope.crypto.randomUUID()
      });
      const target=safeCheckout(result.checkoutUrl,gate);
      if(!target||!storeProof(result))throw new Error('결제 경로 확인에 실패했습니다.');
      // The provider is external. Never include claimToken, email, session or prices in the URL.
      scope.location.assign(target);
    }catch(error){setMessage(error.message||'결제 경로 확인에 실패했습니다.','error');buy.disabled=false;}
  }
  async function bootCheckout(gate,products) {
    const form=$('#ncl-checkout-form'),button=$('#ncl-buy'),root=$('#ncl-products');
    if(!form||!button||!root)return;
    const data=selectProducts(new URLSearchParams(scope.location.search).get('product'),products);
    const valid=canRelease(gate);
    let picked=data.selected;
    function refresh(){
      root.replaceChildren();
      if(data.paid.length){
        addText(root,'h3','ncl-group-title','유료 마음도구');
        for(const p of data.paid)addProduct(root,p,false,p.id===picked?.id,choose);
      }
      if(data.free.length){
        addText(root,'h3','ncl-group-title','언제든 무료로 읽을 수 있는 작은 책');
        for(const p of data.free)addProduct(root,p,true,false,()=>{});
      }
      if(!data.paid.length&&!data.free.length)addText(root,'p','ncl-muted','공개된 상품이 없습니다.');
      const name=$('#ncl-order-name'),price=$('#ncl-order-price');
      if(name)name.textContent=picked?.title||'선택한 상품 없음';
      if(price)price.textContent=picked?fmt(picked.price):'—';
      button.disabled=!valid||!validProduct(picked,gate);
      button.textContent=!valid?'판매 연결 준비 중':picked?'결제 페이지 열기':'상품을 선택해 주세요';
    }
    function choose(p){picked=p;refresh();}
    refresh();
    if(!valid)return; // Never collect/send email or load buyer backend while release is OFF.
    let config;
    try{config=await publicJson('/nal/data/backend.json');}
    catch{button.disabled=true;setMessage('구매 서버 설정을 확인할 수 없습니다.','error');return;}
    form.addEventListener('submit',event=>{
      event.preventDefault();beginCheckout(picked,gate,config);
    });
  }
  async function bootComplete(gate){
    const button=$('#ncl-download');
    if(!button||!canRelease(gate))return;
    const proof=recoverProof();
    if(!proof){
      setMessage('이 브라우저에서 확인할 주문이 없습니다. 구매 이메일의 안내를 확인해 주세요.');
      return;
    }
    const orderQuery=new URLSearchParams(scope.location.search).get('order');
    if(orderQuery && orderQuery!==proof.orderId){
      setMessage('주문 정보를 확인할 수 없습니다. 고객지원에 문의해 주세요.','error');return;
    }
    let config;
    try{
      config=await publicJson('/nal/data/backend.json');
      const result=await serverJson(config,'status',{orderId:proof.orderId,claimToken:proof.claimToken});
      if(result.state==='paid'&&result.canDownload===true){
        setMessage('구매가 확인되었습니다. 아래 버튼을 눌러 PDF를 받을 수 있습니다.');
        button.hidden=false;
        button.addEventListener('click',async()=>{
          button.disabled=true;
          try{
            const answer=await serverJson(config,'download',{orderId:proof.orderId,claimToken:proof.claimToken});
            const signed=validSignedUrl(answer.downloadUrl,config);
            if(!signed)throw new Error('다운로드 주소를 확인하지 못했습니다.');
            scope.location.assign(signed);
          }catch{setMessage('다운로드를 연결하지 못했습니다. 구매 이메일로 문의해 주세요.','error');}
          finally{button.disabled=false;}
        },{once:false});
      }else if(result.state==='refunded'||result.state==='cancelled'){
        wipeProof();setMessage('환불되었거나 취소된 주문입니다. 새 다운로드는 제공되지 않습니다.');
      }else setMessage('결제 승인 결과를 확인 중입니다. 확인 전에는 다운로드가 제공되지 않습니다.');
    }catch{setMessage('결제 확인에 실패했습니다. 중복 결제하지 말고 고객지원에 문의해 주세요.','error');}
  }
  function takeReceiptFragment() {
    // Never leave a one-time proof in navigation history after opening the email.
    const hash=scope.location.hash||'';
    try{scope.history.replaceState(null,'',scope.location.pathname+scope.location.search);}catch{}
    try {
      const data=new URLSearchParams(hash.replace(/^#/,''));
      const orderId=data.get('order'),receiptToken=data.get('token');
      if(!ORDER_ID.test(orderId||'')||!SAFE_TOKEN.test(receiptToken||''))return null;
      if([...data.keys()].some(k=>!['order','token'].includes(k)))return null;
      return {orderId,receiptToken};
    }catch{return null;}
  }
  async function bootClaim(gate,receipt) {
    if(!canRelease(gate)) {
      setMessage('구매자 이메일 다운로드는 연결 준비 중입니다. 현재 실결제·자동전달은 제공하지 않습니다.');
      return;
    }
    if(!receipt) {
      setMessage('다운로드 확인 링크가 유효하지 않거나 이미 사용됐습니다. 고객지원에 문의해 주세요.','error');
      return;
    }
    try{
      const config=await publicJson('/nal/data/backend.json');
      const result=await serverJson(config,'redeem',receipt);
      const url=validSignedUrl(result?.downloadUrl,config);
      if(!url)throw Error('invalid signed URL');
      setMessage('구매 내역과 본인 이메일 링크를 확인했습니다. 아래 버튼을 눌러 PDF를 받으세요.');
      const button=$('#ncl-receipt-download');
      if(button){
        button.hidden=false;
        button.addEventListener('click',()=>{
          button.disabled=true;
          scope.location.assign(url);
        },{once:true});
      }
    }catch{
      setMessage('다운로드를 확인하지 못했습니다. 결제되었다면 다시 결제하지 말고 고객지원에 문의해 주세요.','error');
    }
  }
  async function boot(){
    if(!scope.document)return;
    try{
      const gate=await publicJson('/nal/data/commerce-lite.release.json');
      if(scope.document.body?.dataset.commercePage==='claim')await bootClaim(gate,takeReceiptFragment());
      else if(scope.document.body?.dataset.commercePage==='complete')await bootComplete(gate);
      else if(scope.document.body?.dataset.commercePage==='checkout'){
        const data=await publicJson('/nal/data/products.json');
        await bootCheckout(gate,data.products);
      }
    }catch{setMessage('판매 준비 상태를 확인할 수 없습니다. 현재 유료 결제는 제공하지 않습니다.','error');}
  }
  scope.NALCommerceLite=Object.freeze({canRelease,safeCheckout,safeFreeLink,validProduct,selectProducts,validSignedUrl});
  if(scope.document){
    if(scope.document.readyState==='loading')scope.document.addEventListener('DOMContentLoaded',()=>{void boot();},{once:true});
    else void boot();
  }
})(globalThis);
