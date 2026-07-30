var DC = DC || {};

DC.OtpService = (function () {
  var OTP_TTL_MS = 10 * 60 * 1000;
  var OTP_COOLDOWN_MS = 60 * 1000;
  var OTP_WINDOW_MS = 60 * 60 * 1000;
  var OTP_MAX_REQUESTS_PER_WINDOW = 5;
  var OTP_MAX_ATTEMPTS = 5;
  var OTP_MAX_FAILURES_PER_WINDOW = 12;
  var AUTH_SESSION_TTL_MS = 20 * 60 * 1000;

  function genericLinkError() {
    return new Error('초대 링크를 확인할 수 없습니다. 새 초대가 필요하면 운영자에게 문의하세요.');
  }

  function parseTime(value) {
    var time = new Date(String(value || '')).getTime();
    return isNaN(time) ? 0 : time;
  }

  function sponsorMustWaitForGoalConsent(signer, contract) {
    return String(signer && signer.signerRole) === 'SPONSOR' &&
      Boolean(contract && contract.sponsorShareAgreedGoals) &&
      !clientProvisionAllowsGoal(String(contract.contractId));
  }

  function bootstrap(rawToken) {
    try {
      return DC.Storage.withScriptLock(function () {
        var signer = DC.TokenService.assertUsable(
          DC.TokenService.lookupByRawToken(rawToken)
        );
        var contract = DC.Storage.findRow('CONTRACTS', 'contractId', signer.contractId);
        if (!DC.StateMachine.isSignable(contract)) {
          throw new Error('INVALID_SIGNING_LINK');
        }
        return {
          ok: true,
          maskedEmail: DC.Security.maskEmail(signer.signerEmail),
          contractType: String(contract.contractType),
          signerRole: String(signer.signerRole),
          waitingForClient: sponsorMustWaitForGoalConsent(signer, contract),
          otpCooldownSeconds: 60
        };
      });
    } catch (error) {
      throw genericLinkError();
    }
  }

  function requestOtp(rawToken, requestId) {
    var prepared;
    try {
      prepared = DC.Storage.withScriptLock(function () {
        var signer = DC.TokenService.assertUsable(
          DC.TokenService.lookupByRawToken(rawToken)
        );
        var contract = DC.Storage.findRow(
          'CONTRACTS', 'contractId', signer.contractId
        );
        DC.StateMachine.assertSignable(contract);
        if (sponsorMustWaitForGoalConsent(signer, contract)) {
          throw new Error('SPONSOR_WAITING_FOR_CLIENT');
        }
        var requestHash = DC.Security.hashIdempotency(
          signer.signerId, 'REQUEST_OTP', requestId
        );
        if (DC.Audit.findByRequestHash(requestHash, 'OTP_REQUESTED') &&
            Boolean(signer.otpHash) &&
            ['PENDING', 'SENT'].indexOf(String(signer.otpDeliveryStatus)) !== -1) {
          return {
            duplicate: true,
            signerId: signer.signerId,
            maskedEmail: DC.Security.maskEmail(signer.signerEmail),
            deliveryReady: String(signer.otpDeliveryStatus) === 'SENT'
          };
        }
        var now = Date.now();
        if (parseTime(signer.otpLockedUntil) > now) {
          throw new Error('OTP_LOCKED');
        }
        if (parseTime(signer.otpLastSentAt) + OTP_COOLDOWN_MS > now) {
          throw new Error('OTP_COOLDOWN');
        }
        var windowStart = parseTime(signer.otpRequestWindowStartedAt);
        var requestCount = Number(signer.otpRequestCount || 0);
        if (!windowStart || windowStart + OTP_WINDOW_MS <= now) {
          windowStart = now;
          requestCount = 0;
        }
        if (requestCount >= OTP_MAX_REQUESTS_PER_WINDOW) {
          DC.Storage.updateRow('SIGNERS', signer.__rowNumber, {
            otpLockedUntil: new Date(now + OTP_WINDOW_MS).toISOString(),
            rowVersion: Number(signer.rowVersion || 0) + 1,
            lastUpdatedAt: new Date(now).toISOString()
          });
          throw new Error('OTP_RATE_LIMIT');
        }
        var otp = DC.Security.otpCode();
        var challengeId = DC.Security.randomId('otp-');
        var version = DC.Config.activeCryptoVersion();
        var nowIso = new Date(now).toISOString();
        DC.Storage.updateRow('SIGNERS', signer.__rowNumber, {
          status: 'OTP_PENDING',
          otpChallengeId: challengeId,
          otpHashVersion: version,
          otpHash: DC.Security.hashOtp(signer.signerId, challengeId, otp, version),
          otpExpiresAt: new Date(now + OTP_TTL_MS).toISOString(),
          otpAttemptCount: 0,
          otpLastSentAt: nowIso,
          otpDeliveryStatus: 'PENDING',
          otpRequestWindowStartedAt: new Date(windowStart).toISOString(),
          otpRequestCount: requestCount + 1,
          authSessionHashVersion: '',
          authSessionHash: '',
          authSessionExpiresAt: '',
          authSessionUsedAt: '',
          otpVerifyRequestHash: '',
          rowVersion: Number(signer.rowVersion || 0) + 1,
          lastUpdatedAt: nowIso
        });
        DC.Audit.append({
          contractId: signer.contractId,
          signerId: signer.signerId,
          eventType: 'OTP_REQUESTED',
          actorRole: signer.signerRole,
          requestIdHash: requestHash
        });
        try {
          CacheService.getScriptCache().put(
            'otpburst:' + signer.signerId,
            String(now),
            60
          );
        } catch (ignored) {
          // Cache는 권위 저장소가 아니므로 실패해도 계속한다.
        }
        return {
          duplicate: false,
          signerId: signer.signerId,
          contractId: signer.contractId,
          signerRole: signer.signerRole,
          signerName: signer.signerName,
          signerEmail: signer.signerEmail,
          maskedEmail: DC.Security.maskEmail(signer.signerEmail),
          otp: otp
        };
      });
    } catch (error) {
      if (String(error.message) === 'SPONSOR_WAITING_FOR_CLIENT') {
        throw new Error('고객의 목표 정보공유 확인이 완료된 뒤 인증번호를 요청할 수 있습니다.');
      }
      if (['OTP_LOCKED', 'OTP_RATE_LIMIT', 'OTP_COOLDOWN'].indexOf(error.message) !== -1) {
        throw new Error('인증번호 요청 한도를 확인하세요. 잠시 후 다시 시도하세요.');
      }
      throw genericLinkError();
    }

    if (prepared.duplicate) {
      if (!prepared.deliveryReady) {
        throw new Error(
          '인증번호 전송 상태를 확인할 수 없습니다. ' +
          '60초 후 새 요청으로 다시 시도하세요.'
        );
      }
      return {
        ok: true,
        duplicate: true,
        maskedEmail: prepared.maskedEmail,
        expiresInSeconds: 600
      };
    }

    var sent = false;
    try {
      DC.MailService.sendOtp(prepared);
      sent = true;
    } catch (error) {
      sent = false;
    }
    DC.Storage.withScriptLock(function () {
      var signer = DC.Storage.findRow('SIGNERS', 'signerId', prepared.signerId);
      if (!signer) return;
      var nowIso = DC.Storage.nowIso();
      var changes = {
        otpDeliveryStatus: sent ? 'SENT' : 'FAILED',
        rowVersion: Number(signer.rowVersion || 0) + 1,
        lastUpdatedAt: nowIso
      };
      if (!sent) {
        changes.otpHash = '';
        changes.otpExpiresAt = '';
        changes.otpLastSentAt = '';
        changes.status = 'ISSUED';
      }
      DC.Storage.updateRow('SIGNERS', signer.__rowNumber, changes);
      DC.Audit.append({
        contractId: signer.contractId,
        signerId: signer.signerId,
        eventType: sent ? 'OTP_SENT' : 'OTP_SEND_FAILED',
        actorRole: 'SYSTEM',
        result: sent ? 'SUCCESS' : 'FAILURE',
        detailCode: sent ? 'MAIL_ACCEPTED' : 'MAIL_SEND_FAILED'
      });
    });
    if (!sent) throw new Error('인증번호를 전송하지 못했습니다. 잠시 후 다시 시도하세요.');
    return {
      ok: true,
      duplicate: false,
      maskedEmail: prepared.maskedEmail,
      expiresInSeconds: 600
    };
  }

  function verifyOtp(rawToken, otp, requestId) {
    if (!/^\d{6}$/.test(String(otp || ''))) {
      throw new Error('6자리 인증번호를 입력하세요.');
    }
    var result;
    try {
      result = DC.Storage.withScriptLock(function () {
        var signer = DC.TokenService.lookupByRawToken(rawToken);
        if (!signer) throw new Error('INVALID_SIGNING_LINK');
        var contract = DC.Storage.findRow(
          'CONTRACTS', 'contractId', signer.contractId
        );
        DC.StateMachine.assertSignable(contract);
        var requestHash = DC.Security.hashIdempotency(
          signer.signerId, 'VERIFY_OTP', requestId
        );
        var repeatedVerification =
          String(signer.tokenStatus) === 'CONSUMED' &&
          String(signer.status) === 'OTP_VERIFIED' &&
          String(signer.otpVerifyRequestHash) === requestHash;
        var priorFailure = DC.Audit.findByRequestHash(
          requestHash, 'OTP_VERIFY_FAILED'
        );
        if (!repeatedVerification && priorFailure) {
          return {
            ok: false,
            code: String(priorFailure.detailCode) === 'ATTEMPT_LIMIT'
              ? 'LOCKED'
              : 'MISMATCH'
          };
        }
        if (!repeatedVerification) {
          DC.TokenService.assertUsable(signer);
        }
        var now = Date.now();
        if (repeatedVerification) {
          if (!signer.authSessionHash ||
              parseTime(signer.authSessionExpiresAt) <= now) {
            return { ok: false, code: 'EXPIRED' };
          }
          var repeatedExpected = DC.Security.hashOtp(
            signer.signerId,
            signer.otpChallengeId,
            String(otp),
            signer.otpHashVersion
          );
          if (!DC.Security.constantTimeEqual(
            repeatedExpected,
            String(signer.otpHash)
          )) {
            return { ok: false, code: 'MISMATCH' };
          }
          var repeatedSessionToken = DC.Security.deriveAuthSession(
            signer.signerId,
            signer.otpChallengeId,
            String(otp),
            signer.otpHashVersion
          );
          var repeatedSessionHash = DC.Security.hashAuthSession(
            repeatedSessionToken,
            signer.authSessionHashVersion
          );
          if (!DC.Security.constantTimeEqual(
            repeatedSessionHash,
            String(signer.authSessionHash)
          )) {
            throw new Error('AUTH_SESSION_INTEGRITY_FAILED');
          }
          if (!DC.Audit.findByRequestHash(requestHash, 'OTP_VERIFIED')) {
            DC.Audit.append({
              contractId: signer.contractId,
              signerId: signer.signerId,
              eventType: 'OTP_VERIFIED',
              actorRole: signer.signerRole,
              requestIdHash: requestHash,
              detailCode: 'JOURNAL_RECOVERED'
            });
          }
          return {
            ok: true,
            authSessionToken: repeatedSessionToken,
            expiresAt: String(signer.authSessionExpiresAt)
          };
        }
        if (parseTime(signer.otpLockedUntil) > now) {
          return { ok: false, code: 'LOCKED' };
        }
        if (!signer.otpHash || parseTime(signer.otpExpiresAt) <= now) {
          return { ok: false, code: 'EXPIRED' };
        }
        var expected = DC.Security.hashOtp(
          signer.signerId,
          signer.otpChallengeId,
          String(otp),
          signer.otpHashVersion
        );
        if (!DC.Security.constantTimeEqual(expected, String(signer.otpHash))) {
          var attempts = Number(signer.otpAttemptCount || 0) + 1;
          var failureWindow = parseTime(signer.otpFailureWindowStartedAt);
          var failures = Number(signer.otpFailureCount || 0);
          if (!failureWindow || failureWindow + OTP_WINDOW_MS <= now) {
            failureWindow = now;
            failures = 0;
          }
          failures += 1;
          var locked = attempts >= OTP_MAX_ATTEMPTS ||
            failures >= OTP_MAX_FAILURES_PER_WINDOW;
          DC.Storage.updateRow('SIGNERS', signer.__rowNumber, {
            otpAttemptCount: attempts,
            otpFailureWindowStartedAt: new Date(failureWindow).toISOString(),
            otpFailureCount: failures,
            otpLockedUntil: locked
              ? new Date(now + OTP_WINDOW_MS).toISOString()
              : '',
            rowVersion: Number(signer.rowVersion || 0) + 1,
            lastUpdatedAt: new Date(now).toISOString()
          });
          DC.Audit.append({
            contractId: signer.contractId,
            signerId: signer.signerId,
            eventType: 'OTP_VERIFY_FAILED',
            actorRole: signer.signerRole,
            result: 'FAILURE',
            requestIdHash: requestHash,
            detailCode: locked ? 'ATTEMPT_LIMIT' : 'MISMATCH',
            attemptNumber: attempts
          });
          return { ok: false, code: locked ? 'LOCKED' : 'MISMATCH' };
        }

        var sessionToken = DC.Security.deriveAuthSession(
          signer.signerId,
          signer.otpChallengeId,
          String(otp),
          signer.otpHashVersion
        );
        var sessionExpiry = signer.authSessionExpiresAt &&
          parseTime(signer.authSessionExpiresAt) > now
          ? String(signer.authSessionExpiresAt)
          : new Date(now + AUTH_SESSION_TTL_MS).toISOString();
        var sessionHash = DC.Security.hashAuthSession(
          sessionToken,
          signer.otpHashVersion
        );
        DC.Storage.updateRow('SIGNERS', signer.__rowNumber, {
          status: 'OTP_VERIFIED',
          tokenStatus: 'CONSUMED',
          tokenUsedAt: signer.tokenUsedAt || new Date(now).toISOString(),
          otpVerifiedAt: signer.otpVerifiedAt || new Date(now).toISOString(),
          otpVerifyRequestHash: requestHash,
          authSessionHashVersion: signer.otpHashVersion,
          authSessionHash: sessionHash,
          authSessionExpiresAt: sessionExpiry,
          authSessionUsedAt: '',
          rowVersion: Number(signer.rowVersion || 0) + 1,
          lastUpdatedAt: new Date(now).toISOString()
        });
        if (!DC.Audit.findByRequestHash(requestHash, 'OTP_VERIFIED')) {
          DC.Audit.append({
            contractId: signer.contractId,
            signerId: signer.signerId,
            eventType: 'OTP_VERIFIED',
            actorRole: signer.signerRole,
            requestIdHash: requestHash
          });
        }
        return {
          ok: true,
          authSessionToken: sessionToken,
          expiresAt: sessionExpiry
        };
      });
    } catch (error) {
      throw genericLinkError();
    }
    if (!result.ok) {
      if (result.code === 'EXPIRED') throw new Error('인증번호가 만료되었습니다. 새 번호를 요청하세요.');
      if (result.code === 'LOCKED') throw new Error('인증 시도 한도를 초과했습니다. 잠시 후 다시 시도하세요.');
      throw new Error('인증번호가 일치하지 않습니다.');
    }
    return result;
  }

  function findSignerBySession(sessionToken) {
    var version = DC.Config.activeCryptoVersion();
    var hash = DC.Security.hashAuthSession(sessionToken, version);
    return DC.Storage.findRow('SIGNERS', 'authSessionHash', hash);
  }

  function assertSession(signer) {
    if (!signer || !signer.authSessionHash ||
        parseTime(signer.authSessionExpiresAt) <= Date.now() ||
        signer.authSessionUsedAt ||
        ['ACCEPTED', 'REVOKED', 'EXPIRED'].indexOf(String(signer.status)) !== -1) {
      throw new Error('AUTH_SESSION_INVALID');
    }
    return signer;
  }

  function clientProvisionAllowsGoal(contractId) {
    var client = DC.Storage.findRows('SIGNERS', 'contractId', contractId)
      .filter(function (signer) {
        return String(signer.signerRole) === 'CLIENT' &&
          String(signer.status) === 'ACCEPTED';
      })[0];
    if (!client) return false;
    try {
      var consent = verifiedConsentRecord(client);
      return String(consent.sponsorProvisionStatus) === 'ACCEPTED' &&
        String(consent.sponsorProvidedItems).split(/\s*,\s*/)
          .indexOf('합의된 전체 목표') !== -1;
    } catch (error) {
      return false;
    }
  }

  function snapshotForSigner(snapshot, signerRole, contractId) {
    var visible = JSON.parse(JSON.stringify(snapshot));
    if (String(signerRole) !== 'SPONSOR') return visible;
    if (visible.parties && visible.parties.client) {
      delete visible.parties.client.phone;
    }
    var sharing = visible.informationSharing && visible.informationSharing.sponsor;
    var goalConsentRecorded = sharing && sharing.agreedGoals === true &&
      clientProvisionAllowsGoal(contractId);
    if (!goalConsentRecorded) {
      visible.coaching.goalSummary = '';
      visible.coaching.goalSummaryVisibility = 'SPONSOR_NOT_SHARED';
    } else {
      visible.coaching.goalSummaryVisibility = 'SPONSOR_SHARED_AFTER_CLIENT_CONSENT';
    }
    Object.keys(visible.consentOfferSet || {}).forEach(function (key) {
      visible.consentOfferSet[key] = false;
    });
    visible.consentNotices = {};
    visible.sessionProcessingStatement =
      '고객 세션의 녹음·전사·AI·사례·후기 선택동의는 고객만 결정할 수 있어 스폰서에게 제시하지 않습니다.';
    if (visible.privacyNotice && visible.privacyNotice.items) {
      visible.privacyNotice.items = String(visible.privacyNotice.items)
        .replace(/,\s*휴대전화번호/g, '');
      visible.privacyNotice.requiredItems = String(
        visible.privacyNotice.requiredItems || ''
      ).replace(/,\s*휴대전화번호/g, '');
    }
    return visible;
  }

  function loadContract(sessionToken) {
    try {
      var context = DC.Storage.withScriptLock(function () {
        var signer = assertSession(findSignerBySession(sessionToken));
        var contract = DC.Storage.findRow('CONTRACTS', 'contractId', signer.contractId);
        if (!DC.StateMachine.isSignable(contract) ||
            parseTime(contract.acceptanceDeadline) <= Date.now()) {
          throw new Error('AUTH_SESSION_INVALID');
        }
        if (sponsorMustWaitForGoalConsent(signer, contract)) {
          throw new Error('SPONSOR_WAITING_FOR_CLIENT');
        }
        var stored;
        if (signer.presentedSnapshotFileId) {
          stored = DC.Storage.readJsonFile(String(signer.presentedSnapshotFileId));
          if (String(stored.sourceDocumentHash) !== String(contract.documentHash) ||
              DC.Security.documentHash(stored.contract) !== String(stored.presentationHash) ||
              String(stored.presentationHash) !== String(signer.presentedDocumentHash)) {
            throw new Error('PRESENTATION_INTEGRITY_FAILED');
          }
        } else {
          var source = DC.ContractService.loadSnapshot(contract);
          var visible = snapshotForSigner(
            source,
            signer.signerRole,
            contract.contractId
          );
          var presentationHash = DC.Security.documentHash(visible);
          var fileId = DC.Storage.savePrivateJsonOnce(
            DC.Config.KEYS.SNAPSHOT_FOLDER_ID,
            contract.contractId + '-' + signer.signerId + '-presented.json',
            {
              sourceDocumentHash: contract.documentHash,
              presentationHash: presentationHash,
              signerRole: signer.signerRole,
              contract: visible
            }
          );
          DC.Storage.updateRow('SIGNERS', signer.__rowNumber, {
            presentedSnapshotFileId: fileId,
            presentedDocumentHashAlgorithm: 'SHA-256',
            presentedDocumentHash: presentationHash,
            presentedSourceDocumentHash: contract.documentHash,
            rowVersion: Number(signer.rowVersion || 0) + 1,
            lastUpdatedAt: DC.Storage.nowIso()
          });
          stored = {
            sourceDocumentHash: contract.documentHash,
            presentationHash: presentationHash,
            contract: visible
          };
        }
        return {
          signerRole: signer.signerRole,
          signerName: signer.signerName,
          sourceDocumentHash: stored.sourceDocumentHash,
          presentationHash: stored.presentationHash,
          contract: stored.contract
        };
      });
      return {
        ok: true,
        signerRole: context.signerRole,
        signerName: context.signerName,
        documentHash: context.presentationHash,
        sourceDocumentHash: context.sourceDocumentHash,
        contract: context.contract
      };
    } catch (error) {
      throw new Error('인증 세션이 만료되었거나 유효하지 않습니다.');
    }
  }

  function identityName(value) {
    return DC.Security.normalizeString(value).trim().replace(/\s+/g, ' ');
  }

  function retentionDue(settings, completedAt) {
    var date = new Date(completedAt);
    date.setUTCMonth(date.getUTCMonth() + Number(settings.RETENTION_MONTHS));
    return date.toISOString();
  }

  function hasContractEvent(contractId, eventType) {
    return DC.Storage.findRows('AUDIT_LOG', 'contractId', contractId)
      .some(function (event) { return String(event.eventType) === eventType; });
  }

  function buildAcceptanceEvidence(signer, contract, snapshot, pending) {
    if (!pending || !pending.payload || !parseTime(pending.acceptedAt) ||
        String(pending.sourceDocumentHash) !== String(contract.documentHash) ||
        String(pending.presentationHash) !== String(signer.presentedDocumentHash) ||
        DC.Security.documentHash(pending.payload) !==
          String(signer.acceptancePayloadHash)) {
      throw new Error('PENDING_ACCEPTANCE_INTEGRITY_FAILED');
    }
    var provisionNotice = snapshot.informationSharing.provisionNotice;
    var sponsorProvisionRequired = snapshot.contractMode === 'organization' &&
      String(signer.signerRole) === 'CLIENT' &&
      provisionNotice.providedItems.length > 0;
    return {
      sourceDocumentHash: contract.documentHash,
      documentHash: signer.presentedDocumentHash,
      signerId: signer.signerId,
      signerRole: signer.signerRole,
      signerName: signer.signerName,
      acceptedAt: String(pending.acceptedAt),
      acceptanceVersion: DC.Schema.VERSION,
      privacyNoticeVersion: contract.privacyNoticeVersion,
      consentVersion: contract.consentVersion,
      confirmations: pending.payload.confirmations,
      consents: pending.payload.consents,
      sponsorProvision: sponsorProvisionRequired
        ? {
          status: 'ACCEPTED',
          recipient: provisionNotice.recipient,
          purpose: provisionNotice.purpose,
          providedItems: provisionNotice.providedItems,
          retention: provisionNotice.retention,
          refusalNoticeVersion: provisionNotice.version,
          alwaysExcluded: provisionNotice.alwaysExcluded
        }
        : { status: 'NOT_APPLICABLE' }
    };
  }

  function consentRecordFromEvidence(evidence, requestHash) {
    var provision = evidence.sponsorProvision || { status: 'NOT_APPLICABLE' };
    return {
      contractId: evidence.contractId || '',
      signerId: evidence.signerId,
      signerRole: evidence.signerRole,
      recordingStatus: evidence.consents.recordingStatus,
      transcriptionStatus: evidence.consents.transcriptionStatus,
      aiSummaryStatus: evidence.consents.aiSummaryStatus,
      researchUseStatus: evidence.consents.researchUseStatus,
      anonymousCaseUseStatus: evidence.consents.anonymousCaseUseStatus,
      testimonialPublicityStatus: evidence.consents.testimonialPublicityStatus,
      marketingEmailStatus: evidence.consents.marketingEmailStatus,
      marketingSmsStatus: evidence.consents.marketingSmsStatus,
      thirdPartyTransferStatus: evidence.consents.thirdPartyTransferStatus,
      sponsorProvisionStatus: provision.status,
      sponsorProvisionRecipient: provision.status === 'ACCEPTED'
        ? provision.recipient
        : '',
      sponsorProvisionPurpose: provision.status === 'ACCEPTED'
        ? provision.purpose
        : '',
      sponsorProvidedItems: provision.status === 'ACCEPTED'
        ? provision.providedItems.join(', ')
        : '',
      sponsorProvisionRetention: provision.status === 'ACCEPTED'
        ? provision.retention
        : '',
      sponsorRefusalNoticeVersion: provision.status === 'ACCEPTED'
        ? provision.refusalNoticeVersion
        : '',
      sponsorProvisionConfirmedAt: provision.status === 'ACCEPTED'
        ? evidence.acceptedAt
        : '',
      privacyNoticeVersion: evidence.privacyNoticeVersion,
      privacyNoticeAcknowledgedAt: evidence.acceptedAt,
      consentVersion: evidence.consentVersion,
      acceptedDocumentHash: evidence.documentHash,
      acceptanceEvidenceHash: DC.Security.documentHash(evidence),
      acceptanceRequestHash: requestHash,
      createdAt: evidence.acceptedAt
    };
  }

  function comparableConsent(record) {
    var fields = DC.Schema.SHEETS.CONSENTS.filter(function (field) {
      return ['consentId', 'createdAt'].indexOf(field) === -1;
    });
    var result = {};
    fields.forEach(function (field) {
      result[field] = String(record[field] == null ? '' : record[field]);
    });
    return result;
  }

  function loadAcceptanceEvidence(signer) {
    if (!signer || !signer.acceptanceEvidenceFileId ||
        !signer.acceptanceEvidenceHash) {
      throw new Error('ACCEPTANCE_EVIDENCE_MISSING');
    }
    var wrapper = DC.Storage.readJsonFile(String(signer.acceptanceEvidenceFileId));
    if (!wrapper || !wrapper.evidence || !wrapper.evidenceHash) {
      throw new Error('ACCEPTANCE_EVIDENCE_INVALID');
    }
    var computed = DC.Security.documentHash(wrapper.evidence);
    if (!DC.Security.constantTimeEqual(computed, String(wrapper.evidenceHash)) ||
        !DC.Security.constantTimeEqual(computed, String(signer.acceptanceEvidenceHash)) ||
        String(wrapper.evidence.signerId) !== String(signer.signerId) ||
        String(wrapper.evidence.sourceDocumentHash) !==
          String(signer.acceptedSourceDocumentHash) ||
        String(wrapper.evidence.documentHash) !==
          String(signer.acceptedDocumentHash)) {
      throw new Error('ACCEPTANCE_EVIDENCE_INTEGRITY_FAILED');
    }
    return wrapper.evidence;
  }

  function verifiedConsentRecord(signer) {
    var evidence = loadAcceptanceEvidence(signer);
    var expected = consentRecordFromEvidence(
      evidence,
      String(signer.acceptanceRequestHash)
    );
    expected.contractId = signer.contractId;
    var rows = DC.Storage.findRows('CONSENTS', 'signerId', signer.signerId);
    if (rows.length !== 1 ||
        DC.Security.canonicalJson(comparableConsent(rows[0])) !==
          DC.Security.canonicalJson(comparableConsent(expected))) {
      throw new Error('CONSENT_EVIDENCE_MISMATCH');
    }
    return expected;
  }

  function completePendingAcceptanceLocked(signer, contract, snapshot) {
    if (['TERMINATED', 'EXPIRED', 'DRAFT'].indexOf(String(contract.status)) !== -1) {
      if (String(signer.acceptanceStage) !== 'ABORTED') {
        DC.Storage.updateRow('SIGNERS', signer.__rowNumber, {
          acceptanceStage: 'ABORTED',
          pendingAcceptanceJson: '',
          authSessionUsedAt: DC.Storage.nowIso(),
          rowVersion: Number(signer.rowVersion || 0) + 1,
          lastUpdatedAt: DC.Storage.nowIso()
        });
        DC.Audit.append({
          contractId: contract.contractId,
          signerId: signer.signerId,
          eventType: 'PENDING_ACCEPTANCE_ABORTED',
          actorRole: 'SYSTEM',
          result: 'FAILURE',
          detailCode: 'CONTRACT_NOT_SIGNABLE'
        });
      }
      return { aborted: true, contractId: contract.contractId, status: contract.status };
    }
    if (!DC.StateMachine.isSignable(contract) &&
        !(String(contract.status) === 'COMPLETED' &&
          String(signer.status) === 'ACCEPTED')) {
      throw new Error('CONTRACT_NOT_SIGNABLE');
    }
    var pending = JSON.parse(String(signer.pendingAcceptanceJson || ''));
    var evidence = buildAcceptanceEvidence(signer, contract, snapshot, pending);
    evidence.contractId = contract.contractId;
    var evidenceHash = DC.Security.documentHash(evidence);
    var evidenceFileId = signer.acceptanceEvidenceFileId ||
      DC.Storage.savePrivateJsonOnce(
        DC.Config.KEYS.SNAPSHOT_FOLDER_ID,
        contract.contractId + '-' + signer.signerId + '-acceptance-evidence.json',
        {
          schemaVersion: DC.Schema.VERSION,
          evidenceHash: evidenceHash,
          evidence: evidence
        }
      );
    var expectedConsent = consentRecordFromEvidence(
      evidence,
      String(signer.acceptanceRequestHash)
    );
    expectedConsent.consentId = DC.Security.randomId('consent-');
    var existingConsents = DC.Storage.findRows(
      'CONSENTS', 'signerId', signer.signerId
    );
    if (!existingConsents.length) {
      DC.Storage.appendObject('CONSENTS', expectedConsent);
    } else if (existingConsents.length !== 1 ||
        DC.Security.canonicalJson(comparableConsent(existingConsents[0])) !==
          DC.Security.canonicalJson(comparableConsent(expectedConsent))) {
      throw new Error('CONSENT_EVIDENCE_MISMATCH');
    }
    signer = DC.Storage.findRow('SIGNERS', 'signerId', signer.signerId);
    if (String(signer.status) !== 'ACCEPTED' ||
        String(signer.acceptanceStage) !== 'SIGNER_ACCEPTED') {
      DC.Storage.updateRow('SIGNERS', signer.__rowNumber, {
        status: 'ACCEPTED',
        tokenStatus: 'CONSUMED',
        tokenUsedAt: signer.tokenUsedAt || evidence.acceptedAt,
        authSessionUsedAt: signer.authSessionUsedAt || evidence.acceptedAt,
        acceptedAt: evidence.acceptedAt,
        acceptanceVersion: DC.Schema.VERSION,
        acceptedDocumentHash: evidence.documentHash,
        acceptedSourceDocumentHash: evidence.sourceDocumentHash,
        acceptanceEvidenceHash: evidenceHash,
        acceptanceEvidenceFileId: evidenceFileId,
        acceptanceStage: 'SIGNER_ACCEPTED',
        rowVersion: Number(signer.rowVersion || 0) + 1,
        lastUpdatedAt: evidence.acceptedAt
      });
    }
    signer = DC.Storage.findRow('SIGNERS', 'signerId', signer.signerId);
    var signers = DC.Storage.findRows('SIGNERS', 'contractId', contract.contractId);
    var nextStatus = DC.StateMachine.derive(contract, signers);
    DC.StateMachine.assertTransition(String(contract.status), nextStatus);
    var now = evidence.acceptedAt;
    var contractChanges = {
      status: nextStatus,
      rowVersion: Number(contract.rowVersion || 0) + 1,
      lastUpdatedAt: now
    };
    if (nextStatus === 'COMPLETED') {
      var acceptedEvidence = signers
        .filter(function (entry) { return String(entry.status) === 'ACCEPTED'; })
        .map(function (entry) {
          if (!entry.acceptanceEvidenceFileId || !entry.acceptanceEvidenceHash) {
            throw new Error('ACCEPTANCE_EVIDENCE_MISSING');
          }
          return {
            signerId: String(entry.signerId),
            signerRole: String(entry.signerRole),
            acceptedAt: String(entry.acceptedAt),
            evidenceHash: String(entry.acceptanceEvidenceHash)
          };
        })
        .sort(function (a, b) { return a.signerRole.localeCompare(b.signerRole); });
      contractChanges.completedAt = contract.completedAt || now;
      contractChanges.serviceStatus = 'ACTIVE';
      contractChanges.acceptanceEvidenceHash = DC.Security.documentHash({
        documentHash: contract.documentHash,
        signers: acceptedEvidence
      });
      if (String(contract.finalizationStatus) !== 'READY') {
        contractChanges.finalizationStatus = 'PENDING';
        contractChanges.nextFinalizationAttemptAt = now;
      }
      contractChanges.retentionDueAt =
        retentionDue(DC.Storage.getSettingsMap(), now);
    }
    if (String(contract.status) !== nextStatus ||
        (nextStatus === 'COMPLETED' && !contract.acceptanceEvidenceHash)) {
      DC.Storage.updateRow('CONTRACTS', contract.__rowNumber, contractChanges);
    }
    if (!DC.Audit.findByRequestHash(
      signer.acceptanceRequestHash, 'SIGNER_ACCEPTED'
    )) {
      DC.Audit.append({
        contractId: contract.contractId,
        signerId: signer.signerId,
        eventType: 'SIGNER_ACCEPTED',
        actorRole: signer.signerRole,
        previousStatus: contract.status,
        nextStatus: nextStatus,
        requestIdHash: signer.acceptanceRequestHash,
        safeMetadata: {
          sourceDocumentHash: contract.documentHash,
          presentedDocumentHash: signer.presentedDocumentHash,
          acceptanceEvidenceHash: evidenceHash
        }
      });
    }
    if (nextStatus === 'COMPLETED' &&
        !hasContractEvent(contract.contractId, 'CONTRACT_COMPLETED')) {
      DC.Audit.append({
        contractId: contract.contractId,
        eventType: 'CONTRACT_COMPLETED',
        actorRole: 'SYSTEM',
        previousStatus: contract.status,
        nextStatus: 'COMPLETED'
      });
    }
    signer = DC.Storage.findRow('SIGNERS', 'signerId', signer.signerId);
    if (String(signer.acceptanceStage) !== 'COMPLETE' ||
        signer.pendingAcceptanceJson) {
      DC.Storage.updateRow('SIGNERS', signer.__rowNumber, {
        acceptanceStage: 'COMPLETE',
        pendingAcceptanceJson: '',
        rowVersion: Number(signer.rowVersion || 0) + 1,
        lastUpdatedAt: DC.Storage.nowIso()
      });
    }
    return {
      aborted: false,
      contractId: contract.contractId,
      status: nextStatus,
      completed: nextStatus === 'COMPLETED'
    };
  }

  function reconcilePendingAcceptances(contractId) {
    return DC.Storage.withScriptLock(function () {
      var contract = DC.Storage.findRow('CONTRACTS', 'contractId', contractId);
      if (!contract) return { repaired: 0, contractId: contractId };
      var pendingSigners = DC.Storage.findRows('SIGNERS', 'contractId', contractId)
        .filter(function (signer) {
          return ['STARTED', 'SIGNER_ACCEPTED'].indexOf(
            String(signer.acceptanceStage)
          ) !== -1 && Boolean(signer.pendingAcceptanceJson);
        });
      if (!pendingSigners.length) {
        return { repaired: 0, contractId: contractId };
      }
      var snapshot = DC.ContractService.loadSnapshot(contract);
      var repaired = 0;
      pendingSigners.forEach(function (signer) {
          completePendingAcceptanceLocked(signer, contract, snapshot);
          contract = DC.Storage.findRow('CONTRACTS', 'contractId', contractId);
          repaired += 1;
        });
      return { repaired: repaired, contractId: contractId };
    });
  }

  function accept(sessionToken, payload, requestId) {
    var preliminary = DC.Storage.withScriptLock(function () {
      var signer = findSignerBySession(sessionToken);
      if (!signer) throw new Error('AUTH_SESSION_INVALID');
      var contract = DC.Storage.findRow('CONTRACTS', 'contractId', signer.contractId);
      if (!contract) throw new Error('AUTH_SESSION_INVALID');
      var pending = ['STARTED', 'SIGNER_ACCEPTED'].indexOf(
        String(signer.acceptanceStage)
      ) !== -1 && Boolean(signer.pendingAcceptanceJson);
      if (!pending) {
        if (String(signer.status) === 'ACCEPTED' &&
            String(signer.acceptanceStage) === 'COMPLETE') {
          return {
            duplicate: true,
            contractId: contract.contractId,
            status: contract.status,
            finalizationStatus: contract.finalizationStatus
          };
        }
        assertSession(signer);
        DC.StateMachine.assertSignable(contract);
        if (parseTime(contract.acceptanceDeadline) <= Date.now()) {
          throw new Error('AUTH_SESSION_INVALID');
        }
      }
      if (!signer.presentedSnapshotFileId ||
          !signer.presentedDocumentHash ||
          String(signer.presentedSourceDocumentHash) !== String(contract.documentHash)) {
        throw new Error('PRESENTATION_REQUIRED');
      }
      return {
        duplicate: false,
        pending: pending,
        signerId: signer.signerId,
        signerRole: signer.signerRole,
        contractId: contract.contractId,
        sourceDocumentHash: contract.documentHash,
        presentationHash: signer.presentedDocumentHash,
        presentedSnapshotFileId: signer.presentedSnapshotFileId,
        requestHash: pending
          ? String(signer.acceptanceRequestHash)
          : DC.Security.hashIdempotency(
            signer.signerId, 'ACCEPT_CONTRACT', requestId
          )
      };
    });
    if (preliminary.duplicate) {
      return {
        ok: true,
        duplicate: true,
        contractId: preliminary.contractId,
        status: preliminary.status,
        finalizationStatus: preliminary.finalizationStatus
      };
    }

    var contractBefore = DC.Storage.findRow(
      'CONTRACTS', 'contractId', preliminary.contractId
    );
    var snapshot = DC.ContractService.loadSnapshot(contractBefore);
    var presented = DC.Storage.readJsonFile(preliminary.presentedSnapshotFileId);
    if (String(presented.sourceDocumentHash) !== String(preliminary.sourceDocumentHash) ||
        String(presented.presentationHash) !== String(preliminary.presentationHash) ||
        DC.Security.documentHash(presented.contract) !== String(preliminary.presentationHash)) {
      throw new Error('PRESENTATION_INTEGRITY_FAILED');
    }
    var acceptedPayload = DC.Validation.acceptancePayload(
      payload,
      presented.contract.consentOfferSet,
      snapshot,
      preliminary.signerRole
    );
    var acceptedPayloadHash = DC.Security.documentHash(acceptedPayload);
    var outcome = DC.Storage.withScriptLock(function () {
      var signer = DC.Storage.findRow('SIGNERS', 'signerId', preliminary.signerId);
      var contract = DC.Storage.findRow('CONTRACTS', 'contractId', preliminary.contractId);
      if (!signer || !contract ||
          String(contract.documentHash) !== String(preliminary.sourceDocumentHash) ||
          String(signer.presentedDocumentHash) !== String(preliminary.presentationHash)) {
        throw new Error('DOCUMENT_CHANGED');
      }
      var pending = ['STARTED', 'SIGNER_ACCEPTED'].indexOf(
        String(signer.acceptanceStage)
      ) !== -1 && Boolean(signer.pendingAcceptanceJson);
      if (!pending) {
        assertSession(signer);
        DC.StateMachine.assertSignable(contract);
        if (parseTime(contract.acceptanceDeadline) <= Date.now()) {
          throw new Error('AUTH_SESSION_INVALID');
        }
        if (identityName(acceptedPayload.signerName) !==
            identityName(signer.signerName)) {
          throw new Error('SIGNER_NAME_MISMATCH');
        }
        var acceptedAt = DC.Storage.nowIso();
        var pendingValue = {
          acceptedAt: acceptedAt,
          sourceDocumentHash: contract.documentHash,
          presentationHash: signer.presentedDocumentHash,
          payload: acceptedPayload
        };
        DC.Storage.updateRow('SIGNERS', signer.__rowNumber, {
          acceptanceRequestHash: preliminary.requestHash,
          acceptancePayloadHash: acceptedPayloadHash,
          acceptanceStage: 'STARTED',
          pendingAcceptanceJson: DC.Security.canonicalJson(pendingValue),
          rowVersion: Number(signer.rowVersion || 0) + 1,
          lastUpdatedAt: acceptedAt
        });
        signer = DC.Storage.findRow('SIGNERS', 'signerId', signer.signerId);
      }
      return completePendingAcceptanceLocked(signer, contract, snapshot);
    });

    if (outcome.completed && DC.JobService) {
      try {
        DC.JobService.finalizeContract(outcome.contractId);
      } catch (ignored) {
        // 주기 작업이 PENDING/FAILED 상태를 재처리한다.
      }
    }
    var latest = DC.Storage.findRow('CONTRACTS', 'contractId', outcome.contractId);
    return {
      ok: !outcome.aborted,
      duplicate: preliminary.pending,
      contractId: outcome.contractId,
      status: outcome.status,
      finalizationStatus: latest ? latest.finalizationStatus : 'PENDING'
    };
  }

  return Object.freeze({
    bootstrap: bootstrap,
    requestOtp: requestOtp,
    verifyOtp: verifyOtp,
    loadContract: loadContract,
    accept: accept,
    findSignerBySession: findSignerBySession,
    reconcilePendingAcceptances: reconcilePendingAcceptances,
    loadAcceptanceEvidence: loadAcceptanceEvidence,
    verifiedConsentRecord: verifiedConsentRecord
  });
})();
