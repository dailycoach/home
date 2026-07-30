var DC = DC || {};

DC.Audit = (function () {
  function append(event) {
    var record = {
      eventId: DC.Security.randomId('evt-'),
      contractId: event.contractId || '',
      signerId: event.signerId || '',
      eventType: event.eventType,
      actorRole: event.actorRole || 'SYSTEM',
      eventAt: event.eventAt || DC.Storage.nowIso(),
      version: DC.Schema.VERSION,
      result: event.result || 'SUCCESS',
      previousStatus: event.previousStatus || '',
      nextStatus: event.nextStatus || '',
      requestIdHash: event.requestIdHash || '',
      correlationId: event.correlationId || '',
      detailCode: event.detailCode || '',
      attemptNumber: event.attemptNumber || 0,
      safeMetadataJson: event.safeMetadata
        ? DC.Security.canonicalJson(event.safeMetadata)
        : ''
    };
    DC.Storage.appendObject('AUDIT_LOG', record);
    return record.eventId;
  }

  function findByRequestHash(requestIdHash, eventType) {
    if (!requestIdHash) return null;
    var rows = DC.Storage.findRows('AUDIT_LOG', 'requestIdHash', requestIdHash);
    for (var index = rows.length - 1; index >= 0; index -= 1) {
      if (!eventType || String(rows[index].eventType) === eventType) {
        return rows[index];
      }
    }
    return null;
  }

  return Object.freeze({
    append: append,
    findByRequestHash: findByRequestHash
  });
})();
