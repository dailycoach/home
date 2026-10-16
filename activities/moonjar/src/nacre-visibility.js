/**
 * DAILYCOACHING Moonjar: optional session-only nacre visibility guide.
 * This is a viewing aid: it never changes project JSON, original images,
 * SVG geometry, downloadable PNG, postcards, or print content.
 */
export function installNacreVisibility({document: doc = globalThis.document, Observer = globalThis.MutationObserver} = {}) {
  if (!doc || !Observer) return () => {};
  const root = doc.querySelector('#main');
  if (!root) return () => {};
  let active = false;
  let disposed = false;

  const enhance = () => {
    if (disposed) return;
    const inStudio = root.classList.contains('studio');
    root.classList.toggle('nacre-guide-visible', inStudio && active);
    if (!inStudio) return;

    const toolbar = root.querySelector('.view-toolbar');
    if (!toolbar || toolbar.querySelector('#nacre-visibility-switch')) return;

    const control = doc.createElement('button');
    control.type = 'button';
    control.id = 'nacre-visibility-switch';
    control.className = 'nacre-visibility-switch';
    control.setAttribute('aria-controls', 'art');
    control.setAttribute('aria-describedby', 'nacre-visibility-note');
    const note = doc.createElement('p');
    note.id = 'nacre-visibility-note';
    note.className = 'nacre-visibility-note';
    note.setAttribute('role', 'status');
    note.setAttribute('aria-live', 'polite');
    note.textContent = '편집할 때만 조각의 윤곽을 도와주는 보기 옵션입니다. 저장한 작품과 카드는 원본 그대로입니다.';

    function paint() {
      control.textContent = active ? '윤곽 보기 끄기' : '조각 윤곽 보기';
      control.setAttribute('aria-pressed', String(active));
      note.hidden = !active;
      root.classList.toggle('nacre-guide-visible', active);
    }

    control.addEventListener('click', event => {
      event.stopPropagation();
      active = !active;
      paint();
    });
    const pause = toolbar.querySelector('.pause-button');
    if (pause) toolbar.insertBefore(control, pause);
    else toolbar.append(control);
    toolbar.insertAdjacentElement('afterend', note);
    paint();
  };

  const observer = new Observer(records => {
    // The main app replaces its view as a whole. Reinstall the control only
    // after a view replacement, not on every editing step or style change.
    if (records.some(r => r.type === 'childList')) enhance();
  });
  observer.observe(root, {childList:true});
  enhance();

  return () => {
    disposed = true;
    observer.disconnect();
    root.classList.remove('nacre-guide-visible');
    root.querySelector('#nacre-visibility-switch')?.remove();
    root.querySelector('#nacre-visibility-note')?.remove();
  };
}

if (typeof document !== 'undefined') installNacreVisibility();
