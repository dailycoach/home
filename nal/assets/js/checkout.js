(() => {
  "use strict";
  const PRODUCT_ID=/^[a-z0-9-]{1,120}$/;
  const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  const $=(s,r=document)=>r.querySelector(s);
  const money=(n)=>Number.isFinite(n)?new Intl.NumberFormat("ko-KR").format(n)+"원":"";
  const params=new URLSearchParams(location.search);
  const page=document.body.dataset.checkoutPage||"start";
  const productId=PRODUCT_ID.test(params.get("product")||"")?params.get("product"):"";
  let config=null,client=null,session=null,product=null,order=null,widgets=null;

  function setStatus(message,type=""){
    const node=$("[data-status]"); if(!node)return;
    node.hidden=!message; node.textContent=message||""; node.className="status"+(type?" "+type:"");
  }
  function uuid(){
    if(globalThis.crypto?.randomUUID)return crypto.randomUUID();
    return "10000000-1000-4000-8000-100000000000".replace(/[018]/g,c=>(c^crypto.getRandomValues(new Uint8Array(1))[0]&15>>c/4).toString(16));
  }
  async function json(url,options={}){
    const res=await fetch(url,{cache:"no-store",...options});
    const value=await res.json().catch(()=>({}));
    if(!res.ok){const e=new Error(value.error||("HTTP "+res.status));e.status=res.status;e.data=value;throw e}
    return value;
  }
  async function setup(){
    const [cfg,catalog]=await Promise.all([json("/nal/data/backend.json"),json("/nal/data/products.json")]);
    if(cfg?.enabled!==true||!/^https:\/\/[a-z0-9]{20}\.supabase\.co$/.test(cfg.url||"")||!/^sb_publishable_[A-Za-z0-9_-]+$/.test(cfg.publishableKey||""))throw new Error("구매자 인증 설정을 확인할 수 없습니다.");
    if(!globalThis.supabase?.createClient)throw new Error("구매자 인증 모듈을 불러오지 못했습니다.");
    config=cfg;
    product=(catalog.products||[]).find(p=>p.id===productId)||null;
    client=globalThis.supabase.createClient(config.url,config.publishableKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
    const current=await client.auth.getSession(); session=current.data?.session||null;
    client.auth.onAuthStateChange((_event,next)=>{session=next;renderAccount();if(page==="start")renderStartState();});
  }
  function renderProduct(){
    const slot=$("[data-product]");
    if(!slot)return;
    if(!product){slot.innerHTML="<p>상품 정보를 찾을 수 없습니다.</p>";return}
    const img=document.createElement("img");img.src=product.coverImage;img.alt=product.coverImageAlt||product.title;
    const copy=document.createElement("div");
    const title=document.createElement("h2");title.textContent=product.title;
    const meta=document.createElement("p");meta.textContent=["PDF",product.pageCount?product.pageCount+"쪽":"",product.licenseType==="personal-use"?"개인사용권":""].filter(Boolean).join(" · ");
    const price=document.createElement("p");price.className="product-price";
    if(Number.isFinite(product.originalPrice)&&product.originalPrice!==product.price){const del=document.createElement("del");del.textContent=money(product.originalPrice);price.append(del)}
    price.append(document.createTextNode(money(product.price)));
    copy.append(title,meta,price);slot.replaceChildren(img,copy);
  }
  function renderAccount(){
    const account=$("[data-account]"),auth=$("[data-auth]");
    if(!account||!auth)return;
    if(session?.user?.email){
      account.hidden=false;auth.hidden=true;
      $("[data-account-email]").textContent=session.user.email;
    }else{account.hidden=true;auth.hidden=false}
  }
  async function sendMagicLink(event){
    event.preventDefault();
    const email=$("[data-email]")?.value.trim();
    if(!email)return setStatus("이메일을 입력해 주세요.","error");
    const redirect=new URL(location.href);redirect.hash="";
    try{
      setStatus("로그인 링크를 보내는 중입니다.");
      const {error}=await client.auth.signInWithOtp({email,options:{emailRedirectTo:redirect.href,shouldCreateUser:true}});
      if(error)throw error;
      setStatus("이메일로 로그인 링크를 보냈습니다. 같은 브라우저에서 링크를 열어주세요.","ok");
    }catch(e){setStatus(e.message||"로그인 링크를 보내지 못했습니다.","error")}
  }
  async function signOut(){await client.auth.signOut();location.reload()}
  function renderStartState(){
    const begin=$("[data-begin]"),policy=$("[data-policy]");
    if(!begin)return;
    const available=product&&product.stockStatus==="available"&&Number.isFinite(product.price)&&product.price>=100;
    begin.disabled=!available||!session||!(policy?.checked);
    if(!product)return setStatus("상품을 찾을 수 없습니다.","error");
    if(product.stockStatus!=="available"){
      setStatus("현재는 판매 준비 단계입니다. 결제와 구매자 전용 다운로드 연결을 모두 검증한 뒤 판매를 엽니다.");
      return;
    }
    if(!session)setStatus("구매를 위해 이메일 인증이 필요합니다.");
    else setStatus("구매자 인증이 완료되었습니다. 이용 범위를 확인한 뒤 결제를 준비해 주세요.","ok");
  }
  async function preparePayment(){
    if(!session)return setStatus("먼저 이메일 인증을 완료해 주세요.","error");
    if(!product||product.stockStatus!=="available")return setStatus("아직 판매 준비 중입니다.");
    const button=$("[data-begin]");button.disabled=true;setStatus("안전한 결제 주문을 준비하고 있습니다.");
    try{
      order=await json(config.url+"/functions/v1/nal-toss-checkout",{method:"POST",headers:{apikey:config.publishableKey,Authorization:"Bearer "+session.access_token,"Content-Type":"application/json"},body:JSON.stringify({action:"create-order",productId:product.id,requestId:uuid()})});
      if(!UUID.test(order.orderId||"")||!Number.isInteger(order.amount)||order.amount<100||!order.clientKey)throw new Error("결제 주문 정보가 올바르지 않습니다.");
      if(!globalThis.TossPayments)throw new Error("결제 모듈을 불러오지 못했습니다.");
      const toss=globalThis.TossPayments(order.clientKey);
      widgets=toss.widgets({customerKey:session.user.id});
      await widgets.setAmount({currency:"KRW",value:order.amount});
      await Promise.all([widgets.renderPaymentMethods({selector:"#payment-method"}),widgets.renderAgreement({selector:"#agreement"})]);
      $("[data-authoritative-amount]").textContent=money(order.amount);
      $("[data-payment-box]").hidden=false;
      setStatus("결제수단을 선택한 뒤 결제를 진행해 주세요.","ok");
    }catch(e){
      if(e.status===503)setStatus("결제 기능은 아직 오픈 전입니다. 상점키·원본 파일·테스트 결제가 모두 확인된 뒤 활성화됩니다.");
      else setStatus(e.message||"결제 준비에 실패했습니다.","error");
      button.disabled=false;
    }
  }
  async function requestPayment(){
    if(!widgets||!order||!session)return;
    const success=new URL(order.successUrl),fail=new URL(order.failUrl);
    success.searchParams.set("product",product.id);fail.searchParams.set("product",product.id);
    try{
      await widgets.requestPayment({orderId:order.orderId,orderName:order.orderName,successUrl:success.href,failUrl:fail.href,customerEmail:session.user.email||undefined});
    }catch(e){setStatus(e.message||"결제창을 열지 못했습니다.","error")}
  }
  async function confirmPayment(){
    const paymentKey=params.get("paymentKey")||"",orderId=params.get("orderId")||"",amount=Number(params.get("amount"));
    if(!session)return setStatus("결제 확인을 위해 구매에 사용한 이메일로 다시 로그인해 주세요.","error");
    if(!paymentKey||!UUID.test(orderId)||!Number.isInteger(amount)||amount<100)return setStatus("결제 결과 주소가 올바르지 않습니다.","error");
    try{
      setStatus("결제 승인과 구매 권한을 확인하고 있습니다.");
      const result=await json(config.url+"/functions/v1/nal-toss-checkout",{method:"POST",headers:{apikey:config.publishableKey,Authorization:"Bearer "+session.access_token,"Content-Type":"application/json"},body:JSON.stringify({action:"confirm",orderId,paymentKey,amount})});
      if(!result.entitlementId||!UUID.test(result.entitlementId))throw new Error("구매 권한 연결을 확인하지 못했습니다.");
      const resultBox=$("[data-success-result]"); if(resultBox)resultBox.hidden=false;
      const ent=$("[data-entitlement]");if(ent)ent.textContent=result.entitlementId;
      const dl=$("[data-download]");if(dl){dl.disabled=false;dl.dataset.entitlement=result.entitlementId}
      setStatus("결제가 확인되었습니다. 구매자 전용 다운로드를 발급할 수 있습니다.","ok");
    }catch(e){
      if(e.status===503)setStatus("결제 승인 이후 전달 연결을 확인 중입니다. 같은 계정으로 다시 시도할 수 있도록 주문 기록은 서버에서 유지됩니다.","error");
      else setStatus(e.message||"결제 확인에 실패했습니다.","error");
    }
  }
  async function downloadPurchase(){
    const button=$("[data-download]"),entitlementId=button?.dataset.entitlement||"";
    if(!session||!UUID.test(entitlementId))return;
    button.disabled=true;setStatus("짧게 유효한 다운로드 링크를 발급하고 있습니다.");
    try{
      const r=await json(config.url+"/functions/v1/nal-digital-download",{method:"POST",headers:{apikey:config.publishableKey,Authorization:"Bearer "+session.access_token,"Content-Type":"application/json"},body:JSON.stringify({entitlementId,requestId:uuid()})});
      if(!/^https:\/\//.test(r.downloadUrl||""))throw new Error("다운로드 링크를 확인하지 못했습니다.");
      setStatus("다운로드 링크가 발급되었습니다. 새 창에서 파일을 엽니다.","ok");
      window.open(r.downloadUrl,"_blank","noopener,noreferrer");
    }catch(e){setStatus(e.status===503?"구매자 전용 파일 전달 기능은 아직 오픈 전입니다.":(e.message||"다운로드 링크 발급에 실패했습니다."),"error");button.disabled=false}
  }
  function renderFail(){
    const code=params.get("code")||"PAYMENT_FAILED",message=params.get("message")||"결제가 완료되지 않았습니다.";
    $("[data-fail-code]").textContent=code.slice(0,80);
    $("[data-fail-message]").textContent=message.slice(0,300);
    const back=$("[data-product-back]");if(back&&productId)back.href="/nal/shop/"+(product?.slug||productId)+"/";
  }
  async function boot(){
    try{await setup();renderProduct();renderAccount();
      if(page==="start"){renderStartState();$("[data-auth-form]")?.addEventListener("submit",sendMagicLink);$("[data-signout]")?.addEventListener("click",signOut);$("[data-policy]")?.addEventListener("change",renderStartState);$("[data-begin]")?.addEventListener("click",preparePayment);$("[data-pay]")?.addEventListener("click",requestPayment)}
      if(page==="success"){$("[data-download]")?.addEventListener("click",downloadPurchase);$("[data-auth-form]")?.addEventListener("submit",sendMagicLink);$("[data-signout]")?.addEventListener("click",signOut);await confirmPayment()}
      if(page==="fail")renderFail();
    }catch(e){setStatus(e.message||"결제 페이지를 준비하지 못했습니다.","error")}
  }
  boot();
})();