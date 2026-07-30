var DC = DC || {};

function include_(fileName) {
  return HtmlService.createHtmlOutputFromFile(fileName).getContent();
}

function doGet() {
  var template = HtmlService.createTemplateFromFile('SignPage');
  template.allowedOriginsJson = JSON.stringify(DC.Config.allowedParentOrigins());
  return template.evaluate()
    .setTitle('코칭계약 전자확인 | DAILYCOACHING')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('DAILYCOACHING 계약')
    .addItem('신규 계약 발행', 'menuNewContract')
    .addItem('선택 계약 초대 재발송', 'menuResendSelectedInvitation')
    .addItem('선택 계약 PDF 재발송', 'menuResendSelectedPdf')
    .addItem('계약 종료 처리', 'menuTerminateSelectedContract')
    .addSeparator()
    .addItem('만료 계약 확인', 'menuCheckExpiredContracts')
    .addItem('개인정보 파기 예정 확인', 'menuCheckRetentionCandidates')
    .addItem('선택 계약 재조정', 'menuReconcileSelectedContract')
    .addItem('설정 점검', 'menuCheckSettings')
    .addToUi();
}

function installCoachingContractSystem() {
  return DC.Install.run();
}

function publicBootstrapSign(token) {
  return DC.OtpService.bootstrap(token);
}

function publicRequestOtp(token, requestId) {
  return DC.OtpService.requestOtp(token, requestId);
}

function publicVerifyOtp(token, otp, requestId) {
  return DC.OtpService.verifyOtp(token, otp, requestId);
}

function publicLoadContract(authSessionToken) {
  return DC.OtpService.loadContract(authSessionToken);
}

function publicAcceptContract(authSessionToken, acceptancePayload, requestId) {
  try {
    return DC.OtpService.accept(authSessionToken, acceptancePayload, requestId);
  } catch (error) {
    throw new Error('전자계약 체결 요청을 처리하지 못했습니다. 입력과 인증 유효시간을 확인하세요.');
  }
}

function publicContractManagementInfo() {
  return DC.ManagementService.publicInfo();
}

function adminIssueContract(payload, requestId) {
  return DC.ContractService.issue(payload, requestId);
}

function adminGetIssueDefaults() {
  return DC.ContractService.issueDefaults();
}

function adminResendInvitation(contractId, signerRole, requestId) {
  return DC.ContractService.resendInvitation(contractId, signerRole, requestId);
}

function adminResendPdf(contractId, requestId) {
  return DC.JobService.resendPdf(contractId, requestId);
}

function adminTerminateContract(contractId, reasonCode, requestId) {
  return DC.ContractService.terminate(contractId, reasonCode, requestId);
}

function adminGetSettingsHealth() {
  DC.Config.requireAdmin();
  return DC.Config.health();
}

function adminRecordManagementRequest(
  contractId,
  requestType,
  requesterRole,
  externalReference,
  requestId
) {
  return DC.ManagementService.recordRequest(
    contractId,
    requestType,
    requesterRole,
    externalReference,
    requestId
  );
}

function adminResolveManagementRequest(
  contractId,
  requestType,
  outcomeCode,
  requestId
) {
  return DC.ManagementService.resolveRequest(
    contractId,
    requestType,
    outcomeCode,
    requestId
  );
}

function menuNewContract() {
  DC.Config.requireAdmin();
  var template = HtmlService.createTemplateFromFile('AdminIssueDialog');
  SpreadsheetApp.getUi().showModalDialog(
    template.evaluate().setWidth(720).setHeight(720),
    '신규 코칭계약 발행'
  );
}

function selectedContractId_() {
  DC.Config.requireAdmin();
  var active = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = active.getActiveSheet();
  if (sheet.getName() !== 'CONTRACTS' || sheet.getActiveRange().getRow() < 2) {
    throw new Error('CONTRACTS 시트에서 계약 행을 선택하세요.');
  }
  var headers = DC.Storage.headers('CONTRACTS');
  var column = headers.indexOf('contractId') + 1;
  return String(sheet.getRange(sheet.getActiveRange().getRow(), column).getValue());
}

function menuResendSelectedInvitation() {
  var contractId = selectedContractId_();
  var ui = SpreadsheetApp.getUi();
  var response = ui.prompt(
    '초대 재발송',
    'CLIENT 또는 SPONSOR를 입력하세요. 기존 토큰은 폐기되고 새 토큰이 발행됩니다.',
    ui.ButtonSet.OK_CANCEL
  );
  if (response.getSelectedButton() !== ui.Button.OK) return;
  adminResendInvitation(
    contractId,
    String(response.getResponseText()).trim().toUpperCase(),
    DC.Security.randomToken()
  );
  ui.alert('초대 재발송 처리를 마쳤습니다.');
}

function menuResendSelectedPdf() {
  var contractId = selectedContractId_();
  adminResendPdf(contractId, DC.Security.randomToken());
  SpreadsheetApp.getUi().alert('PDF 재발송 처리를 마쳤습니다.');
}

function menuTerminateSelectedContract() {
  var contractId = selectedContractId_();
  var ui = SpreadsheetApp.getUi();
  var response = ui.prompt(
    '계약 종료',
    '민감한 상세내용 대신 검토된 종료 사유 코드를 입력하세요.',
    ui.ButtonSet.OK_CANCEL
  );
  if (response.getSelectedButton() !== ui.Button.OK) return;
  adminTerminateContract(
    contractId,
    String(response.getResponseText()).trim(),
    DC.Security.randomToken()
  );
  ui.alert('계약 종료 상태를 기록했습니다.');
}

function menuCheckExpiredContracts() {
  DC.Config.requireAdmin();
  DC.JobService.expireContracts();
  SpreadsheetApp.getUi().alert('만료 계약 상태를 점검했습니다.');
}

function menuCheckRetentionCandidates() {
  DC.Config.requireAdmin();
  var records = DC.JobService.retentionCandidateRecords();
  SpreadsheetApp.getUi().alert(
    records.length
      ? '파기 검토 대상:\n' + records.map(function (record) {
        return record.contractId + ' [' + record.status + '] · 관련 비공개 파일 ' +
          record.artifactFileIds.length + '개';
      }).join('\n')
      : '현재 파기 검토 대상이 없습니다.'
  );
}

function menuReconcileSelectedContract() {
  var result = DC.JobService.reconcileContract(selectedContractId_());
  SpreadsheetApp.getUi().alert('재조정 결과: ' + result.code);
}

function menuCheckSettings() {
  DC.Config.requireAdmin();
  var result = DC.Config.health();
  SpreadsheetApp.getUi().alert(
    result.ready
      ? '계약 발행 설정이 준비되었습니다.'
      : '미확정 항목:\n' + result.missing.join('\n')
  );
}

function processPendingContractJobs_() {
  DC.JobService.processPending();
}

function expireIssuedContracts_() {
  DC.JobService.expireContracts();
}

function reportRetentionCandidates_() {
  DC.JobService.reportRetentionCandidates();
}
