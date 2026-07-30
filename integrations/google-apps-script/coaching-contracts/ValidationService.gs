var DC = DC || {};

DC.Validation = (function () {
  function text(value, name, options) {
    var settings = options || {};
    var result = DC.Security.normalizeString(value).trim();
    if (settings.required && !result) throw new Error(name + '은(는) 필수입니다.');
    if (result.length > (settings.max || 500)) throw new Error(name + '이(가) 너무 깁니다.');
    return result;
  }

  function email(value, name, required) {
    var result = text(value, name, { required: required, max: 254 }).toLowerCase();
    if (result && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(result)) {
      throw new Error(name + ' 형식을 확인하세요.');
    }
    return result;
  }

  function phone(value, name, required) {
    var result = text(value, name, { required: required, max: 30 });
    var digitCount = result.replace(/\D/g, '').length;
    if (result &&
        (!/^\+?[0-9().\-\s]{7,30}$/.test(result) || digitCount < 8)) {
      throw new Error(name + ' 형식을 확인하세요.');
    }
    return result;
  }

  function contractSummary(value, name) {
    var result = text(value, name, { required: true, max: 300 });
    if (/\b\d{6}[-\s]?\d{7}\b/.test(result)) {
      throw new Error(name + '에는 주민등록번호 등 민감정보를 입력할 수 없습니다.');
    }
    return result;
  }

  function integer(value, name, min, max) {
    var number = Number(value);
    if (!Number.isInteger(number) || number < min || number > max) {
      throw new Error(name + ' 값을 확인하세요.');
    }
    return number;
  }

  function money(value, name) {
    return integer(value, name, 0, 1000000000);
  }

  function enumValue(value, name, allowed) {
    var result = String(value || '');
    if (allowed.indexOf(result) === -1) throw new Error(name + ' 값을 확인하세요.');
    return result;
  }

  function isoDate(value, name, required) {
    var result = text(value, name, { required: required, max: 10 });
    if (result && !/^\d{4}-\d{2}-\d{2}$/.test(result)) {
      throw new Error(name + '은 YYYY-MM-DD 형식이어야 합니다.');
    }
    if (result && isNaN(new Date(result + 'T00:00:00Z').getTime())) {
      throw new Error(name + '이 올바르지 않습니다.');
    }
    if (result) {
      var parts = result.split('-').map(Number);
      var parsed = new Date(result + 'T00:00:00Z');
      if (parsed.getUTCFullYear() !== parts[0] ||
          parsed.getUTCMonth() + 1 !== parts[1] ||
          parsed.getUTCDate() !== parts[2]) {
        throw new Error(name + '이 올바른 달력 날짜가 아닙니다.');
      }
    }
    return result;
  }

  function issuePayload(payload, settings) {
    var source = payload || {};
    var type = enumValue(source.contractType, '계약 유형', ['life', 'business', 'career']);
    var mode = type === 'business'
      ? enumValue(source.contractMode || 'individual', '계약 모드', ['individual', 'organization'])
      : 'individual';
    var startDate = isoDate(source.startDate, '시작일', true);
    var endDate = isoDate(source.endDate, '종료일', true);
    if (new Date(startDate + 'T00:00:00Z') > new Date(endDate + 'T00:00:00Z')) {
      throw new Error('종료일은 시작일보다 빠를 수 없습니다.');
    }
    var result = {
      contractType: type,
      contractMode: mode,
      clientName: text(source.clientName, '고객 성명', { required: true, max: 80 }),
      clientEmail: email(source.clientEmail, '고객 이메일', true),
      clientPhone: phone(source.clientPhone, '고객 휴대전화번호', true),
      clientRole: text(source.clientRole, '고객 계약상 역할', {
        required: true,
        max: 80
      }),
      clientOrganization: type === 'business'
        ? text(source.clientOrganization, '고객 소속', {
          required: false,
          max: 120
        })
        : '',
      clientTitle: type === 'business'
        ? text(source.clientTitle, '고객 직책', {
          required: false,
          max: 100
        })
        : '',
      sponsorName: '',
      sponsorEmail: '',
      sponsorOrganization: '',
      sessions: integer(source.sessions, '전체 회기 수', 1, 200),
      sessionMinutes: integer(source.sessionMinutes, '회기당 시간', 1, 480),
      deliveryMode: enumValue(source.deliveryMode, '진행방식', ['online', 'offline', 'hybrid']),
      deliveryLocation: text(source.deliveryLocation, '장소 또는 화상도구', { required: true, max: 200 }),
      startDate: startDate,
      endDate: endDate,
      totalFee: money(source.totalFee, '총 계약금액'),
      perSessionFee: money(source.perSessionFee, '회기당 금액'),
      paymentMethod: text(source.paymentMethod || settings.PAYMENT_METHOD_DEFAULT, '결제방법', { required: true, max: 300 }),
      paymentSchedule: text(source.paymentSchedule, '결제일정', { required: true, max: 500 }),
      cancellationPolicy: text(source.cancellationPolicy || settings.CANCELLATION_POLICY_DEFAULT, '취소 기준', { required: true, max: 2000 }),
      noShowPolicy: text(source.noShowPolicy || settings.NO_SHOW_POLICY_DEFAULT, '노쇼 기준', { required: true, max: 2000 }),
      refundPolicy: text(source.refundPolicy || settings.REFUND_POLICY_DEFAULT, '환불 기준', { required: true, max: 2000 }),
      coachingPurpose: contractSummary(source.coachingPurpose, '코칭 목적'),
      goalSummary: contractSummary(source.goalSummary, '코칭 목표'),
      sponsorShareAttendance: Boolean(source.sponsorShareAttendance),
      sponsorShareScheduleProgress: Boolean(source.sponsorShareScheduleProgress),
      sponsorShareAgreedGoals: Boolean(source.sponsorShareAgreedGoals),
      sponsorShareSessionContent: false,
      sponsorSharePersonalConcerns: false,
      sponsorShareClosingSummary: Boolean(source.sponsorShareClosingSummary),
      sponsorShareSafetyLegalMinimum: true
    };
    if (mode === 'organization') {
      result.sponsorName = text(source.sponsorName, '스폰서 담당자명', { required: true, max: 80 });
      result.sponsorEmail = email(source.sponsorEmail, '스폰서 이메일', true);
      result.sponsorOrganization = text(source.sponsorOrganization, '스폰서 조직명', { required: true, max: 160 });
      if (result.sponsorEmail === result.clientEmail) {
        throw new Error('고객과 스폰서는 서로 다른 이메일을 사용해야 합니다.');
      }
    }
    return result;
  }

  function acceptancePayload(payload, offeredConsents, contractSnapshot, signerRole) {
    var source = payload || {};
    var confirmations = source.confirmations || {};
    [
      'scope', 'confidentiality', 'cancellation', 'privacy', 'electronic'
    ].forEach(function (key) {
      if (confirmations[key] !== true) throw new Error('필수 핵심 조항을 모두 확인해야 합니다.');
    });
    var result = {
      signerName: text(source.signerName, '성명', { required: true, max: 80 }),
      confirmations: {
        scope: true,
        confidentiality: true,
        cancellation: true,
        privacy: true,
        electronic: true
      },
      consents: {}
    };
    Object.keys(offeredConsents || {}).forEach(function (key) {
      var offered = Boolean(offeredConsents[key]);
      var value = source.consents && source.consents[key] === 'ACCEPTED'
        ? 'ACCEPTED'
        : 'DECLINED';
      result.consents[key] = offered ? value : 'NOT_OFFERED';
    });
    var sponsorProvisionRequired = Boolean(
      contractSnapshot &&
      contractSnapshot.contractMode === 'organization' &&
      contractSnapshot.informationSharing &&
      contractSnapshot.informationSharing.provisionNotice &&
      contractSnapshot.informationSharing.provisionNotice.providedItems &&
      contractSnapshot.informationSharing.provisionNotice.providedItems.length
    );
    result.sponsorProvisionAccepted = false;
    if (sponsorProvisionRequired && String(signerRole) === 'CLIENT') {
      if (source.sponsorProvisionAccepted !== true) {
        throw new Error('조직 스폰서 제공 안내를 확인해야 합니다.');
      }
      result.sponsorProvisionAccepted = true;
    }
    return result;
  }

  return Object.freeze({
    text: text,
    email: email,
    phone: phone,
    integer: integer,
    money: money,
    enumValue: enumValue,
    isoDate: isoDate,
    issuePayload: issuePayload,
    acceptancePayload: acceptancePayload
  });
})();
