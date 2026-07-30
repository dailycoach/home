(() => {
  'use strict';

  const config = window.DAILYCOACHING_CONTRACT_CONFIG || {};
  const protocolVersion = Number(config.protocolVersion) || 1;
  const messageSource = 'dailycoaching-contracts';
  const tokenPattern = /^[A-Za-z0-9_-]{22,128}$/;

  function init() {
    applyOperatorEmail();
    if (document.querySelector('[data-sign-gateway]')) initSignGateway();
    if (document.querySelector('[data-contract-success]')) initSuccessManagement();
  }

  function initSignGateway() {
    let inviteToken = readAndRemoveInviteToken();
    const title = document.querySelector('#signGatewayTitle');
    const message = document.querySelector('#signGatewayMessage');
    const status = document.querySelector('#signGatewayStatus');
    const statusTitle = document.querySelector('#signGatewayStatusTitle');
    const statusMessage = document.querySelector('#signGatewayStatusMessage');
    const frameHost = document.querySelector('#signFrameHost');
    let frame = null;
    let tokenDelivered = false;
    let readyTimeout = null;

    const setStatus = (heading, body, ready = false) => {
      if (title) title.textContent = heading;
      if (message) message.textContent = body;
      if (status) status.dataset.state = ready ? 'ready' : 'draft';
      if (statusTitle) statusTitle.textContent = heading;
      if (statusMessage) statusMessage.textContent = body;
      title?.focus({ preventScroll: true });
    };

    if (!inviteToken || !tokenPattern.test(inviteToken)) {
      inviteToken = null;
      setStatus(
        '초대 링크를 확인할 수 없습니다.',
        '발행받은 원본 이메일의 계약 확인 버튼으로 다시 접속해 주세요. 만료·사용 여부 등 구체적인 상태는 이 화면에서 구분해 표시하지 않습니다.'
      );
      return;
    }

    const readiness = getElectronicReadiness();
    if (!readiness.ready) {
      inviteToken = null;
      setStatus(readiness.title, readiness.message);
      return;
    }

    frame = document.createElement('iframe');
    frame.title = 'DAILYCOACHING 전자계약 확인';
    frame.width = '100%';
    frame.height = '760';
    frame.loading = 'eager';
    frame.referrerPolicy = 'no-referrer';
    frame.setAttribute('sandbox', 'allow-scripts allow-forms allow-same-origin');
    frame.hidden = true;

    const handleMessage = (event) => {
      if (!frame || event.source !== frame.contentWindow || !isAllowedAppsScriptOrigin(event.origin)) return;
      const payload = event.data;
      if (!isProtocolMessage(payload)) return;

      if (payload.type === 'DAILYCOACHING_SIGN_READY') {
        if (tokenDelivered || !inviteToken) return;
        window.clearTimeout(readyTimeout);
        frame.hidden = false;
        setStatus('전자계약 보안 관문 연결', '이메일 본인 확인 화면을 준비하고 있습니다.', true);
        frame.contentWindow.postMessage({
          source: messageSource,
          type: 'DAILYCOACHING_SIGN_TOKEN',
          version: protocolVersion,
          token: inviteToken
        }, event.origin);
        tokenDelivered = true;
        return;
      }

      if (payload.type === 'DAILYCOACHING_SIGN_TOKEN_RECEIVED') {
        inviteToken = null;
        setStatus('이메일 본인 확인', '화면 안내에 따라 이메일 인증번호를 확인해 주세요.', true);
        return;
      }

      if (payload.type === 'DAILYCOACHING_SIGN_STATUS') {
        applyMappedStatus(payload.status, setStatus);
        return;
      }

      if (payload.type === 'DAILYCOACHING_SIGN_COMPLETED') {
        inviteToken = null;
        cleanup();
        window.location.replace('/coaching/agreement/success/');
        return;
      }

      if (payload.type === 'DAILYCOACHING_SIGN_FAILED') {
        inviteToken = null;
        cleanup(false);
        setStatus(
          '전자확인을 계속할 수 없습니다.',
          '발행받은 원본 이메일의 링크를 다시 확인하거나 운영 이메일로 문의해 주세요. 계약 존재 여부나 당사자 정보는 이 오류 화면에 표시하지 않습니다.'
        );
      }
    };

    const handleFrameError = () => {
      inviteToken = null;
      cleanup(false);
      setStatus('전자계약 화면을 불러오지 못했습니다.', '잠시 후 원본 이메일의 링크로 다시 접속하거나 운영 이메일로 문의해 주세요.');
    };

    const cleanup = (removeFrame = true) => {
      window.clearTimeout(readyTimeout);
      window.removeEventListener('message', handleMessage);
      window.removeEventListener('pagehide', handlePageHide);
      frame?.removeEventListener('error', handleFrameError);
      if (removeFrame) frame?.remove();
    };

    const handlePageHide = () => {
      inviteToken = null;
      cleanup();
    };

    window.addEventListener('message', handleMessage);
    window.addEventListener('pagehide', handlePageHide, { once: true });
    frame.addEventListener('error', handleFrameError, { once: true });
    frame.src = readiness.endpoint;
    frameHost?.replaceChildren(frame);
    readyTimeout = window.setTimeout(() => {
      inviteToken = null;
      cleanup();
      setStatus('전자계약 연결 시간이 초과되었습니다.', '원본 이메일의 링크로 다시 접속하거나 운영 이메일로 문의해 주세요.');
    }, 15000);
  }

  function initSuccessManagement() {
    const readiness = getElectronicReadiness();
    const managementEndpoint = getValidAppsScriptEndpoint(config.contractManagementUrl);
    const managementReady = readiness.ready && Boolean(managementEndpoint);
    const status = document.querySelector('#managementStatus');
    const buttons = [...document.querySelectorAll('[data-management-action]')];

    if (!managementReady) {
      buttons.forEach((button) => {
        button.disabled = true;
        button.setAttribute('aria-disabled', 'true');
      });
      if (status) {
        status.textContent = '온라인 계약 관리 endpoint와 필수 운영 검토가 모두 확정되기 전에는 관리 버튼을 활성화하지 않습니다. 현재는 운영 이메일로 요청을 접수합니다.';
      }
      return;
    }

    buttons.forEach((button) => {
      button.disabled = false;
      button.removeAttribute('aria-disabled');
      button.textContent = getManagementButtonLabel(button.dataset.managementAction);
      button.addEventListener('click', () => {
        const destination = new URL(managementEndpoint);
        destination.hash = button.dataset.managementAction || 'contract';
        window.location.assign(destination.toString());
      });
    });
    if (status) {
      status.textContent = '안전한 계약 관리 관문에서 이메일 본인 확인 후 요청할 수 있습니다.';
    }
  }

  function readAndRemoveInviteToken() {
    const token = window.location.hash.startsWith('#')
      ? window.location.hash.slice(1)
      : '';
    window.history.replaceState(null, '', window.location.pathname);
    return token;
  }

  function getElectronicReadiness() {
    const endpoint = getValidAppsScriptEndpoint(config.appsScriptUrl);
    const enabled = config.electronicContractEnabled === true;
    const complianceComplete = [
      'googleProcessingReviewComplete',
      'overseasTransferNoticeComplete',
      'legalReviewComplete',
      'contractManagementReady',
      'endToEndTestComplete'
    ].every((key) => config.compliance?.[key] === true);

    if (!enabled || !endpoint) {
      return {
        ready: false,
        title: '전자계약 시스템 연결 전',
        message: '전자계약 배포 URL과 운영 활성화 설정이 완료되지 않았습니다. 현재 전자계약을 진행하지 않습니다.'
      };
    }
    if (!complianceComplete) {
      return {
        ready: false,
        title: '전자계약 운영 검토 전',
        message: 'Google 처리위탁·국외이전 안내, 법률 검토, 계약 관리 준비와 종단간 검수가 모두 확정되지 않아 전자계약을 진행하지 않습니다.'
      };
    }
    return { ready: true, title: '전자계약 연결 준비 완료', endpoint };
  }

  function getValidAppsScriptEndpoint(value) {
    if (!value) return '';
    try {
      const url = new URL(value);
      const valid = url.protocol === 'https:' &&
        url.hostname === 'script.google.com' &&
        /^\/macros\/s\/[A-Za-z0-9_-]+\/exec$/.test(url.pathname) &&
        !url.search &&
        !url.hash;
      return valid ? url.toString() : '';
    } catch {
      return '';
    }
  }

  function isAllowedAppsScriptOrigin(origin) {
    try {
      const url = new URL(origin);
      if (url.protocol !== 'https:') return false;
      const configured = Array.isArray(config.allowedAppsScriptOrigins)
        ? config.allowedAppsScriptOrigins
        : [];
      if (configured.includes(url.origin)) return true;
      return url.hostname === 'script.google.com' ||
        url.hostname === 'script.googleusercontent.com' ||
        url.hostname.endsWith('.googleusercontent.com');
    } catch {
      return false;
    }
  }

  function isProtocolMessage(payload) {
    return payload &&
      typeof payload === 'object' &&
      payload.source === messageSource &&
      Number(payload.version) === protocolVersion &&
      typeof payload.type === 'string';
  }

  function applyMappedStatus(statusCode, setStatus) {
    const statuses = {
      otp: ['이메일 본인 확인', '이메일로 받은 6자리 인증번호를 입력해 주세요.'],
      review: ['계약 전문 확인', '계약 조건과 전체 조항, 개인정보 안내와 선택 동의를 차례로 확인해 주세요.'],
      waiting: ['다른 당사자 확인 대기', '조직 지원 3자 계약은 고객과 스폰서의 확인이 모두 완료되어야 최종본이 발행됩니다.'],
      processing: ['최종 문서 처리 중', '전자확인 기록과 계약 문서 생성을 안전하게 처리하고 있습니다.']
    };
    const mapped = statuses[statusCode];
    if (mapped) setStatus(mapped[0], mapped[1], true);
  }

  function getManagementButtonLabel(action) {
    const labels = {
      amendment: '계약 변경 요청',
      termination: '청약철회·중도종료 요청',
      consent: '선택동의 철회 요청',
      privacy: '개인정보 권리요청',
      contract: '계약 변경·종료 요청'
    };
    return labels[action] || '계약 관리';
  }

  function applyOperatorEmail() {
    const email = config.provider?.email || 'hello@daily-coach-ing.com';
    document.querySelectorAll('[data-operator-email-link]').forEach((link) => {
      link.href = `mailto:${email}`;
      if (link.hasAttribute('data-operator-email-text')) link.textContent = email;
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
