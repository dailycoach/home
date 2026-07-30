var DC = DC || {};

DC.Install = (function () {
  function validFolder(id) {
    if (!id) return null;
    try {
      var folder = DriveApp.getFolderById(id);
      folder.getName();
      return folder;
    } catch (error) {
      return null;
    }
  }

  function validFile(id) {
    if (!id) return null;
    try {
      var file = DriveApp.getFileById(id);
      file.getName();
      return file;
    } catch (error) {
      return null;
    }
  }

  function makePrivate(item) {
    try {
      item.setSharing(DriveApp.Access.PRIVATE, DriveApp.Permission.NONE);
      if (item.getSharingAccess() !== DriveApp.Access.PRIVATE) {
        throw new Error('PRIVATE_NOT_APPLIED');
      }
    } catch (error) {
      throw new Error('비공개 Drive 권한을 적용할 수 없습니다. 전용 My Drive에서 설치하세요.');
    }
  }

  function ensureRootFolder() {
    var key = DC.Config.KEYS.ROOT_FOLDER_ID;
    var existing = validFolder(DC.Config.getProperty(key));
    if (existing) {
      makePrivate(existing);
      return existing;
    }
    var folder = DriveApp.createFolder('DAILYCOACHING_CONTRACTS_PRIVATE');
    makePrivate(folder);
    DC.Config.setProperty(key, folder.getId());
    return folder;
  }

  function ensureChildFolder(parent, propertyKey, name) {
    var existing = validFolder(DC.Config.getProperty(propertyKey));
    if (existing) {
      makePrivate(existing);
      return existing;
    }
    var matches = parent.getFoldersByName(name);
    var folder = matches.hasNext() ? matches.next() : parent.createFolder(name);
    makePrivate(folder);
    DC.Config.setProperty(propertyKey, folder.getId());
    return folder;
  }

  function ensureSheet(spreadsheet, name, requiredHeaders) {
    var target = spreadsheet.getSheetByName(name) || spreadsheet.insertSheet(name);
    var current = target.getLastColumn()
      ? target.getRange(1, 1, 1, target.getLastColumn()).getDisplayValues()[0]
      : [];
    var nonEmpty = current.filter(Boolean);
    var duplicates = nonEmpty.filter(function (header, index) {
      return nonEmpty.indexOf(header) !== index;
    });
    if (duplicates.length) {
      throw new Error(name + ' 시트 헤더가 중복되었습니다: ' + duplicates.join(', '));
    }
    if (!nonEmpty.length) {
      target.getRange(1, 1, 1, requiredHeaders.length).setValues([requiredHeaders]);
    } else {
      var missing = requiredHeaders.filter(function (header) {
        return nonEmpty.indexOf(header) === -1;
      });
      if (missing.length) {
        target.getRange(1, target.getLastColumn() + 1, 1, missing.length)
          .setValues([missing]);
      }
    }
    target.setFrozenRows(1);
    target.getRange(1, 1, 1, target.getLastColumn())
      .setFontWeight('bold')
      .setBackground('#061528')
      .setFontColor('#fffaf2');
    var protections = target.getProtections(SpreadsheetApp.ProtectionType.SHEET);
    var description = 'DAILYCOACHING_SYSTEM_SHEET';
    var hasProtection = protections.some(function (protection) {
      return protection.getDescription() === description;
    });
    if (!hasProtection) {
      target.protect().setDescription(description).setWarningOnly(true);
    }
    return target;
  }

  function ensureSettings(installerEmail) {
    var existing = {};
    DC.Storage.allRows('SETTINGS').forEach(function (row) {
      if (row.key) existing[String(row.key)] = true;
    });
    DC.Schema.SETTING_DEFINITIONS.forEach(function (definition) {
      if (existing[definition[0]]) return;
      DC.Storage.appendObject('SETTINGS', {
        key: definition[0],
        value: definition[1],
        category: definition[2],
        required: definition[3],
        updatedAt: DC.Storage.nowIso(),
        updatedBy: installerEmail,
        notes: definition[4]
      });
    });
  }

  function templateTitle(type) {
    return {
      life: 'DAILYCOACHING_LIFE_CONTRACT_TEMPLATE',
      business: 'DAILYCOACHING_BUSINESS_CONTRACT_TEMPLATE',
      career: 'DAILYCOACHING_CAREER_CONTRACT_TEMPLATE'
    }[type];
  }

  function ensureTemplate(type, propertyKey, folder) {
    var existing = validFile(DC.Config.getProperty(propertyKey));
    if (existing) {
      makePrivate(existing);
      DC.PdfService.validateTemplateFile(existing.getId());
      return existing;
    }
    var title = templateTitle(type);
    var matches = folder.getFilesByName(title);
    var file;
    if (matches.hasNext()) {
      file = matches.next();
    } else {
      var document = DocumentApp.create(title);
      var body = document.getBody();
      body.appendParagraph('{{DC_BRAND}}')
        .setHeading(DocumentApp.ParagraphHeading.SUBTITLE);
      body.appendParagraph('{{DC_TITLE}}')
        .setHeading(DocumentApp.ParagraphHeading.TITLE);
      body.appendParagraph('{{DC_NOTICE}}');
      body.appendParagraph('{{DC_TEMPLATE_VERSION}}');
      body.appendParagraph('{{DC_CONTENT}}');
      document.saveAndClose();
      file = DriveApp.getFileById(document.getId());
      file.moveTo(folder);
    }
    makePrivate(file);
    DC.PdfService.validateTemplateFile(file.getId());
    DC.Config.setProperty(propertyKey, file.getId());
    return file;
  }

  function ensureSecretsAndDefaults(spreadsheet) {
    var properties = PropertiesService.getScriptProperties();
    var values = properties.getProperties();
    var changes = {};
    changes[DC.Config.KEYS.SCHEMA_VERSION] = DC.Schema.VERSION;
    changes[DC.Config.KEYS.SPREADSHEET_ID] = spreadsheet.getId();
    if (!values[DC.Config.KEYS.INSTALLATION_ID]) {
      changes[DC.Config.KEYS.INSTALLATION_ID] = DC.Security.randomId('install-');
    }
    if (!values[DC.Config.KEYS.ALLOWED_PARENT_ORIGINS]) {
      changes[DC.Config.KEYS.ALLOWED_PARENT_ORIGINS] =
        JSON.stringify(['https://daily-coach-ing.com']);
    }
    if (!values[DC.Config.KEYS.ACTIVE_CRYPTO_VERSION]) {
      changes[DC.Config.KEYS.ACTIVE_CRYPTO_VERSION] = 'v1';
    }
    [
      DC.Config.KEYS.TOKEN_PEPPER_V1,
      DC.Config.KEYS.OTP_PEPPER_V1,
      DC.Config.KEYS.SESSION_PEPPER_V1,
      DC.Config.KEYS.IDEMPOTENCY_PEPPER_V1
    ].forEach(function (key) {
      if (!values[key]) changes[key] = DC.Security.randomToken();
    });
    properties.setProperties(changes, false);
  }

  function ensureTrigger(handler, builder) {
    var exists = ScriptApp.getProjectTriggers().some(function (trigger) {
      return trigger.getHandlerFunction() === handler;
    });
    if (!exists) builder(ScriptApp.newTrigger(handler).timeBased()).create();
  }

  function ensureTriggers() {
    ensureTrigger('processPendingContractJobs_', function (trigger) {
      return trigger.everyMinutes(5);
    });
    ensureTrigger('expireIssuedContracts_', function (trigger) {
      return trigger.everyHours(1);
    });
    ensureTrigger('reportRetentionCandidates_', function (trigger) {
      return trigger.everyDays(1).atHour(3);
    });
  }

  function runLocked() {
    var installer = DC.Config.requireInstaller();
    var spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    if (!spreadsheet) {
      throw new Error('DAILYCOACHING_CONTRACTS 스프레드시트에 바인딩한 뒤 실행하세요.');
    }
    var configuredId = DC.Config.getProperty(DC.Config.KEYS.SPREADSHEET_ID);
    if (configuredId && configuredId !== spreadsheet.getId()) {
      throw new Error('이미 다른 계약 스프레드시트에 연결된 프로젝트입니다.');
    }
    spreadsheet.setSpreadsheetTimeZone('Asia/Seoul');
    spreadsheet.rename('DAILYCOACHING_CONTRACTS');
    ensureSecretsAndDefaults(spreadsheet);

    Object.keys(DC.Schema.SHEETS).forEach(function (name) {
      ensureSheet(spreadsheet, name, DC.Schema.SHEETS[name]);
    });
    ensureSettings(installer);

    var root = ensureRootFolder();
    ensureChildFolder(root, DC.Config.KEYS.DOCUMENT_FOLDER_ID, 'DOCUMENTS');
    ensureChildFolder(root, DC.Config.KEYS.PDF_FOLDER_ID, 'PDF');
    ensureChildFolder(root, DC.Config.KEYS.SNAPSHOT_FOLDER_ID, 'SNAPSHOTS');
    var templateFolder = ensureChildFolder(
      root, DC.Config.KEYS.TEMPLATE_FOLDER_ID, 'TEMPLATES'
    );
    ensureTemplate('life', DC.Config.KEYS.TEMPLATE_LIFE_ID, templateFolder);
    ensureTemplate('business', DC.Config.KEYS.TEMPLATE_BUSINESS_ID, templateFolder);
    ensureTemplate('career', DC.Config.KEYS.TEMPLATE_CAREER_ID, templateFolder);
    ensureTriggers();
    return DC.Config.health();
  }

  function run() {
    var lock = LockService.getScriptLock();
    lock.waitLock(30000);
    try {
      return runLocked();
    } finally {
      lock.releaseLock();
    }
  }

  return Object.freeze({ run: run });
})();
