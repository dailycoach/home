(() => {
  'use strict';
  const data = window.DISC16_YOUTH_DATA;
  if (!data?.QUESTIONS) return;

  const labels = [
    {D:'조건 다시 말하기',I:'마음 전하기',S:'일단 따라보기',C:'이유 물어보기'},
    {D:'먼저 자리 잡기',I:'먼저 말 걸기',S:'천천히 어울리기',C:'분위기 살피기'},
    {D:'결론 먼저 내기',I:'의견 이어주기',S:'사이 조율하기',C:'근거 따져보기'},
    {D:'내 계획 말하기',I:'속마음 털어놓기',S:'기대 맞춰주기',C:'현실 비교하기'},
    {D:'바로 선 긋기',I:'웃으며 풀기',S:'한번 넘기기',C:'규칙 다시 정하기'},
    {D:'해결책 말하기',I:'힘 북돋우기',S:'오래 들어주기',C:'상황 정리하기'},
    {D:'새 계획 이끌기',I:'재미 찾기',S:'천천히 적응하기',C:'바뀐 점 확인하기'},
    {D:'직접 물어보기',I:'새 대화 열기',S:'조금 기다리기',C:'사실 확인하기'},
    {D:'바로 해명하기',I:'대화로 풀기',S:'관계 지켜보기',C:'경위 확인하기'},
    {D:'내 입장 말하기',I:'속상함 털어놓기',S:'조용히 들어보기',C:'맞는 점 살피기'},
    {D:'분명히 거절하기',I:'분위기 바꾸기',S:'조용히 빠지기',C:'위험 따져보기'},
    {D:'도움 요청하기',I:'먼저 털어놓기',S:'믿는 사람 찾기',C:'상황 정리하기'},
    {D:'역할 다시 나누기',I:'같이 하자 말하기',S:'내가 더 해보기',C:'분담 확인하기'},
    {D:'책임 분명히 묻기',I:'서운함 말하기',S:'사정 이해하기',C:'약속 다시 잡기'},
    {D:'핵심 바로 말하기',I:'먼저 연락하기',S:'감정 가라앉히기',C:'사실 나눠보기'},
    {D:'내 선 분명히 하기',I:'불편함 솔직히 말하기',S:'갈등 피하기',C:'기준 함께 정하기'}
  ];

  if (labels.length !== data.QUESTIONS.length) {
    console.warn('DISC16 Youth keyword count mismatch');
    return;
  }

  data.QUESTIONS.forEach((question, questionIndex) => {
    const set = labels[questionIndex];
    question.choices = question.choices.map(([type]) => [type, set[type]]);
  });
})();
