(() => {
  'use strict';

  const contracts = window.DAILYCOACHING_CONTRACTS;
  const config = window.DAILYCOACHING_CONTRACT_CONFIG || {};
  const validTypes = new Set(['life', 'business', 'career']);
  const acknowledgementNames = Object.freeze([
    'ackScope',
    'ackFees',
    'ackConfidentiality',
    'ackPrivacy',
    'ackNoGuarantee'
  ]);
  const stepMeta = Object.freeze([
    {
      eyebrow: 'Step 01 / Contract type',
      title: '어떤 코칭을 시작하나요?',
      description: '현재 가장 먼저 다루고 싶은 장면을 기준으로 계약 유형을 선택하세요.'
    },
    {
      eyebrow: 'Step 02 / Contract details',
      title: '실제 조건을 입력합니다.',
      description: '계약 당사자와 회기·일정·비용·변경 및 환불 기준을 확인합니다.'
    },
    {
      eyebrow: 'Step 03 / Terms review',
      title: '주요 조항을 확인합니다.',
      description: '요약과 정식 문구를 함께 읽고 핵심 조항을 각각 확인하세요.'
    },
    {
      eyebrow: 'Step 04 / Draft preview',
      title: '초안 전체를 살펴봅니다.',
      description: '입력한 조건과 조항이 한 문서로 어떻게 구성되는지 확인합니다.'
    },
    {
      eyebrow: 'Step 05 / Print and next steps',
      title: '초안을 저장하고 다음 절차를 확인합니다.',
      description: '공개 작성기와 초대형 전자계약은 서로 분리되어 있습니다.'
    }
  ]);
  const blankValues = Object.freeze({
    clientName: '',
    clientRole: '',
    clientEmail: '',
    clientPhone: '',
    clientOrganization: '',
    clientTitle: '',
    goalSummary: '',
    coachingPurpose: '',
    sponsorOrganization: '',
    sponsorName: '',
    sponsorEmail: '',
    sessions: '',
    sessionMinutes: '',
    deliveryMode: '',
    startDate: '',
    endDate: '',
    deliveryLocation: '',
    totalFee: '',
    feePerSession: '',
    paymentMethod: '',
    paymentSchedule: '',
    reschedulePolicy: '',
    noShowPolicy: '',
    refundPolicy: ''
  });

  const dom = {};
  let state;
  let printSession = null;
  let originalDocumentTitle = document.title;

  function init() {
    cacheDom();
    if (!dom.form) return;

    if (!contracts || typeof contracts.getClauses !== 'function') {
      showFatalConfigurationMessage();
      return;
    }

    const requestedType = readRequestedType();
    state = createInitialState(requestedType);
    bindEvents();
    renderProviderSummary();
    renderPrivacyNotice();
    renderOptionalConsents();
    renderRuntimeState();
    syncStateToForm();
    renderTypeDependentSections();
    showStep(0, false);

    const navigationEntry = performance.getEntriesByType?.('navigation')?.[0];
    window.addEventListener('pageshow', (event) => {
      if (event.persisted || navigationEntry?.type === 'reload') {
        resetDraft({ preserveType: true, ask: false, focus: false });
      }
    });
    window.addEventListener('pagehide', clearSensitiveMemory);
    window.addEventListener('beforeprint', preparePrintDocument);
    window.addEventListener('afterprint', restorePrintDocument);
  }

  function cacheDom() {
    dom.form = document.querySelector('#agreementForm');
    dom.panels = [...document.querySelectorAll('[data-step-panel]')];
    dom.stepButtons = [...document.querySelectorAll('[data-step-button]')];
    dom.stepEyebrow = document.querySelector('#stepEyebrow');
    dom.stepTitle = document.querySelector('#stepTitle');
    dom.stepDescription = document.querySelector('#stepDescription');
    dom.errorSummary = document.querySelector('#errorSummary');
    dom.errorSummaryList = document.querySelector('#errorSummaryList');
    dom.providerSummary = document.querySelector('#providerSummary');
    dom.businessModeSection = document.querySelector('#businessModeSection');
    dom.clientOrganizationField = document.querySelector('#clientOrganizationField');
    dom.clientTitleField = document.querySelector('#clientTitleField');
    dom.sponsorSection = document.querySelector('#sponsorSection');
    dom.sharingSection = document.querySelector('#sharingSection');
    dom.sharingTableBody = document.querySelector('#sharingTableBody');
    dom.sharingCards = document.querySelector('#sharingCards');
    dom.sponsorDisclosureRecipient = document.querySelector('#sponsorDisclosureRecipient');
    dom.sponsorDisclosureItems = document.querySelector('#sponsorDisclosureItems');
    dom.sponsorDisclosureConsentRow = document.querySelector('#sponsorDisclosureConsentRow');
    dom.clauseList = document.querySelector('#clauseList');
    dom.privacyNoticeList = document.querySelector('#privacyNoticeList');
    dom.optionalConsents = document.querySelector('#optionalConsents');
    dom.consentOperationalNote = document.querySelector('#consentOperationalNote');
    dom.previewHost = document.querySelector('#previewHost');
    dom.systemBanner = document.querySelector('#systemBanner');
    dom.systemBannerTitle = document.querySelector('#systemBannerTitle');
    dom.systemBannerMessage = document.querySelector('#systemBannerMessage');
  }

  function createInitialState(type) {
    return {
      type: validTypes.has(type) ? type : null,
      businessMode: 'individual',
      currentStep: 0,
      maxStepReached: 0,
      values: { ...blankValues },
      sharing: Object.fromEntries(
        contracts.sharingMatrix.map((item) => [item.id, Boolean(item.defaultShared)])
      ),
      acknowledgements: Object.fromEntries(
        acknowledgementNames.map((name) => [name, false])
      ),
      consents: Object.fromEntries(
        contracts.optionalConsents.map((item) => [item.id, false])
      ),
      sponsorDisclosureConsent: false,
      dirty: false
    };
  }

  function readRequestedType() {
    const url = new URL(window.location.href);
    const requested = url.searchParams.get('type');
    if (!requested) return null;
    if (validTypes.has(requested)) return requested;
    window.history.replaceState(null, '', window.location.pathname);
    return null;
  }

  function bindEvents() {
    dom.form.addEventListener('input', handleFormInput);
    dom.form.addEventListener('change', handleFormChange);
    dom.form.addEventListener('submit', (event) => {
      event.preventDefault();
      moveNext();
    });

    document.querySelectorAll('[data-prev-step]').forEach((button) => {
      button.addEventListener('click', () => showStep(Math.max(0, state.currentStep - 1), true));
    });
    dom.stepButtons.forEach((button) => {
      button.addEventListener('click', () => {
        const nextStep = Number(button.dataset.stepButton);
        if (nextStep <= state.maxStepReached) showStep(nextStep, true);
      });
    });
    document.querySelector('[data-open-clauses]')?.addEventListener('click', () => {
      dom.clauseList.querySelectorAll('details').forEach((detail) => {
        detail.open = true;
      });
    });
    document.querySelector('[data-close-clauses]')?.addEventListener('click', () => {
      dom.clauseList.querySelectorAll('details').forEach((detail) => {
        detail.open = false;
      });
    });
    document.querySelectorAll('[data-print-draft]').forEach((button) => {
      button.addEventListener('click', printDraft);
    });
    document.querySelector('[data-reset-draft]')?.addEventListener('click', () => {
      resetDraft({ preserveType: true, ask: true, focus: true });
    });
  }

  function handleFormInput(event) {
    const target = event.target;
    if (!(target instanceof HTMLInputElement || target instanceof HTMLSelectElement || target instanceof HTMLTextAreaElement)) return;
    if (!Object.prototype.hasOwnProperty.call(state.values, target.name)) return;

    state.values[target.name] = target.value;
    state.dirty = true;
    clearFieldError(target.name);
    if (target.name === 'sponsorOrganization') {
      invalidateSponsorDisclosureConsent();
      renderSponsorDisclosure();
    }
  }

  function handleFormChange(event) {
    const target = event.target;
    if (!(target instanceof HTMLInputElement || target instanceof HTMLSelectElement || target instanceof HTMLTextAreaElement)) return;

    if (target.name === 'contractType') {
      changeContractType(target.value);
      return;
    }

    if (target.name === 'businessMode') {
      changeBusinessMode(target.value);
      return;
    }

    if (target.name === 'sponsorDisclosureConsent') {
      state.sponsorDisclosureConsent = target.checked;
      state.dirty = true;
      clearFieldError('sponsorDisclosureConsent');
      return;
    }

    if (acknowledgementNames.includes(target.name)) {
      state.acknowledgements[target.name] = target.checked;
      state.dirty = true;
      clearFieldError('acknowledgement');
      return;
    }

    const consentId = target.dataset.consentId;
    if (consentId && Object.prototype.hasOwnProperty.call(state.consents, consentId)) {
      state.consents[consentId] = target.checked;
      state.dirty = true;
      return;
    }

    const sharingId = target.dataset.sharingId;
    if (sharingId && Object.prototype.hasOwnProperty.call(state.sharing, sharingId)) {
      state.sharing[sharingId] = target.checked;
      syncSharingControls(sharingId);
      invalidateSponsorDisclosureConsent();
      renderSponsorDisclosure();
      state.dirty = true;
    }
  }

  function changeContractType(nextType) {
    if (!validTypes.has(nextType)) return;
    const previousType = state.type;
    const switchingExistingDraft = previousType && previousType !== nextType && hasMeaningfulDraft();

    if (switchingExistingDraft) {
      const approved = window.confirm('계약 유형을 바꾸면 유형별 정보와 조항 확인 상태가 초기화됩니다. 계속할까요?');
      if (!approved) {
        syncContractTypeControls();
        return;
      }
    }

    state.type = nextType;
    state.businessMode = 'individual';
    clearBusinessOnlyValues();
    resetReviewSelections();
    state.dirty = true;
    updateTypeInAddress(nextType);
    renderTypeDependentSections();
    clearFieldError('contractType');
  }

  function changeBusinessMode(nextMode) {
    if (!['individual', 'sponsored'].includes(nextMode)) return;
    if (state.businessMode === 'sponsored' && nextMode === 'individual' && hasSponsorInformation()) {
      const approved = window.confirm('2자 계약으로 바꾸면 스폰서 정보와 선택한 공유범위가 삭제됩니다. 계속할까요?');
      if (!approved) {
        syncBusinessModeControls();
        return;
      }
    }

    state.businessMode = nextMode;
    if (nextMode === 'individual') clearSponsorValues();
    resetReviewSelections();
    state.dirty = true;
    renderTypeDependentSections();
  }

  function updateTypeInAddress(type) {
    const url = new URL(window.location.href);
    url.search = '';
    url.searchParams.set('type', type);
    window.history.replaceState(null, '', `${url.pathname}${url.search}`);
  }

  function hasMeaningfulDraft() {
    return Object.values(state.values).some((value) => String(value).trim()) ||
      Object.values(state.acknowledgements).some(Boolean);
  }

  function hasSponsorInformation() {
    return ['sponsorOrganization', 'sponsorName', 'sponsorEmail']
      .some((key) => state.values[key].trim()) ||
      contracts.sharingMatrix.some((item) => !item.fixed && state.sharing[item.id]);
  }

  function clearBusinessOnlyValues() {
    ['clientOrganization', 'clientTitle'].forEach((key) => {
      state.values[key] = '';
    });
    clearSponsorValues();
  }

  function clearSponsorValues() {
    ['sponsorOrganization', 'sponsorName', 'sponsorEmail'].forEach((key) => {
      state.values[key] = '';
      const field = dom.form.elements.namedItem(key);
      if (field) field.value = '';
      clearFieldError(key);
    });
    contracts.sharingMatrix.forEach((item) => {
      state.sharing[item.id] = Boolean(item.defaultShared);
    });
    state.sponsorDisclosureConsent = false;
    const disclosureConsent = dom.form.elements.namedItem('sponsorDisclosureConsent');
    if (disclosureConsent) disclosureConsent.checked = false;
    clearFieldError('sponsorDisclosureConsent');
  }

  function resetReviewSelections() {
    acknowledgementNames.forEach((name) => {
      state.acknowledgements[name] = false;
      const input = dom.form.elements.namedItem(name);
      if (input) input.checked = false;
    });
    Object.keys(state.consents).forEach((id) => {
      state.consents[id] = false;
    });
    clearFieldError('acknowledgement');
  }

  function syncStateToForm() {
    Object.entries(state.values).forEach(([name, value]) => {
      const field = dom.form.elements.namedItem(name);
      if (field) field.value = value;
    });
    syncContractTypeControls();
    syncBusinessModeControls();
    acknowledgementNames.forEach((name) => {
      const input = dom.form.elements.namedItem(name);
      if (input) input.checked = Boolean(state.acknowledgements[name]);
    });
    dom.optionalConsents?.querySelectorAll('[data-consent-id]').forEach((input) => {
      input.checked = Boolean(state.consents[input.dataset.consentId]);
    });
    contracts.sharingMatrix.forEach((item) => syncSharingControls(item.id));
    const sponsorDisclosureConsent = dom.form.elements.namedItem('sponsorDisclosureConsent');
    if (sponsorDisclosureConsent) sponsorDisclosureConsent.checked = state.sponsorDisclosureConsent;
  }

  function syncContractTypeControls() {
    dom.form.querySelectorAll('input[name="contractType"]').forEach((input) => {
      input.checked = input.value === state.type;
    });
  }

  function syncBusinessModeControls() {
    dom.form.querySelectorAll('input[name="businessMode"]').forEach((input) => {
      input.checked = input.value === state.businessMode;
    });
  }

  function renderTypeDependentSections() {
    const isBusiness = state.type === 'business';
    const isSponsored = isBusiness && state.businessMode === 'sponsored';

    setSectionVisibility(dom.businessModeSection, isBusiness);
    setSectionVisibility(dom.clientOrganizationField, isBusiness);
    setSectionVisibility(dom.clientTitleField, isBusiness);
    setSectionVisibility(dom.sponsorSection, isSponsored);
    setSectionVisibility(dom.sharingSection, isSponsored);
    syncBusinessModeControls();

    const goalField = document.querySelector('#goalSummary');
    if (goalField && state.type) {
      goalField.placeholder = contracts.types[state.type].goalPlaceholder;
    } else if (goalField) {
      goalField.removeAttribute('placeholder');
    }

    renderSharingMatrix();
    renderSponsorDisclosure();
    renderClauses();
  }

  function setSectionVisibility(element, visible) {
    if (!element) return;
    element.hidden = !visible;
    element.inert = !visible;
  }

  function renderProviderSummary() {
    if (!dom.providerSummary) return;
    const provider = config.provider || {};
    const rows = [
      ['서비스명', provider.serviceName],
      ['상호·법적 명칭', provider.legalName],
      ['대표자', provider.representative],
      ['담당 코치', provider.coachName],
      ['코치 자격', provider.coachCredentials],
      ['사업자등록번호', provider.businessRegistrationNumber],
      ['사업장 주소', provider.businessAddress],
      ['연락처', provider.phone],
      ['이메일', provider.email],
      ['과세·면세 안내', provider.taxNotice],
      ['분쟁 관할·소재지', provider.disputeLocation]
    ];
    const list = createElement('dl');

    rows.forEach(([label, value]) => {
      list.append(
        createElement('dt', '', label),
        createElement('dd', value ? '' : 'is-missing', value || '운영자 확인 필요')
      );
    });
    dom.providerSummary.replaceChildren(list);
  }

  function renderPrivacyNotice() {
    if (!dom.privacyNoticeList) return;
    const notice = contracts.privacyNotice;
    const rows = [
      ['개인정보 처리자', notice.controller],
      ['처리 목적', notice.purpose],
      ['필수 처리항목', notice.requiredItems],
      ['선택 처리항목', notice.optionalItems],
      ['처리 근거', notice.legalBasis],
      ['보유기간', notice.retention],
      ['파기방법', notice.destruction],
      ['고객의 권리', notice.rights],
      ['담당자 연락처', notice.contact],
      ['안내 버전', notice.version]
    ];
    const fragment = document.createDocumentFragment();
    rows.forEach(([label, value]) => {
      fragment.append(createElement('dt', '', label), createElement('dd', '', value));
    });
    dom.privacyNoticeList.replaceChildren(fragment);
  }

  function renderOptionalConsents() {
    if (!dom.optionalConsents) return;
    /*
     * 공개 초안 작성기는 선택 동의를 수집하지 않는다. 운영 feature flag만으로
     * 처리 목적·항목·수탁자·보유기간이 확정되지 않은 포괄 동의가 노출되는 것을
     * 막고, 실제 전자계약의 서버 검증된 항목별 안내에서만 동의를 받는다.
     */
    dom.optionalConsents.hidden = true;
    dom.optionalConsents.replaceChildren();
    dom.consentOperationalNote.textContent = '공개 초안 작성기에서는 선택 동의를 받지 않습니다. 현재 DAILYCOACHING은 별도 합의 없이 코칭 세션을 녹음하거나 음성 전사·AI 요약 도구에 입력하지 않으며, 연구·사례·홍보·마케팅·제3자 전달도 실제 운영과 항목별 안내가 확정된 초대형 전자계약에서만 별도로 제시합니다.';
  }

  function renderSharingMatrix() {
    if (!dom.sharingTableBody || !dom.sharingCards) return;
    const tableFragment = document.createDocumentFragment();
    const cardFragment = document.createDocumentFragment();

    contracts.sharingMatrix.forEach((item) => {
      const row = createElement('tr');
      row.append(
        createElement('td', '', item.label),
        createElement('td', '', normalizeClientSharingLabel(item.client))
      );
      const sponsorCell = createElement('td');
      sponsorCell.append(createSharingControl(item, 'table'));
      row.append(sponsorCell);
      tableFragment.append(row);

      const card = createElement('article', 'sharing-card');
      card.append(
        createElement('strong', '', item.label),
        createElement('p', '', `고객: ${normalizeClientSharingLabel(item.client)}`)
      );
      const sponsorLine = createElement('div');
      sponsorLine.append(createSharingControl(item, 'card'));
      card.append(sponsorLine);
      cardFragment.append(card);
    });

    dom.sharingTableBody.replaceChildren(tableFragment);
    dom.sharingCards.replaceChildren(cardFragment);
  }

  function normalizeClientSharingLabel(label) {
    if (label === '공개') return '고객 본인 확인 가능';
    return label;
  }

  function createSharingControl(item, suffix) {
    if (item.fixed) {
      const fixedLabel = item.id === 'session-detail' || item.id === 'personal'
        ? '공유하지 않음 · 잠금'
        : item.sponsor;
      return createElement('span', '', fixedLabel);
    }

    const wrapper = createElement('span', 'sharing-table__toggle');
    const input = createElement('input');
    const id = `sharing-${item.id}-${suffix}`;
    input.type = 'checkbox';
    input.id = id;
    input.dataset.sharingId = item.id;
    input.checked = Boolean(state.sharing[item.id]);
    const label = createElement('label', '', state.sharing[item.id] ? '스폰서와 공유' : '공유하지 않음');
    label.htmlFor = id;
    wrapper.append(input, label);
    return wrapper;
  }

  function syncSharingControls(sharingId) {
    document.querySelectorAll(`[data-sharing-id="${cssEscape(sharingId)}"]`).forEach((input) => {
      input.checked = Boolean(state.sharing[sharingId]);
      const label = input.parentElement?.querySelector('label');
      if (label) label.textContent = input.checked ? '스폰서와 공유' : '공유하지 않음';
    });
  }

  function invalidateSponsorDisclosureConsent() {
    state.sponsorDisclosureConsent = false;
    const input = dom.form.elements.namedItem('sponsorDisclosureConsent');
    if (input) input.checked = false;
    clearFieldError('sponsorDisclosureConsent');
  }

  function renderSponsorDisclosure() {
    if (!dom.sponsorDisclosureRecipient || !dom.sponsorDisclosureItems) return;
    dom.sponsorDisclosureRecipient.textContent = state.values.sponsorOrganization.trim() || '입력한 스폰서 조직';
    const selectedItems = [];
    contracts.sharingMatrix.forEach((item) => {
      if (!item.fixed && state.sharing[item.id]) selectedItems.push(item.label);
    });
    dom.sponsorDisclosureItems.textContent = selectedItems.length
      ? selectedItems.join(', ')
      : '선택한 제공항목 없음';
    const consentInput = dom.form.elements.namedItem('sponsorDisclosureConsent');
    const consentRequired = selectedItems.length > 0;
    setSectionVisibility(dom.sponsorDisclosureConsentRow, consentRequired);
    if (consentInput) consentInput.required = consentRequired;
    if (!consentRequired) {
      state.sponsorDisclosureConsent = false;
      if (consentInput) consentInput.checked = false;
      clearFieldError('sponsorDisclosureConsent');
    }
  }

  function renderClauses() {
    if (!dom.clauseList) return;
    if (!state.type) {
      dom.clauseList.replaceChildren();
      return;
    }

    const replacements = buildTemplateReplacements();
    const fragment = document.createDocumentFragment();
    contracts.getClauses(state.type).forEach((clause) => {
      const detail = createElement('details', 'clause');
      const summary = createElement('summary');
      const number = createElement('span', 'clause__number', String(clause.number).padStart(2, '0'));
      const copy = createElement('span');
      copy.append(
        createElement('span', 'clause__title', clause.title),
        createElement('span', 'clause__summary', clause.summary)
      );
      const toggle = createElement('span', 'clause__toggle');
      toggle.setAttribute('aria-hidden', 'true');
      summary.append(number, copy, toggle);
      const body = createElement('div', 'clause__body');
      body.append(createElement('p', '', interpolate(clause.body, replacements)));
      detail.append(summary, body);
      fragment.append(detail);
    });
    dom.clauseList.replaceChildren(fragment);
  }

  function moveNext() {
    const errors = validateStep(state.currentStep);
    if (errors.length) {
      showErrors(errors);
      return;
    }

    clearErrors();
    const nextStep = Math.min(stepMeta.length - 1, state.currentStep + 1);
    state.maxStepReached = Math.max(state.maxStepReached, nextStep);
    if (nextStep === 2) renderClauses();
    if (nextStep >= 3) buildPreview();
    showStep(nextStep, true);
  }

  function showStep(index, focusHeading) {
    if (!Number.isInteger(index) || index < 0 || index >= stepMeta.length) return;
    state.currentStep = index;

    dom.panels.forEach((panel) => {
      const active = Number(panel.dataset.stepPanel) === index;
      panel.hidden = !active;
      panel.inert = !active;
    });
    dom.stepButtons.forEach((button) => {
      const buttonStep = Number(button.dataset.stepButton);
      button.disabled = buttonStep > state.maxStepReached;
      if (buttonStep === index) button.setAttribute('aria-current', 'step');
      else button.removeAttribute('aria-current');
    });

    const meta = stepMeta[index];
    dom.stepEyebrow.textContent = meta.eyebrow;
    dom.stepTitle.textContent = meta.title;
    dom.stepDescription.textContent = meta.description;
    clearErrors();

    if (focusHeading) {
      dom.stepTitle.focus({ preventScroll: true });
      document.querySelector('.agreement-card')?.scrollIntoView({ block: 'start', behavior: reducedMotion() ? 'auto' : 'smooth' });
    }
  }

  function validateStep(step) {
    if (step === 0) {
      return state.type ? [] : [{ field: 'contractType', message: '코칭 계약 유형을 선택해 주세요.' }];
    }
    if (step === 1) return validateDetails();
    if (step === 2) return validateAcknowledgements();
    if (step === 3) return [...validateDetails(), ...validateAcknowledgements()];
    return [];
  }

  function validateDetails() {
    const errors = [];
    const requiredText = [
      ['clientName', '고객 성명을 입력해 주세요.'],
      ['clientRole', '고객의 계약상 역할을 입력해 주세요.'],
      ['clientEmail', '고객 이메일을 입력해 주세요.'],
      ['clientPhone', '고객 휴대전화번호를 입력해 주세요.'],
      ['goalSummary', '코칭 목표를 한두 문장으로 입력해 주세요.'],
      ['coachingPurpose', '이 계약의 코칭 목적을 한두 문장으로 입력해 주세요.'],
      ['deliveryMode', '진행 방식을 선택해 주세요.'],
      ['startDate', '시작 예정일을 입력해 주세요.'],
      ['endDate', '종료 예정일을 입력해 주세요.'],
      ['deliveryLocation', '진행 장소 또는 화상도구를 입력해 주세요.'],
      ['paymentMethod', '결제방법을 입력해 주세요.'],
      ['paymentSchedule', '결제일정을 입력해 주세요.'],
      ['reschedulePolicy', '일정변경 기준을 입력해 주세요.'],
      ['noShowPolicy', '노쇼 기준을 입력해 주세요.'],
      ['refundPolicy', '중도종료 및 환불 기준을 입력해 주세요.']
    ];

    requiredText.forEach(([field, message]) => {
      if (!state.values[field].trim()) errors.push({ field, message });
    });

    if (state.values.clientEmail && !isValidEmail(state.values.clientEmail)) {
      errors.push({ field: 'clientEmail', message: '이메일 형식을 확인해 주세요.' });
    }
    if (state.values.clientPhone && state.values.clientPhone.replace(/\D/g, '').length < 8) {
      errors.push({ field: 'clientPhone', message: '연락 가능한 전화번호를 확인해 주세요.' });
    }
    if (!isPositiveInteger(state.values.sessions)) {
      errors.push({ field: 'sessions', message: '전체 회기 수는 1 이상의 정수로 입력해 주세요.' });
    }
    if (!isPositiveInteger(state.values.sessionMinutes)) {
      errors.push({ field: 'sessionMinutes', message: '회기당 시간은 1분 이상의 정수로 입력해 주세요.' });
    }
    if (state.values.startDate && state.values.endDate && state.values.startDate > state.values.endDate) {
      errors.push({ field: 'endDate', message: '종료 예정일은 시작 예정일보다 빠를 수 없습니다.' });
    }
    if (parseWon(state.values.totalFee) === null) {
      errors.push({ field: 'totalFee', message: '총 계약금액을 0 이상의 원 단위 숫자로 입력해 주세요.' });
    }
    if (parseWon(state.values.feePerSession) === null) {
      errors.push({ field: 'feePerSession', message: '회기당 금액을 0 이상의 원 단위 숫자로 입력해 주세요.' });
    }

    if (state.type === 'business' && state.businessMode === 'sponsored') {
      [
        ['sponsorOrganization', '스폰서 조직명을 입력해 주세요.'],
        ['sponsorName', '스폰서 담당자 성명을 입력해 주세요.'],
        ['sponsorEmail', '스폰서 담당자 이메일을 입력해 주세요.']
      ].forEach(([field, message]) => {
        if (!state.values[field].trim()) errors.push({ field, message });
      });
      if (state.values.sponsorEmail && !isValidEmail(state.values.sponsorEmail)) {
        errors.push({ field: 'sponsorEmail', message: '스폰서 이메일 형식을 확인해 주세요.' });
      }
      const hasSelectedSponsorSharing = contracts.sharingMatrix.some((item) =>
        !item.fixed && state.sharing[item.id]
      );
      if (hasSelectedSponsorSharing && !state.sponsorDisclosureConsent) {
        errors.push({
          field: 'sponsorDisclosureConsent',
          message: '스폰서에게 제공되는 대상·목적·항목·보유기간·거부권을 확인하고 별도 정보제공 동의를 선택해 주세요.'
        });
      }
    }

    return deduplicateErrors(errors);
  }

  function validateAcknowledgements() {
    const allChecked = acknowledgementNames.every((name) => state.acknowledgements[name]);
    return allChecked
      ? []
      : [{ field: 'acknowledgement', message: '주요 계약조항 다섯 항목을 각각 확인해 주세요.' }];
  }

  function showErrors(errors) {
    clearErrors();
    if (!errors.length) return;
    const fragment = document.createDocumentFragment();

    errors.forEach((error) => {
      const item = createElement('li');
      const link = createElement('a', '', error.message);
      const targetId = getFocusTargetId(error.field);
      link.href = `#${targetId}`;
      link.addEventListener('click', (event) => {
        event.preventDefault();
        focusField(error.field);
      });
      item.append(link);
      fragment.append(item);
      setFieldError(error.field, error.message);
    });

    dom.errorSummaryList.replaceChildren(fragment);
    dom.errorSummary.hidden = false;
    dom.errorSummary.focus();
  }

  function clearErrors() {
    if (!dom.errorSummary) return;
    dom.errorSummary.hidden = true;
    dom.errorSummaryList.replaceChildren();
    dom.form.querySelectorAll('[aria-invalid="true"]').forEach((field) => {
      field.removeAttribute('aria-invalid');
    });
    dom.form.querySelectorAll('.field__error').forEach((error) => {
      error.hidden = true;
      error.textContent = '';
    });
  }

  function setFieldError(field, message) {
    const errorElement = document.querySelector(`#${cssEscape(field)}Error`);
    if (errorElement) {
      errorElement.textContent = message;
      errorElement.hidden = false;
    }

    if (field === 'contractType') {
      dom.form.querySelectorAll('input[name="contractType"]').forEach((input) => input.setAttribute('aria-invalid', 'true'));
    } else if (field === 'acknowledgement') {
      acknowledgementNames.forEach((name) => {
        dom.form.elements.namedItem(name)?.setAttribute('aria-invalid', 'true');
      });
    } else {
      dom.form.elements.namedItem(field)?.setAttribute('aria-invalid', 'true');
    }
  }

  function clearFieldError(field) {
    const errorElement = document.querySelector(`#${cssEscape(field)}Error`);
    if (errorElement) {
      errorElement.textContent = '';
      errorElement.hidden = true;
    }
    if (field === 'acknowledgement') {
      acknowledgementNames.forEach((name) => {
        dom.form.elements.namedItem(name)?.removeAttribute('aria-invalid');
      });
    } else if (field === 'contractType') {
      dom.form.querySelectorAll('input[name="contractType"]').forEach((input) => input.removeAttribute('aria-invalid'));
    } else {
      dom.form.elements.namedItem(field)?.removeAttribute('aria-invalid');
    }
  }

  function getFocusTargetId(field) {
    if (field === 'contractType') return 'contractTypeLife';
    if (field === 'acknowledgement') return 'ackScope';
    return field;
  }

  function focusField(field) {
    const id = getFocusTargetId(field);
    document.querySelector(`#${cssEscape(id)}`)?.focus({ preventScroll: false });
  }

  function renderRuntimeState() {
    const readiness = getElectronicReadiness();
    const email = config.provider?.email || 'hello@daily-coach-ing.com';
    document.querySelectorAll('[data-operator-email-link]').forEach((link) => {
      link.href = `mailto:${email}`;
      if (link.hasAttribute('data-operator-email-text')) link.textContent = email;
    });

    if (readiness.ready) {
      dom.systemBanner.dataset.state = 'ready';
      dom.systemBannerTitle.textContent = '전자계약 연결 준비 확인';
      dom.systemBannerMessage.textContent = '전자계약은 공개 초안과 분리되며, 코치가 발행한 개별 초대 링크에서만 진행됩니다.';
      document.querySelectorAll('[data-electronic-action]').forEach((button) => {
        button.textContent = '개별 초대 링크에서만 체결 가능';
      });
      return;
    }

    dom.systemBanner.dataset.state = 'draft';
    dom.systemBannerTitle.textContent = '전자계약 운영 검토 전';
    dom.systemBannerMessage.textContent = readiness.message;
    document.querySelectorAll('[data-electronic-action]').forEach((button) => {
      button.disabled = true;
      button.textContent = '전자계약 운영 검토 전';
    });
    document.querySelectorAll('[data-management-action]').forEach((button) => {
      button.disabled = true;
    });
  }

  function getElectronicReadiness() {
    const endpointValid = isValidAppsScriptEndpoint(config.appsScriptUrl);
    const enabled = config.electronicContractEnabled === true;
    const complianceComplete = [
      'googleProcessingReviewComplete',
      'overseasTransferNoticeComplete',
      'legalReviewComplete',
      'contractManagementReady',
      'endToEndTestComplete'
    ].every((key) => config.compliance?.[key] === true);

    if (!enabled || !endpointValid) {
      return {
        ready: false,
        message: 'Apps Script 배포 URL이 연결되지 않았습니다. 현재는 서버 전송 없는 초안 미리보기와 인쇄·PDF 저장만 가능합니다.'
      };
    }
    if (!complianceComplete) {
      return {
        ready: false,
        message: 'Google 처리위탁·국외이전 안내, 법률 검토, 계약 관리 준비와 종단간 검수가 모두 확정되지 않아 전자계약과 온라인 계약 관리를 활성화하지 않습니다.'
      };
    }
    return { ready: true, message: '' };
  }

  function isValidAppsScriptEndpoint(value) {
    if (!value) return false;
    try {
      const url = new URL(value);
      return url.protocol === 'https:' &&
        url.hostname === 'script.google.com' &&
        /^\/macros\/s\/[A-Za-z0-9_-]+\/exec$/.test(url.pathname) &&
        !url.search &&
        !url.hash;
    } catch {
      return false;
    }
  }

  function buildPreview() {
    if (!state.type || !dom.previewHost) return;
    const type = contracts.types[state.type];
    const provider = config.provider || {};
    const operatorValue = (value) => String(value || '').trim() || '운영자 확인 필요';
    const replacements = buildTemplateReplacements();
    const paper = createElement('article', 'contract-paper contract-document');
    paper.id = 'contractPrintArea';
    paper.setAttribute('aria-label', `${type.name} 계약서 초안`);

    const watermark = createElement('div', 'draft-watermark', 'DRAFT · 전자확인 전');
    watermark.setAttribute('aria-hidden', 'true');
    const content = createElement('div', 'contract-content');
    const head = createElement('header', 'contract-document__head');
    head.append(
      createElement('p', 'contract-document__eyebrow', type.eyebrow),
      createElement('h1', '', `${type.name} 계약서 · 초안`)
    );
    const meta = createElement('div', 'contract-document__meta');
    appendMeta(meta, '계약서 상태', 'DRAFT · 전자확인 전');
    appendMeta(meta, '계약서 버전', contracts.versions[state.type]);
    appendMeta(meta, '공통조항 버전', contracts.versions.common);
    appendMeta(meta, '개인정보 안내 버전', contracts.versions.privacy);
    head.append(meta);
    content.append(head);

    content.append(createElement(
      'p',
      'contract-document__notice',
      '본 문서는 공개 초안 작성기에서 만든 전자확인 전 초안입니다. 서버에 저장되거나 전자계약으로 체결되지 않았으며, 최종 계약은 코치가 별도로 발행한 불변 계약 문구와 개별 초대 링크에서 확인해야 합니다.'
    ));
    content.append(createElement(
      'p',
      'contract-document__notice',
      '본 계약서는 ICF 윤리강령, 한국코치협회 윤리규정 및 국내 관련 법령의 주요 원칙을 참고하여 DAILYCOACHING의 실제 코칭 운영에 맞게 구성했으며, 각 기관이 직접 승인하거나 인증한 계약서는 아닙니다.'
    ));

    const conditions = createElement('dl', 'contract-conditions');
    const conditionRows = [
      ['계약 유형', type.name],
      ['계약 방식', state.type === 'business' && state.businessMode === 'sponsored' ? '조직 지원 3자 계약' : '2자 계약'],
      ['코칭 제공자', replacements.providerName],
      ['대표자', operatorValue(provider.representative)],
      ['담당 코치', replacements.coachName],
      ['담당 코치 자격', operatorValue(provider.coachCredentials)],
      ['사업자등록번호', operatorValue(provider.businessRegistrationNumber)],
      ['사업장 주소', operatorValue(provider.businessAddress)],
      ['제공자 연락처', operatorValue(provider.phone)],
      ['제공자 이메일', operatorValue(provider.email)],
      ['과세·면세 안내', operatorValue(provider.taxNotice)],
      ['분쟁 관할·소재지', operatorValue(provider.disputeLocation)],
      ['고객', state.values.clientName],
      ['고객 역할', state.values.clientRole],
      ['고객 이메일', state.values.clientEmail],
      ['고객 휴대전화', state.values.clientPhone]
    ];
    if (state.type === 'business') {
      conditionRows.push([
        '고객 소속·직책',
        [state.values.clientOrganization, state.values.clientTitle].filter(Boolean).join(' · ') || '미입력'
      ]);
    }
    if (state.type === 'business' && state.businessMode === 'sponsored') {
      conditionRows.push(
        ['스폰서 조직', state.values.sponsorOrganization],
        ['스폰서 담당자', `${state.values.sponsorName} · ${state.values.sponsorEmail}`]
      );
    }
    conditionRows.push(
      ['코칭 목적', state.values.coachingPurpose],
      ['코칭 목표', state.values.goalSummary],
      ['회기', `${state.values.sessions}회 · 회기당 ${state.values.sessionMinutes}분`],
      ['진행기간', `${formatDate(state.values.startDate)} ~ ${formatDate(state.values.endDate)}`],
      ['진행방식', `${state.values.deliveryMode} · ${state.values.deliveryLocation}`],
      ['총 계약금액', formatWon(state.values.totalFee)],
      ['회기당 금액', formatWon(state.values.feePerSession)],
      ['결제방법', state.values.paymentMethod],
      ['결제일정', state.values.paymentSchedule],
      ['일정변경 기준', state.values.reschedulePolicy],
      ['노쇼 기준', state.values.noShowPolicy],
      ['중도종료·환불', state.values.refundPolicy]
    );
    conditionRows.forEach(([label, value]) => appendCondition(conditions, label, value || '미입력'));
    content.append(conditions);

    contracts.getClauses(state.type).forEach((clause) => {
      const section = createElement('section', 'contract-clause');
      section.append(
        createElement('h2', '', `${clause.number}. ${clause.title}`),
        createElement('p', '', interpolate(clause.body, replacements))
      );
      content.append(section);
    });

    if (state.type === 'business' && state.businessMode === 'sponsored') {
      content.append(buildPrintSharingTable());
    }
    content.append(buildPrintConsentSection());

    const signoff = createElement('section', 'contract-signoff');
    signoff.append(
      createElement('h2', '', '전자확인 전 초안'),
      createElement('p', '', '이 초안은 당사자의 전자확인 기록, 확인 시각 또는 문서 해시를 포함하지 않습니다. 초대받은 전자계약에서 계약 전문을 다시 확인해야 합니다.')
    );
    const signGrid = createElement('div', 'contract-signoff__grid');
    signGrid.append(
      createElement('div', 'contract-signoff__box', `고객: ${state.values.clientName || '미입력'}\n상태: 전자확인 전`),
      createElement('div', 'contract-signoff__box', `코칭 제공자: ${replacements.providerName}\n상태: 발행 전`)
    );
    if (state.type === 'business' && state.businessMode === 'sponsored') {
      signGrid.append(createElement('div', 'contract-signoff__box', `스폰서: ${state.values.sponsorName || '미입력'}\n상태: 전자확인 전`));
    }
    signoff.append(signGrid);
    content.append(signoff);

    paper.append(watermark, content);
    dom.previewHost.replaceChildren(paper);
  }

  function buildPrintSharingTable() {
    const section = createElement('section', 'contract-sharing');
    section.append(
      createElement('h2', '', '스폰서 정보공유 별도 선택'),
      createElement('p', '', '스폰서 공유는 기본 코칭 계약과 분리된 고객의 선택입니다. 세션의 구체적인 대화와 개인적인 감정·고민은 공유하지 않습니다.')
    );
    const table = createElement('table');
    const head = createElement('thead');
    const headRow = createElement('tr');
    ['정보 유형', '고객', '스폰서'].forEach((label) => headRow.append(createElement('th', '', label)));
    head.append(headRow);
    const body = createElement('tbody');
    contracts.sharingMatrix.forEach((item) => {
      const row = createElement('tr');
      const sponsorText = item.fixed
        ? (item.id === 'session-detail' || item.id === 'personal' ? '공유하지 않음 · 잠금' : item.sponsor)
        : (state.sharing[item.id] ? '별도 선택으로 공유' : '공유하지 않음');
      row.append(
        createElement('td', '', item.label),
        createElement('td', '', normalizeClientSharingLabel(item.client)),
        createElement('td', '', sponsorText)
      );
      body.append(row);
    });
    table.append(head, body);
    section.append(table);
    const selectedItems = [];
    contracts.sharingMatrix.forEach((item) => {
      if (!item.fixed && state.sharing[item.id]) selectedItems.push(item.label);
    });
    section.append(
      createElement('p', '', `제공받는 자: ${state.values.sponsorOrganization || '미입력'}`),
      createElement('p', '', '제공 목적: 코칭 참여 여부와 고객이 별도로 선택한 합의된 운영현황 확인'),
      createElement('p', '', `선택 제공항목: ${selectedItems.length ? selectedItems.join(', ') : '없음'}`),
      createElement('p', '', '제외 정보: 세션의 구체적인 대화, 개인적인 감정·고민과 비공개 자료'),
      createElement('p', '', '보유기간: 운영자가 관계 법령과 실제 조직 지원 계약 정책을 검토해 확정할 기간. 확정 전 전자계약 발행 차단'),
      createElement('p', '', '거부권: 고객은 제공을 거부할 수 있으며, 거부 시 선택 정보는 제공하지 않고 3자 계약 운영 방식을 다시 협의함'),
      createElement(
        'p',
        '',
        `별도 정보제공 동의: ${
          selectedItems.length
            ? (state.sponsorDisclosureConsent ? '확인함' : '확인하지 않음')
            : '선택 제공항목 없음 · 별도 동의 미제시'
        }`
      )
    );
    return section;
  }

  function buildPrintConsentSection() {
    const section = createElement('section', 'contract-consents');
    const notice = contracts.privacyNotice;
    section.append(createElement('h2', '', '개인정보 안내 및 별도 선택 동의'));
    [
      ['개인정보 처리자', notice.controller],
      ['처리 목적', notice.purpose],
      ['필수 처리항목', notice.requiredItems],
      ['선택 처리항목', notice.optionalItems],
      ['처리 근거', notice.legalBasis],
      ['보유기간', notice.retention],
      ['파기방법', notice.destruction],
      ['고객의 권리', notice.rights],
      ['담당자 연락처', notice.contact],
      ['안내 버전', notice.version]
    ].forEach(([label, value]) => {
      section.append(createElement('p', '', `${label}: ${value}`));
    });
    section.append(createElement('p', '', '공개 초안 작성기에서는 선택 동의를 수집하지 않습니다. 현재 별도 합의 없이 녹음·전사·AI 요약을 사용하지 않으며, 실제 운영과 항목별 안내가 확정되지 않은 연구·사례·홍보·마케팅·제3자 전달 동의를 미리 받지 않습니다.'));
    return section;
  }

  function buildTemplateReplacements() {
    const provider = config.provider || {};
    const type = state.type ? contracts.types[state.type] : null;
    return {
      providerName: provider.legalName || provider.serviceName || '운영자 확인 필요',
      coachName: [provider.coachName, provider.coachCredentials].filter(Boolean).join(' · ') || '운영자 확인 필요',
      clientName: state.values.clientName || '미입력',
      sponsorOrganization: state.values.sponsorOrganization || '해당 없음',
      sponsorName: state.values.sponsorName || '해당 없음',
      typePurpose: `${type?.purpose || '코칭 유형별 목적 미선택'} 이번 계약에서 당사자가 합의한 구체적인 코칭 목적은 “${state.values.coachingPurpose || '미입력'}”입니다.`,
      coachingPurpose: state.values.coachingPurpose || '미입력',
      goalSummary: state.values.goalSummary || '미입력',
      sessions: state.values.sessions || '미입력',
      sessionMinutes: state.values.sessionMinutes || '미입력',
      deliveryMode: state.values.deliveryMode || '미입력',
      deliveryLocation: state.values.deliveryLocation || '미입력',
      startDate: formatDate(state.values.startDate),
      endDate: formatDate(state.values.endDate),
      totalFee: formatWon(state.values.totalFee),
      feePerSession: formatWon(state.values.feePerSession),
      paymentMethod: state.values.paymentMethod || '미입력',
      paymentSchedule: state.values.paymentSchedule || '미입력',
      reschedulePolicy: state.values.reschedulePolicy || '미입력',
      noShowPolicy: state.values.noShowPolicy || '미입력',
      refundPolicy: state.values.refundPolicy || '미입력'
    };
  }

  function printDraft() {
    const typeErrors = validateStep(0);
    if (typeErrors.length) {
      showStep(0, true);
      showErrors(typeErrors);
      return;
    }
    const detailErrors = validateDetails();
    if (detailErrors.length) {
      state.maxStepReached = Math.max(state.maxStepReached, 1);
      showStep(1, true);
      showErrors(detailErrors);
      return;
    }
    const acknowledgementErrors = validateAcknowledgements();
    if (acknowledgementErrors.length) {
      state.maxStepReached = Math.max(state.maxStepReached, 2);
      renderClauses();
      showStep(2, true);
      showErrors(acknowledgementErrors);
      return;
    }

    buildPreview();
    preparePrintDocument();
    window.requestAnimationFrame(() => window.print());
  }

  function preparePrintDocument() {
    if (!state?.type) return;
    buildPreview();
    const printArea = document.querySelector('#contractPrintArea');
    if (!printArea || printSession) return;
    printSession = {
      parent: printArea.parentNode,
      nextSibling: printArea.nextSibling
    };
    document.body.append(printArea);
    originalDocumentTitle = document.title;
    document.title = `DAILYCOACHING_${contracts.types[state.type].shortName}_코칭계약서_초안`;
  }

  function restorePrintDocument() {
    if (!printSession) return;
    const printArea = document.querySelector('#contractPrintArea');
    if (printArea && printSession.parent) {
      printSession.parent.insertBefore(printArea, printSession.nextSibling);
    }
    document.title = originalDocumentTitle;
    printSession = null;
  }

  function resetDraft({ preserveType, ask, focus }) {
    if (ask && hasMeaningfulDraft()) {
      const approved = window.confirm('작성한 개인정보와 계약 조건을 모두 초기화할까요?');
      if (!approved) return;
    }

    const preservedType = preserveType ? state.type : null;
    state = createInitialState(preservedType);
    dom.form.reset();
    dom.previewHost.replaceChildren();
    syncStateToForm();
    renderTypeDependentSections();
    clearErrors();
    showStep(0, focus);
  }

  function clearSensitiveMemory() {
    if (!state) return;
    const preservedType = state.type;
    state = createInitialState(preservedType);
    dom.form?.reset();
    dom.previewHost?.replaceChildren();
    if (printSession) restorePrintDocument();
  }

  function showFatalConfigurationMessage() {
    if (!dom.systemBanner) return;
    dom.systemBanner.dataset.state = 'draft';
    dom.systemBannerTitle.textContent = '계약서 템플릿을 불러오지 못했습니다.';
    dom.systemBannerMessage.textContent = '페이지를 새로고침한 뒤에도 문제가 계속되면 운영 이메일로 문의해 주세요.';
    dom.form.querySelectorAll('button, input, select, textarea').forEach((control) => {
      control.disabled = true;
    });
  }

  function appendMeta(parent, label, value) {
    const item = createElement('div');
    item.append(createElement('strong', '', `${label}: `), document.createTextNode(value));
    parent.append(item);
  }

  function appendCondition(parent, label, value) {
    const wrapper = createElement('div', 'contract-condition');
    wrapper.append(createElement('dt', '', label), createElement('dd', '', value));
    parent.append(wrapper);
  }

  function interpolate(template, replacements) {
    return String(template).replace(/\{\{([A-Za-z0-9_-]+)\}\}/g, (_, key) => {
      const value = replacements[key];
      return value === undefined || value === null ? '' : String(value);
    });
  }

  function parseWon(value) {
    const raw = String(value ?? '').trim();
    if (!raw) return null;
    const normalized = raw.replace(/[,\s₩원]/g, '');
    if (!/^\d+$/.test(normalized)) return null;
    const amount = Number(normalized);
    return Number.isSafeInteger(amount) && amount >= 0 ? amount : null;
  }

  function formatWon(value) {
    const amount = parseWon(value);
    if (amount === null) return '미입력';
    return `${new Intl.NumberFormat('ko-KR', {
      style: 'currency',
      currency: 'KRW',
      maximumFractionDigits: 0
    }).format(amount)} (${new Intl.NumberFormat('ko-KR').format(amount)}원)`;
  }

  function formatDate(value) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value))) return '미입력';
    const [year, month, day] = value.split('-');
    return `${year}년 ${Number(month)}월 ${Number(day)}일`;
  }

  function isPositiveInteger(value) {
    return /^\d+$/.test(String(value)) && Number(value) >= 1;
  }

  function isValidEmail(value) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value).trim());
  }

  function deduplicateErrors(errors) {
    const seen = new Set();
    return errors.filter((error) => {
      if (seen.has(error.field)) return false;
      seen.add(error.field);
      return true;
    });
  }

  function reducedMotion() {
    return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  }

  function cssEscape(value) {
    if (window.CSS?.escape) return window.CSS.escape(value);
    return String(value).replace(/[^A-Za-z0-9_-]/g, '\\$&');
  }

  function createElement(tagName, className = '', text = '') {
    const element = document.createElement(tagName);
    if (className) element.className = className;
    if (text !== '') element.textContent = String(text);
    return element;
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
