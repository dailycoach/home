var DC = DC || {};

DC.Storage = (function () {
  function nowIso() {
    return new Date().toISOString();
  }

  function spreadsheet() {
    var id = DC.Config.getProperty(DC.Config.KEYS.SPREADSHEET_ID);
    if (id) return SpreadsheetApp.openById(id);
    var active = SpreadsheetApp.getActiveSpreadsheet();
    if (!active) throw new Error('계약 스프레드시트를 찾을 수 없습니다.');
    return active;
  }

  function sheet(name) {
    var target = spreadsheet().getSheetByName(name);
    if (!target) throw new Error('필수 시트가 없습니다: ' + name);
    return target;
  }

  function headers(name) {
    var target = sheet(name);
    var lastColumn = target.getLastColumn();
    if (!lastColumn) return [];
    return target.getRange(1, 1, 1, lastColumn).getDisplayValues()[0];
  }

  function safeCell(value) {
    if (value === null || typeof value === 'undefined') return '';
    if (typeof value === 'number' || typeof value === 'boolean') return value;
    if (value instanceof Date) return value.toISOString();
    return DC.Security.sheetText(value);
  }

  function appendObject(name, object) {
    var target = sheet(name);
    var keys = headers(name);
    var row = keys.map(function (key) { return safeCell(object[key]); });
    target.getRange(target.getLastRow() + 1, 1, 1, row.length).setValues([row]);
    return target.getLastRow();
  }

  function rowObject(name, rowNumber) {
    var target = sheet(name);
    var keys = headers(name);
    var values = target.getRange(rowNumber, 1, 1, keys.length).getValues()[0];
    var object = {};
    keys.forEach(function (key, index) { object[key] = values[index]; });
    object.__rowNumber = rowNumber;
    return object;
  }

  function findRow(name, key, value) {
    var target = sheet(name);
    var keys = headers(name);
    var column = keys.indexOf(key);
    if (column === -1) throw new Error('필수 열이 없습니다: ' + name + '.' + key);
    var lastRow = target.getLastRow();
    if (lastRow < 2) return null;
    var values = target.getRange(2, column + 1, lastRow - 1, 1).getValues();
    var expected = String(value);
    for (var index = 0; index < values.length; index += 1) {
      if (String(values[index][0]) === expected) {
        return rowObject(name, index + 2);
      }
    }
    return null;
  }

  function findRows(name, key, value) {
    var target = sheet(name);
    var keys = headers(name);
    var column = keys.indexOf(key);
    if (column === -1) throw new Error('필수 열이 없습니다: ' + name + '.' + key);
    var lastRow = target.getLastRow();
    if (lastRow < 2) return [];
    var values = target.getRange(2, column + 1, lastRow - 1, 1).getValues();
    var expected = String(value);
    var result = [];
    values.forEach(function (entry, index) {
      if (String(entry[0]) === expected) result.push(rowObject(name, index + 2));
    });
    return result;
  }

  function allRows(name) {
    var target = sheet(name);
    var result = [];
    for (var row = 2; row <= target.getLastRow(); row += 1) {
      result.push(rowObject(name, row));
    }
    return result;
  }

  function updateRow(name, rowNumber, changes) {
    var target = sheet(name);
    var keys = headers(name);
    var current = target.getRange(rowNumber, 1, 1, keys.length).getValues()[0];
    Object.keys(changes).forEach(function (key) {
      var index = keys.indexOf(key);
      if (index === -1) throw new Error('필수 열이 없습니다: ' + name + '.' + key);
      current[index] = safeCell(changes[key]);
    });
    target.getRange(rowNumber, 1, 1, keys.length).setValues([current]);
  }

  function withScriptLock(callback, timeoutMs) {
    var lock = LockService.getScriptLock();
    if (!lock.tryLock(timeoutMs || 15000)) {
      throw new Error('시스템이 다른 요청을 처리 중입니다. 잠시 후 다시 시도하세요.');
    }
    try {
      return callback();
    } finally {
      SpreadsheetApp.flush();
      lock.releaseLock();
    }
  }

  function getSettingsMap() {
    var result = {};
    if (!DC.Config.getProperty(DC.Config.KEYS.SPREADSHEET_ID)) return result;
    try {
      allRows('SETTINGS').forEach(function (row) {
        if (row.key) result[String(row.key)] = String(row.value || '');
      });
    } catch (error) {
      return {};
    }
    return result;
  }

  function nextContractId() {
    var timeZone = Session.getScriptTimeZone() || 'Asia/Seoul';
    var year = Utilities.formatDate(new Date(), timeZone, 'yyyy');
    var propertyKey = 'CONTRACT_COUNTER_' + year;
    var current = Number(DC.Config.getProperty(propertyKey) || 0);
    var candidate;
    do {
      current += 1;
      candidate = 'DC-' + year + '-' + String(current).padStart(4, '0');
    } while (findRow('CONTRACTS', 'contractId', candidate));
    DC.Config.setProperty(propertyKey, String(current));
    return candidate;
  }

  function savePrivateJson(folderPropertyKey, fileName, value) {
    var folderId = DC.Config.getProperty(folderPropertyKey);
    if (!folderId) throw new Error('비공개 저장 폴더 설정이 누락되었습니다.');
    var folder = DriveApp.getFolderById(folderId);
    var file = folder.createFile(
      fileName,
      DC.Security.canonicalJson(value),
      MimeType.PLAIN_TEXT
    );
    try {
      file.setSharing(DriveApp.Access.PRIVATE, DriveApp.Permission.NONE);
      if (file.getSharingAccess() !== DriveApp.Access.PRIVATE) {
        throw new Error('PRIVATE_NOT_APPLIED');
      }
    } catch (error) {
      file.setTrashed(true);
      throw new Error('스냅샷을 비공개로 고정할 수 없어 저장을 중단했습니다.');
    }
    return file.getId();
  }

  function savePrivateJsonOnce(folderPropertyKey, fileName, value) {
    var folderId = DC.Config.getProperty(folderPropertyKey);
    if (!folderId) throw new Error('비공개 저장 폴더 설정이 누락되었습니다.');
    var folder = DriveApp.getFolderById(folderId);
    var expected = DC.Security.canonicalJson(value);
    var files = folder.getFilesByName(fileName);
    while (files.hasNext()) {
      var existing = files.next();
      try {
        existing.setSharing(DriveApp.Access.PRIVATE, DriveApp.Permission.NONE);
        if (existing.getSharingAccess() !== DriveApp.Access.PRIVATE) {
          throw new Error('PRIVATE_NOT_APPLIED');
        }
      } catch (error) {
        throw new Error('기존 스냅샷의 비공개 권한을 확인할 수 없습니다.');
      }
      var actual = existing.getBlob().getDataAsString('UTF-8');
      if (actual !== expected) {
        throw new Error('같은 이름의 스냅샷 내용이 일치하지 않습니다.');
      }
      return existing.getId();
    }
    return savePrivateJson(folderPropertyKey, fileName, value);
  }

  function readJsonFile(fileId) {
    var file = DriveApp.getFileById(fileId);
    try {
      file.setSharing(DriveApp.Access.PRIVATE, DriveApp.Permission.NONE);
      if (file.getSharingAccess() !== DriveApp.Access.PRIVATE) {
        throw new Error('PRIVATE_NOT_APPLIED');
      }
    } catch (error) {
      throw new Error('비공개 전자기록의 접근권한을 검증할 수 없습니다.');
    }
    var text = file.getBlob().getDataAsString('UTF-8');
    return JSON.parse(text);
  }

  function fileExists(fileId) {
    if (!fileId) return false;
    try {
      DriveApp.getFileById(fileId).getName();
      return true;
    } catch (error) {
      return false;
    }
  }

  return Object.freeze({
    nowIso: nowIso,
    spreadsheet: spreadsheet,
    sheet: sheet,
    headers: headers,
    appendObject: appendObject,
    rowObject: rowObject,
    findRow: findRow,
    findRows: findRows,
    allRows: allRows,
    updateRow: updateRow,
    withScriptLock: withScriptLock,
    getSettingsMap: getSettingsMap,
    nextContractId: nextContractId,
    savePrivateJson: savePrivateJson,
    savePrivateJsonOnce: savePrivateJsonOnce,
    readJsonFile: readJsonFile,
    fileExists: fileExists
  });
})();
