var DC = DC || {};

DC.StateMachine = (function () {
  var ALLOWED = Object.freeze({
    DRAFT: ['ISSUED', 'TERMINATED'],
    ISSUED: ['CLIENT_VERIFIED', 'SPONSOR_VERIFIED', 'COMPLETED', 'TERMINATED', 'EXPIRED'],
    CLIENT_VERIFIED: ['COMPLETED', 'TERMINATED', 'EXPIRED'],
    SPONSOR_VERIFIED: ['COMPLETED', 'TERMINATED', 'EXPIRED'],
    COMPLETED: ['TERMINATED'],
    TERMINATED: [],
    EXPIRED: []
  });
  var SIGNABLE = Object.freeze([
    'ISSUED', 'CLIENT_VERIFIED', 'SPONSOR_VERIFIED'
  ]);

  function assertTransition(from, to) {
    if (from === to) return true;
    if (!ALLOWED[from] || ALLOWED[from].indexOf(to) === -1) {
      throw new Error('허용되지 않은 계약 상태 전이입니다.');
    }
    return true;
  }

  function requiredRoles(contract) {
    if (String(contract.contractType) === 'business' &&
        String(contract.contractMode) === 'organization') {
      return ['CLIENT', 'SPONSOR'];
    }
    return ['CLIENT'];
  }

  function isSignable(contract) {
    return Boolean(contract) &&
      SIGNABLE.indexOf(String(contract.status)) !== -1;
  }

  function assertSignable(contract) {
    if (!isSignable(contract)) throw new Error('CONTRACT_NOT_SIGNABLE');
    return contract;
  }

  function derive(contract, signers) {
    var roles = requiredRoles(contract);
    var accepted = {};
    signers.forEach(function (signer) {
      if (String(signer.status) === 'ACCEPTED') {
        accepted[String(signer.signerRole)] = true;
      }
    });
    var allAccepted = roles.every(function (role) { return accepted[role]; });
    if (allAccepted) return 'COMPLETED';
    if (accepted.CLIENT) return 'CLIENT_VERIFIED';
    if (accepted.SPONSOR) return 'SPONSOR_VERIFIED';
    return 'ISSUED';
  }

  return Object.freeze({
    assertTransition: assertTransition,
    isSignable: isSignable,
    assertSignable: assertSignable,
    requiredRoles: requiredRoles,
    derive: derive
  });
})();
