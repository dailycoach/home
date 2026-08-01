(() => {
  "use strict";

  const TEMPLATE_ROOT = "/coaching/contracts/templates";
  const TYPE_LABELS = Object.freeze({ life: "라이프 코칭", business: "비즈니스 코칭", career: "커리어 코칭" });
  const templateCache = new Map();

  const el = (tag, options = {}, children = []) => {
    const node = document.createElement(tag);
    if (options.className) node.className = options.className;
    if (options.text !== undefined && options.text !== null) node.textContent = String(options.text);
    if (options.attrs) Object.entries(options.attrs).forEach(([key, value]) => {
      if (value !== undefined && value !== null) node.setAttribute(key, String(value));
    });
    const childList = Array.isArray(children) ? children : [children];
    childList.filter(Boolean).forEach(child => node.append(child));
    return node;
  };

  const getPath = (value, path) => {
    if (!path) return undefined;
    return String(path).split(".").reduce((current, key) => current == null ? undefined : current[key], value);
  };

  const partyByRole = (snapshot, role) => {
    const parties = snapshot.parties || snapshot.contract_parties || [];
    return Array.isArray(parties) ? parties.find(party => party?.role === role) || {} : parties?.[role] || {};
  };

  const interpolationContext = snapshot => ({
    ...snapshot,
    ...(snapshot.template_variables || snapshot.templateVariables || {}),
    values: snapshot.values || snapshot,
    coach: partyByRole(snapshot, "coach"),
    client: partyByRole(snapshot, "client"),
    sponsor: partyByRole(snapshot, "sponsor"),
    organization_contact: partyByRole(snapshot, "organization_contact"),
    coach_name: pickPartyName(snapshot, "coach"),
    client_name: pickPartyName(snapshot, "client"),
    sponsor_name: pickPartyName(snapshot, "sponsor") || "해당 없음",
    organization_contact_name: pickPartyName(snapshot, "organization_contact") || "해당 없음",
    contract_type_label: TYPE_LABELS[snapshot.contract_type || snapshot.contractType] || "코칭"
  });

  function pickPartyName(snapshot, role) {
    const party = partyByRole(snapshot, role);
    return party.display_name || party.displayName || party.name || "";
  }

  const resolveToken = (context, token) => {
    const path = String(token).trim();
    const direct = getPath(context, path);
    if (direct !== undefined && direct !== null && String(direct).trim() !== "") return String(direct);
    const values = getPath(context.values, path);
    if (values !== undefined && values !== null && String(values).trim() !== "") return String(values);
    return `[${path}: 미입력]`;
  };

  const interpolate = (value, context) => String(value ?? "").replace(/{{\s*([A-Za-z0-9_.-]+)\s*}}/g, (_, token) => resolveToken(context, token));

  const fetchJson = async path => {
    const response = await fetch(path, { cache: "no-store", credentials: "same-origin", referrerPolicy: "no-referrer" });
    if (!response.ok) throw new Error("계약 템플릿을 불러오지 못했습니다.");
    const data = await response.json();
    if (!data || typeof data !== "object") throw new Error("계약 템플릿 형식이 올바르지 않습니다.");
    return data;
  };

  const normalizeConsents = value => {
    if (Array.isArray(value)) return value;
    if (!value || typeof value !== "object") return [];
    return Object.entries(value).map(([key, item]) => ({ consentKey: key, ...(item || {}) }));
  };

  const mergeTemplates = (common, variant) => {
    const overrideMap = new Map(normalizeConsents(variant.consentOverrides).map(item => [item.consentKey || item.key || item.id, item]));
    const optionalConsents = normalizeConsents(common.optionalConsents).map(item => {
      const key = item.consentKey || item.key || item.id;
      return { ...item, ...(overrideMap.get(key) || {}), consentKey: key };
    });
    normalizeConsents(variant.consentOverrides).forEach(item => {
      const key = item.consentKey || item.key || item.id;
      if (!optionalConsents.some(existing => existing.consentKey === key)) optionalConsents.push({ ...item, consentKey: key });
    });

    return Object.freeze({
      templateId: variant.templateId || `${common.templateId || "common"}+${variant.contractType || variant.type || "type"}`,
      templateVersion: variant.templateVersion || common.templateVersion || "v1",
      type: variant.contractType || variant.type,
      contractType: variant.contractType || variant.type,
      locale: variant.locale || common.locale || "ko-KR",
      audience: variant.audience || common.audience || "adult",
      documentRules: { ...(common.documentRules || {}), ...(variant.documentRules || {}) },
      parties: variant.parties || [],
      eligibility: variant.eligibility || variant.audience || {},
      typeSpecificTerms: variant.typeSpecificTerms || [],
      contractFieldRequirements: variant.contractFieldRequirements || [],
      clauses: [...(Array.isArray(common.clauses) ? common.clauses : []), ...(Array.isArray(variant.clauses) ? variant.clauses : [])]
        .sort((a, b) => Number(a.order || 0) - Number(b.order || 0)),
      optionalConsents,
      legalReviewItems: [...(common.legalReviewItems || []), ...(variant.legalReviewItems || [])],
      references: common.references || [],
      common,
      variant
    });
  };

  const loadTemplates = async type => {
    if (!TYPE_LABELS[type]) throw new Error("지원하지 않는 계약 유형입니다.");
    if (templateCache.has(type)) return templateCache.get(type);
    const promise = Promise.all([
      fetchJson(`${TEMPLATE_ROOT}/common.v1.json`),
      fetchJson(`${TEMPLATE_ROOT}/${type}.v1.json`)
    ]).then(([common, variant]) => mergeTemplates(common, variant));
    templateCache.set(type, promise);
    try {
      return await promise;
    } catch (error) {
      templateCache.delete(type);
      throw error;
    }
  };

  const appendBody = (container, body, context) => {
    const parts = Array.isArray(body) ? body : [body];
    parts.forEach(part => {
      if (part === undefined || part === null) return;
      if (typeof part === "string" || typeof part === "number") {
        container.append(el("p", { text: interpolate(part, context) }));
        return;
      }
      if (Array.isArray(part.items)) {
        const list = el(part.ordered ? "ol" : "ul");
        part.items.forEach(item => list.append(el("li", { text: interpolate(item, context) })));
        container.append(list);
        return;
      }
      if (part.text) container.append(el("p", { text: interpolate(part.text, context) }));
    });
  };

  const displayValue = (value, fallback = "확정 전") => {
    if (value === undefined || value === null || String(value).trim() === "") return fallback;
    return String(value);
  };

  const addDefinition = (list, label, value, className) => {
    const wrapper = el("div", { className });
    wrapper.append(el("dt", { text: label }), el("dd", { text: displayValue(value) }));
    list.append(wrapper);
  };

  const pick = (snapshot, paths, fallback) => {
    for (const path of paths) {
      const value = getPath(snapshot, path);
      if (value !== undefined && value !== null && String(value).trim() !== "") return value;
    }
    return fallback;
  };

  const renderSnapshot = (container, rawSnapshot, options = {}) => {
    const snapshot = rawSnapshot?.canonical_snapshot || rawSnapshot?.snapshot || rawSnapshot?.document || rawSnapshot || {};
    const template = options.templateBundle || snapshot.template || rawSnapshot?.template || {};
    const type = pick(snapshot, ["contract_type", "contractType"], pick(template, ["contractType", "type", "variant.contractType", "variant.type"], "life"));
    const typeLabel = TYPE_LABELS[type] || displayValue(type, "코칭");
    const clauses = Array.isArray(snapshot.clauses)
      ? snapshot.clauses
      : (options.allowTemplateFallback === true && Array.isArray(template.clauses) ? template.clauses : []);
    const context = interpolationContext(snapshot);

    const documentNode = el("article", { className: "document", attrs: { "aria-label": `${typeLabel} 계약 전문` } });
    const header = el("header", { className: "document-header" });
    header.append(el("p", { className: "document-brand", text: "DAILYCOACHING · COACHING AGREEMENT" }));
    header.append(el("h1", { text: pick(snapshot, ["title"], `${typeLabel} 계약서`) }));
    const metadata = el("dl", { className: "document-meta" });
    addDefinition(metadata, "계약번호", pick(snapshot, ["contract_number", "contractNumber"], "발행 전"));
    addDefinition(metadata, "계약 유형", typeLabel);
    addDefinition(metadata, "문서 버전", pick(snapshot, ["version_number", "versionNumber", "template_version", "templateVersion"], template.templateVersion || "v1"));
    header.append(metadata);
    documentNode.append(header);

    const body = el("div", { className: "document-body" });
    const summary = el("section", { className: "document-summary", attrs: { "aria-labelledby": options.summaryHeadingId || "document-summary-title" } });
    summary.append(el("h2", { text: "주요 계약 조건", attrs: { id: options.summaryHeadingId || "document-summary-title" } }));
    const summaryList = el("dl", { className: "summary-grid" });
    addDefinition(summaryList, "코치", pick(partyByRole(snapshot, "coach"), ["display_name", "displayName", "name"]));
    addDefinition(summaryList, "고객", pick(partyByRole(snapshot, "client"), ["display_name", "displayName", "name"]));
    if (type === "business") addDefinition(summaryList, "스폰서", pick(partyByRole(snapshot, "sponsor"), ["display_name", "displayName", "name"]));
    addDefinition(summaryList, "회기", `${displayValue(pick(snapshot, ["session_count", "session.count"], "-"))}회 · 회기당 ${displayValue(pick(snapshot, ["session_minutes", "session.minutes"], "-"))}분`);
    addDefinition(summaryList, "기간", `${displayValue(pick(snapshot, ["start_date", "period.start"], "-"))} ~ ${displayValue(pick(snapshot, ["expected_end_date", "period.end"], "-"))}`);
    addDefinition(summaryList, "진행 방식", pick(snapshot, ["delivery_method", "session.delivery_method"]));
    addDefinition(summaryList, "비용", `${displayValue(pick(snapshot, ["fee_amount", "fee.amount"], "-"))} ${displayValue(pick(snapshot, ["fee_currency", "fee.currency"], "KRW"))}`);
    if (type === "business") addDefinition(summaryList, "보고 범위", pick(snapshot, ["reporting_scope", "sponsor_terms.reporting_scope"]));
    summary.append(summaryList);
    body.append(summary);

    if (!clauses.length) {
      body.append(el("p", { className: "document-notice", text: "계약 전문 스냅샷이 제공되지 않았습니다. 계약 서비스 연결 상태를 확인해 주세요." }));
    } else {
      clauses.forEach((clause, index) => {
        const article = el("section", { className: "clause" });
        const headingId = `clause-${String(clause.id || index + 1).replace(/[^A-Za-z0-9_-]/g, "-")}`;
        const heading = el("div", { className: "clause-heading" });
        heading.append(el("span", { className: "clause-number", text: String(clause.order || index + 1).padStart(2, "0") }));
        heading.append(el("h2", { text: clause.title || `계약 조항 ${index + 1}`, attrs: { id: headingId } }));
        article.setAttribute("aria-labelledby", headingId);
        article.append(heading);
        const content = el("div", { className: "clause-content" });
        if (clause.summary) content.append(el("p", { text: interpolate(clause.summary, context) }));
        appendBody(content, clause.body, context);
        if ((clause.reviewStatus || clause.review_status) === "LEGAL_REVIEW_REQUIRED") content.append(el("span", { className: "inline-review", text: "LEGAL_REVIEW_REQUIRED" }));
        article.append(content);
        body.append(article);
      });
    }

    const legalItems = snapshot.legalReviewItems || template.legalReviewItems || [];
    if (legalItems.length || snapshot.legal_review_required) {
      const text = legalItems.length
        ? `법률 검토 필요 항목: ${legalItems.map(item => typeof item === "string" ? item : item.title || item.id).join(", ")}`
        : "이 계약 문구에는 법률 검토가 필요한 항목이 포함되어 있습니다.";
      body.append(el("p", { className: "document-notice", text: `LEGAL_REVIEW_REQUIRED · ${text}` }));
    }
    documentNode.append(body);

    container.replaceChildren(documentNode);
    return documentNode;
  };

  const buildPreviewSnapshot = (template, payload) => ({
    ...payload,
    title: payload.title || `${TYPE_LABELS[payload.contract_type] || "코칭"} 계약서`,
    template_version: template.templateVersion,
    version_number: payload.version_number || 1,
    clauses: template.clauses,
    legalReviewItems: template.legalReviewItems,
    optionalConsents: template.optionalConsents
  });

  const bodyAsText = (body, context) => {
    const parts = Array.isArray(body) ? body : [body];
    return parts.map(part => {
      if (part === undefined || part === null) return "";
      if (typeof part === "string" || typeof part === "number") return interpolate(part, context);
      if (Array.isArray(part.items)) return part.items.map((item, index) => `${part.ordered ? `${index + 1}.` : "-"} ${interpolate(item, context)}`).join("\n");
      return part.text ? interpolate(part.text, context) : "";
    }).filter(Boolean).join("\n\n");
  };

  const stripVariableBraces = value => String(value || "").replace(/^{{\s*|\s*}}$/g, "");

  const hydrateConsentDefinition = (definition, payload) => {
    const key = definition.consentKey || definition.key || definition.id;
    const config = payload.technology_terms?.[key] || {};
    const enabled = config.enabled === true;
    const disabledText = "사용 안 함";
    const base = {
      key,
      enabled,
      version: definition.consentTextVersion || definition.textVersion || definition.version || "v1",
      text: definition.consentText || definition.text || definition.description || `${definition.title || key} 선택 동의`,
      purpose: enabled ? (config.purpose || definition.purpose || "") : disabledText,
      scope: enabled ? (config.scope || config.input_scope || definition.scope || "") : disabledText,
      retention: enabled ? (config.retention || config.duration || definition.retentionPeriod || definition.retention || "") : disabledText,
      withdrawal: enabled ? (config.withdrawal || definition.withdrawalMethod || definition.withdrawal || "") : disabledText
    };
    if (key === "ai_assisted_summary") Object.assign(base, {
      provider: enabled ? (config.service || definition.serviceName || "") : disabledText,
      session_extent: enabled ? (config.coverage || definition.sessionUsageScope || "") : disabledText,
      human_review: enabled ? (config.human_review || definition.humanReview || "") : disabledText,
      external_transfer: enabled ? (config.external_provider || definition.externalProviderTerms || "") : disabledText,
      overseas_processing: enabled ? (config.cross_border || definition.crossBorderProcessing || "") : disabledText,
      error_notice: definition.errorNotice || "AI 결과에는 누락·왜곡·오류 가능성이 있습니다."
    });
    if (key === "anonymized_case_use") Object.assign(base, {
      media: enabled ? (config.media || definition.media || "") : disabledText,
      de_identification: enabled ? (config.identifiers_removed || definition.identifiersRemoved || "") : disabledText,
      re_identification_risk: enabled ? (config.reidentification_risk || definition.reidentificationRisk || "") : disabledText,
      use_period: enabled ? (config.duration || definition.retentionPeriod || "") : disabledText,
      withdrawal_deadline: enabled ? (config.withdrawal || definition.withdrawalDeadline || "") : disabledText
    });
    if (key === "marketing_testimonial") Object.assign(base, {
      public_channels: enabled ? String(config.channels || "").split(",").map(item => item.trim()).filter(Boolean) : [disabledText],
      public_period: enabled ? (config.duration || definition.retentionPeriod || "") : disabledText
    });
    return base;
  };

  const buildCanonicalDocument = (template, payload) => {
    const clauses = (template.clauses || []).map((clause, index) => ({
      id: String(clause.id || `clause_${index + 1}`),
      order: Number(clause.order || index + 1),
      title: String(clause.title || `계약 조항 ${index + 1}`),
      summary: String(clause.summary || "계약 내용을 확인합니다."),
      body: clause.body,
      review_status: clause.reviewStatus || "CONTENT_READY",
      required: clause.required !== false,
      variables: Array.isArray(clause.variables) ? clause.variables.map(stripVariableBraces) : []
    }));
    const consentDefinitions = (template.optionalConsents || []).map(item => hydrateConsentDefinition(item, payload));
    return {
      schema_version: "1.0",
      language: template.locale || "ko-KR",
      title: payload.title,
      clauses,
      consent_definitions: consentDefinitions,
      legal_review_items: template.legalReviewItems || [],
      notices: {
        electronic_document: payload.template_variables?.electronic_document_notice || "본 계약은 전자문서 방식으로 체결됩니다.",
        copy_delivery: payload.template_variables?.document_delivery_method || "안전한 만료 링크와 이메일",
        access_period: payload.template_variables?.document_access_period || "운영 설정에 따른 기간",
        save_method: "인쇄 또는 브라우저 PDF 저장",
        change_termination_request: payload.template_variables?.electronic_request_method || "담당 코치의 공식 문의 채널",
        verification_request: payload.template_variables?.document_support_contact || "담당 코치의 공식 문의 채널"
      }
    };
  };

  const consentDefinitions = (snapshot, template) => {
    const direct = snapshot?.optionalConsents || snapshot?.optional_consents || snapshot?.consentDefinitions || snapshot?.consent_definitions || snapshot?.consents_config;
    const items = normalizeConsents(direct || template?.optionalConsents);
    const requiredKeys = ["session_recording", "ai_assisted_summary", "anonymized_case_use", "marketing_testimonial"];
    return requiredKeys.map(key => {
      const found = items.find(item => (item.consentKey || item.key || item.id) === key) || {};
      return {
        ...found,
        consentKey: key,
        consentText: found.consentText || found.consent_text || found.text,
        consentTextVersion: found.consentTextVersion || found.consent_text_version || found.textVersion || found.text_version || found.version,
        consentTextHash: found.consentTextHash || found.consent_text_hash || found.textHash || found.text_hash,
        required: false,
        defaultAccepted: false
      };
    });
  };

  Object.defineProperty(window, "ContractRenderer", {
    value: Object.freeze({ TYPE_LABELS, el, loadTemplates, mergeTemplates, renderSnapshot, buildPreviewSnapshot, buildCanonicalDocument, consentDefinitions, interpolate }),
    configurable: false,
    writable: false
  });
})();
