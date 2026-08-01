(() => {
  "use strict";

  const api = window.ContractApi;
  const renderer = window.ContractRenderer;
  const validation = window.ContractValidation;

  const TYPE_LABELS = Object.freeze({ life: "라이프 코칭", business: "비즈니스 코칭", career: "커리어 코칭" });
  const ROLE_LABELS = Object.freeze({ coach: "코치", client: "고객", sponsor: "스폰서", organization_contact: "조직 담당자" });
  const CONSENT_LABELS = Object.freeze({
    session_recording: "세션 녹음",
    ai_assisted_summary: "AI 기반 요약",
    anonymized_case_use: "비식별 사례 활용",
    marketing_testimonial: "후기·홍보 활용"
  });

  const create = (tag, className, text) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = String(text);
    return node;
  };

  const appendText = (parent, tag, className, text) => {
    const node = create(tag, className, text);
    parent.append(node);
    return node;
  };

  const get = (object, paths, fallback = "") => {
    for (const path of paths) {
      const value = String(path).split(".").reduce((current, key) => current == null ? undefined : current[key], object);
      if (value !== undefined && value !== null && String(value).trim() !== "") return value;
    }
    return fallback;
  };

  const extractAndClearToken = parameter => {
    let token = "";
    try {
      const query = new URLSearchParams(window.location.search);
      token = query.get(parameter) || "";
      if (!token && window.location.hash.length > 1) {
        const fragment = window.location.hash.slice(1);
        const fragmentParams = new URLSearchParams(fragment);
        if (fragmentParams.has(parameter)) token = fragmentParams.get(parameter) || "";
        else if (!fragment.includes("=")) {
          try { token = decodeURIComponent(fragment); } catch { token = ""; }
        }
      }
    } finally {
      window.history.replaceState(null, document.title, window.location.pathname);
    }
    return token.trim();
  };

  const setStatus = (node, message, state = "") => {
    if (!node) return;
    node.textContent = message;
    node.dataset.state = state;
  };

  const addSummaryItem = (list, label, value) => {
    const wrapper = create("div");
    wrapper.append(create("dt", "", label), create("dd", "", value || "확인 전"));
    list.append(wrapper);
  };

  const safeSession = result => get(result, ["session_token", "sessionToken", "invite_session_token", "access_session_token", "final_document_session_token"]);
  const safeContractId = result => get(result, ["contract_id", "contractId", "summary.contract_id", "summary.contractId"]);

  const consentConfig = (snapshot, key) => {
    let technologyTerms = get(snapshot, ["technology_terms", "technologyTerms"], {});
    if (typeof technologyTerms === "string" && technologyTerms.length < 50000) {
      try { technologyTerms = JSON.parse(technologyTerms); } catch { technologyTerms = {}; }
    }
    const direct = get(snapshot, [
      `technology_terms.${key}`,
      `technologyTerms.${key}`,
      `canonical_document.terms.technology_terms.${key}`,
      `optional_consent_configuration.${key}`,
      `consent_availability.${key}`
    ], {}) || {};
    return { ...(technologyTerms?.[key] || {}), ...direct };
  };

  const isCompleteConfig = (key, config) => {
    if (config?.enabled !== true && config?.available !== true) return false;
    const required = {
      session_recording: ["purpose", "scope", "storage", "access", "retention", "deletion", "withdrawal"],
      ai_assisted_summary: ["service", "input_scope", "coverage", "human_review", "external_provider", "cross_border", "retention", "withdrawal"],
      anonymized_case_use: ["purpose", "scope", "media", "identifiers_removed", "reidentification_risk", "duration", "withdrawal"],
      marketing_testimonial: ["purpose", "channels", "duration", "withdrawal"]
    }[key] || [];
    return required.every(item => String(config[item] ?? "").trim().length > 0);
  };

  const configDetails = (key, config, definition) => {
    const labels = {
      purpose: "목적", scope: "대상·범위", storage: "보관 장소", access: "접근 가능자", retention: "보유기간", deletion: "삭제 시점", withdrawal: "철회 방법·이후 처리",
      service: "사용 도구·서비스", input_scope: "입력 정보 범위", coverage: "세션 전체/일부", human_review: "사람의 검토", external_provider: "외부 사업자 제공", cross_border: "국외 처리",
      media: "사용 매체", identifiers_removed: "제거할 식별정보", reidentification_risk: "재식별 위험", duration: "사용·공개 기간", channels: "공개 채널"
    };
    const ordered = {
      session_recording: ["purpose", "scope", "storage", "access", "retention", "deletion", "withdrawal"],
      ai_assisted_summary: ["service", "input_scope", "coverage", "human_review", "external_provider", "cross_border", "retention", "withdrawal"],
      anonymized_case_use: ["purpose", "media", "identifiers_removed", "reidentification_risk", "duration", "withdrawal"],
      marketing_testimonial: ["channels", "duration", "withdrawal"]
    }[key] || [];
    const details = ordered.map(item => `${labels[item]}: ${String(config[item] || "미설정")}`);
    if (key === "ai_assisted_summary") details.push("AI 결과에는 오류가 있을 수 있으며 코치가 책임 있게 검토해야 합니다.");
    const fromDefinition = definition?.details;
    if (Array.isArray(fromDefinition)) fromDefinition.forEach(item => details.push(typeof item === "string" ? item : item?.text || ""));
    return details.filter(Boolean);
  };

  const renderVerification = (app, summary, sessionToken, onVerified) => {
    const card = create("section", "app-card");
    card.setAttribute("aria-labelledby", "invite-summary-title");
    appendText(card, "p", "eyebrow", "STEP 01 · INVITATION");
    appendText(card, "h2", "", "초대받은 계약을 확인합니다.").id = "invite-summary-title";
    appendText(card, "p", "section-help", "아래 정보가 사전 협의 내용과 다르면 확인번호를 입력하지 말고 담당 코치에게 문의해 주세요.");
    const list = create("dl", "invite-summary");
    const type = get(summary, ["contract_type", "contractType"]);
    addSummaryItem(list, "계약 유형", TYPE_LABELS[type] || type || "코칭");
    addSummaryItem(list, "계약번호", get(summary, ["contract_number", "contractNumber"], "발행 완료 후 표시"));
    const signerRole = get(summary, ["signer_role", "signerRole", "current_party_role", "currentPartyRole"]);
    const signerHint = get(summary, ["signer_email_hint", "signerEmailHint", "party_display_name_masked", "partyNameMasked", "signer_masked"], "초대 수신자");
    addSummaryItem(list, "서명 당사자", signerRole ? `${ROLE_LABELS[signerRole] || signerRole} · ${signerHint}` : signerHint);
    addSummaryItem(list, "담당 코치", get(summary, ["coach_display_name", "coachDisplayName"], "초대 안내 확인"));
    addSummaryItem(list, "초대 만료", get(summary, ["expires_at", "expiresAt"], "발행 안내 확인"));
    card.append(list);

    const form = create("form", "pin-form");
    form.noValidate = true;
    form.autocomplete = "off";
    const wrapper = create("div", "field");
    const label = create("label", "", "일회용 확인번호");
    label.htmlFor = "invite-pin";
    const input = document.createElement("input");
    input.id = "invite-pin";
    input.name = "pin";
    input.type = "password";
    input.inputMode = "numeric";
    input.autocomplete = "one-time-code";
    input.minLength = 6;
    input.maxLength = 6;
    input.required = true;
    input.setAttribute("aria-describedby", "invite-pin-help invite-pin-error");
    wrapper.append(label, input);
    appendText(wrapper, "p", "field-help", "초대 링크와 별도로 전달받은 확인번호를 입력하세요.").id = "invite-pin-help";
    const errorNode = appendText(wrapper, "p", "field-error", "");
    errorNode.id = "invite-pin-error";
    errorNode.setAttribute("aria-live", "polite");
    const button = create("button", "primary-button", "본인 확인");
    button.type = "submit";
    form.append(wrapper, button);
    card.append(form);
    app.replaceChildren(card);

    form.addEventListener("submit", async event => {
      event.preventDefault();
      const pin = input.value.trim();
      if (!/^\d{6}$/.test(pin)) {
        errorNode.textContent = "6자리 확인번호를 입력해 주세요.";
        input.setAttribute("aria-invalid", "true");
        input.focus();
        return;
      }
      button.disabled = true;
      input.disabled = true;
      errorNode.textContent = "확인 중입니다.";
      try {
        const verified = await api.verifyInvite(sessionToken, pin);
        input.value = "";
        if (verified?.verified === false || verified?.identity_verified === false) throw new Error("확인번호가 일치하지 않습니다.");
        const nextSession = safeSession(verified) || sessionToken;
        const contractId = safeContractId(verified) || safeContractId(summary);
        if (!contractId) throw new Error("계약 식별 정보를 확인하지 못했습니다.");
        await onVerified({ sessionToken: nextSession, contractId, verification: verified });
      } catch (error) {
        input.value = "";
        input.disabled = false;
        button.disabled = false;
        input.setAttribute("aria-invalid", "true");
        errorNode.textContent = error.message || "본인 확인에 실패했습니다.";
        input.focus();
      }
    });
  };

  const makeConfirmation = (key, text, state, onChange) => {
    const label = create("label", "confirmation-item");
    const input = document.createElement("input");
    input.type = "checkbox";
    input.name = key;
    input.checked = false;
    input.addEventListener("change", () => { state.confirmations[key] = input.checked; onChange(); });
    label.append(input, document.createTextNode(text));
    return label;
  };

  const disclosureRow = (key, labelText, consentState) => {
    const wrapper = create("div", "choice-field full");
    appendText(wrapper, "span", "field-label", labelText);
    const row = create("div", "choice-row");
    [{ value: true, label: "공개" }, { value: false, label: "비공개" }].forEach(choice => {
      const label = create("label", "choice");
      const input = document.createElement("input");
      input.type = "radio";
      input.name = `marketing-${key}`;
      input.value = String(choice.value);
      input.addEventListener("change", () => { consentState.options[key] = choice.value; });
      label.append(input, document.createTextNode(choice.label));
      row.append(label);
    });
    wrapper.append(row);
    return wrapper;
  };

  const marketingOptions = consentState => {
    const panel = create("div", "marketing-options");
    panel.hidden = true;
    panel.dataset.marketingOptions = "";
    panel.append(
      disclosureRow("disclose_name", "이름 공개 여부", consentState),
      disclosureRow("disclose_photo", "사진 공개 여부", consentState),
      disclosureRow("disclose_organization", "소속 공개 여부", consentState),
      disclosureRow("disclose_testimonial_text", "후기 문구 공개 여부", consentState)
    );
    const channelWrapper = create("div", "choice-field full");
    appendText(channelWrapper, "span", "field-label", "공개 채널");
    const channelRow = create("div", "choice-row");
    [{ value: "website", label: "웹사이트" }, { value: "blog", label: "블로그" }, { value: "social_media", label: "소셜미디어" }, { value: "print", label: "인쇄 홍보물" }].forEach(item => {
      const label = create("label", "choice");
      const input = document.createElement("input");
      input.type = "checkbox";
      input.value = item.value;
      input.addEventListener("change", () => {
        const selected = new Set(consentState.options.publication_channels || []);
        input.checked ? selected.add(item.value) : selected.delete(item.value);
        consentState.options.publication_channels = [...selected];
      });
      label.append(input, document.createTextNode(item.label));
      channelRow.append(label);
    });
    channelWrapper.append(channelRow);
    panel.append(channelWrapper);
    const period = create("div", "field full");
    const periodLabel = create("label", "", "공개 기간");
    periodLabel.htmlFor = "marketing-publication-period";
    const periodInput = document.createElement("input");
    periodInput.id = "marketing-publication-period";
    periodInput.type = "text";
    periodInput.maxLength = 200;
    periodInput.autocomplete = "off";
    periodInput.placeholder = "예: 게시일로부터 1년";
    periodInput.addEventListener("input", () => { consentState.options.publication_period = periodInput.value.trim(); });
    period.append(periodLabel, periodInput);
    panel.append(period);
    return panel;
  };

  const consentCard = (definition, snapshot, state, options = {}) => {
    const key = definition.consentKey;
    const config = {
      enabled: definition.enabled,
      purpose: definition.purpose,
      scope: definition.scope,
      retention: definition.retention || definition.retentionPeriod,
      withdrawal: definition.withdrawal || definition.withdrawalMethod,
      storage: definition.storageLocation || definition.storage_location,
      access: definition.authorizedAccess || definition.authorized_access,
      deletion: definition.deletionTiming || definition.deletion_timing,
      service: definition.provider || definition.serviceName,
      input_scope: definition.scope,
      coverage: definition.sessionExtent || definition.sessionUsageScope,
      human_review: definition.humanReview,
      external_provider: definition.externalTransfer || definition.externalProviderTerms,
      cross_border: definition.overseasProcessing || definition.crossBorderProcessing,
      media: definition.media,
      identifiers_removed: definition.deIdentification || definition.identifiersRemoved,
      reidentification_risk: definition.reIdentificationRisk || definition.reidentificationRisk,
      duration: definition.usePeriod || definition.publicPeriod || definition.retention,
      channels: Array.isArray(definition.publicChannels) ? definition.publicChannels.join(", ") : definition.publicChannels,
      ...consentConfig(snapshot, key)
    };
    const interactive = options.interactive === true;
    const existingSelection = options.existingSelection || {};
    const configured = isCompleteConfig(key, config);
    const available = interactive && configured;
    const consentState = state.consents[key] = {
      accepted: interactive ? false : existingSelection.accepted === true,
      decided: !interactive || !available,
      available: configured,
      consent_text_version: get(definition, ["consent_text_version", "consentTextVersion", "text_version", "textVersion", "version"]),
      consent_text_hash: get(definition, ["consent_text_hash", "consentTextHash", "text_hash", "textHash"], null),
      options: key === "marketing_testimonial" ? {
        disclose_name: null,
        disclose_photo: null,
        disclose_organization: null,
        disclose_testimonial_text: null,
        publication_channels: [],
        publication_period: ""
      } : {}
    };

    const card = create("article", `consent-card${available ? "" : " consent-disabled"}`);
    appendText(card, "span", "consent-badge", interactive ? (available ? "선택 동의 · 기본 미동의" : "사용 안 함 · 미동의 기록") : "고객 선택 항목 · 읽기 전용");
    appendText(card, "h3", "", definition.title || definition.label || CONSENT_LABELS[key]);
    appendText(card, "p", "consent-description", definition.description || definition.summary || "이 항목은 기본 코칭 이용에 필수적이지 않습니다.");
    appendText(card, "p", "form-note", definition.consentText || definition.text || "표시된 목적·범위·보유기간과 철회 방법을 확인하고 이 항목을 선택합니다.");
    const details = create("ul", "consent-details");
    if (configured) configDetails(key, config, definition).forEach(item => appendText(details, "li", "", item));
    else appendText(details, "li", "", "운영 정보가 모두 설정되지 않아 이 기능은 사용할 수 없습니다.");
    card.append(details);

    if (!interactive) {
      appendText(card, "p", "form-note", existingSelection.accepted === true ? "고객 선택 결과: 동의" : existingSelection.accepted === false ? "고객 선택 결과: 미동의" : "고객 선택 결과는 아직 기록되지 않았습니다. 스폰서 또는 제3자는 대신 선택할 수 없습니다.");
      return card;
    }

    const choice = create("div", "consent-choice");
    const marketingPanel = key === "marketing_testimonial" ? marketingOptions(consentState) : null;
    [{ accepted: true, label: "동의합니다" }, { accepted: false, label: "동의하지 않습니다" }].forEach(option => {
      const label = document.createElement("label");
      const input = document.createElement("input");
      input.type = "radio";
      input.name = `consent-${key}`;
      input.value = String(option.accepted);
      input.disabled = !available;
      input.addEventListener("change", () => {
        consentState.accepted = option.accepted;
        consentState.decided = true;
        if (marketingPanel) marketingPanel.hidden = !option.accepted;
      });
      label.append(input, document.createTextNode(option.label));
      choice.append(label);
    });
    card.append(choice);
    if (marketingPanel) card.append(marketingPanel);
    const error = appendText(card, "p", "field-error", "");
    error.dataset.consentError = key;
    error.setAttribute("aria-live", "polite");
    return card;
  };

  const renderSigning = async (app, snapshotResponse, sessionToken, contractId, roleHint) => {
    const snapshot = snapshotResponse?.canonical_snapshot || snapshotResponse?.snapshot || snapshotResponse?.contract || snapshotResponse;
    const signerRole = get(snapshotResponse, ["signer_role", "signerRole", "current_party_role", "currentPartyRole", "party.role"], roleHint || "");
    if (!new Set(["client", "sponsor", "organization_contact"]).has(signerRole)) throw new Error("현재 서명자의 계약 역할을 확인하지 못해 서명을 차단했습니다.");
    const managesConsents = signerRole === "client";
    const snapshotHash = String(get(snapshotResponse, ["snapshot_hash", "snapshotHash", "document_hash", "documentHash"])).toLowerCase();
    const expectedVersion = Number(get(snapshotResponse, ["version_number", "versionNumber", "expected_version", "expectedVersion"]));
    if (!/^[a-f0-9]{64}$/.test(snapshotHash) || !Number.isInteger(expectedVersion) || expectedVersion < 1) {
      throw new Error("발행 스냅샷의 해시 또는 버전을 확인하지 못해 서명을 차단했습니다.");
    }
    const type = get(snapshot, ["contract_type", "contractType"], "life");
    const immutableClauses = get(snapshot, ["clauses"], null);
    const immutableConsents = get(snapshot, ["optional_consents", "optionalConsents", "consent_definitions", "consentDefinitions"], null);
    if (!Array.isArray(immutableClauses) || immutableClauses.length === 0 || !Array.isArray(immutableConsents) || immutableConsents.length !== 4) {
      throw new Error("발행 시점의 고정 계약 전문 또는 선택 동의 문구가 없어 서명을 차단했습니다.");
    }
    const state = { confirmations: { contract_read: false, important_terms: false, electronic_document: false }, consents: {}, signed_name: "", signature_intent: false };

    const documentCard = create("section", "app-card");
    appendText(documentCard, "p", "eyebrow", "STEP 02 · FULL AGREEMENT");
    appendText(documentCard, "h2", "", "계약 전문을 확인해 주세요.");
    appendText(documentCard, "p", "section-help", "긴 조항을 접어 숨기지 않았습니다. 위에서 아래까지 전문과 중요한 조건을 함께 확인합니다.");
    const documentRegion = create("div", "preview-region");
    renderer.renderSnapshot(documentRegion, snapshot, { summaryHeadingId: "sign-document-summary" });
    documentCard.append(documentRegion);

    const important = create("section", "important-summary");
    appendText(important, "h2", "", "중요 조항 요약");
    const importantList = document.createElement("ul");
    const summaryItems = [
      `현재 계약은 성인 고객 대상 ${TYPE_LABELS[type] || "코칭"} 계약입니다.`,
      `총 ${get(snapshot, ["session_count", "session.count"], "-")}회 · 회기당 ${get(snapshot, ["session_minutes", "session.minutes"], "-")}분 · ${get(snapshot, ["delivery_method", "session.delivery_method"], "진행 방식 확인")}`,
      `일정: ${get(snapshot, ["start_date", "period.start"], "-")}부터 ${get(snapshot, ["expected_end_date", "period.end"], "-")}까지`,
      `비용: ${get(snapshot, ["fee_amount", "fee.amount"], "-")} ${get(snapshot, ["fee_currency", "fee.currency"], "KRW")} · 지급·취소·환불 조건은 전문을 기준으로 합니다.`,
      "치료·취업·승진·매출 등 특정 결과를 보장하지 않습니다.",
      "녹음·AI·사례·후기 활용을 모두 거절해도 기본 코칭 계약을 체결할 수 있습니다."
    ];
    if (type === "business") summaryItems.push(`조직 보고 범위: ${get(snapshot, ["reporting_scope", "sponsor_terms.reporting_scope"], "출석·계약 진행 상태만")}. 세션 원문·노트·개인적 발언은 기본 공유 금지입니다.`);
    summaryItems.forEach(item => appendText(importantList, "li", "", item));
    important.append(importantList);

    const confirmations = create("section", "confirmations");
    appendText(confirmations, "p", "eyebrow", "STEP 03 · REQUIRED CONFIRMATIONS");
    appendText(confirmations, "h2", "", "필수 확인");
    appendText(confirmations, "p", "section-help", "필수 확인은 선택 동의와 다릅니다. 세 항목을 확인해야 서명 버튼이 활성화됩니다.");
    const confirmationList = create("div", "confirmation-list");
    let signButton;
    const updateSignButton = () => {
      if (!signButton) return;
      const confirmationsReady = Object.values(state.confirmations).every(Boolean);
      const marketing = state.consents.marketing_testimonial;
      const marketingReady = !marketing?.accepted || (
        ["disclose_name", "disclose_photo", "disclose_organization", "disclose_testimonial_text"].every(key => typeof marketing.options?.[key] === "boolean")
        && Object.values(marketing.options || {}).some(value => value === true)
        && Array.isArray(marketing.options?.publication_channels)
        && marketing.options.publication_channels.length > 0
        && String(marketing.options?.publication_period || "").trim().length > 0
      );
      const consentsReady = !managesConsents || (
        Object.keys(state.consents).length === 4
        && Object.values(state.consents).every(item => item.decided === true)
        && marketingReady
      );
      const identityReady = state.signed_name.length >= 2 && state.signature_intent === true;
      signButton.disabled = !(confirmationsReady && consentsReady && identityReady) || signButton.dataset.busy === "true";
    };
    confirmationList.append(
      makeConfirmation("contract_read", "계약 전문을 읽고 코칭 범위·당사자·비용·일정·변경·종료 조건을 확인했습니다.", state, updateSignButton),
      makeConfirmation("important_terms", "비밀보장과 예외, 기록·기술 사용, 결과 비보장, 중요 조건 요약을 확인했습니다.", state, updateSignButton),
      makeConfirmation("electronic_document", "전자문서로 계약이 체결되며 계약본 열람·저장·변경·해지 요청 방법을 확인했습니다.", state, updateSignButton)
    );
    confirmations.append(confirmationList);

    const consentSection = create("section", "consent-section");
    appendText(consentSection, "p", "eyebrow", "STEP 04 · OPTIONAL CONSENTS");
    appendText(consentSection, "h2", "", "선택 동의는 각각 결정합니다.");
    appendText(consentSection, "p", "section-help", managesConsents
      ? "초기값은 모두 미동의이며 어떤 체크도 미리 선택하지 않았습니다. 사용 가능한 항목마다 동의 또는 동의하지 않음을 직접 선택해 주세요."
      : "선택 동의는 실제 코칭 고객만 결정합니다. 스폰서·조직 담당자는 정책과 기록된 결과를 읽을 수 있지만 대신 선택할 수 없습니다.");
    const consentList = create("div", "consent-list");
    const recordedSelections = get(snapshotResponse, ["consent_selections", "consentSelections", "client_consents", "clientConsents"], []);
    const consentDefinitions = renderer.consentDefinitions(snapshot, null);
    if (managesConsents && consentDefinitions.some(definition => {
      const version = get(definition, ["consent_text_version", "consentTextVersion", "text_version", "textVersion", "version"]);
      const hash = String(get(definition, ["consent_text_hash", "consentTextHash", "text_hash", "textHash"])).toLowerCase();
      return !String(version).trim() || !/^[a-f0-9]{64}$/.test(hash);
    })) {
      throw new Error("고정된 선택 동의 문구의 버전 또는 해시가 없어 동의와 서명을 차단했습니다.");
    }
    consentDefinitions.forEach(definition => {
      const existingSelection = Array.isArray(recordedSelections)
        ? recordedSelections.find(item => (item.key || item.consent_key) === definition.consentKey) || {}
        : {};
      consentList.append(consentCard(definition, snapshot, state, { interactive: managesConsents, existingSelection }));
    });
    consentSection.append(consentList);

    const signature = create("section", "signature-section");
    appendText(signature, "p", "eyebrow", "STEP 05 · ELECTRONIC SIGNATURE");
    appendText(signature, "h2", "", "이름으로 전자서명합니다.");
    appendText(signature, "p", "section-help", "MVP에서는 서명 그림을 수집하지 않습니다. 본인 확인, 이름, 명시적 의사, 서명 시각과 문서 해시를 전자서명 증빙으로 기록합니다.");
    const signatureGrid = create("div", "signature-grid");
    const nameField = create("div", "field");
    const nameLabel = create("label", "", "서명자 이름");
    nameLabel.htmlFor = "signed-name";
    const nameInput = document.createElement("input");
    nameInput.id = "signed-name";
    nameInput.type = "text";
    nameInput.autocomplete = "name";
    nameInput.maxLength = 100;
    nameInput.addEventListener("input", () => { state.signed_name = nameInput.value.trim(); });
    const nameError = appendText(nameField, "p", "field-error", "");
    nameError.dataset.signError = "signed_name";
    nameField.append(nameLabel, nameInput, nameError);
    const intent = create("label", "confirmation-item");
    const intentInput = document.createElement("input");
    intentInput.type = "checkbox";
    intentInput.checked = false;
    intentInput.addEventListener("change", () => { state.signature_intent = intentInput.checked; });
    intent.append(intentInput, document.createTextNode("위 이름으로 이 계약에 전자서명할 의사가 있으며, 입력 내용이 본인의 의사와 일치함을 확인합니다."));
    signatureGrid.append(nameField, intent);
    signature.append(signatureGrid);
    appendText(signature, "p", "signature-disclosure", "전자문서로 계약이 체결됩니다. 모든 필수 당사자 서명이 완료되면 변경 불가능한 최종본이 생성되며, 안전한 만료 링크에서 열람하고 인쇄 또는 브라우저 PDF 저장을 할 수 있습니다.");
    const actions = create("div", "sign-actions");
    const signStatus = appendText(actions, "p", "", managesConsents
      ? "필수 확인, 네 가지 선택 동의 결정, 서명 이름과 전자서명 의사를 모두 입력하면 버튼이 활성화됩니다."
      : "필수 확인, 서명 이름과 전자서명 의사를 모두 입력하면 버튼이 활성화됩니다. 선택 동의는 고객의 결정을 변경하지 않습니다.");
    signStatus.setAttribute("role", "status");
    signStatus.setAttribute("aria-live", "polite");
    signButton = create("button", "primary-button", "확인하고 전자서명");
    signButton.type = "button";
    signButton.disabled = true;
    actions.append(signButton);
    signature.append(actions);

    app.replaceChildren(documentCard, important, confirmations, consentSection, signature);
    app.addEventListener("input", updateSignButton);
    app.addEventListener("change", updateSignButton);

    const clearSignErrors = () => {
      app.querySelectorAll("[data-consent-error], [data-sign-error]").forEach(node => { node.textContent = ""; });
      nameInput.removeAttribute("aria-invalid");
    };
    const showSignErrors = errors => {
      clearSignErrors();
      Object.entries(errors).forEach(([key, message]) => {
        if (key.startsWith("consent_")) {
          const consentKey = key.replace(/^consent_/, "");
          const target = app.querySelector(`[data-consent-error="${CSS.escape(consentKey)}"]`);
          if (target) target.textContent = message;
        } else if (key.startsWith("marketing_")) {
          const target = app.querySelector('[data-consent-error="marketing_testimonial"]');
          if (target) target.textContent = message;
        } else {
          const target = app.querySelector(`[data-sign-error="${CSS.escape(key)}"]`);
          if (target) target.textContent = message;
        }
      });
      if (errors.signed_name) { nameInput.setAttribute("aria-invalid", "true"); nameInput.focus(); }
      else {
        const firstConsent = Object.keys(errors).find(key => key.startsWith("consent_") || key.startsWith("marketing_"));
        if (firstConsent) consentSection.scrollIntoView({ block: "start" });
      }
    };

    signButton.addEventListener("click", async () => {
      const result = validation.validateSigning(state, { requireConsents: managesConsents });
      if (!result.valid) {
        showSignErrors(result.errors);
        setStatus(signStatus, "선택하지 않은 항목 또는 서명 정보를 확인해 주세요.", "error");
        return;
      }
      clearSignErrors();
      signButton.dataset.busy = "true";
      signButton.disabled = true;
      setStatus(signStatus, "선택 동의와 전자서명을 안전하게 제출하고 있습니다.");
      const consents = Object.entries(state.consents).map(([consentKey, item]) => ({
        consent_key: consentKey,
        accepted: item.accepted,
        consent_text_version: item.consent_text_version,
        consent_text_hash: item.consent_text_hash,
        options: consentKey === "marketing_testimonial" && item.accepted ? item.options : undefined
      }));
      try {
        if (managesConsents) await api.saveConsents(contractId, sessionToken, { consents });
        const signed = await api.signContract(contractId, sessionToken, {
          signed_name: state.signed_name,
          electronic_signature_intent: true,
          confirmations: {
            contract_read: true,
            important_terms: true,
            electronic_document: true
          },
          document_hash: snapshotHash,
          expected_version: expectedVersion
        });
        nameInput.value = "";
        state.signed_name = "";
        const finalToken = get(signed, ["final_access_token", "finalAccessToken"]);
        if (signed && typeof signed === "object") {
          delete signed.final_access_token;
          delete signed.finalAccessToken;
        }
        if (get(signed, ["status"]) === "fully_signed" && finalToken && api.isOpaqueToken(finalToken)) {
          window.location.replace(`/coaching/contracts/complete/#${encodeURIComponent(finalToken)}`);
          return;
        }
        renderSubmitted(app, signed, finalToken);
      } catch (error) {
        signButton.dataset.busy = "false";
        updateSignButton();
        setStatus(signStatus, error.message || "서명을 제출하지 못했습니다.", "error");
      }
    });
  };

  const renderSubmitted = (app, result, rawFinalToken = "") => {
    const fullySigned = result?.status === "fully_signed";
    const panel = create("section", "completion-panel");
    appendText(panel, "div", "completion-mark", "✓").setAttribute("aria-hidden", "true");
    appendText(panel, "h1", "", fullySigned ? "모든 필수 서명이 완료되었습니다." : "내 서명이 제출되었습니다.");
    appendText(panel, "p", "", fullySigned ? "최종 계약본 열람 링크는 안전한 전달 채널로 제공됩니다." : "다른 필수 당사자의 서명이 남아 있습니다. 모든 서명이 끝나기 전에는 최종 완료본이 생성되지 않습니다.");
    const details = create("dl", "invite-summary completion-details");
    addSummaryItem(details, "계약번호", get(result, ["contract_number", "contractNumber"], "확인 중"));
    addSummaryItem(details, "현재 상태", get(result, ["status"], "signature_submitted"));
    addSummaryItem(details, "제출 시각", get(result, ["signed_at", "signedAt"], "서버 기록 기준"));
    const submittedHash = get(result, ["snapshot_hash", "snapshotHash", "snapshot_hash_prefix", "snapshotHashPrefix", "snapshot_hash_partial", "documentHashPartial"]);
    addSummaryItem(details, "문서 해시", typeof submittedHash === "string" && submittedHash.length > 16 ? submittedHash.slice(0, 16) : submittedHash || "최종 완료 후 표시");
    panel.append(details);
    let pendingFinalToken = api.isOpaqueToken(rawFinalToken) ? rawFinalToken : "";
    if (!fullySigned && pendingFinalToken) {
      const delivery = create("div", "audit-summary no-print");
      appendText(delivery, "h2", "", "최종본 링크를 지금 한 번 복사하세요.");
      appendText(delivery, "p", "section-help", "이 링크는 모든 필수 당사자 서명이 완료된 뒤 사용할 수 있습니다. 공개 채널로 보내지 말고 비밀번호 관리자 등 본인이 통제하는 안전한 위치에 보관하세요. 이 사이트는 링크를 브라우저 저장소에 보관하지 않습니다.");
      const copyButton = create("button", "secondary-button", "최종본 링크 1회 복사");
      copyButton.type = "button";
      const copyStatus = appendText(delivery, "p", "status-line", "링크 원문은 화면에 표시하지 않습니다.");
      copyStatus.setAttribute("role", "status");
      copyStatus.setAttribute("aria-live", "polite");
      copyButton.addEventListener("click", async () => {
        if (!pendingFinalToken) return;
        const completeLink = `${window.location.origin}/coaching/contracts/complete/#${encodeURIComponent(pendingFinalToken)}`;
        try {
          await navigator.clipboard.writeText(completeLink);
          pendingFinalToken = "";
          copyButton.disabled = true;
          setStatus(copyStatus, "링크를 복사했고 이 페이지의 메모리에서 지웠습니다. 모든 서명 완료 후 사용하세요.", "success");
        } catch {
          setStatus(copyStatus, "보안 클립보드 사용이 허용되지 않았습니다. 담당 코치에게 완료 후 새 링크를 요청하세요.", "error");
        }
      }, { once: true });
      delivery.append(copyButton);
      panel.append(delivery);
    }
    appendText(panel, "p", "form-note", "최종 접근 토큰이 발급되지 않은 상태에서는 이 화면이 완료본을 대신하지 않습니다. 초대를 발행한 담당 코치에게 수령 방법을 확인해 주세요.");
    app.replaceChildren(panel);
  };

  const renderConsentWithdrawal = (panel, summary, manifest, sessionToken) => {
    if (get(summary, ["signer_role", "signerRole"]) !== "client" || !manifest) return;
    const current = get(summary, ["current_optional_consents", "currentOptionalConsents"], null);
    const records = Array.isArray(current) ? current : get(manifest, ["optional_consents", "optionalConsents"], []);
    const accepted = Array.isArray(records) ? records.filter(item => item?.accepted === true && !get(item, ["withdrawn_at", "withdrawnAt"])) : [];
    const contractId = get(summary, ["contract_id", "contractId"], get(manifest, ["contract_id", "contractId"]));
    if (!contractId || !accepted.length) return;
    const section = create("section", "consent-section no-print");
    appendText(section, "p", "eyebrow", "OPTIONAL CONSENT WITHDRAWAL");
    appendText(section, "h2", "", "선택 동의를 전자적으로 철회할 수 있습니다.");
    appendText(section, "p", "section-help", "철회해도 체결 당시 계약본은 바뀌지 않으며 철회 시각과 이력은 별도 기록됩니다. 이미 공개·처리된 범위는 계약 문구의 철회 안내를 따릅니다.");
    const list = create("div", "confirmation-list");
    accepted.forEach(item => {
      const key = get(item, ["consent_key", "consentKey", "key"]);
      if (!CONSENT_LABELS[key]) return;
      const label = create("label", "confirmation-item");
      const input = document.createElement("input");
      input.type = "checkbox";
      input.value = key;
      label.append(input, document.createTextNode(`${CONSENT_LABELS[key]} 동의를 철회합니다.`));
      list.append(label);
    });
    if (!list.childElementCount) return;
    const actions = create("div", "sign-actions");
    const status = appendText(actions, "p", "", "철회할 항목을 선택해 주세요.");
    status.setAttribute("role", "status");
    status.setAttribute("aria-live", "polite");
    const button = create("button", "danger-button", "선택 동의 철회 요청");
    button.type = "button";
    button.disabled = true;
    const update = () => { button.disabled = button.dataset.busy === "true" || ![...list.querySelectorAll("input")].some(input => input.checked && !input.disabled); };
    list.addEventListener("change", update);
    button.addEventListener("click", async () => {
      const selected = [...list.querySelectorAll("input")].filter(input => input.checked && !input.disabled);
      if (!selected.length || !window.confirm("선택한 동의를 철회할까요? 고정 계약본은 변경되지 않습니다.")) return;
      button.dataset.busy = "true";
      update();
      try {
        const response = await api.withdrawConsents(contractId, sessionToken, selected.map(input => input.value));
        selected.forEach(input => { input.checked = false; input.disabled = true; });
        setStatus(status, `철회 기록 완료 · ${get(response, ["withdrawn_at", "withdrawnAt"], "서버 기록 기준")}`, "success");
      } catch (error) {
        setStatus(status, error.message || "동의 철회 요청을 제출하지 못했습니다.", "error");
      } finally {
        button.dataset.busy = "false";
        update();
      }
    });
    actions.append(button);
    section.append(list, actions);
    panel.append(section);
  };

  const initSign = async () => {
    const app = document.querySelector("[data-sign-app]");
    const status = document.querySelector("[data-sign-status]");
    if (!app || !status) return;
    const rawToken = extractAndClearToken("invite");
    if (!api || !renderer || !validation) {
      setStatus(status, "계약 모듈을 불러오지 못해 서명 기능을 열지 않았습니다.", "error");
      return;
    }
    if (!api.isOpaqueToken(rawToken)) {
      setStatus(status, "유효한 초대 링크가 없습니다. 담당 코치가 보낸 새 링크를 사용해 주세요.", "error");
      return;
    }
    let tokenForExchange = rawToken;
    try {
      const exchanged = await api.exchangeInvite(tokenForExchange);
      tokenForExchange = "";
      const sessionToken = safeSession(exchanged);
      if (!api.isOpaqueToken(sessionToken)) throw new Error("초대 세션을 발급받지 못했습니다.");
      const summary = exchanged?.summary || await api.getInviteSummary(sessionToken);
      renderVerification(app, summary, sessionToken, async verified => {
        const snapshot = await api.getContractSnapshot(verified.contractId, verified.sessionToken);
        const roleHint = get(verified.verification, ["signer_role", "signerRole", "current_party_role", "currentPartyRole", "party.role"], get(summary, ["signer_role", "signerRole", "current_party_role", "currentPartyRole", "party.role"]));
        await renderSigning(app, snapshot, verified.sessionToken, verified.contractId, roleHint);
      });
    } catch (error) {
      tokenForExchange = "";
      setStatus(status, error.message || "초대 링크를 확인하지 못했습니다.", "error");
    }
  };

  const renderComplete = async (app, data, sessionToken) => {
    let finalManifest = data?.canonical_document || data?.canonicalDocument || null;
    const canonical = data?.canonical_snapshot || finalManifest?.canonical_snapshot || finalManifest?.canonicalSnapshot || {};
    const summary = data?.summary || data?.contract || (Object.keys(canonical).length ? {
      ...canonical,
      status: (data.fully_signed_at || finalManifest?.fully_signed_at) ? "fully_signed" : canonical.status_at_issue,
      fully_signed_at: data.fully_signed_at || finalManifest?.fully_signed_at,
      snapshot_hash_prefix: typeof (data.snapshot_hash || finalManifest?.snapshot_hash) === "string" ? (data.snapshot_hash || finalManifest.snapshot_hash).slice(0, 16) : ""
    } : data) || {};
    const status = get(summary, ["status"]);
    const fullySigned = status === "fully_signed";
    const panel = create("section", "completion-panel");
    appendText(panel, "div", "completion-mark", fullySigned ? "✓" : "i").setAttribute("aria-hidden", "true");
    appendText(panel, "h1", "", fullySigned ? "코칭계약이 완료되었습니다." : "계약 상태를 확인했습니다.");
    appendText(panel, "p", "", fullySigned ? "모든 필수 당사자의 서명이 끝나 최종 계약본이 고정되었습니다." : "모든 필수 당사자의 서명이 끝나기 전에는 최종 완료로 표시하지 않습니다.");
    const details = create("dl", "invite-summary completion-details");
    addSummaryItem(details, "완료 여부", fullySigned ? "모든 필수 서명 완료" : status || "확인 필요");
    addSummaryItem(details, "계약번호", get(summary, ["contract_number", "contractNumber"], "확인 중"));
    addSummaryItem(details, "계약 유형", TYPE_LABELS[get(summary, ["contract_type", "contractType"])] || get(summary, ["contract_type", "contractType"], "코칭"));
    addSummaryItem(details, "계약 버전", get(summary, ["version_number", "versionNumber", "template_version"], "v1"));
    addSummaryItem(details, "서명 완료 일시", get(summary, ["fully_signed_at", "fullySignedAt"], fullySigned ? "서버 기록 확인" : "아직 완료되지 않음"));
    const parties = get(summary, ["parties"], []);
    addSummaryItem(details, "참여 당사자", Array.isArray(parties) ? parties.map(party => party.display_name || party.displayName || party.role).filter(Boolean).join(" · ") : "계약본에서 확인");
    addSummaryItem(details, "문서 해시 일부", get(summary, ["snapshot_hash_prefix", "snapshotHashPrefix", "final_document_hash_prefix", "finalDocumentHashPrefix", "snapshot_hash_partial", "document_hash_partial", "documentHashPartial"], "계약본에서 확인"));
    panel.append(details);

    const actions = create("div", "completion-actions no-print");
    const printButton = create("button", "primary-button", "인쇄 또는 PDF 저장");
    printButton.type = "button";
    printButton.disabled = !fullySigned;
    printButton.addEventListener("click", () => window.print());
    const requestLink = create("a", "secondary-button", "계약 변경·해지 요청 이메일");
    requestLink.href = "mailto:hello@daily-coach-ing.com";
    requestLink.rel = "nofollow";
    actions.append(printButton, requestLink);
    panel.append(actions);
    appendText(panel, "p", "form-note", "변경·해지·선택 동의 철회는 계약번호와 요청 항목을 적어 담당 코치의 공식 문의 채널로 전자 요청할 수 있습니다. 계약본 열람 기간이 끝나면 본인 확인 후 새 링크를 요청하세요.");

    let documentData = data?.canonical_snapshot || finalManifest?.canonical_snapshot || finalManifest?.canonicalSnapshot || data?.snapshot || data?.document || null;
    if (!documentData && fullySigned) {
      try {
        const fetched = await api.getFinalAccessDocument(sessionToken);
        finalManifest = fetched?.canonical_document || fetched?.canonicalDocument || finalManifest;
        documentData = fetched?.canonical_snapshot || finalManifest?.canonical_snapshot || finalManifest?.canonicalSnapshot || fetched?.snapshot || fetched?.document || null;
        if (!documentData) throw new Error("최종 계약 스냅샷이 없습니다.");
      } catch (error) {
        appendText(panel, "p", "form-note danger", "계약 요약은 확인했지만 전문을 불러오지 못했습니다. 담당 코치에게 최종 계약본을 요청해 주세요.");
      }
    }
    if (documentData && fullySigned) {
      const type = get(documentData, ["contract_type", "contractType"], get(summary, ["contract_type", "contractType"], "life"));
      let template = null;
      try { template = await renderer.loadTemplates(type); } catch { /* The immutable snapshot can render without the current template. */ }
      const wrap = create("div", "final-document-wrap");
      renderer.renderSnapshot(wrap, documentData, { templateBundle: template || undefined, summaryHeadingId: "final-document-summary" });
      panel.append(wrap);
    }

    if (fullySigned) renderConsentWithdrawal(panel, summary, finalManifest, sessionToken);

    const audit = data?.audit_summary || data?.auditSummary || finalManifest?.audit_summary || finalManifest?.auditSummary;
    if (audit) {
      const auditBox = create("section", "audit-summary");
      appendText(auditBox, "h2", "", "감사기록 요약");
      const list = document.createElement("ul");
      const events = Array.isArray(audit) ? audit : (Array.isArray(audit.events) ? audit.events : []);
      events.forEach(event => appendText(list, "li", "", `${get(event, ["event_type", "type"], "event")} · ${get(event, ["event_at", "at"], "서버 기록")}`));
      if (!events.length) appendText(list, "li", "", "감사기록 요약은 서버에서 제공되지 않았습니다.");
      auditBox.append(list);
      panel.append(auditBox);
    }
    app.replaceChildren(panel);
  };

  const initComplete = async () => {
    const app = document.querySelector("[data-complete-app]");
    const status = document.querySelector("[data-complete-status]");
    if (!app || !status) return;
    const rawToken = extractAndClearToken("access");
    if (!api || !renderer) {
      setStatus(status, "계약 모듈을 불러오지 못해 완료본을 열지 않았습니다.", "error");
      return;
    }
    if (!api.isOpaqueToken(rawToken)) {
      setStatus(status, "유효한 최종 계약본 링크가 없습니다. 담당 코치에게 새 안전 링크를 요청해 주세요.", "error");
      return;
    }
    let tokenForExchange = rawToken;
    try {
      const exchanged = await api.exchangeFinalAccess(tokenForExchange);
      tokenForExchange = "";
      const sessionToken = safeSession(exchanged);
      if (!api.isOpaqueToken(sessionToken)) throw new Error("최종본 열람 세션을 발급받지 못했습니다.");
      const data = exchanged?.summary || exchanged?.snapshot ? exchanged : await api.getFinalAccess(sessionToken);
      await renderComplete(app, data, sessionToken);
    } catch (error) {
      tokenForExchange = "";
      setStatus(status, error.message || "최종 계약본 링크를 확인하지 못했습니다.", "error");
    }
  };

  if (document.body.matches("[data-contract-sign]")) initSign();
  if (document.body.matches("[data-contract-complete]")) initComplete();
})();
