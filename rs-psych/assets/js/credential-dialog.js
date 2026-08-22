(function () {
  'use strict';

  let credentials = [];

  function listMarkup(items) {
    return items.map((item) => `<li>${RSPsych.escapeHTML(item)}</li>`).join('');
  }

  function renderDialog(dialog, credential) {
    const body = dialog.querySelector('[data-credential-dialog-body]');
    const title = dialog.querySelector('[data-credential-dialog-title]');
    title.textContent = credential.koTitle;
    body.innerHTML = `
      <div class="credential-dialog-grid">
        <div>${RSPsych.credentialSealMarkup(credential, { button: false, caption: false })}</div>
        <div>
          <p class="micro">${RSPsych.escapeHTML(credential.title)}</p>
          <p>${RSPsych.escapeHTML(credential.subtitle)}</p>
          <div class="result-meta">
            ${RSPsych.statusChipMarkup(credential.status)}
            ${RSPsych.statusChipMarkup('operation-unverified', credential.issuerStatus)}
          </div>
          <div class="criteria-block"><h4>EVIDENCE</h4><ul>${listMarkup(credential.criteria.evidence)}</ul></div>
          <div class="criteria-block"><h4>MEANING</h4><ul>${listMarkup(credential.criteria.meaning)}</ul></div>
          <div class="criteria-block"><h4>APPLICATION</h4><ul>${listMarkup(credential.criteria.application)}</ul></div>
          <div class="boundary-box"><strong>공개 경계</strong><p>${RSPsych.escapeHTML(credential.publicBoundary)}</p></div>
        </div>
      </div>`;
  }

  async function init() {
    const dialog = document.getElementById('credential-dialog');
    if (!dialog) return;
    try {
      credentials = await RSPsych.loadJSON('credentials.json');
    } catch (error) {
      return;
    }

    document.addEventListener('click', (event) => {
      const trigger = event.target.closest('[data-credential-id]');
      if (!trigger) return;
      const credential = credentials.find((item) => item.id === trigger.dataset.credentialId);
      if (!credential) return;
      event.preventDefault();
      renderDialog(dialog, credential);
      RSPsych.openDialog(dialog, trigger);
      RSPsych.track('rspsych_view_credential_preview', { credential_id: credential.id, domain: credential.domain });
    });
  }

  document.addEventListener('DOMContentLoaded', init);
})();
