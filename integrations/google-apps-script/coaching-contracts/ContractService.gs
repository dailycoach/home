var DC = DC || {};

DC.ContractService = (function () {
  var INVITATION_MAX_ATTEMPTS = 5;

  function invitationBackoff(attempt) {
    return Math.min(
      6 * 60 * 60 * 1000,
      Math.pow(2, Math.max(0, Number(attempt || 1) - 1)) * 5 * 60 * 1000
    );
  }

  function isoAfterDays(days) {
    return new Date(Date.now() + Number(days) * 86400000).toISOString();
  }

  function retentionDueFrom(settings, baseIso) {
    var date = new Date(String(baseIso));
    var months = Number(settings.RETENTION_MONTHS);
    if (isNaN(date.getTime()) || !Number.isInteger(months) || months <= 0) {
      throw new Error('보유기간 기준을 계산할 수 없습니다.');
    }
    date.setUTCMonth(date.getUTCMonth() + months);
    return date.toISOString();
  }

  function consentOfferSet(settings) {
    var enabled = String(settings.RECORDING_AI_MODE) === 'SEPARATE_CONSENT_ENABLED';
    function yes(key) { return String(settings[key]) === 'YES'; }
    return {
      recordingStatus: enabled && yes('OFFER_RECORDING_CONSENT'),
      transcriptionStatus: enabled && yes('OFFER_TRANSCRIPTION_CONSENT'),
      aiSummaryStatus: enabled && yes('OFFER_AI_SUMMARY_CONSENT'),
      researchUseStatus: yes('OFFER_RESEARCH_CONSENT'),
      anonymousCaseUseStatus: yes('OFFER_ANONYMOUS_CASE_CONSENT'),
      testimonialPublicityStatus: yes('OFFER_TESTIMONIAL_CONSENT'),
      marketingEmailStatus: yes('OFFER_MARKETING_EMAIL_CONSENT'),
      marketingSmsStatus: yes('OFFER_MARKETING_SMS_CONSENT'),
      thirdPartyTransferStatus: yes('OFFER_THIRD_PARTY_TRANSFER_CONSENT')
    };
  }

  function sessionProcessingNotices(settings) {
    var notices = {};
    var sessionEnabled =
      String(settings.RECORDING_AI_MODE) === 'SEPARATE_CONSENT_ENABLED';
    if (sessionEnabled && String(settings.OFFER_RECORDING_CONSENT) === 'YES') {
      notices.recordingStatus = {
        version: settings.SESSION_PROCESSING_NOTICE_VERSION,
        purpose: settings.RECORDING_PURPOSE,
        scope: settings.RECORDING_SCOPE,
        provider: 'DAILYCOACHING 운영 설정',
        retention: settings.RECORDING_RETENTION
      };
    }
    if (sessionEnabled && String(settings.OFFER_TRANSCRIPTION_CONSENT) === 'YES') {
      notices.transcriptionStatus = {
        version: settings.SESSION_PROCESSING_NOTICE_VERSION,
        purpose: settings.TRANSCRIPTION_PURPOSE,
        scope: settings.TRANSCRIPTION_SCOPE,
        provider: settings.TRANSCRIPTION_PROVIDER,
        retention: settings.TRANSCRIPTION_RETENTION
      };
    }
    if (sessionEnabled && String(settings.OFFER_AI_SUMMARY_CONSENT) === 'YES') {
      notices.aiSummaryStatus = {
        version: settings.SESSION_PROCESSING_NOTICE_VERSION,
        purpose: settings.AI_SUMMARY_PURPOSE,
        scope: settings.AI_SUMMARY_SCOPE,
        provider: settings.AI_SUMMARY_PROVIDER,
        retention: settings.AI_SUMMARY_RETENTION
      };
    }
    function addGeneral(key, flag, purpose, scope, provider, retention) {
      if (String(settings[flag]) !== 'YES') return;
      notices[key] = {
        version: settings.OPTIONAL_CONSENT_NOTICE_VERSION,
        purpose: settings[purpose],
        scope: settings[scope],
        provider: settings[provider] || settings.SERVICE_NAME,
        retention: settings[retention]
      };
    }
    addGeneral(
      'researchUseStatus', 'OFFER_RESEARCH_CONSENT',
      'RESEARCH_PURPOSE', 'RESEARCH_ITEMS', 'SERVICE_NAME', 'RESEARCH_RETENTION'
    );
    addGeneral(
      'anonymousCaseUseStatus', 'OFFER_ANONYMOUS_CASE_CONSENT',
      'ANONYMOUS_CASE_PURPOSE', 'ANONYMOUS_CASE_ITEMS',
      'SERVICE_NAME', 'ANONYMOUS_CASE_RETENTION'
    );
    addGeneral(
      'testimonialPublicityStatus', 'OFFER_TESTIMONIAL_CONSENT',
      'TESTIMONIAL_PURPOSE', 'TESTIMONIAL_ITEMS',
      'SERVICE_NAME', 'TESTIMONIAL_RETENTION'
    );
    addGeneral(
      'marketingEmailStatus', 'OFFER_MARKETING_EMAIL_CONSENT',
      'MARKETING_EMAIL_PURPOSE', 'MARKETING_EMAIL_ITEMS',
      'MARKETING_EMAIL_SENDER', 'MARKETING_EMAIL_RETENTION'
    );
    addGeneral(
      'marketingSmsStatus', 'OFFER_MARKETING_SMS_CONSENT',
      'MARKETING_SMS_PURPOSE', 'MARKETING_SMS_ITEMS',
      'MARKETING_SMS_SENDER', 'MARKETING_SMS_RETENTION'
    );
    addGeneral(
      'thirdPartyTransferStatus', 'OFFER_THIRD_PARTY_TRANSFER_CONSENT',
      'THIRD_PARTY_PURPOSE', 'THIRD_PARTY_ITEMS',
      'THIRD_PARTY_RECIPIENT', 'THIRD_PARTY_RETENTION'
    );
    return notices;
  }

  function providerSnapshot(settings) {
    return {
      serviceName: settings.SERVICE_NAME,
      representative: settings.REPRESENTATIVE,
      coachName: settings.COACH_NAME,
      coachCredential: settings.COACH_CREDENTIAL,
      businessRegistrationNumber: settings.BUSINESS_REGISTRATION_NUMBER,
      address: settings.BUSINESS_ADDRESS,
      phone: settings.CONTACT_PHONE,
      email: settings.CONTACT_EMAIL,
      taxNotice: settings.TAX_NOTICE,
      jurisdiction: settings.JURISDICTION
    };
  }

  function sharingMatrix(input, settings) {
    var providedItems = [];
    if (input.sponsorShareAttendance) providedItems.push('코칭 참여 여부');
    if (input.sponsorShareScheduleProgress) providedItems.push('일정·진행률');
    if (input.sponsorShareAgreedGoals) providedItems.push('합의된 전체 목표');
    if (input.sponsorShareClosingSummary) providedItems.push('사전 합의 범위의 종료 요약');
    return {
      version: settings.INFORMATION_SHARING_VERSION,
      sponsor: {
        attendance: Boolean(input.sponsorShareAttendance),
        scheduleProgress: Boolean(input.sponsorShareScheduleProgress),
        agreedGoals: Boolean(input.sponsorShareAgreedGoals),
        sessionContent: false,
        personalConcerns: false,
        closingSummary: Boolean(input.sponsorShareClosingSummary),
        safetyLegalMinimum: true
      },
      provisionNotice: {
        version: settings.SPONSOR_PROVISION_NOTICE_VERSION,
        recipient: input.sponsorOrganization + ' · ' + input.sponsorName,
        purpose: '조직지원 코칭의 계약 이행과 합의된 진행정보 공유',
        providedItems: providedItems,
        retention: settings.SPONSOR_INFORMATION_RETENTION,
        refusalNotice: settings.SPONSOR_PROVISION_REFUSAL_NOTICE,
        alwaysExcluded: ['세션의 구체적인 대화', '개인적인 감정·고민']
      }
    };
  }

  function termsVersion(type) {
    return DC.Terms.VERSIONS[type];
  }

  function won(value) {
    return '₩' + String(Math.round(Number(value || 0)))
      .replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  }

  function renderedClauses(type, input, provider) {
    var typePurposes = {
      life: '삶의 방향, 자기이해, 관계, 생활습관, 자기조절, 가치와 우선순위를 탐색하고 고객이 원하는 변화와 행동을 스스로 설계하도록 돕는 것을 목적으로 합니다.',
      business: '리더십, 사업 운영, 조직성과, 의사결정, 역할 전환과 팀 관계를 탐색하고 고객이 책임 있는 선택과 실행을 설계하도록 돕는 것을 목적으로 합니다.',
      career: '진로탐색, 취업 준비, 이직, 경력전환, 강점과 직무 적합성, 경력 로드맵을 탐색하고 고객이 자신의 경로와 행동을 설계하도록 돕는 것을 목적으로 합니다.'
    };
    var replacements = {
      providerName: provider.serviceName,
      coachName: provider.coachName + ' · ' + provider.coachCredential,
      clientName: input.clientName,
      sponsorOrganization: input.sponsorOrganization || '해당 없음',
      sponsorName: input.sponsorName || '해당 없음',
      typePurpose: typePurposes[type] +
        ' 이번 계약에서 당사자가 합의한 구체적인 코칭 목적은 “' +
        input.coachingPurpose + '”입니다.',
      coachingPurpose: input.coachingPurpose,
      goalSummary: input.goalSummary,
      sessions: input.sessions,
      sessionMinutes: input.sessionMinutes,
      deliveryMode: input.deliveryMode,
      deliveryLocation: input.deliveryLocation,
      startDate: input.startDate,
      endDate: input.endDate,
      totalFee: won(input.totalFee),
      feePerSession: won(input.perSessionFee),
      paymentMethod: input.paymentMethod,
      paymentSchedule: input.paymentSchedule,
      reschedulePolicy: input.cancellationPolicy,
      noShowPolicy: input.noShowPolicy,
      refundPolicy: input.refundPolicy
    };
    return DC.Terms.clauses(type).map(function (clause) {
      var rendered = JSON.parse(JSON.stringify(clause));
      rendered.text = String(rendered.text).replace(
        /\{\{([A-Za-z0-9_-]+)\}\}/g,
        function (match, key) {
          return Object.prototype.hasOwnProperty.call(replacements, key)
            ? String(replacements[key])
            : match;
        }
      );
      if (/\{\{[A-Za-z0-9_-]+\}\}/.test(rendered.text)) {
        throw new Error('계약 조항의 필수 병합값이 누락되었습니다.');
      }
      return rendered;
    });
  }

  function buildSnapshot(contractId, input, settings, issuedAt, acceptanceDeadline) {
    var provider = providerSnapshot(settings);
    var clauses = renderedClauses(input.contractType, input, provider);
    var parties = {
      provider: provider,
      client: {
        name: input.clientName,
        email: input.clientEmail,
        phone: input.clientPhone,
        role: input.clientRole,
        signerRole: 'CLIENT',
        organization: input.clientOrganization,
        title: input.clientTitle
      }
    };
    if (input.contractMode === 'organization') {
      parties.sponsor = {
        name: input.sponsorName,
        email: input.sponsorEmail,
        organization: input.sponsorOrganization,
        role: 'SPONSOR'
      };
    }
    return {
      schemaVersion: DC.Schema.VERSION,
      contractId: contractId,
      contractType: input.contractType,
      contractMode: input.contractMode,
      issuedAt: issuedAt,
      acceptanceDeadline: acceptanceDeadline,
      provider: provider,
      parties: parties,
      coaching: {
        purpose: input.coachingPurpose,
        goalSummary: input.goalSummary,
        sessions: input.sessions,
        sessionMinutes: input.sessionMinutes,
        deliveryMode: input.deliveryMode,
        deliveryLocation: input.deliveryLocation,
        startDate: input.startDate,
        endDate: input.endDate
      },
      payment: {
        totalFee: input.totalFee,
        perSessionFee: input.perSessionFee,
        paymentMethod: input.paymentMethod,
        paymentSchedule: input.paymentSchedule,
        cancellationPolicy: input.cancellationPolicy,
        noShowPolicy: input.noShowPolicy,
        refundPolicy: input.refundPolicy
      },
      informationSharing: sharingMatrix(input, settings),
      clauses: clauses,
      privacyNotice: DC.Terms.privacyNotice(settings),
      consentOfferSet: consentOfferSet(settings),
      consentNotices: sessionProcessingNotices(settings),
      sessionProcessingStatement:
        String(settings.RECORDING_AI_MODE) === 'NOT_USED'
          ? '현재 DAILYCOACHING은 별도 합의 없이 코칭 세션을 녹음하거나 AI 전사·요약 도구에 입력하지 않습니다.'
          : '녹음·전사·AI 처리는 아래 별도 선택동의에서 동의한 항목에 한해 안내된 범위로 수행합니다.',
      versions: {
        common: DC.Terms.VERSIONS.common,
        specific: termsVersion(input.contractType),
        privacy: DC.Terms.VERSIONS.privacy,
        consent: DC.Terms.VERSIONS.consent,
        informationSharing: settings.INFORMATION_SHARING_VERSION
      }
    };
  }

  function contractRow(snapshot, documentHash, issuedBy, settings) {
    var input = snapshot.coaching;
    var payment = snapshot.payment;
    var provider = snapshot.provider;
    var sponsor = snapshot.parties.sponsor || {};
    var sharing = snapshot.informationSharing.sponsor;
    return {
      contractId: snapshot.contractId,
      contractType: snapshot.contractType,
      contractMode: snapshot.contractMode,
      status: 'ISSUED',
      serviceStatus: 'NOT_STARTED',
      termsVersion: snapshot.versions.specific,
      privacyNoticeVersion: snapshot.versions.privacy,
      consentVersion: snapshot.versions.consent,
      rowVersion: 1,
      issuanceRequestHash: '',
      issuanceInputHash: '',
      issuanceStatus: '',
      issuanceSnapshotJson: '',
      createdAt: snapshot.issuedAt,
      issuedAt: snapshot.issuedAt,
      acceptanceDeadline: snapshot.acceptanceDeadline,
      completedAt: '',
      terminatedAt: '',
      expiredAt: '',
      issuedBy: issuedBy,
      supersedesContractId: '',
      clientName: snapshot.parties.client.name,
      clientEmail: snapshot.parties.client.email,
      clientPhone: snapshot.parties.client.phone,
      clientRole: snapshot.parties.client.role,
      clientOrganization: snapshot.parties.client.organization,
      clientTitle: snapshot.parties.client.title,
      sponsorName: sponsor.name || '',
      sponsorEmail: sponsor.email || '',
      sponsorOrganization: sponsor.organization || '',
      coachName: provider.coachName,
      sessions: input.sessions,
      sessionMinutes: input.sessionMinutes,
      deliveryMode: input.deliveryMode,
      deliveryLocation: input.deliveryLocation,
      startDate: input.startDate,
      endDate: input.endDate,
      totalFee: payment.totalFee,
      perSessionFee: payment.perSessionFee,
      paymentMethod: payment.paymentMethod,
      paymentSchedule: payment.paymentSchedule,
      cancellationPolicy: payment.cancellationPolicy,
      noShowPolicy: payment.noShowPolicy,
      refundPolicy: payment.refundPolicy,
      coachingPurpose: input.purpose,
      goalSummary: input.goalSummary,
      providerServiceName: provider.serviceName,
      providerRepresentative: provider.representative,
      providerCoachName: provider.coachName,
      providerCoachCredential: provider.coachCredential,
      providerBusinessNumber: provider.businessRegistrationNumber,
      providerAddress: provider.address,
      providerPhone: provider.phone,
      providerEmail: provider.email,
      providerTaxNotice: provider.taxNotice,
      providerJurisdiction: provider.jurisdiction,
      informationSharingVersion: snapshot.versions.informationSharing,
      sponsorShareAttendance: sharing.attendance,
      sponsorShareScheduleProgress: sharing.scheduleProgress,
      sponsorShareAgreedGoals: sharing.agreedGoals,
      sponsorShareSessionContent: false,
      sponsorSharePersonalConcerns: false,
      sponsorShareClosingSummary: sharing.closingSummary,
      sponsorShareSafetyLegalMinimum: true,
      termsSnapshotFileId: '',
      contractSnapshotFileId: '',
      documentHashAlgorithm: 'SHA-256',
      documentHash: documentHash,
      acceptanceEvidenceHash: '',
      docFileId: '',
      pdfFileId: '',
      finalizationStatus: 'NOT_READY',
      finalizationLeaseId: '',
      finalizationLeaseExpiresAt: '',
      finalizationAttemptCount: 0,
      nextFinalizationAttemptAt: '',
      lastFinalizationErrorCode: '',
      pdfHashAlgorithm: '',
      pdfHash: '',
      pdfGeneratedAt: '',
      sponsorDocFileId: '',
      sponsorPdfFileId: '',
      sponsorPdfHashAlgorithm: '',
      sponsorPdfHash: '',
      sponsorPdfGeneratedAt: '',
      operatorDeliveryStatus: 'NOT_READY',
      operatorDeliveryLeaseId: '',
      operatorDeliveryLeaseExpiresAt: '',
      operatorDeliveryAttemptCount: 0,
      operatorNextDeliveryAttemptAt: '',
      retentionDueAt: retentionDueFrom(
        settings,
        snapshot.acceptanceDeadline
      ),
      destructionStatus: 'ACTIVE',
      managementStatus: 'NONE',
      withdrawalStatus: 'NONE',
      terminationRequestStatus: 'NONE',
      changeRequestStatus: 'NONE',
      consentWithdrawalStatus: 'NONE',
      privacyRightsRequestStatus: 'NONE',
      lastManagementRequestAt: '',
      lastUpdatedAt: snapshot.issuedAt
    };
  }

  function signerRow(contractId, role, name, email, token, expiry, now) {
    return {
      contractId: contractId,
      signerId: DC.Security.randomId('signer-'),
      signerRole: role,
      signerName: name,
      signerEmail: email,
      emailNormalized: String(email).trim().toLowerCase(),
      status: 'ISSUED',
      rowVersion: 1,
      tokenHashVersion: token.tokenHashVersion,
      tokenHash: token.tokenHash,
      tokenIssuedAt: now,
      tokenExpiresAt: expiry,
      tokenUsedAt: '',
      tokenRevokedAt: '',
      tokenStatus: 'ACTIVE',
      inviteDeliveryStatus: 'PENDING',
      inviteDeliveryAttemptCount: 0,
      inviteLastSentAt: '',
      inviteNextAttemptAt: '',
      otpChallengeId: '',
      otpHashVersion: '',
      otpHash: '',
      otpExpiresAt: '',
      otpAttemptCount: 0,
      otpLastSentAt: '',
      otpDeliveryStatus: 'NOT_SENT',
      otpRequestWindowStartedAt: '',
      otpRequestCount: 0,
      otpFailureWindowStartedAt: '',
      otpFailureCount: 0,
      otpLockedUntil: '',
      otpVerifiedAt: '',
      otpVerifyRequestHash: '',
      authSessionHashVersion: '',
      authSessionHash: '',
      authSessionExpiresAt: '',
      authSessionUsedAt: '',
      presentedSnapshotFileId: '',
      presentedDocumentHashAlgorithm: '',
      presentedDocumentHash: '',
      presentedSourceDocumentHash: '',
      acceptedAt: '',
      acceptanceVersion: '',
      acceptedDocumentHash: '',
      acceptedSourceDocumentHash: '',
      acceptanceEvidenceHash: '',
      acceptanceEvidenceFileId: '',
      acceptanceRequestHash: '',
      acceptancePayloadHash: '',
      acceptanceStage: '',
      pendingAcceptanceJson: '',
      completionDeliveryStatus: 'NOT_READY',
      completionDeliveryLeaseId: '',
      completionDeliveryLeaseExpiresAt: '',
      completionDeliveryAttemptCount: 0,
      completionLastSentAt: '',
      completionNextAttemptAt: '',
      completionDocumentHashAlgorithm: '',
      completionDocumentHash: '',
      completionDocumentGeneratedAt: '',
      lastUpdatedAt: now
    };
  }

  function issuanceSnapshot(row) {
    if (row.issuanceSnapshotJson) {
      return JSON.parse(String(row.issuanceSnapshotJson));
    }
    if (row.contractSnapshotFileId) {
      return DC.Storage.readJsonFile(String(row.contractSnapshotFileId)).contract;
    }
    throw new Error('발행 복구용 계약 스냅샷이 없습니다.');
  }

  function claimInvitation(contract, snapshot, role, now) {
    var signer = DC.Storage.findRows('SIGNERS', 'contractId', contract.contractId)
      .filter(function (entry) { return String(entry.signerRole) === role; })[0];
    if (signer &&
        (String(signer.status) === 'ACCEPTED' ||
         String(signer.inviteDeliveryStatus) === 'SENT')) {
      return null;
    }
    if (signer &&
        String(signer.inviteDeliveryStatus) === 'CLAIMED' &&
        new Date(String(signer.lastUpdatedAt || '')).getTime() + 10 * 60 * 1000 > Date.now()) {
      return null;
    }

    var party = role === 'CLIENT' ? snapshot.parties.client : snapshot.parties.sponsor;
    var token;
    if (signer) {
      var rotated = DC.TokenService.rotate(contract.contractId, role);
      token = {
        rawToken: rotated.rawToken,
        tokenHashVersion: rotated.signer.tokenHashVersion,
        tokenHash: rotated.signer.tokenHash
      };
      signer = rotated.signer;
      DC.Storage.updateRow('SIGNERS', signer.__rowNumber, {
        inviteDeliveryStatus: 'CLAIMED',
        rowVersion: Number(signer.rowVersion || 0) + 1,
        lastUpdatedAt: now
      });
    } else {
      token = DC.TokenService.createTokenRecord();
      signer = signerRow(
        contract.contractId,
        role,
        party.name,
        party.email,
        token,
        snapshot.acceptanceDeadline,
        now
      );
      signer.inviteDeliveryStatus = 'CLAIMED';
      DC.Storage.appendObject('SIGNERS', signer);
    }
    return {
      rawToken: token.rawToken,
      signerId: signer.signerId,
      signerRole: role
    };
  }

  function issue(payload, requestId) {
    var admin = DC.Config.requireAdmin();
    var settings = DC.Config.requireIssuanceReady();
    var input = DC.Validation.issuePayload(payload, settings);
    var requestHash = DC.Security.hashIdempotency(admin, 'ISSUE_CONTRACT', requestId);
    var inputHash = DC.Security.documentHash(input);
    var issued = DC.Storage.withScriptLock(function () {
      var contract = DC.Storage.findRow(
        'CONTRACTS', 'issuanceRequestHash', requestHash
      );
      var duplicate = Boolean(contract);
      var snapshot;
      var hash;
      var now = DC.Storage.nowIso();
      if (!contract) {
        var contractId = DC.Storage.nextContractId();
        var expiry = isoAfterDays(Number(settings.CONTRACT_ACCEPTANCE_DAYS));
        snapshot = buildSnapshot(contractId, input, settings, now, expiry);
        hash = DC.Security.documentHash(snapshot);
        var provisional = contractRow(snapshot, hash, admin, settings);
        provisional.status = 'DRAFT';
        provisional.issuanceRequestHash = requestHash;
        provisional.issuanceInputHash = inputHash;
        provisional.issuanceStatus = 'STARTED';
        provisional.issuanceSnapshotJson = DC.Security.canonicalJson(snapshot);
        DC.Storage.appendObject('CONTRACTS', provisional);
        contract = DC.Storage.findRow('CONTRACTS', 'contractId', contractId);
        DC.Audit.append({
          contractId: contractId,
          eventType: 'ISSUE_STARTED',
          actorRole: 'ADMIN',
          previousStatus: '',
          nextStatus: 'DRAFT',
          requestIdHash: requestHash,
          safeMetadata: {
            inputHash: inputHash,
            contractType: input.contractType
          }
        });
      } else {
        if (String(contract.issuanceInputHash) !== inputHash) {
          throw new Error('같은 요청 식별자로 다른 계약 내용을 발행할 수 없습니다.');
        }
        snapshot = issuanceSnapshot(contract);
        hash = DC.Security.documentHash(snapshot);
        if (String(contract.documentHash) !== hash) {
          throw new Error('발행 복구 스냅샷의 무결성을 확인할 수 없습니다.');
        }
      }

      var termsFileId = contract.termsSnapshotFileId ||
        DC.Storage.savePrivateJsonOnce(
        DC.Config.KEYS.SNAPSHOT_FOLDER_ID,
        contract.contractId + '-terms.json',
        {
          versions: snapshot.versions,
          clauses: snapshot.clauses,
          privacyNotice: snapshot.privacyNotice,
          consentOfferSet: snapshot.consentOfferSet
        }
      );
      var snapshotFileId = contract.contractSnapshotFileId ||
        DC.Storage.savePrivateJsonOnce(
        DC.Config.KEYS.SNAPSHOT_FOLDER_ID,
        contract.contractId + '-contract.json',
        { documentHash: hash, contract: snapshot }
      );
      if (!contract.termsSnapshotFileId || !contract.contractSnapshotFileId) {
        DC.Storage.updateRow('CONTRACTS', contract.__rowNumber, {
          termsSnapshotFileId: termsFileId,
          contractSnapshotFileId: snapshotFileId,
          issuanceStatus: 'SNAPSHOT_READY',
          rowVersion: Number(contract.rowVersion || 0) + 1,
          lastUpdatedAt: now
        });
        contract = DC.Storage.findRow('CONTRACTS', 'contractId', contract.contractId);
      }

      if (String(contract.status) === 'DRAFT') {
        DC.Storage.updateRow('CONTRACTS', contract.__rowNumber, {
          status: 'ISSUED',
          issuanceStatus: 'READY_TO_INVITE',
          rowVersion: Number(contract.rowVersion || 0) + 1,
          lastUpdatedAt: now
        });
        contract = DC.Storage.findRow('CONTRACTS', 'contractId', contract.contractId);
      }
      DC.StateMachine.assertSignable(contract);

      var invitations = [];
      if (DC.StateMachine.isSignable(contract)) {
        var clientInvitation = claimInvitation(contract, snapshot, 'CLIENT', now);
        if (clientInvitation) invitations.push(clientInvitation);
        if (snapshot.contractMode === 'organization') {
          var sponsorInvitation = claimInvitation(contract, snapshot, 'SPONSOR', now);
          if (sponsorInvitation) invitations.push(sponsorInvitation);
        }
      }
      DC.Storage.updateRow('CONTRACTS', contract.__rowNumber, {
        issuanceStatus: 'COMPLETE',
        issuanceSnapshotJson: '',
        rowVersion: Number(contract.rowVersion || 0) + 1,
        lastUpdatedAt: now
      });
      if (!DC.Audit.findByRequestHash(requestHash, 'CONTRACT_ISSUED')) {
        DC.Audit.append({
          contractId: contract.contractId,
          eventType: 'CONTRACT_ISSUED',
          actorRole: 'ADMIN',
          previousStatus: 'DRAFT',
          nextStatus: 'ISSUED',
          requestIdHash: requestHash,
          safeMetadata: {
            signerCount: DC.StateMachine.requiredRoles(contract).length,
            contractType: snapshot.contractType
          }
        });
      }
      return {
        duplicate: duplicate,
        contractId: contract.contractId,
        invitations: invitations
      };
    });

    issued.invitations.forEach(function (invitation) {
      sendInvitationAndRecord_(issued.contractId, invitation.signerId, invitation.rawToken);
    });
    return {
      ok: true,
      duplicate: issued.duplicate,
      contractId: issued.contractId
    };
  }

  function sendInvitationAndRecord_(contractId, signerId, rawToken) {
    var signer = DC.Storage.findRow('SIGNERS', 'signerId', signerId);
    var contract = DC.Storage.findRow('CONTRACTS', 'contractId', contractId);
    var outcome;
    try {
      DC.StateMachine.assertSignable(contract);
      DC.MailService.sendIssued(contract, signer, rawToken);
      outcome = { success: true, code: 'SENT' };
    } catch (error) {
      outcome = { success: false, code: 'SEND_FAILED' };
    }
    DC.Storage.withScriptLock(function () {
      var current = DC.Storage.findRow('SIGNERS', 'signerId', signerId);
      if (!current) return;
      var now = DC.Storage.nowIso();
      var changes = {
        inviteDeliveryStatus: outcome.success ? 'SENT' : 'FAILED',
        inviteDeliveryAttemptCount: Number(current.inviteDeliveryAttemptCount || 0) + 1,
        inviteLastSentAt: outcome.success ? now : String(current.inviteLastSentAt || ''),
        inviteNextAttemptAt: '',
        rowVersion: Number(current.rowVersion || 0) + 1,
        lastUpdatedAt: now
      };
      if (!outcome.success) {
        changes.tokenStatus = 'REVOKED';
        changes.tokenRevokedAt = now;
        changes.inviteNextAttemptAt = new Date(
          Date.now() + invitationBackoff(changes.inviteDeliveryAttemptCount)
        ).toISOString();
      }
      DC.Storage.updateRow('SIGNERS', current.__rowNumber, changes);
      DC.Audit.append({
        contractId: contractId,
        signerId: signerId,
        eventType: outcome.success ? 'INVITATION_SENT' : 'INVITATION_SEND_FAILED',
        actorRole: 'SYSTEM',
        result: outcome.success ? 'SUCCESS' : 'FAILURE',
        detailCode: outcome.code
      });
    });
  }

  function retryPendingInvitations() {
    var claims = DC.Storage.withScriptLock(function () {
      var now = Date.now();
      var nowIso = new Date(now).toISOString();
      var recoveredClaims = [];
      DC.Storage.allRows('CONTRACTS')
        .filter(function (contract) {
          return DC.StateMachine.isSignable(contract) &&
            Boolean(contract.contractSnapshotFileId);
        })
        .slice(0, 20)
        .forEach(function (contract) {
          var roles = DC.StateMachine.requiredRoles(contract);
          var existingRoles = DC.Storage.findRows(
            'SIGNERS', 'contractId', contract.contractId
          ).map(function (signer) { return String(signer.signerRole); });
          var missingRoles = roles.filter(function (role) {
            return existingRoles.indexOf(role) === -1;
          });
          if (!missingRoles.length) return;
          var snapshot = loadSnapshot(contract);
          missingRoles.forEach(function (role) {
            var invitation = claimInvitation(
              contract,
              snapshot,
              role,
              nowIso
            );
            if (invitation) {
              recoveredClaims.push({
                contractId: contract.contractId,
                signerId: invitation.signerId,
                rawToken: invitation.rawToken
              });
            }
          });
          DC.Storage.updateRow('CONTRACTS', contract.__rowNumber, {
            issuanceStatus: 'COMPLETE',
            issuanceSnapshotJson: '',
            rowVersion: Number(contract.rowVersion || 0) + 1,
            lastUpdatedAt: nowIso
          });
          DC.Audit.append({
            contractId: contract.contractId,
            eventType: 'ISSUANCE_RECONCILED',
            actorRole: 'SYSTEM',
            detailCode: 'MISSING_SIGNER_ROLES_CREATED',
            safeMetadata: { signerRoles: missingRoles }
          });
        });
      var retryClaims = DC.Storage.allRows('SIGNERS')
        .filter(function (signer) {
          var status = String(signer.inviteDeliveryStatus);
          var nextAttempt = new Date(
            String(signer.inviteNextAttemptAt || '')
          ).getTime();
          var failedDue = status === 'FAILED' &&
            (!nextAttempt || isNaN(nextAttempt) || nextAttempt <= now);
          var claimedAt = new Date(String(signer.lastUpdatedAt || '')).getTime();
          var abandonedClaim = status === 'CLAIMED' &&
            (!claimedAt || isNaN(claimedAt) ||
             claimedAt + 10 * 60 * 1000 <= now);
          var abandonedPending = status === 'PENDING' &&
            (!claimedAt || isNaN(claimedAt) ||
             claimedAt + 10 * 60 * 1000 <= now);
          return String(signer.status) !== 'ACCEPTED' &&
            Number(signer.inviteDeliveryAttemptCount || 0) <
              INVITATION_MAX_ATTEMPTS &&
            (failedDue || abandonedClaim || abandonedPending);
        })
        .slice(0, 10)
        .map(function (signer) {
          var contract = DC.Storage.findRow(
            'CONTRACTS', 'contractId', signer.contractId
          );
          if (!DC.StateMachine.isSignable(contract)) return null;
          var rotated = DC.TokenService.rotate(
            contract.contractId, signer.signerRole
          );
          DC.Storage.updateRow('SIGNERS', rotated.signer.__rowNumber, {
            inviteDeliveryStatus: 'CLAIMED',
            inviteNextAttemptAt: '',
            rowVersion: Number(rotated.signer.rowVersion || 0) + 1,
            lastUpdatedAt: DC.Storage.nowIso()
          });
          return {
            contractId: contract.contractId,
            signerId: rotated.signer.signerId,
            rawToken: rotated.rawToken
          };
        })
        .filter(Boolean);
      return recoveredClaims.concat(retryClaims).slice(0, 20);
    });
    claims.forEach(function (claim) {
      sendInvitationAndRecord_(
        claim.contractId, claim.signerId, claim.rawToken
      );
    });
    return claims.length;
  }

  function resendInvitation(contractId, signerRole, requestId) {
    var admin = DC.Config.requireAdmin();
    DC.Config.requireIssuanceReady();
    var requestHash = DC.Security.hashIdempotency(
      admin, 'RESEND_INVITATION|' + contractId + '|' + signerRole, requestId
    );
    var rotated = DC.Storage.withScriptLock(function () {
      var previous = DC.Audit.findByRequestHash(requestHash, 'INVITATION_REISSUED');
      if (previous) return { duplicate: true };
      var result = DC.TokenService.rotate(contractId, signerRole);
      DC.Storage.updateRow('SIGNERS', result.signer.__rowNumber, {
        inviteDeliveryStatus: 'CLAIMED',
        inviteNextAttemptAt: '',
        rowVersion: Number(result.signer.rowVersion || 0) + 1,
        lastUpdatedAt: DC.Storage.nowIso()
      });
      DC.Audit.append({
        contractId: contractId,
        signerId: result.signer.signerId,
        eventType: 'INVITATION_REISSUED',
        actorRole: 'ADMIN',
        requestIdHash: requestHash,
        detailCode: 'TOKEN_ROTATED_BEFORE_RESEND'
      });
      return {
        duplicate: false,
        rawToken: result.rawToken,
        signerId: result.signer.signerId
      };
    });
    if (rotated.duplicate) return { ok: true, duplicate: true, contractId: contractId };
    sendInvitationAndRecord_(contractId, rotated.signerId, rotated.rawToken);
    return { ok: true, duplicate: false, contractId: contractId };
  }

  function loadSnapshot(contract) {
    if (!contract || !contract.contractSnapshotFileId) {
      throw new Error('계약 원문을 찾을 수 없습니다.');
    }
    var wrapper = DC.Storage.readJsonFile(String(contract.contractSnapshotFileId));
    if (!wrapper || !wrapper.contract || !wrapper.documentHash) {
      throw new Error('계약 원문 형식이 올바르지 않습니다.');
    }
    var computed = DC.Security.documentHash(wrapper.contract);
    if (!DC.Security.constantTimeEqual(computed, String(contract.documentHash)) ||
        !DC.Security.constantTimeEqual(computed, String(wrapper.documentHash))) {
      throw new Error('계약 원문 무결성 검증에 실패했습니다.');
    }
    return wrapper.contract;
  }

  function terminate(contractId, reasonCode, requestId) {
    var admin = DC.Config.requireAdmin();
    var safeReasonCode = DC.Validation.text(
      reasonCode, '종료 사유 코드', { required: true, max: 80 }
    );
    if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,79}$/.test(safeReasonCode)) {
      throw new Error('종료 사유 코드는 영문·숫자와 ._-만 사용할 수 있습니다.');
    }
    var requestHash = DC.Security.hashIdempotency(
      admin, 'TERMINATE|' + contractId, requestId
    );
    DC.OtpService.reconcilePendingAcceptances(contractId);
    return DC.Storage.withScriptLock(function () {
      if (DC.Audit.findByRequestHash(requestHash, 'CONTRACT_TERMINATED')) {
        return { ok: true, duplicate: true, contractId: contractId };
      }
      var contract = DC.Storage.findRow('CONTRACTS', 'contractId', contractId);
      if (!contract) throw new Error('계약을 찾을 수 없습니다.');
      var signers = DC.Storage.findRows('SIGNERS', 'contractId', contractId);
      var hasPendingIntent = signers.some(function (signer) {
        return ['STARTED', 'SIGNER_ACCEPTED'].indexOf(
          String(signer.acceptanceStage)
        ) !== -1 && Boolean(signer.pendingAcceptanceJson);
      });
      if (hasPendingIntent) {
        throw new Error(
          '선행 전자확인 기록을 복구하는 동안에는 계약을 종료할 수 없습니다.'
        );
      }
      DC.StateMachine.assertTransition(String(contract.status), 'TERMINATED');
      var now = DC.Storage.nowIso();
      DC.Storage.updateRow('CONTRACTS', contract.__rowNumber, {
        status: 'TERMINATED',
        serviceStatus: 'TERMINATED',
        terminatedAt: now,
        retentionDueAt: retentionDueFrom(
          DC.Storage.getSettingsMap(),
          now
        ),
        rowVersion: Number(contract.rowVersion || 0) + 1,
        lastUpdatedAt: now
      });
      signers.forEach(function (signer) {
        if (String(signer.status) !== 'ACCEPTED') {
          DC.Storage.updateRow('SIGNERS', signer.__rowNumber, {
            status: 'REVOKED',
            tokenStatus: 'REVOKED',
            tokenRevokedAt: now,
            rowVersion: Number(signer.rowVersion || 0) + 1,
            lastUpdatedAt: now
          });
        }
      });
      DC.Audit.append({
        contractId: contractId,
        eventType: 'CONTRACT_TERMINATED',
        actorRole: 'ADMIN',
        previousStatus: contract.status,
        nextStatus: 'TERMINATED',
        requestIdHash: requestHash,
        detailCode: safeReasonCode
      });
      return { ok: true, duplicate: false, contractId: contractId };
    });
  }

  function issueDefaults() {
    DC.Config.requireAdmin();
    var settings = DC.Storage.getSettingsMap();
    return {
      paymentMethod: settings.PAYMENT_METHOD_DEFAULT || '',
      cancellationPolicy: settings.CANCELLATION_POLICY_DEFAULT || '',
      noShowPolicy: settings.NO_SHOW_POLICY_DEFAULT || '',
      refundPolicy: settings.REFUND_POLICY_DEFAULT || ''
    };
  }

  return Object.freeze({
    consentOfferSet: consentOfferSet,
    issue: issue,
    resendInvitation: resendInvitation,
    retryPendingInvitations: retryPendingInvitations,
    loadSnapshot: loadSnapshot,
    terminate: terminate,
    issueDefaults: issueDefaults
  });
})();
