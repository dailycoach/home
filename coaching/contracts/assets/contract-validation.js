(() => {
  "use strict";

  const ALLOWED_TYPES = new Set(["life", "business", "career"]);
  const ALLOWED_TRANSITIONS = Object.freeze({
    draft: ["ready"],
    ready: ["issued"],
    issued: ["viewed", "expired", "cancelled", "superseded"],
    viewed: ["partially_signed"],
    partially_signed: ["fully_signed"],
    fully_signed: ["terminated"],
    expired: [],
    cancelled: [],
    superseded: [],
    terminated: []
  });

  const cleanText = (value, maxLength = 2000) => String(value ?? "").replace(/\u0000/g, "").trim().slice(0, maxLength);
  const isEmail = value => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || "")) && String(value).length <= 254;
  const isPhone = value => /^[0-9+()\-\s]{7,30}$/.test(String(value || ""));
  const isIsoDate = value => /^\d{4}-\d{2}-\d{2}$/.test(String(value || ""));
  const hasValue = value => value !== undefined && value !== null && String(value).trim() !== "";
  const toInteger = value => Number.isInteger(Number(value)) ? Number(value) : NaN;

  const validateAdmin = payload => {
    const errors = {};
    const add = (field, message) => { if (!errors[field]) errors[field] = message; };
    const party = role => payload.parties?.find(item => item.role === role);
    const coach = party("coach");
    const client = party("client");
    const sponsor = party("sponsor");

    if (!ALLOWED_TYPES.has(payload.contract_type)) add("contract_type", "계약 유형을 선택해 주세요.");
    if (payload.adult_only_confirmed !== true) add("adult_only_confirmed", "성인 고객 계약임을 확인해야 합니다.");
    if (!coach || !hasValue(coach.display_name)) add("coach_name", "코치 이름을 입력해 주세요.");
    if (!coach || !isEmail(coach.email)) add("coach_email", "코치 이메일을 올바르게 입력해 주세요.");
    if (coach?.phone && !isPhone(coach.phone)) add("coach_phone", "코치 연락처 형식을 확인해 주세요.");
    if (!client || !hasValue(client.display_name)) add("client_name", "고객 이름을 입력해 주세요.");
    if (!client || !isEmail(client.email)) add("client_email", "고객 이메일을 올바르게 입력해 주세요.");
    if (client?.phone && !isPhone(client.phone)) add("client_phone", "고객 연락처 형식을 확인해 주세요.");

    if (payload.contract_type === "business") {
      if (!sponsor || !hasValue(sponsor.display_name)) add("sponsor_name", "비즈니스 계약의 스폰서 또는 조직 담당자를 입력해 주세요.");
      if (!sponsor || !isEmail(sponsor.email)) add("sponsor_email", "스폰서 이메일을 올바르게 입력해 주세요.");
      if (!hasValue(payload.reporting_scope)) add("reporting_scope", "정보 공유 범위를 선택해 주세요.");
      if (!hasValue(payload.sponsor_terms?.payer)) add("sponsor_payer", "비용 지급자를 지정해 주세요.");
      if (!hasValue(payload.sponsor_terms?.termination_authority)) add("termination_authority", "계약 종료 권한을 정해 주세요.");
      if (sponsor?.required_signer !== true) add("sponsor_required_signer", "v1 비즈니스 계약에서는 스폰서를 필수 서명자로 지정해야 합니다.");
    }

    if (!hasValue(payload.goal_summary) || payload.goal_summary.length < 10) add("goal_summary", "코칭 목표를 10자 이상 입력해 주세요.");
    const sessions = toInteger(payload.session_count);
    const minutes = toInteger(payload.session_minutes);
    if (!Number.isFinite(sessions) || sessions < 1 || sessions > 100) add("session_count", "회기 수는 1~100 사이로 입력해 주세요.");
    if (!Number.isFinite(minutes) || minutes < 20 || minutes > 240) add("session_minutes", "회기 시간은 20~240분 사이로 입력해 주세요.");
    if (!hasValue(payload.delivery_method)) add("delivery_method", "진행 방식을 선택해 주세요.");
    if (!isIsoDate(payload.start_date)) add("start_date", "시작일을 입력해 주세요.");
    if (!isIsoDate(payload.expected_end_date)) add("expected_end_date", "종료 예정일을 입력해 주세요.");
    if (isIsoDate(payload.start_date) && isIsoDate(payload.expected_end_date) && payload.expected_end_date < payload.start_date) add("expected_end_date", "종료 예정일은 시작일 이후여야 합니다.");

    const fee = Number(payload.fee_amount);
    if (!Number.isFinite(fee) || fee < 0 || fee > 1000000000) add("fee_amount", "비용을 0원 이상 올바르게 입력해 주세요.");
    if (!/^[A-Z]{3}$/.test(String(payload.fee_currency || ""))) add("fee_currency", "통화 단위를 확인해 주세요.");
    if (!hasValue(payload.payment_terms)) add("payment_terms", "지급 방법과 시기를 직접 입력해 주세요.");
    if (!hasValue(payload.cancellation_terms)) add("cancellation_terms", "일정 변경·취소 기준을 직접 입력해 주세요.");
    if (!hasValue(payload.refund_terms)) add("refund_terms", "환불 기준을 직접 입력해 주세요.");
    if (!hasValue(payload.confidentiality_scope)) add("confidentiality_scope", "비밀보장 범위를 입력해 주세요.");
    if (!hasValue(payload.governing_law)) add("governing_law", "준거법 문구를 입력해 주세요.");
    if (!hasValue(payload.record_management?.method)) add("record_method", "기록 관리 방식을 입력해 주세요.");
    if (!hasValue(payload.record_management?.storage)) add("record_storage", "기록 보관 장소를 입력해 주세요.");
    if (!hasValue(payload.record_management?.access)) add("record_access", "기록 접근 가능자를 입력해 주세요.");
    if (!hasValue(payload.record_management?.retention)) add("record_retention", "기록 보유기간을 입력해 주세요.");
    if (!hasValue(payload.record_management?.deletion)) add("record_deletion", "기록 삭제 방식을 입력해 주세요.");
    if (!hasValue(payload.termination_terms)) add("termination_terms", "계약 종료 조건을 입력해 주세요.");

    const requiredTemplateVariables = [
      "schedule_method", "additional_fee_terms", "confidentiality_exception_terms", "technology_services",
      "document_delivery_method", "document_access_period", "electronic_request_method", "document_support_contact",
      "privacy_required_processing_notice", "privacy_legal_retention_notice", "privacy_processor_and_transfer_notice",
      "privacy_request_method", "dispute_contact", "dispute_resolution_method", "governing_law", "jurisdiction"
    ];
    requiredTemplateVariables.forEach(key => {
      if (!hasValue(payload.template_variables?.[key])) add(key, "계약 전문에 필요한 운영 문구를 입력해 주세요.");
    });
    if (payload.contract_type === "life" && !hasValue(payload.template_variables?.life_focus_areas)) add("life_focus_areas", "다룰 삶의 영역을 선택해 주세요.");
    if (payload.contract_type === "career") {
      if (!hasValue(payload.template_variables?.career_focus_areas)) add("career_focus_areas", "다룰 커리어 영역을 선택해 주세요.");
      if (!hasValue(payload.template_variables?.assessment_tools)) add("assessment_tools", "검사 활용 여부와 도구를 입력해 주세요.");
      if (!hasValue(payload.template_variables?.market_information_reference_date)) add("market_information_reference_date", "시장·채용 정보 기준일을 입력해 주세요.");
    }

    if (payload.technology_terms?.session_recording?.enabled) {
      const item = payload.technology_terms.session_recording;
      ["purpose", "scope", "storage", "access", "retention", "deletion", "withdrawal"].forEach(key => {
        if (!hasValue(item[key])) add(`recording_${key}`, "녹음 선택 동의를 활성화하려면 모든 안내 항목을 입력해 주세요.");
      });
    }
    if (payload.technology_terms?.ai_assisted_summary?.enabled) {
      const item = payload.technology_terms.ai_assisted_summary;
      ["purpose", "service", "input_scope", "coverage", "human_review", "external_provider", "cross_border", "retention", "withdrawal"].forEach(key => {
        if (!hasValue(item[key])) add(`ai_${key}`, "AI 선택 동의를 활성화하려면 모든 안내 항목을 입력해 주세요.");
      });
    }
    if (payload.technology_terms?.anonymized_case_use?.enabled) {
      const item = payload.technology_terms.anonymized_case_use;
      ["purpose", "scope", "media", "identifiers_removed", "reidentification_risk", "duration", "withdrawal"].forEach(key => {
        if (!hasValue(item[key])) add(`case_${key}`, "사례 활용 선택 동의를 활성화하려면 모든 안내 항목을 입력해 주세요.");
      });
    }
    if (payload.technology_terms?.marketing_testimonial?.enabled) {
      const item = payload.technology_terms.marketing_testimonial;
      ["purpose", "channels", "duration", "withdrawal"].forEach(key => {
        if (!hasValue(item[key])) add(`marketing_${key}`, "후기·홍보 선택 동의를 활성화하려면 모든 안내 항목을 입력해 주세요.");
      });
    }

    if (!hasValue(payload.coach_signature?.signed_name)) add("coach_signed_name", "코치 서명 이름을 직접 입력해 주세요.");
    if (payload.coach_signature?.intent_confirmed !== true) add("coach_signature_intent", "코치의 전자서명 의사를 확인해 주세요.");
    if (payload.legal_review_acknowledged !== true) add("legal_review_acknowledged", "법률 검토 필요 항목을 확인해 주세요.");
    return { valid: Object.keys(errors).length === 0, errors };
  };

  const validateSigning = (state, options = {}) => {
    const errors = {};
    if (!state.confirmations?.contract_read) errors.contract_read = "계약 전문을 확인해 주세요.";
    if (!state.confirmations?.important_terms) errors.important_terms = "중요 조건 요약을 확인해 주세요.";
    if (!state.confirmations?.electronic_document) errors.electronic_document = "전자문서 제공·수령 방법을 확인해 주세요.";
    if (!hasValue(state.signed_name) || state.signed_name.length < 2 || state.signed_name.length > 100) errors.signed_name = "서명자 이름을 2~100자로 직접 입력해 주세요.";
    if (state.signature_intent !== true) errors.signature_intent = "전자서명 의사를 확인해 주세요.";
    const requireConsents = options.requireConsents !== false;
    const consentKeys = ["session_recording", "ai_assisted_summary", "anonymized_case_use", "marketing_testimonial"];
    if (requireConsents) consentKeys.forEach(key => {
      if (typeof state.consents?.[key]?.accepted !== "boolean" || state.consents?.[key]?.decided !== true) errors[`consent_${key}`] = "동의 또는 동의하지 않음을 직접 선택해 주세요.";
    });
    const marketing = state.consents?.marketing_testimonial;
    if (requireConsents && marketing?.accepted) {
      const exposure = marketing.options || {};
      const exposureKeys = ["disclose_name", "disclose_photo", "disclose_organization", "disclose_testimonial_text"];
      if (!exposureKeys.every(key => typeof exposure[key] === "boolean")) errors.marketing_options = "이름·사진·소속·후기 문구의 공개 여부를 각각 선택해 주세요.";
      else if (!exposureKeys.some(key => exposure[key] === true)) errors.marketing_options = "홍보 활용에 동의하려면 공개할 항목을 하나 이상 선택해 주세요. 모두 공개하지 않으려면 동의하지 않음을 선택해 주세요.";
      if (!Array.isArray(exposure.publication_channels) || exposure.publication_channels.length === 0) errors.marketing_channels = "공개 채널을 하나 이상 입력해 주세요.";
      if (!hasValue(exposure.publication_period)) errors.marketing_duration = "공개 기간을 입력해 주세요.";
    }
    return { valid: Object.keys(errors).length === 0, errors };
  };

  const canTransition = (from, to) => Array.isArray(ALLOWED_TRANSITIONS[from]) && ALLOWED_TRANSITIONS[from].includes(to);

  Object.defineProperty(window, "ContractValidation", {
    value: Object.freeze({ ALLOWED_TRANSITIONS, cleanText, validateAdmin, validateSigning, canTransition }),
    configurable: false,
    writable: false
  });
})();
