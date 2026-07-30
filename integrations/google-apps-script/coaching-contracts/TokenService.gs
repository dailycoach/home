var DC = DC || {};

DC.TokenService = (function () {
  function createTokenRecord() {
    var version = DC.Config.activeCryptoVersion();
    var rawToken = DC.Security.randomToken();
    return {
      rawToken: rawToken,
      tokenHashVersion: version,
      tokenHash: DC.Security.hashInvitationToken(rawToken, version)
    };
  }

  function lookupByRawToken(rawToken) {
    if (!DC.Security.isValidInvitationToken(rawToken)) return null;
    var version = DC.Config.activeCryptoVersion();
    var hash = DC.Security.hashInvitationToken(rawToken, version);
    return DC.Storage.findRow('SIGNERS', 'tokenHash', hash);
  }

  function assertUsable(signer) {
    if (!signer || String(signer.tokenStatus) !== 'ACTIVE') {
      throw new Error('INVALID_SIGNING_LINK');
    }
    if (new Date(String(signer.tokenExpiresAt)).getTime() <= Date.now()) {
      throw new Error('INVALID_SIGNING_LINK');
    }
    if (['ACCEPTED', 'REVOKED', 'EXPIRED'].indexOf(String(signer.status)) !== -1) {
      throw new Error('INVALID_SIGNING_LINK');
    }
    return signer;
  }

  function rotate(contractId, signerRole) {
    var rows = DC.Storage.findRows('SIGNERS', 'contractId', contractId);
    var signer = rows.filter(function (row) {
      return String(row.signerRole) === String(signerRole);
    })[0];
    if (!signer) throw new Error('서명자를 찾을 수 없습니다.');
    if (String(signer.status) === 'ACCEPTED') {
      throw new Error('이미 전자확인을 마친 서명자의 초대는 재발행할 수 없습니다.');
    }
    if (['STARTED', 'SIGNER_ACCEPTED'].indexOf(
      String(signer.acceptanceStage)
    ) !== -1 || signer.pendingAcceptanceJson) {
      throw new Error('진행 중인 전자확인은 서버 복구 작업으로 먼저 정리해야 합니다.');
    }
    var contract = DC.Storage.findRow('CONTRACTS', 'contractId', contractId);
    if (!DC.StateMachine.isSignable(contract)) {
      throw new Error('체결 가능한 상태의 계약만 초대를 재발행할 수 있습니다.');
    }
    var created = createTokenRecord();
    var now = DC.Storage.nowIso();
    var expiry = contract.acceptanceDeadline
      ? String(contract.acceptanceDeadline)
      : new Date(Date.now() + 7 * 86400000).toISOString();
    DC.Storage.updateRow('SIGNERS', signer.__rowNumber, {
      tokenHashVersion: created.tokenHashVersion,
      tokenHash: created.tokenHash,
      tokenIssuedAt: now,
      tokenExpiresAt: expiry,
      tokenUsedAt: '',
      tokenRevokedAt: '',
      tokenStatus: 'ACTIVE',
      inviteDeliveryStatus: 'PENDING',
      inviteNextAttemptAt: '',
      otpHash: '',
      otpExpiresAt: '',
      otpVerifyRequestHash: '',
      authSessionHash: '',
      authSessionExpiresAt: '',
      status: 'ISSUED',
      rowVersion: Number(signer.rowVersion || 0) + 1,
      lastUpdatedAt: now
    });
    DC.Audit.append({
      contractId: contractId,
      signerId: signer.signerId,
      eventType: 'TOKEN_ROTATED',
      actorRole: 'ADMIN',
      previousStatus: signer.tokenStatus,
      nextStatus: 'ACTIVE',
      detailCode: 'OLD_TOKEN_REVOKED_NEW_TOKEN_ISSUED'
    });
    return {
      rawToken: created.rawToken,
      signer: DC.Storage.findRow('SIGNERS', 'signerId', signer.signerId)
    };
  }

  return Object.freeze({
    createTokenRecord: createTokenRecord,
    lookupByRawToken: lookupByRawToken,
    assertUsable: assertUsable,
    rotate: rotate
  });
})();
