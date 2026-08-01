(() => {
  "use strict";

  const api = window.ContractApi;
  const renderer = window.ContractRenderer;
  const validation = window.ContractValidation;

  const authenticatedAdmin = result => result?.authenticated === true && result?.access_protected === true;

  const setBanner = (banner, state, title, detail) => {
    if (!banner) return;
    banner.dataset.state = state;
    const paragraph = banner.querySelector("p");
    paragraph.replaceChildren();
    const strong = document.createElement("strong");
    strong.textContent = title;
    paragraph.append(strong, document.createTextNode(` — ${detail}`));
  };

  const initHub = async () => {
    const banner = document.querySelector("[data-api-state]");
    const entry = document.querySelector("[data-admin-entry]");
    if (!api) {
      setBanner(banner, "offline", "계약 API 미연결", "현재는 계약 안내만 볼 수 있으며 발행·서명 기능은 운영되지 않습니다.");
      if (entry) entry.textContent = "보호된 관리자 환경이 필요합니다";
      return;
    }

    try {
      const health = await api.health();
      if (health?.status !== "ok" || health?.contract_service_ready !== true) {
        setBanner(banner, "offline", "계약 기능 비운영", "보안 API와 데이터 저장소의 운영 준비 상태가 확인되지 않았습니다.");
      } else {
        setBanner(banner, "online", "계약 서비스 연결됨", "실제 계약 발행과 서명은 인증된 초대 또는 관리자 세션에서만 진행됩니다.");
      }
    } catch {
      setBanner(banner, "offline", "계약 API 미연결", "현재는 계약 안내만 볼 수 있으며 발행·서명 기능은 운영되지 않습니다.");
    }

    if (!entry) return;
    try {
      const access = await api.adminAccessProbe();
      if (!authenticatedAdmin(access)) throw new Error("ACCESS_NOT_CONFIRMED");
      const link = document.createElement("a");
      link.href = "/coaching/contracts/coach/";
      link.textContent = "코치용 계약 생성";
      link.setAttribute("rel", "nofollow");
      entry.replaceChildren(link);
    } catch {
      entry.textContent = "보호된 관리자 세션에서만 표시됩니다";
    }
  };

  const createElement = (tag, className, text) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  };

  const field = (name, label, options = {}) => {
    const wrapper = createElement("div", `field${options.full ? " full" : ""}`);
    wrapper.dataset.fieldName = name;
    const id = `field-${name.replace(/_/g, "-")}`;
    const labelNode = createElement("label", "", label);
    labelNode.htmlFor = id;
    if (options.required) {
      const mark = createElement("span", "required-mark", " *");
      mark.setAttribute("aria-hidden", "true");
      labelNode.append(mark);
    }
    wrapper.append(labelNode);

    let control;
    if (options.type === "textarea") {
      control = document.createElement("textarea");
      control.rows = options.rows || 4;
    } else if (options.options) {
      control = document.createElement("select");
      options.options.forEach(option => {
        const optionNode = document.createElement("option");
        optionNode.value = option.value;
        optionNode.textContent = option.label;
        if (option.selected) optionNode.selected = true;
        control.append(optionNode);
      });
    } else {
      control = document.createElement("input");
      control.type = options.type || "text";
    }
    control.id = id;
    control.name = name;
    control.autocomplete = options.autocomplete || "off";
    if (options.required) control.required = true;
    if (options.placeholder) control.placeholder = options.placeholder;
    if (options.min !== undefined) control.min = String(options.min);
    if (options.max !== undefined) control.max = String(options.max);
    if (options.step !== undefined) control.step = String(options.step);
    if (options.maxLength) control.maxLength = options.maxLength;
    if (options.inputMode) control.inputMode = options.inputMode;
    if (options.value !== undefined) control.value = String(options.value);
    const errorId = `${id}-error`;
    control.setAttribute("aria-describedby", `${options.help ? `${id}-help ` : ""}${errorId}`.trim());
    wrapper.append(control);

    if (options.help) {
      const help = createElement("p", "field-help", options.help);
      help.id = `${id}-help`;
      wrapper.append(help);
    }
    const error = createElement("p", "field-error");
    error.id = errorId;
    error.dataset.errorFor = name;
    error.setAttribute("aria-live", "polite");
    wrapper.append(error);
    return wrapper;
  };

  const checkbox = (name, label, options = {}) => {
    const wrapper = createElement("div", `choice-field${options.full ? " full" : ""}`);
    wrapper.dataset.fieldName = name;
    const choice = createElement("label", "choice");
    const input = document.createElement("input");
    input.type = "checkbox";
    input.name = name;
    input.id = `field-${name.replace(/_/g, "-")}`;
    input.checked = options.checked === true;
    choice.append(input, document.createTextNode(label));
    wrapper.append(choice);
    if (options.help) wrapper.append(createElement("p", "field-help", options.help));
    const error = createElement("p", "field-error");
    error.dataset.errorFor = name;
    error.setAttribute("aria-live", "polite");
    wrapper.append(error);
    return wrapper;
  };

  const step = (number, title, children, options = {}) => {
    const fieldset = createElement("fieldset", "form-step");
    if (options.dataAttr) fieldset.dataset[options.dataAttr] = "";
    const legend = document.createElement("legend");
    legend.append(createElement("span", "", `STEP ${String(number).padStart(2, "0")}`), document.createTextNode(title));
    fieldset.append(legend);
    const grid = createElement("div", `field-grid${options.three ? " three" : ""}`);
    children.forEach(child => grid.append(child));
    fieldset.append(grid);
    if (options.note) fieldset.append(createElement("p", `form-note${options.danger ? " danger" : ""}`, options.note));
    return fieldset;
  };

  const conditionalConsent = (key, title, description, fields) => {
    const wrapper = createElement("div", "conditional-panel");
    wrapper.dataset.conditionalPanel = key;
    wrapper.setAttribute("aria-disabled", "true");
    wrapper.append(checkbox(`${key}_enabled`, `${title} 선택 동의를 고객에게 제안`, { full: true, help: description }));
    const grid = createElement("div", "field-grid");
    grid.dataset.conditionalFields = key;
    fields.forEach(item => grid.append(field(item.name, item.label, { ...item, full: item.full ?? true })));
    grid.querySelectorAll("input, textarea, select").forEach(control => { control.disabled = true; });
    wrapper.append(grid);
    return wrapper;
  };

  const getFormValue = (form, name) => validation.cleanText(form.elements[name]?.value || "", 4000);
  const isChecked = (form, name) => Boolean(form.elements[name]?.checked);

  const buildPayload = (form, template, accessState = {}) => {
    const type = getFormValue(form, "contract_type");
    const parties = [
      { role: "coach", display_name: getFormValue(form, "coach_name"), email: getFormValue(form, "coach_email"), phone: getFormValue(form, "coach_phone"), organization: getFormValue(form, "coach_organization"), required_signer: true },
      { role: "client", display_name: getFormValue(form, "client_name"), email: getFormValue(form, "client_email"), phone: getFormValue(form, "client_phone"), organization: getFormValue(form, "client_organization"), position: getFormValue(form, "client_position"), required_signer: true }
    ];
    if (type === "business") {
      parties.push({ role: "sponsor", display_name: getFormValue(form, "sponsor_name"), email: getFormValue(form, "sponsor_email"), phone: getFormValue(form, "sponsor_phone"), organization: getFormValue(form, "sponsor_organization"), position: getFormValue(form, "sponsor_position"), required_signer: isChecked(form, "sponsor_required_signer") });
    }

    const payload = {
      contract_type: type,
      template_version: template?.templateVersion || `${type}.v1`,
      title: `${renderer.TYPE_LABELS[type] || "코칭"} 계약서`,
      adult_only_confirmed: isChecked(form, "adult_only_confirmed"),
      parties,
      goal_summary: getFormValue(form, "goal_summary"),
      session_count: Number(getFormValue(form, "session_count")),
      session_minutes: Number(getFormValue(form, "session_minutes")),
      delivery_method: getFormValue(form, "delivery_method"),
      start_date: getFormValue(form, "start_date"),
      expected_end_date: getFormValue(form, "expected_end_date"),
      fee_amount: Number(getFormValue(form, "fee_amount")),
      fee_currency: getFormValue(form, "fee_currency") || "KRW",
      payment_terms: getFormValue(form, "payment_terms"),
      cancellation_terms: getFormValue(form, "cancellation_terms"),
      refund_terms: getFormValue(form, "refund_terms"),
      confidentiality_scope: getFormValue(form, "confidentiality_scope"),
      reporting_scope: type === "business" ? getFormValue(form, "reporting_scope") : "당사자인 코치와 고객 외 공유 없음",
      sponsor_terms: type === "business" ? {
        payer: getFormValue(form, "sponsor_payer"),
        contract_owner: getFormValue(form, "contract_owner"),
        session_participant: getFormValue(form, "session_participant"),
        report_recipient: getFormValue(form, "report_recipient"),
        report_frequency: getFormValue(form, "report_frequency"),
        termination_authority: getFormValue(form, "termination_authority"),
        conflict_handling: getFormValue(form, "conflict_handling"),
        prohibited_sharing: ["session_transcript", "session_notes", "personal_statements"]
      } : null,
      record_management: {
        method: getFormValue(form, "record_method"),
        record_types: getFormValue(form, "record_method"),
        storage: getFormValue(form, "record_storage"),
        record_storage_location: getFormValue(form, "record_storage"),
        access: getFormValue(form, "record_access"),
        record_access_roles: getFormValue(form, "record_access"),
        retention: getFormValue(form, "record_retention"),
        record_retention_period: getFormValue(form, "record_retention"),
        deletion: getFormValue(form, "record_deletion")
      },
      technology_terms: {
        session_recording: {
          enabled: isChecked(form, "session_recording_enabled"),
          purpose: getFormValue(form, "recording_purpose"), scope: getFormValue(form, "recording_scope"), storage: getFormValue(form, "recording_storage"), access: getFormValue(form, "recording_access"), retention: getFormValue(form, "recording_retention"), deletion: getFormValue(form, "recording_deletion"), withdrawal: getFormValue(form, "recording_withdrawal")
        },
        ai_assisted_summary: {
          enabled: isChecked(form, "ai_assisted_summary_enabled"),
          purpose: getFormValue(form, "ai_purpose"), service: getFormValue(form, "ai_service"), input_scope: getFormValue(form, "ai_input_scope"), coverage: getFormValue(form, "ai_coverage"), human_review: getFormValue(form, "ai_human_review"), external_provider: getFormValue(form, "ai_external_provider"), cross_border: getFormValue(form, "ai_cross_border"), retention: getFormValue(form, "ai_retention"), withdrawal: getFormValue(form, "ai_withdrawal")
        },
        anonymized_case_use: {
          enabled: isChecked(form, "anonymized_case_use_enabled"),
          purpose: getFormValue(form, "case_purpose"), scope: getFormValue(form, "case_scope"), media: getFormValue(form, "case_media"), identifiers_removed: getFormValue(form, "case_identifiers_removed"), reidentification_risk: getFormValue(form, "case_reidentification_risk"), duration: getFormValue(form, "case_duration"), withdrawal: getFormValue(form, "case_withdrawal")
        },
        marketing_testimonial: {
          enabled: isChecked(form, "marketing_testimonial_enabled"),
          purpose: getFormValue(form, "marketing_purpose"), channels: getFormValue(form, "marketing_channels"), duration: getFormValue(form, "marketing_duration"), withdrawal: getFormValue(form, "marketing_withdrawal")
        }
      },
      termination_terms: getFormValue(form, "termination_terms"),
      governing_law: getFormValue(form, "governing_law"),
      legal_review_status: accessState.legal_review_status === "APPROVED" ? "APPROVED" : "LEGAL_REVIEW_REQUIRED",
      ...(accessState.legal_review_reference ? { legal_review_reference: String(accessState.legal_review_reference).slice(0, 240) } : {}),
      coach_signature: { signed_name: getFormValue(form, "coach_signed_name"), intent_confirmed: isChecked(form, "coach_signature_intent") },
      legal_review_acknowledged: isChecked(form, "legal_review_acknowledged")
    };
    payload.template_variables = {
      schedule_method: getFormValue(form, "schedule_method"),
      additional_fee_terms: getFormValue(form, "additional_fee_terms"),
      confidentiality_exception_terms: getFormValue(form, "confidentiality_exception_terms"),
      technology_services: getFormValue(form, "technology_services"),
      document_delivery_method: getFormValue(form, "document_delivery_method"),
      document_access_period: getFormValue(form, "document_access_period"),
      electronic_request_method: getFormValue(form, "electronic_request_method"),
      document_support_contact: getFormValue(form, "document_support_contact"),
      dispute_contact: getFormValue(form, "dispute_contact"),
      dispute_resolution_method: getFormValue(form, "dispute_resolution_method"),
      governing_law: payload.governing_law,
      jurisdiction: getFormValue(form, "jurisdiction"),
      privacy_required_processing_notice: getFormValue(form, "privacy_required_processing_notice"),
      privacy_legal_retention_notice: getFormValue(form, "privacy_legal_retention_notice"),
      privacy_processor_and_transfer_notice: getFormValue(form, "privacy_processor_and_transfer_notice"),
      privacy_request_method: getFormValue(form, "privacy_request_method"),
      life_focus_areas: getFormValue(form, "life_focus_areas"),
      career_focus_areas: getFormValue(form, "career_focus_areas"),
      assessment_tools: getFormValue(form, "assessment_tools"),
      market_information_reference_date: getFormValue(form, "market_information_reference_date"),
      contract_mode: type === "business" ? "sponsored_three_party" : "not_applicable",
      payer_name: getFormValue(form, "sponsor_payer"),
      contract_owner_name: getFormValue(form, "contract_owner"),
      report_recipient_name: getFormValue(form, "report_recipient"),
      organization_goal_summary: getFormValue(form, "organization_goal_summary") || payload.goal_summary,
      sponsor_payment_terms: payload.payment_terms,
      sponsor_reporting_terms: payload.reporting_scope,
      sponsor_termination_authority: getFormValue(form, "termination_authority"),
      business_termination_terms: payload.termination_terms,
      conflict_resolution_method: getFormValue(form, "conflict_handling"),
      recording_purpose: payload.technology_terms.session_recording.enabled ? payload.technology_terms.session_recording.purpose : "사용 안 함",
      recording_scope: payload.technology_terms.session_recording.enabled ? payload.technology_terms.session_recording.scope : "사용 안 함",
      recording_storage_location: payload.technology_terms.session_recording.enabled ? payload.technology_terms.session_recording.storage : "사용 안 함",
      recording_authorized_access: payload.technology_terms.session_recording.enabled ? payload.technology_terms.session_recording.access : "사용 안 함",
      recording_retention_period: payload.technology_terms.session_recording.enabled ? payload.technology_terms.session_recording.retention : "사용 안 함",
      recording_deletion_timing: payload.technology_terms.session_recording.enabled ? payload.technology_terms.session_recording.deletion : "사용 안 함",
      recording_withdrawal_method: payload.technology_terms.session_recording.enabled ? payload.technology_terms.session_recording.withdrawal : "사용 안 함",
      recording_after_withdrawal: payload.technology_terms.session_recording.enabled ? payload.technology_terms.session_recording.withdrawal : "사용 안 함",
      ai_purpose: payload.technology_terms.ai_assisted_summary.enabled ? payload.technology_terms.ai_assisted_summary.purpose : "사용 안 함",
      ai_service_name: payload.technology_terms.ai_assisted_summary.enabled ? payload.technology_terms.ai_assisted_summary.service : "사용 안 함",
      ai_input_scope: payload.technology_terms.ai_assisted_summary.enabled ? payload.technology_terms.ai_assisted_summary.input_scope : "사용 안 함",
      ai_session_usage_scope: payload.technology_terms.ai_assisted_summary.enabled ? payload.technology_terms.ai_assisted_summary.coverage : "사용 안 함",
      ai_human_review: payload.technology_terms.ai_assisted_summary.enabled ? payload.technology_terms.ai_assisted_summary.human_review : "사용 안 함",
      ai_external_provider_terms: payload.technology_terms.ai_assisted_summary.enabled ? payload.technology_terms.ai_assisted_summary.external_provider : "사용 안 함",
      ai_cross_border_processing: payload.technology_terms.ai_assisted_summary.enabled ? payload.technology_terms.ai_assisted_summary.cross_border : "사용 안 함",
      ai_retention_period: payload.technology_terms.ai_assisted_summary.enabled ? payload.technology_terms.ai_assisted_summary.retention : "사용 안 함",
      ai_withdrawal_method: payload.technology_terms.ai_assisted_summary.enabled ? payload.technology_terms.ai_assisted_summary.withdrawal : "사용 안 함",
      case_use_purpose: payload.technology_terms.anonymized_case_use.enabled ? payload.technology_terms.anonymized_case_use.purpose : "사용 안 함",
      case_use_scope: payload.technology_terms.anonymized_case_use.enabled ? payload.technology_terms.anonymized_case_use.scope : "사용 안 함",
      case_use_media: payload.technology_terms.anonymized_case_use.enabled ? payload.technology_terms.anonymized_case_use.media : "사용 안 함",
      case_identifiers_removed: payload.technology_terms.anonymized_case_use.enabled ? payload.technology_terms.anonymized_case_use.identifiers_removed : "사용 안 함",
      case_reidentification_risk: payload.technology_terms.anonymized_case_use.enabled ? payload.technology_terms.anonymized_case_use.reidentification_risk : "사용 안 함",
      case_use_period: payload.technology_terms.anonymized_case_use.enabled ? payload.technology_terms.anonymized_case_use.duration : "사용 안 함",
      case_use_withdrawal_method: payload.technology_terms.anonymized_case_use.enabled ? payload.technology_terms.anonymized_case_use.withdrawal : "사용 안 함",
      case_use_withdrawal_deadline: payload.technology_terms.anonymized_case_use.enabled ? payload.technology_terms.anonymized_case_use.withdrawal : "사용 안 함",
      marketing_purpose: payload.technology_terms.marketing_testimonial.enabled ? payload.technology_terms.marketing_testimonial.purpose : "사용 안 함",
      marketing_publication_period: payload.technology_terms.marketing_testimonial.enabled ? payload.technology_terms.marketing_testimonial.duration : "사용 안 함",
      marketing_withdrawal_method: payload.technology_terms.marketing_testimonial.enabled ? payload.technology_terms.marketing_testimonial.withdrawal : "사용 안 함"
    };
    payload.canonical_document = renderer.buildCanonicalDocument(template, payload);
    return payload;
  };

  const clearErrors = form => {
    form.querySelectorAll("[aria-invalid='true']").forEach(control => control.removeAttribute("aria-invalid"));
    form.querySelectorAll("[data-error-for]").forEach(node => { node.textContent = ""; });
  };

  const showErrors = (form, errors, options = {}) => {
    clearErrors(form);
    const ignored = new Set(options.ignore || []);
    const activeEntries = Object.entries(errors).filter(([key]) => !ignored.has(key));
    activeEntries.forEach(([key, message]) => {
      const errorNode = form.querySelector(`[data-error-for="${CSS.escape(key)}"]`);
      if (errorNode) errorNode.textContent = message;
      const control = form.elements[key];
      if (control) {
        const target = control.length && !control.tagName ? control[0] : control;
        target?.setAttribute?.("aria-invalid", "true");
      }
    });
    const firstKey = activeEntries[0]?.[0];
    const firstControl = firstKey ? form.elements[firstKey] : null;
    const target = firstControl?.length && !firstControl.tagName ? firstControl[0] : firstControl;
    target?.focus?.();
    return activeEntries.length === 0;
  };

  const setStatus = (node, message, state = "") => {
    node.textContent = message;
    node.dataset.state = state;
  };

  const lockIssuedForm = form => {
    form.querySelectorAll("input, textarea, select, button").forEach(control => { control.disabled = true; });
  };

  const renderInvitationDelivery = (container, response) => {
    const existing = container.querySelector("[data-invitation-delivery]");
    existing?.remove();
    const section = createElement("section", "app-card");
    section.dataset.invitationDelivery = "";
    const title = createElement("h2", "", "일회용 초대자료를 지금 전달하세요.");
    const warning = createElement("p", "form-note danger", "원본 초대 토큰과 확인번호는 서버에 평문으로 보관되지 않습니다. 이 화면을 닫으면 다시 확인할 수 없으므로, 초대 링크와 확인번호를 서로 다른 안전한 채널로 전달하세요. 같은 메시지에 함께 보내지 마세요.");
    section.append(createElement("p", "eyebrow", "ONE-TIME SECURE HANDOFF"), title, warning);
    const invitations = Array.isArray(response?.invitations) ? response.invitations.map(item => ({ ...item })) : [];
    if (!invitations.length) {
      section.append(createElement("p", "form-note danger", "계약 발행 응답에서 일회용 초대자료를 받지 못했습니다. 고객에게 서명 가능하다고 안내하지 말고 관리자 API의 재발행 절차를 사용하세요."));
      container.append(section);
      return;
    }
    const list = createElement("div", "consent-list");
    invitations.forEach((invitation, index) => {
      let rawToken = invitation.invite_token || invitation.inviteToken || "";
      let rawPin = invitation.verification_code || invitation.verificationCode || invitation.pin || "";
      const role = invitation.role || invitation.party_role || invitation.partyRole || `서명자 ${index + 1}`;
      const card = createElement("article", "consent-card");
      card.append(createElement("span", "consent-badge", `${role} · 일회용`), createElement("h3", "", invitation.display_name || invitation.displayName || "계약 당사자"));
      card.append(createElement("p", "consent-description", `만료: ${invitation.expires_at || invitation.expiresAt || "서버 설정 기준"}`));
      const actionRow = createElement("div", "choice-row");
      const linkButton = createElement("button", "secondary-button", "초대 링크 복사");
      linkButton.type = "button";
      const pinButton = createElement("button", "secondary-button", "확인번호 복사");
      pinButton.type = "button";
      const copyStatus = createElement("p", "field-help", "두 값을 서로 다른 채널로 전달하세요.");
      copyStatus.setAttribute("role", "status");
      copyStatus.setAttribute("aria-live", "polite");
      linkButton.addEventListener("click", async () => {
        if (!api.isOpaqueToken(rawToken)) { copyStatus.textContent = "초대 링크 원문이 이미 지워졌습니다."; return; }
        try {
          await navigator.clipboard.writeText(`${window.location.origin}/coaching/contracts/sign/#${encodeURIComponent(rawToken)}`);
          copyStatus.textContent = "초대 링크를 복사했습니다. 확인번호와 다른 채널로 전달하세요.";
        } catch {
          copyStatus.textContent = "클립보드 복사가 차단되었습니다. 브라우저 권한을 확인한 뒤 다시 시도하세요.";
        }
      });
      pinButton.addEventListener("click", async () => {
        if (!/^\d{6}$/.test(rawPin)) { copyStatus.textContent = "확인번호 원문이 이미 지워졌습니다."; return; }
        try {
          await navigator.clipboard.writeText(rawPin);
          copyStatus.textContent = "확인번호를 복사했습니다. 초대 링크와 다른 채널로 전달하세요.";
        } catch {
          copyStatus.textContent = "클립보드 복사가 차단되었습니다. 브라우저 권한을 확인한 뒤 다시 시도하세요.";
        }
      });
      actionRow.append(linkButton, pinButton);
      card.append(actionRow, copyStatus);
      list.append(card);
      card.dataset.clearSecrets = String(index);
      card._clearInvitationSecrets = () => { rawToken = ""; rawPin = ""; linkButton.disabled = true; pinButton.disabled = true; };
    });
    section.append(list);
    const clearButton = createElement("button", "danger-button", "전달 완료 · 화면에서 초대자료 지우기");
    clearButton.type = "button";
    clearButton.addEventListener("click", () => {
      list.querySelectorAll("[data-clear-secrets]").forEach(card => card._clearInvitationSecrets?.());
      invitations.forEach(item => { item.invite_token = item.inviteToken = item.verification_code = item.verificationCode = item.pin = ""; });
      list.replaceChildren(createElement("p", "form-note", "일회용 초대자료를 이 화면의 메모리에서 지웠습니다. 다시 필요하면 기존 초대를 폐기하고 재발행하세요."));
      clearButton.remove();
    });
    section.append(clearButton);
    container.append(section);
  };

  const buildAdminApp = async (container, accessState) => {
    let activeTemplate = await renderer.loadTemplates("life");
    let draft = null;
    let issued = false;
    const sessionIssueAllowed = accessState?.contract_service_ready === true && accessState?.legal_review_ready === true;
    const templateApproved = template => template?.common?.status === "APPROVED_FOR_USE"
      && template?.variant?.status === "APPROVED_FOR_USE"
      && template.clauses.every(clause => clause.reviewStatus !== "LEGAL_REVIEW_REQUIRED");
    let issueAllowed = sessionIssueAllowed && templateApproved(activeTemplate);

    const layout = createElement("div", "admin-layout");
    const summary = createElement("div", "admin-summary");
    const summaryText = createElement("p", "");
    summaryText.append(createElement("strong", "", "보호된 관리자 세션"), document.createTextNode(" · 입력값은 이 브라우저의 LocalStorage·SessionStorage에 저장하지 않습니다."));
    const draftText = createElement("p", "", "새 계약 · 아직 서버 초안 없음");
    draftText.dataset.draftState = "";
    summary.append(summaryText, draftText);
    layout.append(summary);

    const form = createElement("form", "admin-form");
    form.noValidate = true;
    form.autocomplete = "off";
    form.append(step(1, "계약 유형", [
      field("contract_type", "계약 유형", { required: true, options: [{ value: "life", label: "라이프 코칭" }, { value: "business", label: "비즈니스 코칭" }, { value: "career", label: "커리어 코칭" }] }),
      checkbox("adult_only_confirmed", "계약 고객이 성인임을 확인했습니다.", { help: "v1은 미성년 고객의 계약을 생성하지 않습니다." })
    ], { note: "계약 유형과 당사자 구조를 사전 협의한 뒤 선택합니다." }));
    form.append(step(2, "코치 정보", [
      field("coach_name", "코치 이름", { required: true, autocomplete: "name", maxLength: 100 }), field("coach_email", "코치 이메일", { type: "email", required: true, autocomplete: "email", maxLength: 254 }), field("coach_phone", "코치 연락처", { type: "tel", autocomplete: "tel", maxLength: 30 }), field("coach_organization", "상호·소속", { maxLength: 160 })
    ]));
    form.append(step(3, "고객 정보", [
      field("client_name", "고객 이름", { required: true, autocomplete: "off", maxLength: 100 }), field("client_email", "고객 이메일", { type: "email", required: true, autocomplete: "off", maxLength: 254 }), field("client_phone", "고객 연락처", { type: "tel", autocomplete: "off", maxLength: 30 }), field("client_organization", "소속(선택)", { maxLength: 160 }), field("client_position", "직책(선택)", { maxLength: 100 })
    ], { note: "민감정보나 코칭 세션의 상세 내용을 고객 정보란에 입력하지 않습니다." }));

    const sponsorStep = step(4, "스폰서·조직 담당자 정보", [
      field("sponsor_name", "스폰서/담당자 이름", { required: true, maxLength: 100 }), field("sponsor_email", "스폰서 이메일", { type: "email", required: true, maxLength: 254 }), field("sponsor_phone", "스폰서 연락처", { type: "tel", maxLength: 30 }), field("sponsor_organization", "조직명", { required: true, maxLength: 160 }), field("sponsor_position", "직책", { maxLength: 100 }), checkbox("sponsor_required_signer", "스폰서를 필수 서명자로 지정", { checked: true, help: "v1 비즈니스 계약은 고객과 스폰서 모두 서명해야 완료됩니다." })
    ], { note: "비즈니스 코칭에서만 사용합니다. 비용 지급자와 실제 코칭 고객을 구분합니다." });
    sponsorStep.dataset.businessOnly = "";
    sponsorStep.hidden = true;
    form.append(sponsorStep);

    const lifeFocus = field("life_focus_areas", "다룰 삶의 영역", { options: [{ value: "direction_and_goals", label: "삶의 방향과 목표" }, { value: "life_balance", label: "삶의 균형" }, { value: "relationships_and_roles", label: "관계와 역할" }, { value: "habits_and_action", label: "습관과 실행" }, { value: "self_understanding_and_reflection", label: "자기이해와 성찰" }, { value: "other_specified", label: "기타 합의 영역" }] });
    lifeFocus.dataset.typeOnly = "life";
    const businessGoal = field("organization_goal_summary", "조직과 합의한 목표 요약", { type: "textarea", full: true, maxLength: 2000 });
    businessGoal.dataset.typeOnly = "business";
    const careerFocus = field("career_focus_areas", "다룰 커리어 영역", { options: [{ value: "career_exploration", label: "진로 탐색" }, { value: "career_transition", label: "경력 전환" }, { value: "job_search_preparation", label: "취업 준비" }, { value: "role_selection", label: "직무 선택" }, { value: "resume_and_portfolio", label: "이력서·포트폴리오" }, { value: "interview_preparation", label: "면접 준비" }, { value: "interest_and_strength_assessment", label: "흥미·강점 검사 활용" }, { value: "other_specified", label: "기타 합의 영역" }] });
    careerFocus.dataset.typeOnly = "career";
    const assessmentTools = field("assessment_tools", "검사 활용 여부와 도구", { maxLength: 500, help: "사용하지 않으면 ‘사용 안 함’으로 입력합니다." });
    assessmentTools.dataset.typeOnly = "career";
    const marketDate = field("market_information_reference_date", "시장·채용 정보 기준일", { type: "date" });
    marketDate.dataset.typeOnly = "career";
    form.append(step(5, "코칭 목표", [field("goal_summary", "합의한 코칭 목표 요약", { type: "textarea", required: true, full: true, maxLength: 2000, help: "진단명, 주민등록번호, 건강정보 등 민감정보를 입력하지 않습니다." }), lifeFocus, businessGoal, careerFocus, assessmentTools, marketDate]));
    form.append(step(6, "회기 수와 회기 시간", [field("session_count", "총 회기 수", { type: "number", required: true, min: 1, max: 100, value: 8 }), field("session_minutes", "회기당 시간(분)", { type: "number", required: true, min: 20, max: 240, value: 60 }), field("delivery_method", "진행 방식", { required: true, options: [{ value: "", label: "선택" }, { value: "online", label: "온라인" }, { value: "in_person", label: "대면" }, { value: "hybrid", label: "혼합" }] }), field("schedule_method", "세부 일정·장소·접속 방법 협의 방식", { required: true, full: true, maxLength: 1000 })]));
    form.append(step(7, "시작일과 종료 예정일", [field("start_date", "시작일", { type: "date", required: true }), field("expected_end_date", "종료 예정일", { type: "date", required: true })]));
    form.append(step(8, "비용과 지급 방식", [field("fee_amount", "총 비용", { type: "number", required: true, min: 0, max: 1000000000, step: 1 }), field("fee_currency", "통화", { required: true, options: [{ value: "KRW", label: "KRW · 대한민국 원" }, { value: "USD", label: "USD · 미국 달러" }] }), field("payment_terms", "지급 방법과 시기", { type: "textarea", required: true, full: true, maxLength: 2000, help: "실제 합의한 조건을 직접 입력합니다. 자동 문구를 생성하지 않습니다." }), field("additional_fee_terms", "세금·수수료·추가 비용 조건", { type: "textarea", required: true, full: true, maxLength: 1500, help: "추가 비용이 없으면 ‘추가 비용 없음’으로 명시합니다." })]));
    form.append(step(9, "일정 변경·취소·환불 기준", [field("cancellation_terms", "변경·지각·노쇼·취소 기준", { type: "textarea", required: true, full: true, maxLength: 3000 }), field("refund_terms", "환불 기준", { type: "textarea", required: true, full: true, maxLength: 3000 })], { note: "취소·환불 기준은 자동 생성하지 않습니다. 실제 운영 기준과 법률 검토를 반영해 직접 입력하세요.", danger: true }));

    const businessStep = step(10, "정보 공유 범위와 비즈니스 당사자 역할", [
      field("reporting_scope", "보고 범위", { options: [{ value: "attendance_and_contract_status", label: "출석·계약 진행 여부만" }, { value: "agreed_goals_and_progress", label: "합의된 목표와 진행 요약" }, { value: "client_approved_content", label: "고객이 직접 승인한 내용" }, { value: "specific_items", label: "별도 기재한 특정 항목" }] }),
      field("sponsor_payer", "비용 지급자", { maxLength: 160 }), field("contract_owner", "계약 책임자", { maxLength: 160 }), field("session_participant", "세션 참여자", { maxLength: 160 }), field("report_recipient", "보고 수신자", { maxLength: 160 }), field("report_frequency", "보고 주기", { maxLength: 160 }), field("termination_authority", "계약 종료 권한", { maxLength: 500 }), field("conflict_handling", "이해충돌 처리 방식", { type: "textarea", full: true, maxLength: 1500 })
    ], { note: "세션 원문·세션 노트·고객의 개인적 발언은 공유 금지가 기본값입니다. 추가 공유는 고객이 범위를 사전에 직접 확인해야 합니다." });
    businessStep.dataset.businessOnly = "";
    businessStep.hidden = true;
    form.append(businessStep);

    form.append(step(11, "비밀보장과 기록 관리", [
      field("confidentiality_scope", "비밀보장 범위", { type: "textarea", required: true, full: true, maxLength: 3000 }), field("confidentiality_exception_terms", "비밀보장의 예외와 대응 범위", { type: "textarea", required: true, full: true, maxLength: 3000 }), field("record_method", "생성되는 기록 종류", { required: true, maxLength: 1000 }), field("record_storage", "보관 장소", { required: true, maxLength: 1000 }), field("record_access", "접근 가능자", { required: true, maxLength: 1000 }), field("record_retention", "보유기간", { required: true, maxLength: 1000 }), field("record_deletion", "삭제·폐기 방식", { required: true, maxLength: 1000 }), field("technology_services", "온라인·전자계약에 사용하는 기술 서비스", { required: true, full: true, maxLength: 1500 })
    ], { note: "비밀보장 예외와 정확한 보유기간은 LEGAL_REVIEW_REQUIRED 항목입니다.", danger: true }));

    const techStep = createElement("fieldset", "form-step");
    const techLegend = document.createElement("legend");
    techLegend.append(createElement("span", "", "STEP 12"), document.createTextNode("녹음·AI·사례·홍보 선택 동의 설정"));
    techStep.append(techLegend);
    techStep.append(conditionalConsent("session_recording", "세션 녹음", "고객 동의 전에는 녹음 기능을 실행할 수 없습니다.", [
      { name: "recording_purpose", label: "녹음 목적" }, { name: "recording_scope", label: "녹음 대상·범위" }, { name: "recording_storage", label: "보관 장소" }, { name: "recording_access", label: "접근 가능자" }, { name: "recording_retention", label: "보유기간" }, { name: "recording_deletion", label: "삭제 시점" }, { name: "recording_withdrawal", label: "철회 이후 처리" }
    ]));
    techStep.append(conditionalConsent("ai_assisted_summary", "AI 기반 요약", "서비스·데이터 범위·보유기간이 모두 설정되지 않으면 고객 동의 항목을 활성화할 수 없습니다.", [
      { name: "ai_purpose", label: "AI 사용 목적" }, { name: "ai_service", label: "사용 도구·서비스" }, { name: "ai_input_scope", label: "입력되는 정보 범위" }, { name: "ai_coverage", label: "세션 전체 또는 일부" }, { name: "ai_human_review", label: "사람의 검토 여부" }, { name: "ai_external_provider", label: "외부 사업자 제공 여부" }, { name: "ai_cross_border", label: "국외 처리 여부" }, { name: "ai_retention", label: "보유기간" }, { name: "ai_withdrawal", label: "동의 철회 방법" }
    ]));
    techStep.append(conditionalConsent("anonymized_case_use", "비식별 사례 활용", "‘익명’ 표현만 사용하지 않고 재식별 위험과 철회 가능 시점을 설명합니다.", [
      { name: "case_purpose", label: "사용 목적" }, { name: "case_scope", label: "사용 범위" }, { name: "case_media", label: "사용 매체" }, { name: "case_identifiers_removed", label: "제거할 식별정보" }, { name: "case_reidentification_risk", label: "재식별 위험" }, { name: "case_duration", label: "사용 기간" }, { name: "case_withdrawal", label: "철회 가능 시점·방법" }
    ]));
    techStep.append(conditionalConsent("marketing_testimonial", "후기·홍보 활용", "고객 서명 화면에서 이름·사진·소속·후기 문구를 각각 공개 여부로 나눕니다.", [
      { name: "marketing_purpose", label: "활용 목적" }, { name: "marketing_channels", label: "공개 가능 채널" }, { name: "marketing_duration", label: "공개 기간" }, { name: "marketing_withdrawal", label: "철회 방법" }
    ]));
    techStep.append(createElement("p", "form-note", "네 항목의 고객 동의 기본값은 모두 false입니다. 일괄 동의와 코치의 대리 선택은 제공하지 않습니다."));
    form.append(techStep);

    form.append(step(13, "종료·전자문서·개인정보·분쟁 조건", [
      field("termination_terms", "종료·철회·변경 요청 방법", { type: "textarea", required: true, full: true, maxLength: 3000 }),
      field("document_delivery_method", "완료 계약본 전달 방법", { required: true, maxLength: 1000 }), field("document_access_period", "완료본 열람 기간", { required: true, maxLength: 500 }), field("electronic_request_method", "변경·해지·동의 철회 전자 요청 방법", { required: true, full: true, maxLength: 1000 }), field("document_support_contact", "전자문서 확인·대체 제공 문의 채널", { required: true, full: true, maxLength: 1000 }),
      field("privacy_required_processing_notice", "계약 이행 개인정보 처리 안내", { type: "textarea", required: true, full: true, maxLength: 3000 }), field("privacy_legal_retention_notice", "법적 의무·분쟁 대응 보관 안내", { type: "textarea", required: true, full: true, maxLength: 3000 }), field("privacy_processor_and_transfer_notice", "처리위탁·국외 이전 안내", { type: "textarea", required: true, full: true, maxLength: 3000 }), field("privacy_request_method", "열람·정정·삭제·철회 요청 방법", { type: "textarea", required: true, full: true, maxLength: 2000 }),
      field("dispute_contact", "문의·이의 접수 채널", { required: true, full: true, maxLength: 1000 }), field("dispute_resolution_method", "분쟁 해결 절차", { type: "textarea", required: true, full: true, maxLength: 2000 }), field("governing_law", "준거법", { required: true, maxLength: 1000 }), field("jurisdiction", "관할", { required: true, maxLength: 1000 })
    ], { note: "보유기간·처리위탁·국외 이전·전자서명 증빙·분쟁·준거법은 LEGAL_REVIEW_REQUIRED 항목입니다.", danger: true }));

    const previewStep = createElement("fieldset", "form-step");
    const previewLegend = document.createElement("legend");
    previewLegend.append(createElement("span", "", "STEP 14"), document.createTextNode("계약 미리보기"));
    previewStep.append(previewLegend, createElement("p", "form-note", "미리보기는 브라우저 메모리에만 렌더링되며 계약 발행본이 아닙니다. 발행 시 서버가 전체 문구와 값을 고정 스냅샷으로 저장하고 SHA-256 해시를 생성해야 합니다."));
    const previewRegion = createElement("div", "preview-region");
    previewRegion.dataset.contractPreview = "";
    previewStep.append(previewRegion);
    form.append(previewStep);

    form.append(step(15, "코치 전자서명", [field("coach_signed_name", "코치 서명 이름", { required: true, maxLength: 100, help: "서명할 이름을 직접 입력합니다. 서명 그림은 수집하지 않습니다." }), checkbox("coach_signature_intent", "위 이름으로 이 계약에 전자서명할 의사가 있습니다.", { full: true })]));
    form.append(step(16, "계약 발행", [checkbox("legal_review_acknowledged", "LEGAL_REVIEW_REQUIRED 항목이 운영 확정 전 법률 검토 대상임을 확인했습니다.", { full: true })], { note: "발행 후 원본은 수정할 수 없습니다. 변경이 필요하면 기존 계약을 superseded 처리하고 새 버전을 발행합니다.", danger: true }));

    const actions = createElement("div", "form-actions");
    const status = createElement("p", "form-status", "입력을 완료한 뒤 계약 전문을 미리 확인하세요.");
    status.dataset.formStatus = "";
    status.setAttribute("role", "status");
    status.setAttribute("aria-live", "polite");
    const previewButton = createElement("button", "secondary-button", "계약 전문 미리보기");
    previewButton.type = "button";
    const saveButton = createElement("button", "secondary-button", "서버에 초안 저장");
    saveButton.type = "button";
    const issueButton = createElement("button", "primary-button", "검토 후 계약 발행");
    issueButton.type = "button";
    issueButton.disabled = !issueAllowed;
    actions.append(status, previewButton, saveButton, issueButton);
    form.append(actions);
    layout.append(form);
    container.replaceChildren(layout);

    if (!issueAllowed) {
      setStatus(status, "초안 저장만 가능 · 계약 서비스 준비와 법률 검토 완료 상태가 확인되지 않아 발행은 차단되었습니다.", "error");
      const issueNotice = createElement("p", "form-note danger", "LEGAL_REVIEW_REQUIRED · 관리자 세션의 contract_service_ready와 legal_review_ready, 법률 검토 승인 템플릿이 모두 확인될 때만 발행할 수 있습니다.");
      form.querySelector(".form-step:last-of-type")?.append(issueNotice);
    }

    const typeControl = form.elements.contract_type;
    const updateType = async () => {
      const type = typeControl.value;
      form.querySelectorAll("[data-business-only]").forEach(node => { node.hidden = type !== "business"; });
      form.querySelectorAll("[data-type-only]").forEach(node => {
        const active = node.dataset.typeOnly === type;
        node.hidden = !active;
        node.querySelectorAll("input, textarea, select").forEach(control => { control.disabled = !active; });
      });
      try {
        activeTemplate = await renderer.loadTemplates(type);
        issueAllowed = sessionIssueAllowed && templateApproved(activeTemplate);
        issueButton.disabled = !issueAllowed;
        setStatus(status, issueAllowed
          ? `${renderer.TYPE_LABELS[type]} 법률 검토 승인 템플릿을 불러왔습니다.`
          : `${renderer.TYPE_LABELS[type]} 템플릿은 초안 저장만 가능하며 법률 검토 전 발행은 차단됩니다.`, issueAllowed ? "success" : "error");
      } catch (error) {
        issueAllowed = false;
        issueButton.disabled = true;
        setStatus(status, error.message || "템플릿을 불러오지 못했습니다.", "error");
      }
    };
    typeControl.addEventListener("change", updateType);

    form.querySelectorAll("[name$='_enabled']").forEach(toggle => {
      toggle.addEventListener("change", () => {
        const key = toggle.name.replace(/_enabled$/, "");
        const panel = form.querySelector(`[data-conditional-panel="${CSS.escape(key)}"]`);
        const fields = panel?.querySelector(`[data-conditional-fields="${CSS.escape(key)}"]`);
        panel?.setAttribute("aria-disabled", String(!toggle.checked));
        fields?.querySelectorAll("input, textarea, select").forEach(control => {
          control.disabled = !toggle.checked;
          if (!toggle.checked) {
            control.value = "";
            control.removeAttribute("aria-invalid");
          }
        });
      });
    });

    const payloadAndValidation = requireSignature => {
      const payload = buildPayload(form, activeTemplate, accessState);
      const result = validation.validateAdmin(payload);
      const ignore = requireSignature ? [] : ["coach_signed_name", "coach_signature_intent", "legal_review_acknowledged"];
      const valid = showErrors(form, result.errors, { ignore });
      return { payload, valid };
    };

    previewButton.addEventListener("click", () => {
      const { payload, valid } = payloadAndValidation(false);
      if (!valid) {
        setStatus(status, "미리보기에 필요한 필수 내용을 확인해 주세요.", "error");
        return;
      }
      const snapshot = renderer.buildPreviewSnapshot(activeTemplate, payload);
      renderer.renderSnapshot(previewRegion, snapshot, { templateBundle: activeTemplate, allowTemplateFallback: true, summaryHeadingId: "admin-preview-summary" });
      setStatus(status, "미리보기 생성됨 · 아직 발행본이 아닙니다.", "success");
      previewRegion.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" });
    });

    const saveDraft = async payload => {
      const response = draft
        ? await api.adminUpdateContract(draft.id, { ...payload, expected_version: draft.version_number })
        : await api.adminCreateContract(payload);
      const returned = response?.contract || response;
      if (!returned?.id) throw new Error("서버가 초안 식별자를 반환하지 않았습니다.");
      draft = { id: returned.id, version_number: returned.version_number || returned.version || 1, status: returned.status || "draft", contract_number: returned.contract_number || "발행 전" };
      draftText.textContent = `서버 초안 · ${draft.status} · 버전 ${draft.version_number}`;
      return draft;
    };

    saveButton.addEventListener("click", async () => {
      const { payload, valid } = payloadAndValidation(false);
      if (!valid) { setStatus(status, "초안 저장에 필요한 필수 내용을 확인해 주세요.", "error"); return; }
      document.body.classList.add("is-busy");
      previewButton.disabled = saveButton.disabled = issueButton.disabled = true;
      setStatus(status, "보안 API에 초안을 저장하고 있습니다.");
      try {
        await saveDraft(payload);
        setStatus(status, "초안이 보안 API에 저장되었습니다. 발행 전까지 수정할 수 있습니다.", "success");
      } catch (error) {
        setStatus(status, error.message || "초안을 저장하지 못했습니다.", "error");
      } finally {
        document.body.classList.remove("is-busy");
        if (!issued) {
          previewButton.disabled = saveButton.disabled = false;
          issueButton.disabled = !issueAllowed;
        }
      }
    });

    issueButton.addEventListener("click", async () => {
      if (!issueAllowed) { setStatus(status, "계약 서비스 준비 또는 법률 검토 완료 상태가 확인되지 않아 발행이 차단되었습니다.", "error"); return; }
      const { payload, valid } = payloadAndValidation(true);
      if (!valid) { setStatus(status, "발행 전 모든 필수 항목과 코치 서명을 확인해 주세요.", "error"); return; }
      const confirmed = window.confirm("발행 후 계약 원본은 직접 수정할 수 없습니다. 현재 내용으로 계약을 발행할까요?");
      if (!confirmed) return;
      document.body.classList.add("is-busy");
      previewButton.disabled = saveButton.disabled = issueButton.disabled = true;
      setStatus(status, "계약 스냅샷과 초대를 생성하고 있습니다.");
      try {
        await saveDraft(payload);
        // The issue endpoint performs the server-validated draft -> ready -> issued
        // transition. A status-only PATCH is intentionally not sent because draft
        // updates require the complete contract payload and optimistic version.
        if (!new Set(["draft", "ready"]).has(draft.status)) throw new Error("현재 계약 상태에서는 발행할 수 없습니다.");
        const response = await api.adminIssueContract(draft.id, { expected_version: draft.version_number, coach_signature: payload.coach_signature });
        const contract = response?.contract || response;
        if (!contract || (contract.status !== "issued" && contract.status !== "partially_signed")) throw new Error("서버에서 발행 상태를 확인하지 못했습니다.");
        issued = true;
        draft = { ...draft, ...contract };
        draftText.textContent = `계약 ${draft.contract_number || "번호 확인 중"} · ${draft.status} · 원본 변경 잠금`;
        setStatus(status, "계약 원본이 고정되었습니다. 아래 일회용 초대자료를 지금 분리 전달하세요.", "success");
        lockIssuedForm(form);
        renderInvitationDelivery(layout, response);
      } catch (error) {
        setStatus(status, error.message || "계약을 발행하지 못했습니다.", "error");
        previewButton.disabled = saveButton.disabled = false;
        issueButton.disabled = !issueAllowed;
      } finally {
        document.body.classList.remove("is-busy");
      }
    });
    updateType();
  };

  const initAdmin = async () => {
    const gate = document.querySelector("[data-admin-gate]");
    const status = document.querySelector("[data-admin-status]");
    const app = document.querySelector("[data-admin-app]");
    if (!gate || !status || !app) return;
    if (!api || !renderer || !validation) {
      setStatus(status, "필수 계약 모듈을 불러오지 못했습니다. 생성 기능은 차단되었습니다.", "error");
      return;
    }
    try {
      const access = await api.adminAccessProbe();
      if (!authenticatedAdmin(access)) throw new Error("관리자 접근 보호가 확인되지 않았습니다.");
      await buildAdminApp(app, access);
      gate.hidden = true;
      app.hidden = false;
    } catch (error) {
      setStatus(status, "관리자 인증 또는 서버 측 접근 보호가 확인되지 않아 계약 생성 화면을 열지 않았습니다.", "error");
      const detail = createElement("p", "form-note danger", "Cloudflare Access와 API 인증, 응답 헤더의 클릭재킹 방지 정책(frame-ancestors 또는 X-Frame-Options)을 운영 환경에서 설정해야 합니다.");
      gate.querySelector(".gate-content")?.append(detail);
    }
  };

  if (document.body.matches("[data-contract-hub]")) initHub();
  if (document.body.matches("[data-contract-admin]")) initAdmin();
})();
