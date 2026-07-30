var DC = DC || {};

DC.MailService = (function () {
  function render(templateName, data) {
    var template = HtmlService.createTemplateFromFile(templateName);
    Object.keys(data || {}).forEach(function (key) {
      template[key] = data[key];
    });
    return template.evaluate().getContent();
  }

  function assertQuota(recipientCount) {
    if (MailApp.getRemainingDailyQuota() < Number(recipientCount || 1)) {
      throw new Error('MAIL_QUOTA_EXHAUSTED');
    }
  }

  function typeLabel(type) {
    return DC.PdfService.typeLabel(String(type));
  }

  function sendIssued(contract, signer, rawToken) {
    assertQuota(1);
    var settings = DC.Storage.getSettingsMap();
    var base = String(settings.SIGN_PAGE_BASE_URL || '').trim();
    if (!DC.Config.validateSignPageBaseUrl(base)) {
      throw new Error('SIGN_PAGE_NOT_CONFIGURED');
    }
    var signUrl = base + '#' + rawToken;
    MailApp.sendEmail({
      to: String(signer.signerEmail),
      subject: '[DAILYCOACHING] 코칭계약서 확인 요청 · ' + contract.contractId,
      body:
        '코칭계약서 전자확인 요청이 도착했습니다.\n' +
        '계약번호: ' + contract.contractId + '\n' +
        '계약종류: ' + typeLabel(contract.contractType) + '\n' +
        '확인 주소: ' + signUrl + '\n' +
        '문의: ' + settings.CONTACT_EMAIL,
      htmlBody: render('EmailIssued', {
        signerName: String(signer.signerName),
        contractId: String(contract.contractId),
        contractTypeLabel: typeLabel(contract.contractType),
        signUrl: signUrl,
        contactEmail: String(settings.CONTACT_EMAIL)
      }),
      name: String(settings.SERVICE_NAME),
      replyTo: String(settings.CONTACT_EMAIL)
    });
  }

  function sendOtp(context) {
    assertQuota(1);
    var settings = DC.Storage.getSettingsMap();
    MailApp.sendEmail({
      to: String(context.signerEmail),
      subject: '[DAILYCOACHING] 코칭계약 전자확인 인증번호',
      body:
        '전자확인 인증번호는 ' + context.otp + '입니다.\n' +
        '인증번호는 10분 동안 유효하며 누구에게도 전달하지 마세요.\n' +
        '문의: ' + settings.CONTACT_EMAIL,
      htmlBody: render('EmailOtp', {
        signerName: String(context.signerName),
        otp: String(context.otp),
        contactEmail: String(settings.CONTACT_EMAIL)
      }),
      name: String(settings.SERVICE_NAME),
      replyTo: String(settings.CONTACT_EMAIL)
    });
  }

  function sendCompleted(contract, recipient, pdfBlob) {
    assertQuota(1);
    var settings = DC.Storage.getSettingsMap();
    MailApp.sendEmail({
      to: String(recipient.email),
      subject: '[DAILYCOACHING] 코칭계약서가 완료되었습니다 · ' + contract.contractId,
      body:
        '코칭계약서가 완료되었습니다.\n' +
        '계약번호: ' + contract.contractId + '\n' +
        '계약종류: ' + typeLabel(contract.contractType) + '\n' +
        '완료일: ' + contract.completedAt + '\n' +
        '문의: ' + settings.CONTACT_EMAIL,
      htmlBody: render('EmailCompleted', {
        recipientName: String(recipient.name || ''),
        contractId: String(contract.contractId),
        contractTypeLabel: typeLabel(contract.contractType),
        completedAt: String(contract.completedAt),
        contactEmail: String(settings.CONTACT_EMAIL)
      }),
      attachments: [pdfBlob.setName(contract.contractId + '-coaching-contract.pdf')],
      name: String(settings.SERVICE_NAME),
      replyTo: String(settings.CONTACT_EMAIL)
    });
  }

  function sendRetentionSummary(contractIds) {
    if (!contractIds.length) return;
    assertQuota(1);
    var settings = DC.Storage.getSettingsMap();
    MailApp.sendEmail({
      to: String(settings.CONTACT_EMAIL),
      subject: '[DAILYCOACHING] 개인정보 파기 예정 계약 확인',
      body:
        '보유기간 검토 대상 계약 수: ' + contractIds.length + '\n' +
        '계약번호: ' + contractIds.join(', ') + '\n' +
        '자동 삭제되지 않았습니다. 관계 법령과 운영정책을 확인한 뒤 처리하세요.',
      name: String(settings.SERVICE_NAME),
      replyTo: String(settings.CONTACT_EMAIL)
    });
  }

  return Object.freeze({
    sendIssued: sendIssued,
    sendOtp: sendOtp,
    sendCompleted: sendCompleted,
    sendRetentionSummary: sendRetentionSummary
  });
})();
