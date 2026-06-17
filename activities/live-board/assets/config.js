// Live Board Basic configuration
// 1) Google Apps Script Web App URL만 반드시 교체합니다.
// 2) 화면 문구와 참여자 코드는 Spreadsheet의 Settings / Participants 탭에서 관리합니다.

window.APP_CONFIG = {
  SCRIPT_URL: "https://script.google.com/macros/s/AKfycbx0HQwk3H6R-wOy4hFwi-L9KkE1dvRBM0pFqP_Oe9x4NRT81QIqYGqKZVHqFrUtdvpSeg/exec",
  REFRESH_MS: 5000,
  FALLBACK: {
    eyebrow: "Live Board Basic",
    siteTitle: "강의용 라이브보드",
    siteSubtitle: "지금 떠오른 생각을 짧게 남겨주세요. 공개 동의한 응답만 라이브보드에 표시됩니다.",
    sideTitle: "참여 방법",
    liveTitle: "강의용 라이브보드",
    liveSubtitle: "참여자들의 공개 응답이 실시간으로 모입니다.",
    participantLabel: "참여자 코드",
    keywordLabel: "키워드",
    keywordHelp: "쉼표로 여러 개를 입력할 수 있습니다.",
    responseLabel: "한줄 응답",
    responseHelp: "라이브보드 카드에 크게 표시됩니다.",
    publicNotice: "라이브보드에는 공개 동의한 문장만 참여자 코드로 표시됩니다.",
    submitButtonText: "라이브보드에 기록하기",
    boardResponseTitle: "한줄 응답",
    boardResponseCaption: "최근 공개 응답",
    boardKeywordTitle: "키워드 클라우드",
    boardKeywordCaption: "많이 나온 키워드",
    placeholderKeyword: "예: 성장, 몰입, 관계",
    placeholderResponse: "예: 오늘 가장 남는 한 문장은 무엇인가요?",
    maxLiveItems: "100",
    enablePrivateMemo: "TRUE"
  }
};
