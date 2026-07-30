var DC = DC || {};

DC.JobService = (function () {
  var LEASE_MS = 10 * 60 * 1000;
  var MAX_ATTEMPTS = 5;

  function parseTime(value) {
    var time = new Date(String(value || '')).getTime();
    return isNaN(time) ? 0 : time;
  }

  function backoff(attempt) {
    return Math.min(6 * 60 * 60 * 1000, Math.pow(2, Math.max(0, attempt - 1)) * 5 * 60 * 1000);
  }

  function retentionDueFrom(baseIso) {
    var settings = DC.Storage.getSettingsMap();
    var months = Number(settings.RETENTION_MONTHS);
    var date = new Date(String(baseIso || ''));
    if (!Number.isInteger(months) || months <= 0 || isNaN(date.getTime())) {
      throw new Error('RETENTION_POLICY_NOT_CONFIGURED');
    }
    date.setUTCMonth(date.getUTCMonth() + months);
    return date.toISOString();
  }

  function retentionBase(contract) {
    var status = String(contract.status);
    if (status === 'COMPLETED') return contract.completedAt;
    if (status === 'TERMINATED') return contract.terminatedAt;
    if (status === 'EXPIRED') return contract.expiredAt;
    if (status === 'DRAFT') return contract.createdAt || contract.lastUpdatedAt;
    return contract.acceptanceDeadline || contract.createdAt;
  }

  function claimFinalization(contractId) {
    return DC.Storage.withScriptLock(function () {
      var contract = DC.Storage.findRow('CONTRACTS', 'contractId', contractId);
      if (!contract || String(contract.status) !== 'COMPLETED') return null;
      if (String(contract.finalizationStatus) === 'READY' &&
          contract.pdfFileId &&
          (String(contract.contractMode) !== 'organization' || contract.sponsorPdfFileId)) {
        return null;
      }
      var now = Date.now();
      var status = String(contract.finalizationStatus);
      var leaseExpired = status === 'GENERATING' &&
        parseTime(contract.finalizationLeaseExpiresAt) <= now;
      var due = !contract.nextFinalizationAttemptAt ||
        parseTime(contract.nextFinalizationAttemptAt) <= now;
      if (!leaseExpired && ['PENDING', 'FAILED'].indexOf(status) === -1) return null;
      if (!leaseExpired && !due) return null;
      var attempts = Number(contract.finalizationAttemptCount || 0);
      if (attempts >= MAX_ATTEMPTS && (status === 'FAILED' || leaseExpired)) return null;
      var leaseId = DC.Security.randomId('lease-pdf-');
      DC.Storage.updateRow('CONTRACTS', contract.__rowNumber, {
        finalizationStatus: 'GENERATING',
        finalizationLeaseId: leaseId,
        finalizationLeaseExpiresAt: new Date(now + LEASE_MS).toISOString(),
        finalizationAttemptCount: attempts + 1,
        nextFinalizationAttemptAt: '',
        rowVersion: Number(contract.rowVersion || 0) + 1,
        lastUpdatedAt: new Date(now).toISOString()
      });
      DC.Audit.append({
        contractId: contractId,
        eventType: 'PDF_GENERATION_CLAIMED',
        actorRole: 'SYSTEM',
        attemptNumber: attempts + 1
      });
      contract.finalizationAttemptCount = attempts + 1;
      return { contract: contract, leaseId: leaseId };
    });
  }

  function failFinalization(contractId, leaseId, attempt, code) {
    DC.Storage.withScriptLock(function () {
      var contract = DC.Storage.findRow('CONTRACTS', 'contractId', contractId);
      if (!contract || String(contract.finalizationLeaseId) !== String(leaseId)) return;
      var now = Date.now();
      var cleanupFailed = String(code) === 'PDF_GENERATION_CLEANUP_FAILED';
      DC.Storage.updateRow('CONTRACTS', contract.__rowNumber, {
        finalizationStatus: cleanupFailed ? 'CLEANUP_FAILED' : 'FAILED',
        finalizationLeaseId: '',
        finalizationLeaseExpiresAt: '',
        nextFinalizationAttemptAt: cleanupFailed
          ? ''
          : new Date(now + backoff(attempt)).toISOString(),
        lastFinalizationErrorCode: code,
        rowVersion: Number(contract.rowVersion || 0) + 1,
        lastUpdatedAt: new Date(now).toISOString()
      });
      DC.Audit.append({
        contractId: contractId,
        eventType: 'PDF_GENERATION_FAILED',
        actorRole: 'SYSTEM',
        result: 'FAILURE',
        detailCode: code,
        attemptNumber: attempt
      });
    });
  }

  function finalizeContract(contractId) {
    var claim = claimFinalization(contractId);
    if (!claim) return { ok: true, skipped: true };
    var generated;
    try {
      var current = DC.Storage.findRow('CONTRACTS', 'contractId', contractId);
      var snapshot = DC.ContractService.loadSnapshot(current);
      var signers = DC.Storage.findRows('SIGNERS', 'contractId', contractId)
        .filter(function (signer) { return String(signer.status) === 'ACCEPTED'; });
      var required = DC.StateMachine.requiredRoles(current);
      if (signers.length !== required.length) throw new Error('SIGNER_COUNT_MISMATCH');
      signers.forEach(function (signer) {
        if (String(signer.acceptedSourceDocumentHash || signer.acceptedDocumentHash) !==
            String(current.documentHash)) {
          throw new Error('SIGNER_DOCUMENT_HASH_MISMATCH');
        }
      });
      var consents = signers.map(function (signer) {
        return DC.OtpService.verifiedConsentRecord(signer);
      });
      generated = DC.PdfService.generate(current, snapshot, signers, consents);
    } catch (error) {
      var failureCode = String(error && error.message) ===
        'PDF_GENERATION_CLEANUP_FAILED'
        ? 'PDF_GENERATION_CLEANUP_FAILED'
        : 'PDF_GENERATION_FAILED';
      failFinalization(
        contractId,
        claim.leaseId,
        Number(claim.contract.finalizationAttemptCount || 1),
        failureCode
      );
      throw new Error(failureCode);
    }

    var committed = DC.Storage.withScriptLock(function () {
      var contract = DC.Storage.findRow('CONTRACTS', 'contractId', contractId);
      if (!contract || String(contract.finalizationLeaseId) !== String(claim.leaseId) ||
          String(contract.status) !== 'COMPLETED') {
        return false;
      }
      var now = DC.Storage.nowIso();
      DC.Storage.updateRow('CONTRACTS', contract.__rowNumber, {
        docFileId: generated.docFileId,
        pdfFileId: generated.pdfFileId,
        pdfHashAlgorithm: 'SHA-256',
        pdfHash: generated.pdfHash,
        pdfGeneratedAt: generated.pdfGeneratedAt,
        sponsorDocFileId: generated.sponsorDocFileId || '',
        sponsorPdfFileId: generated.sponsorPdfFileId || '',
        sponsorPdfHashAlgorithm: generated.sponsorPdfFileId ? 'SHA-256' : '',
        sponsorPdfHash: generated.sponsorPdfHash || '',
        sponsorPdfGeneratedAt: generated.sponsorPdfGeneratedAt || '',
        finalizationStatus: 'READY',
        finalizationLeaseId: '',
        finalizationLeaseExpiresAt: '',
        nextFinalizationAttemptAt: '',
        lastFinalizationErrorCode: '',
        operatorDeliveryStatus: 'PENDING',
        operatorNextDeliveryAttemptAt: now,
        rowVersion: Number(contract.rowVersion || 0) + 1,
        lastUpdatedAt: now
      });
      DC.Storage.findRows('SIGNERS', 'contractId', contractId).forEach(function (signer) {
        if (String(signer.status) === 'ACCEPTED') {
          DC.Storage.updateRow('SIGNERS', signer.__rowNumber, {
            completionDeliveryStatus: 'PENDING',
            completionNextAttemptAt: now,
            rowVersion: Number(signer.rowVersion || 0) + 1,
            lastUpdatedAt: now
          });
        }
      });
      DC.Audit.append({
        contractId: contractId,
        eventType: 'PDF_GENERATED',
        actorRole: 'SYSTEM',
        safeMetadata: {
          documentHash: contract.documentHash,
          pdfHash: generated.pdfHash,
          sponsorPdfHash: generated.sponsorPdfHash || ''
        }
      });
      return true;
    });
    if (!committed) {
      var cleanupFailures = DC.PdfService.discardGenerated(generated);
      try {
        DC.Audit.append({
          contractId: contractId,
          eventType: cleanupFailures.length
            ? 'ORPHAN_ASSET_CLEANUP_FAILED'
            : 'UNCOMMITTED_ASSETS_DISCARDED',
          actorRole: 'SYSTEM',
          result: cleanupFailures.length ? 'FAILURE' : 'SUCCESS',
          detailCode: 'FINALIZATION_LEASE_NOT_COMMITTED',
          safeMetadata: cleanupFailures.length
            ? { fileIds: cleanupFailures }
            : null
        });
      } catch (ignored) {
        // 반환 전 정리 시도 결과는 파일 상태가 권위이며 감사로그 실패로 뒤집지 않는다.
      }
      if (cleanupFailures.length) {
        DC.Storage.withScriptLock(function () {
          var contract = DC.Storage.findRow(
            'CONTRACTS', 'contractId', contractId
          );
          if (!contract) return;
          DC.Storage.updateRow('CONTRACTS', contract.__rowNumber, {
            finalizationStatus: 'CLEANUP_FAILED',
            finalizationLeaseId: '',
            finalizationLeaseExpiresAt: '',
            nextFinalizationAttemptAt: '',
            lastFinalizationErrorCode: 'ORPHAN_ASSET_CLEANUP_FAILED',
            rowVersion: Number(contract.rowVersion || 0) + 1,
            lastUpdatedAt: DC.Storage.nowIso()
          });
        });
        throw new Error('PDF_GENERATION_CLEANUP_FAILED');
      }
    } else {
      deliverContract(contractId);
    }
    return { ok: true, skipped: !committed };
  }

  function claimSignerDelivery(signerId) {
    return DC.Storage.withScriptLock(function () {
      var signer = DC.Storage.findRow('SIGNERS', 'signerId', signerId);
      if (!signer || String(signer.status) !== 'ACCEPTED') return null;
      var status = String(signer.completionDeliveryStatus);
      var now = Date.now();
      var expired = status === 'SENDING' &&
        parseTime(signer.completionDeliveryLeaseExpiresAt) <= now;
      var due = !signer.completionNextAttemptAt ||
        parseTime(signer.completionNextAttemptAt) <= now;
      if (!expired && ['PENDING', 'FAILED', 'RETRY_SCHEDULED'].indexOf(status) === -1) return null;
      if (!expired && !due) return null;
      var attempts = Number(signer.completionDeliveryAttemptCount || 0);
      if (attempts >= MAX_ATTEMPTS && (status === 'FAILED' || expired)) return null;
      var leaseId = DC.Security.randomId('lease-mail-');
      DC.Storage.updateRow('SIGNERS', signer.__rowNumber, {
        completionDeliveryStatus: 'SENDING',
        completionDeliveryLeaseId: leaseId,
        completionDeliveryLeaseExpiresAt: new Date(now + LEASE_MS).toISOString(),
        completionDeliveryAttemptCount: attempts + 1,
        completionNextAttemptAt: '',
        rowVersion: Number(signer.rowVersion || 0) + 1,
        lastUpdatedAt: new Date(now).toISOString()
      });
      return { signer: signer, leaseId: leaseId, attempt: attempts + 1 };
    });
  }

  function commitSignerDelivery(claim, success, deliveryEvidence) {
    DC.Storage.withScriptLock(function () {
      var signer = DC.Storage.findRow('SIGNERS', 'signerId', claim.signer.signerId);
      if (!signer ||
          String(signer.completionDeliveryLeaseId) !== String(claim.leaseId)) return;
      var now = Date.now();
      var changes = {
        completionDeliveryStatus: success ? 'SENT' : 'FAILED',
        completionDeliveryLeaseId: '',
        completionDeliveryLeaseExpiresAt: '',
        completionLastSentAt: success ? new Date(now).toISOString() : signer.completionLastSentAt,
        completionNextAttemptAt: success || claim.attempt >= MAX_ATTEMPTS
          ? ''
          : new Date(now + backoff(claim.attempt)).toISOString(),
        rowVersion: Number(signer.rowVersion || 0) + 1,
        lastUpdatedAt: new Date(now).toISOString()
      };
      if (success && deliveryEvidence) {
        changes.completionDocumentHashAlgorithm = 'SHA-256';
        changes.completionDocumentHash = deliveryEvidence.pdfHash;
        changes.completionDocumentGeneratedAt = deliveryEvidence.generatedAt;
      }
      DC.Storage.updateRow('SIGNERS', signer.__rowNumber, changes);
      DC.Audit.append({
        contractId: signer.contractId,
        signerId: signer.signerId,
        eventType: success ? 'COMPLETION_EMAIL_SENT' : 'COMPLETION_EMAIL_FAILED',
        actorRole: 'SYSTEM',
        result: success ? 'SUCCESS' : 'FAILURE',
        detailCode: success ? 'MAIL_ACCEPTED' : 'MAIL_SEND_FAILED',
        attemptNumber: claim.attempt,
        safeMetadata: success && deliveryEvidence ? {
          pdfHash: deliveryEvidence.pdfHash,
          hashAlgorithm: 'SHA-256',
          copyRole: deliveryEvidence.copyRole
        } : null
      });
    });
  }

  function claimOperatorDelivery(contractId) {
    return DC.Storage.withScriptLock(function () {
      var contract = DC.Storage.findRow('CONTRACTS', 'contractId', contractId);
      if (!contract || String(contract.finalizationStatus) !== 'READY') return null;
      var status = String(contract.operatorDeliveryStatus);
      var now = Date.now();
      var expired = status === 'SENDING' &&
        parseTime(contract.operatorDeliveryLeaseExpiresAt) <= now;
      var due = !contract.operatorNextDeliveryAttemptAt ||
        parseTime(contract.operatorNextDeliveryAttemptAt) <= now;
      if (!expired && ['PENDING', 'FAILED', 'RETRY_SCHEDULED'].indexOf(status) === -1) return null;
      if (!expired && !due) return null;
      var attempts = Number(contract.operatorDeliveryAttemptCount || 0);
      if (attempts >= MAX_ATTEMPTS && (status === 'FAILED' || expired)) return null;
      var leaseId = DC.Security.randomId('lease-operator-mail-');
      DC.Storage.updateRow('CONTRACTS', contract.__rowNumber, {
        operatorDeliveryStatus: 'SENDING',
        operatorDeliveryLeaseId: leaseId,
        operatorDeliveryLeaseExpiresAt: new Date(now + LEASE_MS).toISOString(),
        operatorDeliveryAttemptCount: attempts + 1,
        operatorNextDeliveryAttemptAt: '',
        rowVersion: Number(contract.rowVersion || 0) + 1,
        lastUpdatedAt: new Date(now).toISOString()
      });
      return { contract: contract, leaseId: leaseId, attempt: attempts + 1 };
    });
  }

  function commitOperatorDelivery(claim, success) {
    DC.Storage.withScriptLock(function () {
      var contract = DC.Storage.findRow('CONTRACTS', 'contractId', claim.contract.contractId);
      if (!contract ||
          String(contract.operatorDeliveryLeaseId) !== String(claim.leaseId)) return;
      var now = Date.now();
      DC.Storage.updateRow('CONTRACTS', contract.__rowNumber, {
        operatorDeliveryStatus: success ? 'SENT' : 'FAILED',
        operatorDeliveryLeaseId: '',
        operatorDeliveryLeaseExpiresAt: '',
        operatorNextDeliveryAttemptAt: success || claim.attempt >= MAX_ATTEMPTS
          ? ''
          : new Date(now + backoff(claim.attempt)).toISOString(),
        rowVersion: Number(contract.rowVersion || 0) + 1,
        lastUpdatedAt: new Date(now).toISOString()
      });
      DC.Audit.append({
        contractId: contract.contractId,
        eventType: success ? 'OPERATOR_PDF_EMAIL_SENT' : 'OPERATOR_PDF_EMAIL_FAILED',
        actorRole: 'SYSTEM',
        result: success ? 'SUCCESS' : 'FAILURE',
        detailCode: success ? 'MAIL_ACCEPTED' : 'MAIL_SEND_FAILED',
        attemptNumber: claim.attempt
      });
    });
  }

  function deliverContract(contractId) {
    var contract = DC.Storage.findRow('CONTRACTS', 'contractId', contractId);
    if (!contract || String(contract.finalizationStatus) !== 'READY' ||
        !contract.pdfFileId) return;
    var pdfBlob = DC.PdfService.blob(String(contract.pdfFileId));
    DC.Storage.findRows('SIGNERS', 'contractId', contractId).forEach(function (signer) {
      var claim = claimSignerDelivery(signer.signerId);
      if (!claim) return;
      var success = false;
      var deliveryEvidence = null;
      try {
        var sponsorReceipt = String(claim.signer.signerRole) === 'SPONSOR';
        var recipientBlob = sponsorReceipt
          ? DC.PdfService.recipientBlob(contract, 'SPONSOR')
          : pdfBlob.copyBlob();
        var actualHash = DC.Security.sha256Hex(recipientBlob.getBytes());
        var expectedHash = sponsorReceipt ? contract.sponsorPdfHash : contract.pdfHash;
        if (!expectedHash || actualHash !== String(expectedHash)) {
          throw new Error('DELIVERY_PDF_HASH_MISMATCH');
        }
        deliveryEvidence = {
          pdfHash: actualHash,
          generatedAt: sponsorReceipt
            ? contract.sponsorPdfGeneratedAt
            : contract.pdfGeneratedAt,
          copyRole: sponsorReceipt ? 'SPONSOR_RECEIPT' : 'FINAL'
        };
        DC.MailService.sendCompleted(contract, {
          name: claim.signer.signerName,
          email: claim.signer.signerEmail,
          role: claim.signer.signerRole
        }, recipientBlob);
        success = true;
      } catch (error) {
        success = false;
      }
      commitSignerDelivery(claim, success, deliveryEvidence);
    });
    var operatorClaim = claimOperatorDelivery(contractId);
    if (operatorClaim) {
      var settings = DC.Storage.getSettingsMap();
      var operatorSuccess = false;
      try {
        DC.MailService.sendCompleted(contract, {
          name: settings.SERVICE_NAME,
          email: settings.CONTACT_EMAIL
        }, pdfBlob.copyBlob());
        operatorSuccess = true;
      } catch (error) {
        operatorSuccess = false;
      }
      commitOperatorDelivery(operatorClaim, operatorSuccess);
    }
  }

  function resendPdf(contractId, requestId) {
    var admin = DC.Config.requireAdmin();
    var requestHash = DC.Security.hashIdempotency(
      admin, 'RESEND_PDF|' + contractId, requestId
    );
    var shouldSend = DC.Storage.withScriptLock(function () {
      if (DC.Audit.findByRequestHash(requestHash, 'PDF_RESEND_QUEUED')) return false;
      var contract = DC.Storage.findRow('CONTRACTS', 'contractId', contractId);
      if (!contract || String(contract.finalizationStatus) !== 'READY' ||
          !DC.Storage.fileExists(String(contract.pdfFileId))) {
        throw new Error('재발송 가능한 PDF가 없습니다.');
      }
      var now = DC.Storage.nowIso();
      DC.Storage.updateRow('CONTRACTS', contract.__rowNumber, {
        operatorDeliveryStatus: 'PENDING',
        operatorNextDeliveryAttemptAt: now,
        rowVersion: Number(contract.rowVersion || 0) + 1,
        lastUpdatedAt: now
      });
      DC.Storage.findRows('SIGNERS', 'contractId', contractId).forEach(function (signer) {
        if (String(signer.status) === 'ACCEPTED') {
          DC.Storage.updateRow('SIGNERS', signer.__rowNumber, {
            completionDeliveryStatus: 'PENDING',
            completionNextAttemptAt: now,
            rowVersion: Number(signer.rowVersion || 0) + 1,
            lastUpdatedAt: now
          });
        }
      });
      DC.Audit.append({
        contractId: contractId,
        eventType: 'PDF_RESEND_QUEUED',
        actorRole: 'ADMIN',
        requestIdHash: requestHash
      });
      return true;
    });
    if (shouldSend) deliverContract(contractId);
    return { ok: true, duplicate: !shouldSend, contractId: contractId };
  }

  function expireContracts() {
    var now = Date.now();
    var candidates = DC.Storage.allRows('CONTRACTS')
      .filter(function (contract) {
        if (['ISSUED', 'CLIENT_VERIFIED', 'SPONSOR_VERIFIED'].indexOf(
          String(contract.status)
        ) === -1) return false;
        return parseTime(contract.acceptanceDeadline) <= now;
      })
      .map(function (contract) { return String(contract.contractId); });
    candidates.forEach(function (contractId) {
      try {
        DC.OtpService.reconcilePendingAcceptances(contractId);
      } catch (error) {
        // lock 안에서 pending intent를 다시 확인해 유효한 선행 확인을 보호한다.
      }
      DC.Storage.withScriptLock(function () {
        var contract = DC.Storage.findRow(
          'CONTRACTS', 'contractId', contractId
        );
        if (!contract ||
            ['ISSUED', 'CLIENT_VERIFIED', 'SPONSOR_VERIFIED'].indexOf(
              String(contract.status)
            ) === -1 ||
            parseTime(contract.acceptanceDeadline) > Date.now()) {
          return;
        }
        var signers = DC.Storage.findRows(
          'SIGNERS', 'contractId', contractId
        );
        var hasPendingIntent = signers.some(function (signer) {
          return ['STARTED', 'SIGNER_ACCEPTED'].indexOf(
            String(signer.acceptanceStage)
          ) !== -1 && Boolean(signer.pendingAcceptanceJson);
        });
        if (hasPendingIntent) return;
        var nowIso = new Date().toISOString();
        DC.Storage.updateRow('CONTRACTS', contract.__rowNumber, {
          status: 'EXPIRED',
          expiredAt: nowIso,
          retentionDueAt: retentionDueFrom(nowIso),
          rowVersion: Number(contract.rowVersion || 0) + 1,
          lastUpdatedAt: nowIso
        });
        signers.forEach(function (signer) {
            if (String(signer.status) !== 'ACCEPTED') {
              DC.Storage.updateRow('SIGNERS', signer.__rowNumber, {
                status: 'EXPIRED',
                tokenStatus: 'EXPIRED',
                rowVersion: Number(signer.rowVersion || 0) + 1,
                lastUpdatedAt: nowIso
              });
            }
          });
        DC.Audit.append({
          contractId: contract.contractId,
          eventType: 'CONTRACT_EXPIRED',
          actorRole: 'SYSTEM',
          previousStatus: contract.status,
          nextStatus: 'EXPIRED'
        });
      });
    });
  }

  function reconcileContract(contractId) {
    var acceptanceRepair = DC.OtpService.reconcilePendingAcceptances(contractId);
    return DC.Storage.withScriptLock(function () {
      var contract = DC.Storage.findRow('CONTRACTS', 'contractId', contractId);
      if (!contract) return { contractId: contractId, repaired: false, code: 'NOT_FOUND' };
      var now = Date.now();
      var nowIso = new Date(now).toISOString();
      var changes = {};
      var signers = DC.Storage.findRows('SIGNERS', 'contractId', contractId);
      if (!contract.retentionDueAt && retentionBase(contract)) {
        changes.retentionDueAt = retentionDueFrom(retentionBase(contract));
      }
      if (['ISSUED', 'CLIENT_VERIFIED', 'SPONSOR_VERIFIED'].indexOf(
        String(contract.status)
      ) !== -1) {
        var derivedStatus = DC.StateMachine.derive(contract, signers);
        if (derivedStatus !== String(contract.status)) {
          changes.status = derivedStatus;
          if (derivedStatus === 'COMPLETED') {
            var acceptedEvidence = signers
              .filter(function (signer) { return String(signer.status) === 'ACCEPTED'; })
              .map(function (signer) {
                if (!signer.acceptanceEvidenceHash ||
                    !signer.acceptanceEvidenceFileId ||
                    String(signer.acceptedSourceDocumentHash || signer.acceptedDocumentHash) !==
                      String(contract.documentHash)) {
                  throw new Error('RECONCILE_ACCEPTANCE_EVIDENCE_INVALID');
                }
                DC.OtpService.verifiedConsentRecord(signer);
                return {
                  signerId: String(signer.signerId),
                  signerRole: String(signer.signerRole),
                  acceptedAt: String(signer.acceptedAt),
                  evidenceHash: String(signer.acceptanceEvidenceHash)
                };
              })
              .sort(function (a, b) { return a.signerRole.localeCompare(b.signerRole); });
            var settings = DC.Storage.getSettingsMap();
            var retentionDate = new Date(nowIso);
            retentionDate.setUTCMonth(
              retentionDate.getUTCMonth() + Number(settings.RETENTION_MONTHS)
            );
            changes.completedAt = contract.completedAt || nowIso;
            changes.serviceStatus = 'ACTIVE';
            changes.acceptanceEvidenceHash = DC.Security.documentHash({
              documentHash: contract.documentHash,
              signers: acceptedEvidence
            });
            changes.finalizationStatus = contract.pdfFileId ? contract.finalizationStatus : 'PENDING';
            changes.nextFinalizationAttemptAt = contract.pdfFileId
              ? contract.nextFinalizationAttemptAt
              : nowIso;
            changes.retentionDueAt = retentionDate.toISOString();
          }
        }
      }
      var finalizationStatus = String(contract.finalizationStatus);
      var abandonedGeneration =
        (finalizationStatus === 'GENERATING' &&
          parseTime(contract.finalizationLeaseExpiresAt) <= now) ||
        finalizationStatus === 'CLEANUP_FAILED';
      if (abandonedGeneration) {
        var cleanup;
        try {
          cleanup = DC.PdfService.discardUnreferencedContractArtifacts(contract);
        } catch (cleanupError) {
          cleanup = { discarded: [], failed: ['CLEANUP_SCAN_FAILED'] };
        }
        changes.finalizationLeaseId = '';
        changes.finalizationLeaseExpiresAt = '';
        if (cleanup.failed.length) {
          changes.finalizationStatus = 'CLEANUP_FAILED';
          changes.nextFinalizationAttemptAt = '';
          changes.lastFinalizationErrorCode = 'ORPHAN_ASSET_CLEANUP_FAILED';
          DC.Audit.append({
            contractId: contractId,
            eventType: 'ORPHAN_ASSET_CLEANUP_FAILED',
            actorRole: 'SYSTEM',
            result: 'FAILURE',
            detailCode: 'FINALIZATION_LEASE_EXPIRED',
            safeMetadata: { fileIds: cleanup.failed }
          });
        } else {
          changes.finalizationStatus = 'FAILED';
          changes.nextFinalizationAttemptAt = nowIso;
          changes.lastFinalizationErrorCode = 'LEASE_EXPIRED_ASSETS_DISCARDED';
          DC.Audit.append({
            contractId: contractId,
            eventType: 'UNCOMMITTED_ASSETS_DISCARDED',
            actorRole: 'SYSTEM',
            detailCode: 'FINALIZATION_LEASE_EXPIRED',
            safeMetadata: { fileIds: cleanup.discarded }
          });
        }
      }
      var readyArtifactsValid =
        finalizationStatus === 'READY' &&
        Boolean(contract.pdfFileId) &&
        Boolean(contract.pdfHash) &&
        DC.Storage.fileExists(String(contract.pdfFileId)) &&
        (String(contract.contractMode) !== 'organization' ||
          (Boolean(contract.sponsorPdfFileId) &&
           Boolean(contract.sponsorPdfHash) &&
           DC.Storage.fileExists(String(contract.sponsorPdfFileId))));
      if (finalizationStatus === 'READY' &&
          (!contract.pdfFileId || !contract.pdfHash ||
           !DC.Storage.fileExists(String(contract.pdfFileId)))) {
        changes.finalizationStatus = 'FAILED';
        changes.nextFinalizationAttemptAt = nowIso;
        changes.lastFinalizationErrorCode = 'PDF_FILE_OR_HASH_MISSING';
      }
      if (finalizationStatus === 'READY' &&
          String(contract.contractMode) === 'organization' &&
          (!contract.sponsorPdfFileId || !contract.sponsorPdfHash ||
           !DC.Storage.fileExists(String(contract.sponsorPdfFileId)))) {
        changes.finalizationStatus = 'FAILED';
        changes.nextFinalizationAttemptAt = nowIso;
        changes.lastFinalizationErrorCode = 'SPONSOR_PDF_FILE_OR_HASH_MISSING';
      }
      if (readyArtifactsValid &&
          ['', 'NOT_READY'].indexOf(String(contract.operatorDeliveryStatus)) !== -1) {
        changes.operatorDeliveryStatus = 'PENDING';
        changes.operatorDeliveryLeaseId = '';
        changes.operatorDeliveryLeaseExpiresAt = '';
        changes.operatorNextDeliveryAttemptAt = nowIso;
      }
      ['operatorDelivery'].forEach(function (prefix) {
        if (String(contract[prefix + 'Status']) === 'SENDING' &&
            parseTime(contract[prefix + 'LeaseExpiresAt']) <= now) {
          changes[prefix + 'Status'] = 'FAILED';
          changes[prefix + 'LeaseId'] = '';
          changes[prefix + 'LeaseExpiresAt'] = '';
          changes[prefix + 'NextAttemptAt'] = nowIso;
        }
      });
      if (Object.keys(changes).length) {
        changes.rowVersion = Number(contract.rowVersion || 0) + 1;
        changes.lastUpdatedAt = nowIso;
        DC.Storage.updateRow('CONTRACTS', contract.__rowNumber, changes);
        DC.Audit.append({
          contractId: contractId,
          eventType: 'CONTRACT_RECONCILED',
          actorRole: 'SYSTEM',
          detailCode: changes.status
            ? 'STATUS_OR_PROCESS_REPAIRED'
            : 'EXPIRED_LEASE_OR_MISSING_FILE'
        });
      }
      var signerRepaired = false;
      signers.forEach(function (signer) {
        var deliveryStatus = String(signer.completionDeliveryStatus);
        if (readyArtifactsValid &&
            String(signer.status) === 'ACCEPTED' &&
            ['', 'NOT_READY'].indexOf(deliveryStatus) !== -1) {
          signerRepaired = true;
          DC.Storage.updateRow('SIGNERS', signer.__rowNumber, {
            completionDeliveryStatus: 'PENDING',
            completionDeliveryLeaseId: '',
            completionDeliveryLeaseExpiresAt: '',
            completionNextAttemptAt: nowIso,
            rowVersion: Number(signer.rowVersion || 0) + 1,
            lastUpdatedAt: nowIso
          });
        } else if (deliveryStatus === 'SENDING' &&
            parseTime(signer.completionDeliveryLeaseExpiresAt) <= now) {
          signerRepaired = true;
          DC.Storage.updateRow('SIGNERS', signer.__rowNumber, {
            completionDeliveryStatus: 'FAILED',
            completionDeliveryLeaseId: '',
            completionDeliveryLeaseExpiresAt: '',
            completionNextAttemptAt: nowIso,
            rowVersion: Number(signer.rowVersion || 0) + 1,
            lastUpdatedAt: nowIso
          });
        }
      });
      return {
        contractId: contractId,
        repaired: Object.keys(changes).length > 0 || signerRepaired ||
          Number(acceptanceRepair.repaired || 0) > 0,
        code: Object.keys(changes).length || signerRepaired ||
          Number(acceptanceRepair.repaired || 0)
          ? 'REPAIRED'
          : 'NO_CHANGE'
      };
    });
  }

  function processPending() {
    try { DC.ContractService.retryPendingInvitations(); } catch (ignored) {}
    var contracts = DC.Storage.allRows('CONTRACTS');
    contracts.forEach(function (contract) {
      try {
        reconcileContract(String(contract.contractId));
      } catch (error) {
        try {
          DC.Audit.append({
            contractId: String(contract.contractId),
            eventType: 'CONTRACT_RECONCILE_FAILED',
            actorRole: 'SYSTEM',
            result: 'FAILURE',
            detailCode: 'INTEGRITY_OR_RECOVERY_FAILED'
          });
        } catch (ignored) {}
      }
    });
    DC.Storage.allRows('CONTRACTS').forEach(function (contract) {
      if (String(contract.status) === 'COMPLETED' &&
          ['PENDING', 'FAILED'].indexOf(String(contract.finalizationStatus)) !== -1) {
        try { finalizeContract(String(contract.contractId)); } catch (ignored) {}
      } else if (String(contract.finalizationStatus) === 'READY') {
        try { deliverContract(String(contract.contractId)); } catch (ignored) {}
      }
    });
  }

  function retentionCandidates() {
    return retentionCandidateRecords()
      .map(function (record) { return record.contractId; });
  }

  function retentionCandidateRecords() {
    var now = Date.now();
    return DC.Storage.allRows('CONTRACTS')
      .filter(function (contract) {
        return contract.retentionDueAt &&
          parseTime(contract.retentionDueAt) <= now &&
          String(contract.destructionStatus) === 'ACTIVE';
      })
      .map(function (contract) {
        var fileIds = [
          contract.termsSnapshotFileId,
          contract.contractSnapshotFileId,
          contract.docFileId,
          contract.pdfFileId,
          contract.sponsorDocFileId,
          contract.sponsorPdfFileId
        ];
        DC.Storage.findRows('SIGNERS', 'contractId', contract.contractId)
          .forEach(function (signer) {
            fileIds.push(signer.presentedSnapshotFileId);
            fileIds.push(signer.acceptanceEvidenceFileId);
          });
        return {
          contractId: String(contract.contractId),
          status: String(contract.status),
          retentionDueAt: String(contract.retentionDueAt),
          artifactFileIds: fileIds
            .filter(function (fileId, index, all) {
              return fileId && all.indexOf(fileId) === index;
            })
            .map(String)
        };
      });
  }

  function reportRetentionCandidates() {
    var ids = retentionCandidates();
    if (ids.length) DC.MailService.sendRetentionSummary(ids);
    return ids;
  }

  return Object.freeze({
    finalizeContract: finalizeContract,
    deliverContract: deliverContract,
    resendPdf: resendPdf,
    expireContracts: expireContracts,
    reconcileContract: reconcileContract,
    processPending: processPending,
    retentionCandidates: retentionCandidates,
    retentionCandidateRecords: retentionCandidateRecords,
    reportRetentionCandidates: reportRetentionCandidates
  });
})();
