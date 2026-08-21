(function () {
  'use strict';

  function initVerify() {
    const form = document.querySelector('[data-verify-form]');
    const input = document.querySelector('[data-verify-input]');
    const result = document.querySelector('[data-verify-result]');
    if (!form || !input || !result) return;

    form.addEventListener('submit', (event) => {
      event.preventDefault();
      const value = input.value.trim().toUpperCase();
      if (value === 'DEMO-RSPSYCH-001') {
        result.innerHTML = `<div class="verify-document">
          <span class="status-chip demo">DEMO RECORD · NOT VERIFIED</span>
          <h2>연결 전 Credential 구조 예시</h2>
          <p>이 문서는 실제 발급·검증 결과가 아닙니다. 검증 제공자와 발급주체가 확정되기 전의 제품 구조를 보여줍니다.</p>
          <dl>
            <div class="document-row"><dt>Reference</dt><dd>DEMO-RSPSYCH-001</dd></div>
            <div class="document-row"><dt>Credential</dt><dd>GROWTH JOURNEY — Preview</dd></div>
            <div class="document-row"><dt>Evidence</dt><dd>결과리뷰 · 작은 실천 · 실천 회고의 예시 구조</dd></div>
            <div class="document-row"><dt>Issuer</dt><dd>발급주체 확인 전</dd></div>
            <div class="document-row"><dt>Verification</dt><dd>외부 검증 시스템 미연결</dd></div>
          </dl>
        </div>`;
      } else {
        result.innerHTML = `<span class="status-chip pending">NOT CONNECTED</span><h2>검증할 수 없는 참조값입니다.</h2><p>현재 공개 페이지는 실제 Credential 검증 시스템과 연결되어 있지 않습니다. 예시 구조는 <strong>DEMO-RSPSYCH-001</strong>에서만 확인할 수 있습니다.</p>`;
      }
      result.hidden = false;
      result.focus();
      RSPsych.track('rspsych_submit_demo_verify', { result: value === 'DEMO-RSPSYCH-001' ? 'demo-record' : 'not-connected' });
    });
  }

  document.addEventListener('DOMContentLoaded', initVerify);
})();
