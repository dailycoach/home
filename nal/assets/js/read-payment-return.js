(() => {
 // Runs before any remote SDK. Keep provider return credentials in memory only.
 const q=new URLSearchParams(location.search);
 const order=q.get('order');const ok=/^[0-9a-f-]{36}$/i.test(order||'');
 const key=q.get('paymentKey'),providerOrderId=q.get('orderId'),rawAmount=q.get('amount');
 const valid=ok&&typeof key==='string'&&key.length>0&&key.length<=200&&/^nr_[a-f0-9]{32}$/.test(providerOrderId||'')&&/^\d{1,8}$/.test(rawAmount||'');
 window.NalPaymentReturn=valid?{orderId:order,paymentKey:key,providerOrderId,amount:Number(rawAmount)}:null;
 window.NalPaymentFailure=q.get('code')?.slice(0,80)||null;
 history.replaceState({},'',location.pathname+(ok?'?order='+encodeURIComponent(order):''));
})();
