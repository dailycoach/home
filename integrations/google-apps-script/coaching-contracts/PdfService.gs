var DC = DC || {};

DC.PdfService = (function () {
  var TEMPLATE_MARKERS = Object.freeze([
    '{{DC_BRAND}}',
    '{{DC_TITLE}}',
    '{{DC_NOTICE}}',
    '{{DC_TEMPLATE_VERSION}}',
    '{{DC_CONTENT}}'
  ]);

  function templateId(type) {
    var keys = {
      life: DC.Config.KEYS.TEMPLATE_LIFE_ID,
      business: DC.Config.KEYS.TEMPLATE_BUSINESS_ID,
      career: DC.Config.KEYS.TEMPLATE_CAREER_ID
    };
    if (!keys[type]) throw new Error('지원하지 않는 계약 유형입니다.');
    var id = DC.Config.getProperty(keys[type]);
    if (!id) throw new Error('계약서 템플릿 설정이 누락되었습니다.');
    return id;
  }

  function money(value) {
    var text = String(Math.round(Number(value || 0)));
    return '₩' + text.replace(/\B(?=(\d{3})+(?!\d))/g, ',') +
      ' (' + text.replace(/\B(?=(\d{3})+(?!\d))/g, ',') + '원)';
  }

  function appendKeyValueTable(body, rows) {
    var table = body.appendTable();
    rows.forEach(function (row) {
      var cells = table.appendTableRow();
      cells.appendTableCell(String(row[0]));
      cells.appendTableCell(String(row[1] == null ? '' : row[1]));
    });
    return table;
  }

  function typeLabel(type) {
    return { life: '라이프', business: '비즈니스', career: '커리어' }[type] || type;
  }

  function consentLabel(value) {
    return {
      NOT_OFFERED: '제시하지 않음',
      NOT_APPLICABLE: '해당 없음',
      DECLINED: '동의하지 않음',
      ACCEPTED: '동의함'
    }[String(value)] || '기록 없음';
  }

  function validateTemplateBody(body) {
    var text = String(body.getText());
    TEMPLATE_MARKERS.forEach(function (marker) {
      var count = text.split(marker).length - 1;
      if (count !== 1) {
        throw new Error('TEMPLATE_MARKER_INVALID:' + marker);
      }
    });
    return true;
  }

  function validateTemplateFile(fileId) {
    return validateTemplateBody(DocumentApp.openById(String(fileId)).getBody());
  }

  function mergeTemplateHeader(body, contract, snapshot, sponsorReceipt) {
    validateTemplateBody(body);
    body.replaceText('\\{\\{DC_BRAND\\}\\}', 'DAILYCOACHING');
    body.replaceText(
      '\\{\\{DC_TITLE\\}\\}',
      typeLabel(snapshot.contractType) + ' 코칭계약서'
    );
    body.replaceText(
      '\\{\\{DC_NOTICE\\}\\}',
      '계약번호 ' + snapshot.contractId
    );
    body.replaceText(
      '\\{\\{DC_TEMPLATE_VERSION\\}\\}',
      '계약서 버전 ' + contract.termsVersion +
        (sponsorReceipt ? ' · 스폰서 수령본' : ' · 고객·운영본')
    );
    var markerParagraph = body.getParagraphs().filter(function (paragraph) {
      return paragraph.getText() === '{{DC_CONTENT}}';
    })[0];
    if (!markerParagraph) throw new Error('TEMPLATE_CONTENT_MARKER_MISSING');
    body.removeChild(markerParagraph);
  }

  function renderContractDocument(contract, snapshot, signers, consents, renderOptions) {
    var options = renderOptions || {};
    var sponsorReceipt = String(options.recipientRole || '') === 'SPONSOR';
    var sponsorGoalShared = sponsorReceipt &&
      snapshot.informationSharing &&
      snapshot.informationSharing.sponsor &&
      snapshot.informationSharing.sponsor.agreedGoals === true &&
      (consents || []).some(function (consent) {
        return String(consent.signerRole) === 'CLIENT' &&
          String(consent.sponsorProvisionStatus) === 'ACCEPTED' &&
          String(consent.sponsorProvidedItems).split(/\s*,\s*/)
            .indexOf('합의된 전체 목표') !== -1;
      });
    var sourceFile = DriveApp.getFileById(templateId(String(contract.contractType)));
    var folder = DriveApp.getFolderById(
      DC.Config.getProperty(DC.Config.KEYS.DOCUMENT_FOLDER_ID)
    );
    var copied = sourceFile.makeCopy(
      contract.contractId + (sponsorReceipt
        ? '-coaching-contract-sponsor-copy'
        : '-coaching-contract'),
      folder
    );
    try {
      try {
        copied.setSharing(DriveApp.Access.PRIVATE, DriveApp.Permission.NONE);
        if (copied.getSharingAccess() !== DriveApp.Access.PRIVATE) {
          throw new Error('PRIVATE_NOT_APPLIED');
        }
      } catch (error) {
        copied.setTrashed(true);
        throw new Error('계약 문서를 비공개로 고정할 수 없어 생성을 중단했습니다.');
      }
    var document = DocumentApp.openById(copied.getId());
    var body = document.getBody();
    mergeTemplateHeader(body, contract, snapshot, sponsorReceipt);
    body.appendParagraph(
      '본 계약서는 ICF 윤리강령, 한국코치협회 윤리규정 및 국내 관련 법령의 ' +
      '주요 원칙을 참고하여 DAILYCOACHING의 실제 코칭 운영에 맞게 구성했습니다. ' +
      'ICF 또는 한국코치협회가 승인·인증한 계약서가 아닙니다.'
    );
    if (sponsorReceipt) {
      body.appendParagraph(
        sponsorGoalShared
          ? '스폰서 수령본 · 고객이 별도 확인한 합의된 목표를 포함하며 휴대전화번호는 포함하지 않습니다.'
          : '스폰서 수령본 · 고객 휴대전화번호와 비공유 코칭 목표는 포함하지 않습니다.'
      );
    }
    body.appendHorizontalRule();

    body.appendParagraph('계약 당사자')
      .setHeading(DocumentApp.ParagraphHeading.HEADING1);
    var parties = [
      ['제공자', snapshot.provider.serviceName],
      ['대표자', snapshot.provider.representative],
      ['담당 코치', snapshot.provider.coachName + ' · ' + snapshot.provider.coachCredential],
      ['사업자등록번호', snapshot.provider.businessRegistrationNumber],
      ['사업장 주소', snapshot.provider.address],
      ['제공자 연락처', snapshot.provider.phone],
      ['제공자 이메일', snapshot.provider.email],
      ['과세·면세 안내', snapshot.provider.taxNotice],
      ['분쟁 관할 또는 사업장 소재지', snapshot.provider.jurisdiction],
      ['고객', snapshot.parties.client.name],
      ['고객 이메일', snapshot.parties.client.email],
      ['고객 계약상 역할', snapshot.parties.client.role]
    ];
    if (snapshot.parties.client.organization) {
      parties.push(['고객 소속', snapshot.parties.client.organization]);
    }
    if (snapshot.parties.client.title) {
      parties.push(['고객 직책', snapshot.parties.client.title]);
    }
    if (!sponsorReceipt && snapshot.parties.client.phone) {
      parties.push(['고객 휴대전화번호', snapshot.parties.client.phone]);
    }
    if (snapshot.parties.sponsor) {
      parties.push(['스폰서', snapshot.parties.sponsor.name]);
      parties.push(['스폰서 조직', snapshot.parties.sponsor.organization]);
      parties.push(['스폰서 이메일', snapshot.parties.sponsor.email]);
    }
    appendKeyValueTable(body, parties);
    appendKeyValueTable(body, [
      ['계약 발행 일시', snapshot.issuedAt],
      ['전자계약 완료 일시', contract.completedAt]
    ]);

    body.appendParagraph('코칭 조건')
      .setHeading(DocumentApp.ParagraphHeading.HEADING1);
    appendKeyValueTable(body, [
      ['코칭 유형', typeLabel(snapshot.contractType)],
      ['코칭 목적', snapshot.coaching.purpose],
      ['코칭 목표', sponsorReceipt
        ? (sponsorGoalShared
          ? snapshot.coaching.goalSummary
          : '스폰서와 공유하지 않는 코칭 목표입니다.')
        : snapshot.coaching.goalSummary],
      ['전체 회기', snapshot.coaching.sessions + '회'],
      ['회기당 시간', snapshot.coaching.sessionMinutes + '분'],
      ['진행기간', snapshot.coaching.startDate + ' ~ ' + snapshot.coaching.endDate],
      ['진행방식', snapshot.coaching.deliveryMode],
      ['장소·화상도구', snapshot.coaching.deliveryLocation],
      ['총 계약금액', money(snapshot.payment.totalFee)],
      ['회기당 금액', money(snapshot.payment.perSessionFee)],
      ['결제방법', snapshot.payment.paymentMethod],
      ['결제일정', snapshot.payment.paymentSchedule],
      ['일정변경·취소', snapshot.payment.cancellationPolicy],
      ['노쇼', snapshot.payment.noShowPolicy],
      ['중도종료·환불', snapshot.payment.refundPolicy]
    ]);

    if (snapshot.contractMode === 'organization') {
      var sharing = snapshot.informationSharing.sponsor;
      body.appendParagraph('조직 스폰서 정보공유 범위')
        .setHeading(DocumentApp.ParagraphHeading.HEADING1);
      appendKeyValueTable(body, [
        ['코칭 참여 여부', sharing.attendance ? '공유' : '비공유'],
        ['일정·진행률', sharing.scheduleProgress ? '공유' : '비공유'],
        ['합의된 전체 목표', sharing.agreedGoals ? '공유' : '비공유'],
        ['세션의 구체적인 대화', '비공유'],
        ['개인적인 감정·고민', '비공유'],
        ['종료 요약', sharing.closingSummary ? '합의 범위에서 공유' : '비공유'],
        ['위기·법적 의무 관련 정보', '필요한 최소 범위']
      ]);
      var provision = snapshot.informationSharing.provisionNotice;
      body.appendParagraph('스폰서 정보 제공 안내')
        .setHeading(DocumentApp.ParagraphHeading.HEADING2);
      appendKeyValueTable(body, [
        ['제공받는 자', provision.recipient],
        ['제공 목적', provision.purpose],
        ['선택 제공항목', provision.providedItems.length
          ? provision.providedItems.join(', ')
          : '선택한 제공 항목 없음'],
        ['보유·이용기간', provision.retention],
        ['거부 안내', provision.refusalNotice],
        ['항상 제외되는 정보', provision.alwaysExcluded.join(', ')],
        ['안내 버전', provision.version]
      ]);
    }

    body.appendPageBreak();
    body.appendParagraph('계약 조항')
      .setHeading(DocumentApp.ParagraphHeading.HEADING1);
    snapshot.clauses.forEach(function (clause, index) {
      body.appendParagraph((index + 1) + '. ' + clause.title)
        .setHeading(DocumentApp.ParagraphHeading.HEADING2);
      body.appendParagraph('핵심 요약 · ' + clause.summary);
      body.appendParagraph(clause.text);
    });

    body.appendPageBreak();
    body.appendParagraph('개인정보 처리 안내')
      .setHeading(DocumentApp.ParagraphHeading.HEADING1);
    var privacy = JSON.parse(JSON.stringify(snapshot.privacyNotice));
    if (sponsorReceipt) {
      privacy.items = String(privacy.items || '').replace(/,\s*휴대전화번호/g, '');
      privacy.requiredItems = String(privacy.requiredItems || '')
        .replace(/,\s*휴대전화번호/g, '');
    }
    appendKeyValueTable(body, [
      ['처리 목적', privacy.purpose],
      ['필수 처리항목', privacy.requiredItems],
      ['선택 처리항목', privacy.optionalItems],
      ['처리 근거', privacy.basis],
      ['보유기간', privacy.retention],
      ['파기방법', privacy.destruction],
      ['문의처', privacy.contact],
      ['고객의 권리와 요청방법', privacy.rights],
      ['필수항목 미제공 영향', privacy.requiredRefusalEffect],
      ['선택항목 거부 영향', privacy.optionalRefusalEffect],
      ['Google 처리위탁 수탁자', privacy.processor.recipient],
      ['처리위탁 목적', privacy.processor.purpose],
      ['처리위탁 항목', privacy.processor.items],
      ['처리위탁 보유기간', privacy.processor.retention],
      ['국외 이전받는 자', privacy.crossBorder.recipient],
      ['이전 국가·위치', privacy.crossBorder.country],
      ['이전 일시·방법', privacy.crossBorder.method],
      ['국외 이전 목적', privacy.crossBorder.purpose],
      ['국외 이전 항목', privacy.crossBorder.items],
      ['국외 보유기간', privacy.crossBorder.retention]
    ]);
    body.appendParagraph(privacy.sensitiveDataWarning);
    body.appendParagraph(snapshot.sessionProcessingStatement);
    if (!sponsorReceipt) {
      var consentNoticeLabels = {
        recordingStatus: '코칭 세션 녹음',
        transcriptionStatus: '음성 전사',
        aiSummaryStatus: 'AI 요약',
        researchUseStatus: '연구자료 활용',
        anonymousCaseUseStatus: '익명 사례 활용',
        testimonialPublicityStatus: '후기·홍보 활용',
        marketingEmailStatus: '마케팅 이메일',
        marketingSmsStatus: '마케팅 문자',
        thirdPartyTransferStatus: '제3자 자료 전달'
      };
      Object.keys(snapshot.consentNotices || {}).forEach(function (key) {
        var notice = snapshot.consentNotices[key];
        body.appendParagraph((consentNoticeLabels[key] || key) + ' 선택동의 안내')
          .setHeading(DocumentApp.ParagraphHeading.HEADING2);
        appendKeyValueTable(body, [
          ['목적', notice.purpose],
          ['항목·처리범위', notice.scope],
          ['도구·수탁자·제공받는 자', notice.provider],
          ['보유·이용기간', notice.retention],
          ['안내 버전', notice.version]
        ]);
      });
    }

    body.appendParagraph('전자확인 기록')
      .setHeading(DocumentApp.ParagraphHeading.HEADING1);
    signers.sort(function (a, b) {
      return String(a.signerRole).localeCompare(String(b.signerRole));
    }).forEach(function (signer) {
      body.appendParagraph(
        String(signer.signerRole) + ' · ' + String(signer.signerName)
      ).setHeading(DocumentApp.ParagraphHeading.HEADING2);
      appendKeyValueTable(body, [
        ['확인 일시', signer.acceptedAt],
        ['확인 버전', signer.acceptanceVersion],
        ['확인한 서명자 열람본 해시', signer.acceptedDocumentHash],
        ['열람본의 원계약 해시', signer.acceptedSourceDocumentHash],
        ['전자확인 증거 해시', signer.acceptanceEvidenceHash]
      ]);
      var consent = consents.filter(function (entry) {
        return String(entry.signerId) === String(signer.signerId);
      })[0];
      if (consent) {
        var consentRows = [];
        if (!sponsorReceipt && String(signer.signerRole) === 'CLIENT') {
          function consentResult(label, key, value) {
            var notice = snapshot.consentNotices &&
              snapshot.consentNotices[key];
            return [
              label + (notice ? ' · 안내 ' + notice.version : ''),
              consentLabel(value)
            ];
          }
          consentRows = [
            consentResult('세션 녹음', 'recordingStatus', consent.recordingStatus),
            consentResult('음성 전사', 'transcriptionStatus', consent.transcriptionStatus),
            consentResult('AI 요약', 'aiSummaryStatus', consent.aiSummaryStatus),
            consentResult('연구 활용', 'researchUseStatus', consent.researchUseStatus),
            consentResult(
              '익명 사례 활용',
              'anonymousCaseUseStatus',
              consent.anonymousCaseUseStatus
            ),
            consentResult(
              '후기·홍보 활용',
              'testimonialPublicityStatus',
              consent.testimonialPublicityStatus
            ),
            consentResult(
              '마케팅 이메일',
              'marketingEmailStatus',
              consent.marketingEmailStatus
            ),
            consentResult(
              '마케팅 문자',
              'marketingSmsStatus',
              consent.marketingSmsStatus
            ),
            consentResult(
              '제3자 자료 전달',
              'thirdPartyTransferStatus',
              consent.thirdPartyTransferStatus
            )
          ];
        }
        consentRows = consentRows.concat([
          ['조직 스폰서 제공 동의', consentLabel(consent.sponsorProvisionStatus)],
          ['스폰서 제공받는 자', consent.sponsorProvisionRecipient],
          ['스폰서 제공 목적', consent.sponsorProvisionPurpose],
          ['스폰서 제공 선택항목', consent.sponsorProvidedItems],
          ['스폰서 제공 보유기간', consent.sponsorProvisionRetention],
          ['스폰서 제공 안내 버전', consent.sponsorRefusalNoticeVersion],
          ['스폰서 제공 확인시각', consent.sponsorProvisionConfirmedAt]
        ]);
        appendKeyValueTable(body, consentRows);
      }
    });

    body.appendParagraph('무결성 정보')
      .setHeading(DocumentApp.ParagraphHeading.HEADING1);
    appendKeyValueTable(body, [
      ['계약내용 SHA-256', contract.documentHash],
      ['전자확인 증거 SHA-256', contract.acceptanceEvidenceHash],
      ['계약서 버전', contract.termsVersion],
      ['발행 표시', 'DAILYCOACHING 전자계약 발행본']
    ]);
    body.appendParagraph(
      'PDF 파일 자체의 SHA-256은 파일 생성 후 별도 전자기록에 보관됩니다.'
    );
    document.saveAndClose();
    return copied.getId();
    } catch (error) {
      try {
        copied.setTrashed(true);
      } catch (cleanupError) {
        try {
          DC.Audit.append({
            contractId: contract.contractId,
            eventType: 'ORPHAN_ASSET_CLEANUP_FAILED',
            actorRole: 'SYSTEM',
            result: 'FAILURE',
            detailCode: 'DOCUMENT_RENDER_FAILED',
            safeMetadata: { fileIds: [copied.getId()] }
          });
        } catch (ignored) {
          // 정리 실패 자체를 호출자에게 전달하는 것이 우선이다.
        }
        throw new Error('PDF_GENERATION_CLEANUP_FAILED');
      }
      throw error;
    }
  }

  function generate(contract, snapshot, signers, consents) {
    var result = {};
    try {
      result.docFileId = renderContractDocument(
        contract,
        snapshot,
        signers,
        consents
      );
      var docFile = DriveApp.getFileById(result.docFileId);
      var pdfBlob = docFile.getAs(MimeType.PDF)
        .setName(contract.contractId + '-coaching-contract.pdf');
      var pdfFolder = DriveApp.getFolderById(
        DC.Config.getProperty(DC.Config.KEYS.PDF_FOLDER_ID)
      );
      var pdfFile = pdfFolder.createFile(pdfBlob);
      result.pdfFileId = pdfFile.getId();
      try {
        pdfFile.setSharing(DriveApp.Access.PRIVATE, DriveApp.Permission.NONE);
        if (pdfFile.getSharingAccess() !== DriveApp.Access.PRIVATE) {
          throw new Error('PRIVATE_NOT_APPLIED');
        }
      } catch (error) {
        throw new Error('계약 PDF를 비공개로 고정할 수 없어 생성을 중단했습니다.');
      }
      var finalBlob = pdfFile.getBlob();
      result.pdfHash = DC.Security.sha256Hex(finalBlob.getBytes());
      result.pdfGeneratedAt = DC.Storage.nowIso();

      if (snapshot.contractMode === 'organization') {
        result.sponsorDocFileId = renderContractDocument(
          contract,
          snapshot,
          signers,
          consents,
          { recipientRole: 'SPONSOR' }
        );
        var sponsorPdfBlob = DriveApp.getFileById(result.sponsorDocFileId)
          .getAs(MimeType.PDF)
          .setName(contract.contractId + '-coaching-contract-sponsor-copy.pdf');
        var sponsorPdfFile = pdfFolder.createFile(sponsorPdfBlob);
        result.sponsorPdfFileId = sponsorPdfFile.getId();
        try {
          sponsorPdfFile.setSharing(DriveApp.Access.PRIVATE, DriveApp.Permission.NONE);
          if (sponsorPdfFile.getSharingAccess() !== DriveApp.Access.PRIVATE) {
            throw new Error('PRIVATE_NOT_APPLIED');
          }
        } catch (error) {
          throw new Error('스폰서 PDF를 비공개로 고정할 수 없어 생성을 중단했습니다.');
        }
        var sponsorFinalBlob = sponsorPdfFile.getBlob();
        result.sponsorPdfHash = DC.Security.sha256Hex(sponsorFinalBlob.getBytes());
        result.sponsorPdfGeneratedAt = DC.Storage.nowIso();
      }
      return result;
    } catch (error) {
      var cleanupFailures = discardGenerated(result);
      if (cleanupFailures.length) {
        try {
          DC.Audit.append({
            contractId: contract.contractId,
            eventType: 'ORPHAN_ASSET_CLEANUP_FAILED',
            actorRole: 'SYSTEM',
            result: 'FAILURE',
            detailCode: 'PDF_GENERATION_FAILED',
            safeMetadata: { fileIds: cleanupFailures }
          });
        } catch (ignored) {
          // 정리 실패 자체를 호출자에게 전달하는 것이 우선이다.
        }
        throw new Error('PDF_GENERATION_CLEANUP_FAILED');
      }
      throw error;
    }
  }

  function discardGenerated(generated) {
    var source = generated || {};
    var ids = [
      source.docFileId,
      source.pdfFileId,
      source.sponsorDocFileId,
      source.sponsorPdfFileId
    ].filter(function (fileId, index, all) {
      return fileId && all.indexOf(fileId) === index;
    });
    var failed = [];
    ids.forEach(function (fileId) {
      try {
        DriveApp.getFileById(String(fileId)).setTrashed(true);
      } catch (error) {
        failed.push(String(fileId));
      }
    });
    return failed;
  }

  function discardUnreferencedContractArtifacts(contract) {
    var contractId = String(contract && contract.contractId || '');
    if (!/^DC-\d{4}-\d{4,}$/.test(contractId)) {
      throw new Error('INVALID_CONTRACT_ID_FOR_CLEANUP');
    }
    var referenced = [
      contract.docFileId,
      contract.pdfFileId,
      contract.sponsorDocFileId,
      contract.sponsorPdfFileId
    ].filter(Boolean).map(String);
    var targets = [
      {
        folderId: DC.Config.getProperty(DC.Config.KEYS.DOCUMENT_FOLDER_ID),
        names: [
          contractId + '-coaching-contract',
          contractId + '-coaching-contract-sponsor-copy'
        ]
      },
      {
        folderId: DC.Config.getProperty(DC.Config.KEYS.PDF_FOLDER_ID),
        names: [
          contractId + '-coaching-contract.pdf',
          contractId + '-coaching-contract-sponsor-copy.pdf'
        ]
      }
    ];
    var result = { discarded: [], failed: [] };
    targets.forEach(function (target) {
      if (!target.folderId) throw new Error('ARTIFACT_FOLDER_NOT_CONFIGURED');
      var folder = DriveApp.getFolderById(String(target.folderId));
      target.names.forEach(function (name) {
        var files = folder.getFilesByName(name);
        while (files.hasNext()) {
          var file = files.next();
          var fileId = String(file.getId());
          if (referenced.indexOf(fileId) !== -1) continue;
          try {
            file.setTrashed(true);
            result.discarded.push(fileId);
          } catch (error) {
            result.failed.push(fileId);
          }
        }
      });
    });
    return result;
  }

  function blob(pdfFileId) {
    return DriveApp.getFileById(pdfFileId).getBlob();
  }

  function recipientBlob(contract, recipientRole) {
    if (String(recipientRole) !== 'SPONSOR') {
      return blob(String(contract.pdfFileId));
    }
    if (!contract.sponsorPdfFileId) {
      throw new Error('SPONSOR_PDF_NOT_READY');
    }
    return blob(String(contract.sponsorPdfFileId))
      .setName(contract.contractId + '-coaching-contract-sponsor-copy.pdf');
  }

  return Object.freeze({
    generate: generate,
    discardGenerated: discardGenerated,
    discardUnreferencedContractArtifacts: discardUnreferencedContractArtifacts,
    blob: blob,
    recipientBlob: recipientBlob,
    typeLabel: typeLabel,
    validateTemplateBody: validateTemplateBody,
    validateTemplateFile: validateTemplateFile
  });
})();
