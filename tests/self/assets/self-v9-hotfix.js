(() => {
  const startBtn = document.querySelector('#startBtn');
  const homeBtn = document.querySelector('#homeBtn');
  const restartBtn = document.querySelector('#restartBtn');
  const resultScreen = document.querySelector('#resultScreen');
  const screens = [...document.querySelectorAll('.screen')];
  const totalScore = document.querySelector('#totalScore');

  if (!startBtn || !homeBtn || !restartBtn || !resultScreen || !totalScore) return;

  const hasRenderedResult = () => totalScore.textContent.trim() !== '—';

  homeBtn.addEventListener('click', () => {
    if (!hasRenderedResult()) return;
    startBtn.dataset.mode = 'result';
    startBtn.innerHTML = '결과 다시 보기 <span aria-hidden="true">→</span>';
  });

  startBtn.addEventListener('click', (event) => {
    if (startBtn.dataset.mode !== 'result' || !hasRenderedResult()) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    screens.forEach((screen) => screen.classList.toggle('active', screen === resultScreen));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, true);

  restartBtn.addEventListener('click', () => {
    delete startBtn.dataset.mode;
    startBtn.innerHTML = '점검 시작하기 <span aria-hidden="true">→</span>';
  });
})();
