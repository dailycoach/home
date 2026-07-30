var DC = DC || {};

DC.ManagementService = (function () {
  var TYPES = Object.freeze({
    WITHDRAWAL: 'withdrawalStatus',
    EARLY_TERMINATION: 'terminationRequestStatus',
    CONTRACT_CHANGE: 'changeRequestStatus',
    OPTIONAL_CONSENT_WITHDRAWAL: 'consentWithdrawalStatus',
    PRIVACY_RIGHTS: 'privacyRightsRequestStatus'
  });

  function safeCode(value, name) {
    var code = DC.Validation.text(
      value,
      name,
      { required: true, max: 80 }
    );
    if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,79}$/.test(code)) {
      throw new Error(name + '은 영문, 숫자, 마침표, 밑줄, 하이픈만 사용할 수 있습니다.');
    }
    return code;
  }

  function publicInfo() {
    var settings = DC.Storage.getSettingsMap();
    return {
      ok: true,
      activeWriteApi: false,
      contact: String(settings.CONTRACT_MANAGEMENT_CONTACT || ''),
      policies: {
        withdrawal: String(settings.WITHDRAWAL_POLICY || ''),
        earlyTermination: String(settings.REFUND_POLICY_DEFAULT || ''),
        contractChange: String(settings.CONTRACT_CHANGE_POLICY || ''),
        optionalConsentWithdrawal: String(settings.CONSENT_WITHDRAWAL_POLICY || ''),
        privacyRights: String(settings.PRIVACY_RIGHTS_REQUEST_POLICY || '')
      },
      instruction: '본인확인 후 접수하기 위해 안내된 계약관리 연락처로 요청하세요.'
    };
  }

  function recordRequest(contractId, requestType, requesterRole, externalReference, requestId) {
    var admin = DC.Config.requireAdmin();
    var type = String(requestType || '');
    var field = TYPES[type];
    if (!field) throw new Error('지원하지 않는 계약관리 요청 유형입니다.');
    var role = DC.Validation.enumValue(
      requesterRole,
      '요청자 역할',
      ['CLIENT', 'SPONSOR', 'PROVIDER', 'AUTHORIZED_REPRESENTATIVE']
    );
    var reference = safeCode(
      externalReference,
      '외부 접수 참조번호'
    );
    var requestHash = DC.Security.hashIdempotency(
      admin,
      'MANAGEMENT_REQUEST|' + contractId + '|' + type,
      requestId
    );
    return DC.Storage.withScriptLock(function () {
      if (DC.Audit.findByRequestHash(requestHash, 'MANAGEMENT_REQUEST_RECEIVED')) {
        return { ok: true, duplicate: true, contractId: contractId };
      }
      var contract = DC.Storage.findRow('CONTRACTS', 'contractId', contractId);
      if (!contract) throw new Error('계약을 찾을 수 없습니다.');
      var now = DC.Storage.nowIso();
      var changes = {
        managementStatus: 'ACTION_REQUIRED',
        lastManagementRequestAt: now,
        rowVersion: Number(contract.rowVersion || 0) + 1,
        lastUpdatedAt: now
      };
      changes[field] = 'RECEIVED';
      DC.Storage.updateRow('CONTRACTS', contract.__rowNumber, changes);
      DC.Audit.append({
        contractId: contractId,
        eventType: 'MANAGEMENT_REQUEST_RECEIVED',
        actorRole: role,
        requestIdHash: requestHash,
        detailCode: type,
        safeMetadata: { externalReference: reference }
      });
      return { ok: true, duplicate: false, contractId: contractId };
    });
  }

  function resolveRequest(contractId, requestType, outcomeCode, requestId) {
    var admin = DC.Config.requireAdmin();
    var type = String(requestType || '');
    var field = TYPES[type];
    if (!field) throw new Error('지원하지 않는 계약관리 요청 유형입니다.');
    var outcome = safeCode(
      outcomeCode,
      '처리 결과 코드'
    );
    var requestHash = DC.Security.hashIdempotency(
      admin,
      'MANAGEMENT_RESOLVE|' + contractId + '|' + type,
      requestId
    );
    return DC.Storage.withScriptLock(function () {
      if (DC.Audit.findByRequestHash(requestHash, 'MANAGEMENT_REQUEST_RESOLVED')) {
        return { ok: true, duplicate: true, contractId: contractId };
      }
      var contract = DC.Storage.findRow('CONTRACTS', 'contractId', contractId);
      if (!contract) throw new Error('계약을 찾을 수 없습니다.');
      var changes = {
        managementStatus: 'REVIEW_REQUIRED',
        rowVersion: Number(contract.rowVersion || 0) + 1,
        lastUpdatedAt: DC.Storage.nowIso()
      };
      changes[field] = 'RESOLVED';
      DC.Storage.updateRow('CONTRACTS', contract.__rowNumber, changes);
      DC.Audit.append({
        contractId: contractId,
        eventType: 'MANAGEMENT_REQUEST_RESOLVED',
        actorRole: 'ADMIN',
        requestIdHash: requestHash,
        detailCode: type,
        safeMetadata: { outcomeCode: outcome }
      });
      return { ok: true, duplicate: false, contractId: contractId };
    });
  }

  return Object.freeze({
    publicInfo: publicInfo,
    recordRequest: recordRequest,
    resolveRequest: resolveRequest
  });
})();
