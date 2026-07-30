var DC = DC || {};

DC.Config = (function () {
  var PROPERTY_KEYS = Object.freeze({
    SCHEMA_VERSION: 'SYSTEM_SCHEMA_VERSION',
    INSTALLATION_ID: 'INSTALLATION_ID',
    SPREADSHEET_ID: 'CONTRACT_SPREADSHEET_ID',
    ROOT_FOLDER_ID: 'ROOT_FOLDER_ID',
    DOCUMENT_FOLDER_ID: 'DOCUMENT_FOLDER_ID',
    PDF_FOLDER_ID: 'PDF_FOLDER_ID',
    SNAPSHOT_FOLDER_ID: 'SNAPSHOT_FOLDER_ID',
    TEMPLATE_FOLDER_ID: 'TEMPLATE_FOLDER_ID',
    TEMPLATE_LIFE_ID: 'TEMPLATE_LIFE_ID',
    TEMPLATE_BUSINESS_ID: 'TEMPLATE_BUSINESS_ID',
    TEMPLATE_CAREER_ID: 'TEMPLATE_CAREER_ID',
    WEB_APP_EXEC_URL: 'WEB_APP_EXEC_URL',
    ALLOWED_PARENT_ORIGINS: 'ALLOWED_PARENT_ORIGINS',
    ADMIN_EMAIL_ALLOWLIST: 'ADMIN_EMAIL_ALLOWLIST',
    ACTIVE_CRYPTO_VERSION: 'ACTIVE_CRYPTO_VERSION',
    TOKEN_PEPPER_V1: 'TOKEN_PEPPER_V1',
    OTP_PEPPER_V1: 'OTP_PEPPER_V1',
    SESSION_PEPPER_V1: 'SESSION_PEPPER_V1',
    IDEMPOTENCY_PEPPER_V1: 'IDEMPOTENCY_PEPPER_V1'
  });

  function properties() {
    return PropertiesService.getScriptProperties();
  }

  function getProperty(key) {
    return properties().getProperty(key);
  }

  function setProperty(key, value) {
    properties().setProperty(key, String(value));
  }

  function getJsonProperty(key, fallback) {
    var value = getProperty(key);
    if (!value) return fallback;
    try {
      return JSON.parse(value);
    } catch (error) {
      return fallback;
    }
  }

  function activeEmail() {
    return String(Session.getActiveUser().getEmail() || '').trim().toLowerCase();
  }

  function allowedAdmins() {
    return getJsonProperty(PROPERTY_KEYS.ADMIN_EMAIL_ALLOWLIST, [])
      .map(function (email) { return String(email).trim().toLowerCase(); })
      .filter(Boolean);
  }

  function requireAdmin() {
    var email = activeEmail();
    if (!email || allowedAdmins().indexOf(email) === -1) {
      throw new Error('관리자 권한을 확인할 수 없습니다.');
    }
    return email;
  }

  function requireInstaller() {
    var email = activeEmail();
    if (!email) {
      throw new Error('설치자는 확인 가능한 Google 계정으로 실행해야 합니다.');
    }
    var admins = allowedAdmins();
    if (!admins.length) {
      setProperty(PROPERTY_KEYS.ADMIN_EMAIL_ALLOWLIST, JSON.stringify([email]));
      return email;
    }
    if (admins.indexOf(email) === -1) {
      throw new Error('등록된 관리자만 설치 구성을 변경할 수 있습니다.');
    }
    return email;
  }

  function allowedParentOrigins() {
    return getJsonProperty(PROPERTY_KEYS.ALLOWED_PARENT_ORIGINS, [])
      .filter(function (origin) {
        return /^https:\/\/[a-z0-9.-]+(?::\d+)?$/i.test(String(origin));
      })
      .map(function (origin) { return String(origin).toLowerCase(); });
  }

  function activeCryptoVersion() {
    return getProperty(PROPERTY_KEYS.ACTIVE_CRYPTO_VERSION) || 'v1';
  }

  function pepper(kind, version) {
    var suffix = String(version || activeCryptoVersion()).toUpperCase();
    var key = String(kind).toUpperCase() + '_PEPPER_' + suffix;
    var value = getProperty(key);
    if (!value) throw new Error('보안 키 설정이 누락되었습니다.');
    return value;
  }

  function validateExecUrl(value) {
    return /^https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]+\/exec$/.test(
      String(value || '').trim()
    );
  }

  function validateSignPageBaseUrl(value) {
    var text = String(value || '').trim();
    if (!text || /[?#]/.test(text)) return false;
    var parsed = text.match(/^(https):\/\/([^/?#]+)(\/[^?#]*)$/i);
    if (!parsed || parsed[2].indexOf('@') !== -1) return false;
    if (parsed[3] !== '/coaching/agreement/sign/') return false;
    var origin = 'https://' + String(parsed[2]).toLowerCase();
    return allowedParentOrigins().indexOf(origin) !== -1;
  }

  function getSettingsMap() {
    if (!DC.Storage) return {};
    return DC.Storage.getSettingsMap();
  }

  function checkPrivateDriveResources(props, missing) {
    var folderKeys = [
      PROPERTY_KEYS.ROOT_FOLDER_ID,
      PROPERTY_KEYS.DOCUMENT_FOLDER_ID,
      PROPERTY_KEYS.PDF_FOLDER_ID,
      PROPERTY_KEYS.SNAPSHOT_FOLDER_ID,
      PROPERTY_KEYS.TEMPLATE_FOLDER_ID
    ];
    var fileKeys = [
      PROPERTY_KEYS.SPREADSHEET_ID,
      PROPERTY_KEYS.TEMPLATE_LIFE_ID,
      PROPERTY_KEYS.TEMPLATE_BUSINESS_ID,
      PROPERTY_KEYS.TEMPLATE_CAREER_ID
    ];
    folderKeys.forEach(function (key) {
      if (!props[key]) return;
      try {
        var folder = DriveApp.getFolderById(props[key]);
        folder.setSharing(DriveApp.Access.PRIVATE, DriveApp.Permission.NONE);
        if (folder.getSharingAccess() !== DriveApp.Access.PRIVATE) {
          missing.push('Private Drive folder: ' + key);
        }
      } catch (error) {
        missing.push('Private Drive folder: ' + key);
      }
    });
    fileKeys.forEach(function (key) {
      if (!props[key]) return;
      try {
        var file = DriveApp.getFileById(props[key]);
        file.setSharing(DriveApp.Access.PRIVATE, DriveApp.Permission.NONE);
        if (file.getSharingAccess() !== DriveApp.Access.PRIVATE) {
          missing.push('Private Drive file: ' + key);
        }
        if ([
          PROPERTY_KEYS.TEMPLATE_LIFE_ID,
          PROPERTY_KEYS.TEMPLATE_BUSINESS_ID,
          PROPERTY_KEYS.TEMPLATE_CAREER_ID
        ].indexOf(key) !== -1) {
          DC.PdfService.validateTemplateFile(props[key]);
        }
      } catch (error) {
        missing.push('Private Drive file: ' + key);
      }
    });
  }

  function health() {
    var missing = [];
    var props = properties().getProperties();
    [
      PROPERTY_KEYS.SPREADSHEET_ID,
      PROPERTY_KEYS.ROOT_FOLDER_ID,
      PROPERTY_KEYS.DOCUMENT_FOLDER_ID,
      PROPERTY_KEYS.PDF_FOLDER_ID,
      PROPERTY_KEYS.SNAPSHOT_FOLDER_ID,
      PROPERTY_KEYS.TEMPLATE_FOLDER_ID,
      PROPERTY_KEYS.TEMPLATE_LIFE_ID,
      PROPERTY_KEYS.TEMPLATE_BUSINESS_ID,
      PROPERTY_KEYS.TEMPLATE_CAREER_ID,
      PROPERTY_KEYS.TOKEN_PEPPER_V1,
      PROPERTY_KEYS.OTP_PEPPER_V1,
      PROPERTY_KEYS.SESSION_PEPPER_V1,
      PROPERTY_KEYS.IDEMPOTENCY_PEPPER_V1
    ].forEach(function (key) {
      if (!String(props[key] || '').trim()) missing.push('Script Property: ' + key);
    });

    if (!validateExecUrl(props[PROPERTY_KEYS.WEB_APP_EXEC_URL])) {
      missing.push('Script Property: WEB_APP_EXEC_URL');
    }
    if (!allowedParentOrigins().length) {
      missing.push('Script Property: ALLOWED_PARENT_ORIGINS');
    }
    checkPrivateDriveResources(props, missing);

    var settings = getSettingsMap();
    DC.Schema.SETTING_DEFINITIONS.forEach(function (definition) {
      var key = definition[0];
      var required = definition[3];
      if (required && !String(settings[key] || '').trim()) {
        missing.push('Setting: ' + key);
      }
    });

    [
      'GOOGLE_PROCESSOR_DISCLOSURE_CONFIRMED',
      'CROSS_BORDER_TRANSFER_REVIEW_CONFIRMED',
      'LEGAL_REVIEW_CONFIRMED',
      'CONTRACT_MANAGEMENT_REVIEW_CONFIRMED'
    ].forEach(function (key) {
      if (String(settings[key] || '').trim().toUpperCase() !== 'YES') {
        missing.push('Setting confirmation: ' + key);
      }
    });

    if (['NOT_USED', 'SEPARATE_CONSENT_ENABLED'].indexOf(
      String(settings.RECORDING_AI_MODE || '').trim()
    ) === -1) {
      missing.push('Setting value: RECORDING_AI_MODE');
    }
    [
      'OFFER_RECORDING_CONSENT',
      'OFFER_TRANSCRIPTION_CONSENT',
      'OFFER_AI_SUMMARY_CONSENT',
      'OFFER_RESEARCH_CONSENT',
      'OFFER_ANONYMOUS_CASE_CONSENT',
      'OFFER_TESTIMONIAL_CONSENT',
      'OFFER_MARKETING_EMAIL_CONSENT',
      'OFFER_MARKETING_SMS_CONSENT',
      'OFFER_THIRD_PARTY_TRANSFER_CONSENT'
    ].forEach(function (key) {
      if (['YES', 'NO'].indexOf(String(settings[key] || '').trim()) === -1) {
        missing.push('Setting value: ' + key);
      }
    });
    var sessionMode = String(settings.RECORDING_AI_MODE || '').trim();
    var sessionOffers = [
      {
        flag: 'OFFER_RECORDING_CONSENT',
        details: ['RECORDING_PURPOSE', 'RECORDING_SCOPE', 'RECORDING_RETENTION']
      },
      {
        flag: 'OFFER_TRANSCRIPTION_CONSENT',
        details: [
          'TRANSCRIPTION_PROVIDER', 'TRANSCRIPTION_PURPOSE',
          'TRANSCRIPTION_SCOPE', 'TRANSCRIPTION_RETENTION'
        ]
      },
      {
        flag: 'OFFER_AI_SUMMARY_CONSENT',
        details: [
          'AI_SUMMARY_PROVIDER', 'AI_SUMMARY_PURPOSE',
          'AI_SUMMARY_SCOPE', 'AI_SUMMARY_RETENTION'
        ]
      }
    ];
    if (sessionMode === 'NOT_USED') {
      sessionOffers.forEach(function (offer) {
        if (String(settings[offer.flag] || '').trim() !== 'NO') {
          missing.push('Setting must be NO when RECORDING_AI_MODE=NOT_USED: ' + offer.flag);
        }
      });
    }
    if (sessionMode === 'SEPARATE_CONSENT_ENABLED') {
      if (!String(settings.SESSION_PROCESSING_NOTICE_VERSION || '').trim()) {
        missing.push('Setting: SESSION_PROCESSING_NOTICE_VERSION');
      }
      sessionOffers.forEach(function (offer) {
        if (String(settings[offer.flag] || '').trim() !== 'YES') return;
        offer.details.forEach(function (key) {
          if (!String(settings[key] || '').trim()) {
            missing.push('Setting: ' + key);
          }
        });
      });
    }
    var generalOffers = [
      {
        flag: 'OFFER_RESEARCH_CONSENT',
        details: ['RESEARCH_PURPOSE', 'RESEARCH_ITEMS', 'RESEARCH_RETENTION']
      },
      {
        flag: 'OFFER_ANONYMOUS_CASE_CONSENT',
        details: [
          'ANONYMOUS_CASE_PURPOSE', 'ANONYMOUS_CASE_ITEMS',
          'ANONYMOUS_CASE_RETENTION'
        ]
      },
      {
        flag: 'OFFER_TESTIMONIAL_CONSENT',
        details: [
          'TESTIMONIAL_PURPOSE', 'TESTIMONIAL_ITEMS', 'TESTIMONIAL_RETENTION'
        ]
      },
      {
        flag: 'OFFER_MARKETING_EMAIL_CONSENT',
        details: [
          'MARKETING_EMAIL_SENDER', 'MARKETING_EMAIL_PURPOSE',
          'MARKETING_EMAIL_ITEMS', 'MARKETING_EMAIL_RETENTION'
        ]
      },
      {
        flag: 'OFFER_MARKETING_SMS_CONSENT',
        details: [
          'MARKETING_SMS_SENDER', 'MARKETING_SMS_PURPOSE',
          'MARKETING_SMS_ITEMS', 'MARKETING_SMS_RETENTION'
        ]
      },
      {
        flag: 'OFFER_THIRD_PARTY_TRANSFER_CONSENT',
        details: [
          'THIRD_PARTY_RECIPIENT', 'THIRD_PARTY_PURPOSE',
          'THIRD_PARTY_ITEMS', 'THIRD_PARTY_RETENTION'
        ]
      }
    ];
    var anyGeneralOffer = generalOffers.some(function (offer) {
      return String(settings[offer.flag] || '').trim() === 'YES';
    });
    if (anyGeneralOffer &&
        !String(settings.OPTIONAL_CONSENT_NOTICE_VERSION || '').trim()) {
      missing.push('Setting: OPTIONAL_CONSENT_NOTICE_VERSION');
    }
    generalOffers.forEach(function (offer) {
      if (String(settings[offer.flag] || '').trim() !== 'YES') return;
      offer.details.forEach(function (key) {
        if (!String(settings[key] || '').trim()) {
          missing.push('Setting: ' + key);
        }
      });
    });

    var retention = Number(settings.RETENTION_MONTHS);
    if (!Number.isInteger(retention) || retention <= 0) {
      missing.push('Setting value: RETENTION_MONTHS');
    }
    var acceptanceDays = Number(settings.CONTRACT_ACCEPTANCE_DAYS);
    if (!Number.isInteger(acceptanceDays) || acceptanceDays <= 0) {
      missing.push('Setting value: CONTRACT_ACCEPTANCE_DAYS');
    }
    if (!validateSignPageBaseUrl(settings.SIGN_PAGE_BASE_URL)) {
      missing.push('Setting value: SIGN_PAGE_BASE_URL');
    }

    return {
      ready: missing.length === 0,
      missing: missing
    };
  }

  function requireIssuanceReady() {
    var result = health();
    if (!result.ready) {
      throw new Error('계약 발행 전 운영 설정을 확정해야 합니다: ' + result.missing.join(', '));
    }
    return getSettingsMap();
  }

  return Object.freeze({
    KEYS: PROPERTY_KEYS,
    getProperty: getProperty,
    setProperty: setProperty,
    getJsonProperty: getJsonProperty,
    activeEmail: activeEmail,
    allowedAdmins: allowedAdmins,
    allowedParentOrigins: allowedParentOrigins,
    requireAdmin: requireAdmin,
    requireInstaller: requireInstaller,
    activeCryptoVersion: activeCryptoVersion,
    pepper: pepper,
    health: health,
    requireIssuanceReady: requireIssuanceReady,
    validateExecUrl: validateExecUrl,
    validateSignPageBaseUrl: validateSignPageBaseUrl
  });
})();
