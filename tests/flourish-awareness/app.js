"use strict";

const ITEMS = [
  { id: 1, domain: "P", text: "일상에서 잔잔한 만족이나 기쁨을 자주 느낀다." },
  { id: 2, domain: "SN", text: "몸의 긴장이나 호흡 변화를 비교적 빨리 알아차린다." },
  { id: 3, domain: "E", text: "중요한 일을 할 때 주의가 한곳에 모인다." },
  { id: 4, domain: "R", text: "솔직한 마음을 나눌 수 있는 사람이 있다." },
  { id: 5, domain: "M", text: "내가 하는 일이 무엇을 위해 이어지는지 알고 있다." },

  { id: 6, domain: "A", text: "작게라도 끝낸 일을 확인하며 살아간다." },
  { id: 7, domain: "NM", text: "막연한 기분을 구체적인 감정의 이름으로 표현할 수 있다." },
  { id: 8, domain: "P", text: "예상과 다른 일이 생겨도 다시 희망을 떠올릴 수 있다." },
  { id: 9, domain: "E", text: "나의 강점이 쓰이는 활동에 시간을 내고 있다." },
  { id: 10, domain: "R", text: "필요할 때 다른 사람에게 도움을 요청하거나 받을 수 있다." },

  { id: 11, domain: "M", text: "나보다 큰 가치나 공동체와 연결되어 있다고 느낀다." },
  { id: 12, domain: "PT", text: "비슷한 어려움이 반복될 때 그것을 촉발하는 조건을 살펴본다." },
  { id: 13, domain: "A", text: "목표를 현실적으로 실행할 수 있는 단계로 나눈다." },
  { id: 14, domain: "P", text: "좋은 순간을 서두르지 않고 충분히 음미하는 편이다." },
  { id: 15, domain: "VL", text: "중요한 선택에서 타인의 기대와 내가 소중히 여기는 기준을 구분한다." },

  { id: 16, domain: "E", text: "적절히 도전적인 일을 만날 때 활력이 살아난다." },
  { id: 17, domain: "R", text: "가까운 관계 안에서 존중받고 있다고 느낀다." },
  { id: 18, domain: "M", text: "어려운 경험에서도 배울 의미를 찾을 수 있다." },
  { id: 19, domain: "CH", text: "감정이 올라올 때 바로 반응하기보다 잠시 멈출 틈을 만든다." },
  { id: 20, domain: "A", text: "어려움이 있어도 나에게 중요한 일을 다시 시작한다." },

  { id: 21, domain: "P", text: "힘든 감정이 생기면 그날의 좋은 경험까지 잘 보이지 않는다.", reverse: true },
  { id: 22, domain: "SN", text: "몸이 지친 뒤에야 내가 무리했다는 것을 알아차린다.", reverse: true },
  { id: 23, domain: "E", text: "해야 할 일을 하면서도 주의가 자주 흩어진다.", reverse: true },
  { id: 24, domain: "NM", text: "불편한 기분이 들어도 무엇을 느끼는지 구분하지 않고 지나간다.", reverse: true },
  { id: 25, domain: "R", text: "혼자 해결해야 한다는 생각 때문에 도움을 청하지 못한다.", reverse: true },

  { id: 26, domain: "M", text: "바쁘게 움직이지만 왜 이 일을 하는지 모를 때가 많다.", reverse: true },
  { id: 27, domain: "PT", text: "비슷한 반응을 반복한 뒤에도 원인을 상황 탓으로만 돌리는 편이다.", reverse: true },
  { id: 28, domain: "A", text: "시작했지만 마무리하지 못한 일이 계속 쌓여 있다.", reverse: true },
  { id: 29, domain: "VL", text: "타인이 기대하는 방식에 맞추느라 내 강점과 방식을 뒤로 미룬다.", reverse: true },
  { id: 30, domain: "CH", text: "문제를 알아차린 뒤에도 다음 행동을 정하지 못한 채 머문다.", reverse: true },

  { id: 31, domain: "SN", text: "감정이 커지기 전 에너지와 분위기의 작은 변화를 감지한다." },
  { id: 32, domain: "NM", text: "관찰한 사실과 내가 붙인 해석을 나누어 볼 수 있다." },
  { id: 33, domain: "PT", text: "나의 자동적인 반응이 관계와 선택에 미치는 영향을 살펴본다." },
  { id: 34, domain: "VL", text: "나답게 잘해 온 방식과 강점을 다음 선택에 활용한다." },
  { id: 35, domain: "CH", text: "작은 행동을 실행한 뒤 결과를 관찰하고 다시 조정한다." }
];

const DOMAINS = {
  P: {
    group: "flourish", code: "P", name: "긍정정서", short: "정서",
    desc: "좋은 감정을 만들기보다 이미 존재하는 만족, 희망, 감사를 받아들이는 힘",
    questions: ["최근 나에게 실제로 힘을 준 감정은 무엇입니까?", "좋았던 순간을 더 오래 머물게 하려면 무엇을 달리할 수 있을까요?"],
    experiment: ["좋은 순간을 20초 더 머물러 보기", "7주 동안 매주 세 번, 좋았던 장면에 20초 더 머물고 감정과 몸의 변화를 한 문장으로 기록하세요."],
    observe: "한 주의 좋은 순간을 알아차릴 때 내 몸과 생각에는 어떤 변화가 생겼습니까?",
    expert: {
      theory: "긍정정서는 단순히 기분이 좋은 상태가 아닙니다. 희망·감사·평온·흥미처럼 주의의 폭을 넓히고, 이후 사용할 수 있는 심리적·관계적 자원을 축적하게 하는 경험입니다. 부정정서를 없애는 능력과는 다르며 두 감정은 함께 존재할 수 있습니다.",
      low: ["좋은 감정에 접근할 여백이 부족합니다.", "요구와 걱정이 주의를 오래 점유해 좋은 장면이 있어도 충분히 등록되거나 음미되지 않을 수 있습니다. ‘긍정적으로 생각하기’보다 피로와 위협감을 먼저 인정하고, 이미 있었던 작은 안정의 증거를 다시 감각하는 접근이 적절합니다."],
      mid: ["좋은 조건에서는 살아나지만 압박 속에서 빠르게 약해집니다.", "만족과 희망을 느낄 수 있으나 일정, 관계 갈등, 실패 경험이 생기면 회복 통로가 좁아지는 편입니다. 긍정정서를 우연한 기분이 아니라 반복 가능한 생활 조건으로 만드는 작업이 필요합니다."],
      high: ["회복을 돕는 정서 자원에 비교적 안정적으로 접근합니다.", "감사·희망·만족을 알아차리고 머무는 힘이 현재 삶을 지지하고 있습니다. 이 강점이 다른 사람에게 밝아 보이기 위한 역할이 아니라 실제 경험인지 확인하면서, 어려운 감정도 함께 수용하면 더 탄탄해집니다."],
      overuse: "밝게 해석해야 한다는 압박, 슬픔·분노의 성급한 전환, 문제를 보지 않는 낙관으로 흐르면 ‘긍정성 회피’가 될 수 있습니다.",
      scene: "하루를 마칠 때 무엇이 먼저 기억나는지, 실패 직후 희망의 근거를 다시 찾는 데 얼마나 걸리는지, 쉬는 동안 죄책감이 생기는지를 봅니다.",
      coaching: "부정정서를 반박하지 않고 충분히 인정한 다음, 이미 존재했던 만족의 장면·감각·조건을 구체적으로 복원합니다. 감사를 의무로 만들기보다 실제로 반응이 있었던 증거를 찾습니다."
    }
  },
  E: {
    group: "flourish", code: "E", name: "몰입", short: "몰입",
    desc: "강점과 주의를 적절한 도전에 온전히 연결하는 힘",
    questions: ["시간의 흐름을 잊었던 최근 장면에는 어떤 조건이 있었습니까?", "주의를 흩뜨리는 한 가지를 덜어낸다면 무엇입니까?"],
    experiment: ["25분의 몰입 조건 만들기", "7주 동안 매주 한 차례, 강점을 쓸 수 있는 일의 방해 요소를 치우고 25분간 집중한 뒤 조건을 기록하세요."],
    observe: "이번 주 집중이 살아난 순간, 나의 능력과 과제 난이도는 어떻게 맞아 있었습니까?",
    expert: {
      theory: "몰입은 주의가 한 과제에 모이고, 자신의 기술과 도전 수준이 적절히 맞을 때 나타나는 최적경험입니다. 목표가 분명하고 진행 피드백을 얻을 수 있을수록 촉진되며, 단순한 바쁨이나 오래 일하는 것과는 다릅니다.",
      low: ["주의를 모을 조건이 충분히 설계되지 않았습니다.", "집중력 자체의 결함이라기보다 과제가 너무 쉽거나 어렵고, 목표가 흐리거나, 중단 요소가 많은 상태일 수 있습니다. 강점을 쓸 수 있는 일과 실제 생활환경의 연결부터 점검해야 합니다."],
      mid: ["몰입이 가능하지만 조건 의존성이 큽니다.", "흥미·마감·조용한 환경처럼 특정 조건에서는 집중하지만 일상에서는 쉽게 분산될 수 있습니다. 우연히 잘된 날을 분석해 몰입의 시작 조건을 재현하는 것이 효과적입니다."],
      high: ["강점과 주의를 과제에 깊게 연결할 수 있습니다.", "도전적인 활동에서 에너지가 살아나고, 주의를 유지하는 개인적 조건을 어느 정도 알고 있습니다. 이 힘을 중요한 과제에 선택적으로 배치하면 성취와 활력을 함께 높일 수 있습니다."],
      overuse: "과몰입으로 몸의 신호, 관계, 휴식을 놓치거나 ‘집중하고 있을 때만 가치 있다’는 생산성 정체성으로 굳어질 수 있습니다.",
      scene: "집중이 시작되기 전 환경, 방해 후 복귀 시간, 과제 난이도, 강점 사용 여부, 몰입 뒤 피로와 만족의 비율을 관찰합니다.",
      coaching: "집중을 의지 문제로 다루지 않고 목표 명료성·난이도·강점·피드백·방해 요소의 조합으로 봅니다. 가장 최근의 몰입 장면을 해부해 재현 가능한 조건을 만듭니다."
    }
  },
  R: {
    group: "flourish", code: "R", name: "관계", short: "관계",
    desc: "도움을 주고받고, 존중과 소속을 경험하는 연결의 힘",
    questions: ["지금 내 마음을 조금 더 솔직하게 나눌 수 있는 사람은 누구입니까?", "도움을 청하지 못하게 막는 생각은 사실입니까, 익숙한 해석입니까?"],
    experiment: ["매주 한 번 구체적으로 연결 요청하기", "7주 동안 매주 한 사람에게 안부를 넘어, 필요한 도움이나 나누고 싶은 마음 한 가지를 구체적인 문장으로 전하세요."],
    observe: "이번 주 솔직하게 연결했을 때 예상과 실제 반응 사이에는 어떤 차이가 있었습니까?",
    expert: {
      theory: "관계 웰빙은 사람의 수보다 연결의 질과 지각된 지지에 가깝습니다. 필요할 때 도움을 요청하고, 존중받으며, 나도 누군가에게 기여할 수 있다는 상호성이 정서 회복과 소속감을 지지합니다.",
      low: ["연결은 있어도 안전하게 기대기 어려울 수 있습니다.", "혼자 해결해야 한다는 규칙, 거절에 대한 예상, 역할 중심의 관계가 도움 요청을 막을 수 있습니다. 관계를 늘리기보다 한 사람과의 예측 가능한 안전감을 확보하는 것이 먼저입니다."],
      mid: ["관계 자원은 있으나 장면에 따라 신뢰가 흔들립니다.", "일상적 교류는 가능하지만 취약한 마음을 나누거나 구체적인 도움을 청할 때 주저할 수 있습니다. 누구와 어떤 주제까지 안전한지 관계의 범위를 구체화할 필요가 있습니다."],
      high: ["지지와 상호성을 경험하는 관계 기반이 있습니다.", "도움을 주고받고 존중받는 감각이 현재 삶의 중요한 보호자원입니다. 이 연결을 유지하면서도 자신의 한계와 필요를 분명히 표현하면 관계의 질이 오래갑니다."],
      overuse: "관계 유지를 위해 경계를 포기하거나, 타인의 반응에 자기평가를 맡기고, 돌봄 역할만 반복하면 높은 관계 점수가 소진으로 이어질 수 있습니다.",
      scene: "힘들 때 가장 먼저 연락하는 사람, 부탁 전 떠오르는 생각, 거절을 해석하는 방식, 주고받음의 균형, 관계 후 에너지 변화를 봅니다.",
      coaching: "막연히 ‘사람을 만나라’고 권하지 않습니다. 안전한 대상·나눌 내용·요청의 크기를 구체화하고, 예상한 반응과 실제 반응의 차이를 검토합니다."
    }
  },
  M: {
    group: "flourish", code: "M", name: "의미", short: "의미",
    desc: "일상의 선택을 가치, 기여, 더 큰 목적과 이어 보는 힘",
    questions: ["지금의 수고가 궁극적으로 지키려는 것은 무엇입니까?", "해야 하는 일과 중요해서 하는 일을 어떻게 구분할 수 있을까요?"],
    experiment: ["한 주의 일에 ‘왜’를 한 줄 붙이기", "7주 동안 매주 가장 많은 시간을 쓴 일 하나를 고르고, 그것이 어떤 가치와 연결되는지 한 문장으로 적으세요."],
    observe: "이번 주 일에 가치를 붙여 본 뒤 같은 일을 대하는 태도는 어떻게 달라졌습니까?",
    expert: {
      theory: "의미는 모든 일을 거창한 사명으로 만드는 것이 아니라, 현재의 수고가 어떤 가치·사람·기여와 연결되는지 이해하는 감각입니다. 즐거움이 적은 순간에도 방향을 유지하게 하는 행복의 가치지향적 요소입니다.",
      low: ["해야 할 일은 많지만 ‘왜’가 흐려져 있을 수 있습니다.", "바쁨이 방향감을 대신하거나, 오래 지켜 온 가치와 현재 일정이 분리되면 공허감이 커질 수 있습니다. 새로운 사명을 찾기보다 이미 시간과 에너지를 쓰는 일의 의미부터 다시 연결해야 합니다."],
      mid: ["의미를 느끼는 장면과 소진되는 장면이 함께 있습니다.", "가치와 연결된 활동에서는 힘이 나지만 의무가 쌓이면 방향을 잃기 쉽습니다. 중요하지만 급하지 않은 가치가 실제 일정에서 얼마나 보호되는지 확인해야 합니다."],
      high: ["삶의 선택을 가치와 기여에 연결하는 힘이 선명합니다.", "어려움 속에서도 이유를 잃지 않고, 개인을 넘어선 목적이나 소속과 연결될 수 있습니다. 이 의미가 현재의 몸과 관계를 희생시키지 않는 방식으로 구현되는지 함께 살피면 좋습니다."],
      overuse: "사명감으로 과로를 정당화하거나, 큰 의미를 위해 현재의 감정·관계·필요를 희생하면 의미가 압박으로 바뀔 수 있습니다.",
      scene: "일정표와 가치의 일치, 반복 업무에 붙이는 이유, 보상이 없어도 지키고 싶은 일, 중단했을 때 가장 아쉬운 기여를 살펴봅니다.",
      coaching: "추상적인 사명 선언보다 ‘이번 주 이 행동이 누구에게 무엇을 남기는가’를 묻습니다. 의미가 낮을 때는 더 큰 목표를 추가하지 않고 현재 활동의 가치 연결 또는 불필요한 의무의 정리를 돕습니다."
    }
  },
  A: {
    group: "flourish", code: "A", name: "성취", short: "성취",
    desc: "중요한 일을 작게 나누고 끝맺으며 유능감을 축적하는 힘",
    questions: ["이미 해낸 것 중 내가 충분히 인정하지 않은 것은 무엇입니까?", "다음 행동을 실패하기 어려울 만큼 작게 만든다면 어느 정도입니까?"],
    experiment: ["매주 최소 행동 하나 완결하기", "7주 동안 매주 미뤄 둔 일 하나를 15분 안에 끝낼 수 있는 크기로 줄이고, 완료 표시까지 남기세요."],
    observe: "이번 주 시작보다 완료를 선택했을 때 나의 에너지에는 어떤 변화가 생겼습니까?",
    expert: {
      theory: "성취는 외부의 큰 성공보다 목표를 세분화하고, 진행을 확인하며, 끝맺음을 통해 유능감을 축적하는 경험입니다. 결과뿐 아니라 숙련과 자기효능감의 형성이 핵심입니다.",
      low: ["능력보다 목표 구조와 완료 경험을 먼저 점검해야 합니다.", "과제가 너무 크거나 기준이 높고, 시작한 일을 완료로 인식하지 못해 유능감의 피드백이 끊겼을 수 있습니다. 실패 원인을 의지로 돌리기보다 행동 단위와 성공 기준을 줄이는 것이 우선입니다."],
      mid: ["구조가 있을 때는 해내지만 자기주도적 지속이 흔들립니다.", "마감이나 타인의 기대가 있으면 움직이지만 장기 과제에서는 시작과 마무리의 간격이 벌어질 수 있습니다. 진행의 시각화와 중간 완료 기준이 효과적입니다."],
      high: ["중요한 일을 실행하고 끝맺는 유능감이 살아 있습니다.", "어려움 뒤에도 다시 시작하고 진행을 축적하는 힘이 있습니다. 성취가 자기 존재가치를 증명하는 수단이 되지 않도록 과정의 만족과 회복도 함께 평가해야 합니다."],
      overuse: "결과로만 자신을 평가하거나, 완료 직후 다음 목표로 이동해 성취를 느끼지 못하고, 쉬는 시간을 실패로 해석할 수 있습니다.",
      scene: "미완료 목록의 크기, 목표의 최소 단위, 완료 표시 습관, 결과가 기대와 다를 때 재시작 방식, 성취 뒤 회복 여부를 봅니다.",
      coaching: "목표를 더 강하게 독려하기보다 완료 가능한 최소 행동을 합의하고, 무엇을 하면 ‘끝’인지 정의합니다. 결과뿐 아니라 사용한 강점과 조정한 과정을 언어화합니다."
    }
  },
  SN: {
    group: "awareness", code: "S", name: "신호 포착", short: "신호",
    desc: "몸, 감정, 에너지의 작은 변화를 반응이 커지기 전에 감지하는 역량",
    questions: ["지금 내 몸이 먼저 말하고 있는 것은 무엇입니까?", "반응이 커지기 전 가장 먼저 나타나는 신호는 무엇입니까?"],
    expert: {
      theory: "신호 포착은 심박, 호흡, 근육 긴장, 피로, 열감처럼 몸 안에서 오는 정보를 감지하고 정서 상태와 연결하는 내수용감각과 관련됩니다. 신호에 주의를 기울이는 것과 그 의미를 정확히 해석하는 것은 서로 다른 능력입니다.",
      low: ["반응이 커진 뒤에야 신호를 알아차릴 가능성이 있습니다.", "참을 만할 때는 지나치고 피로·분노·불안이 충분히 커진 뒤 행동하는 패턴이 생길 수 있습니다. 감정을 분석하기 전에 가장 반복적인 몸의 초기 신호 하나를 찾는 것이 출발점입니다."],
      mid: ["강한 신호는 보지만 미세한 전조는 놓칠 수 있습니다.", "몸의 변화를 느끼더라도 바쁠 때 무시하거나, 어떤 감정과 연결되는지 확신하지 못할 수 있습니다. 특정 장면 전후의 호흡·턱·어깨·속도 변화를 비교하면 정교해집니다."],
      high: ["몸과 에너지의 변화를 비교적 이른 시점에 감지합니다.", "반응이 행동으로 커지기 전에 멈출 단서를 확보할 수 있습니다. 감지한 신호를 곧바로 위험으로 해석하지 않고 맥락과 함께 읽는다면 자기조절의 중요한 기반이 됩니다."],
      overuse: "몸을 계속 확인하는 과잉경계, 정상적인 각성을 위험으로 단정하는 해석, 감각 통제에 대한 집착은 오히려 불안을 키울 수 있습니다.",
      scene: "회의·대화·마감 직전의 호흡, 어깨와 턱의 긴장, 말의 속도, 배고픔과 피로를 인식하는 시점, 회복이 필요한 신호를 봅니다.",
      coaching: "‘왜 그런가’보다 ‘어디에서 무엇이 얼마나 느껴지는가’를 먼저 묻습니다. 감각-감정-욕구를 한 번에 단정하지 않고 관찰과 해석을 분리합니다."
    }
  },
  NM: {
    group: "awareness", code: "N", name: "경험 명명", short: "명명",
    desc: "감정, 욕구, 사실과 해석에 정확한 이름을 붙이는 역량",
    questions: ["지금 경험을 한 단어가 아니라 한 문장으로 이름 붙이면 무엇입니까?", "확인된 사실과 내가 해석한 부분은 각각 무엇입니까?"],
    expert: {
      theory: "경험 명명은 막연한 정서에 구체적인 언어를 붙이고, 관찰된 사실·나의 해석·욕구를 구분하는 과정입니다. 감정을 말로 표현하는 행위가 정서 반응을 조절하는 데 기여할 수 있다는 감정명명 연구와 연결됩니다.",
      low: ["불편함은 느끼지만 정확한 언어가 붙지 않을 수 있습니다.", "‘그냥 싫다’, ‘상대가 문제다’처럼 경험이 뭉쳐 있으면 선택 가능한 대응도 줄어듭니다. 감정 단어를 늘리는 것보다 사실과 해석을 두 문장으로 나누는 연습이 먼저입니다."],
      mid: ["시간이 지나면 설명할 수 있지만 순간에는 언어가 늦습니다.", "성찰 장면에서는 이해되지만 갈등이나 압박 속에서는 감정과 해석이 섞일 수 있습니다. 반응 전 짧은 문장 틀을 정해 두면 실시간 명명이 쉬워집니다."],
      high: ["경험을 세분화하고 언어로 조직하는 힘이 있습니다.", "감정·욕구·사실·해석을 구분해 자기 경험을 다룰 수 있습니다. 이 언어가 설명에만 머물지 않고 몸의 실제 감각과 다음 선택으로 이어질 때 더욱 효과적입니다."],
      overuse: "감정을 정확히 설명하는 데 몰두해 실제로 느끼지 않거나, 개념과 분석으로 거리를 두는 지적 방어가 될 수 있습니다.",
      scene: "갈등 직후 사용하는 단어, ‘사실은’ 다음 문장에 평가가 섞이는지, 감정 뒤에 있는 필요를 말할 수 있는지, 말한 뒤 정서 강도가 달라지는지 봅니다.",
      coaching: "‘무슨 감정인가’에서 멈추지 않고 사실-해석-감정-욕구를 분리합니다. 코치가 이름을 대신 붙이지 않고 고객의 언어가 더 정확해지도록 선택지를 탐색합니다."
    }
  },
  PT: {
    group: "awareness", code: "P", name: "패턴 이해", short: "패턴",
    desc: "상황-생각-반응 사이에서 반복되는 연결을 발견하는 역량",
    questions: ["이 장면은 언제, 누구와, 어떤 조건에서 반복됩니까?", "반복될 때 내가 자동으로 취하는 역할은 무엇입니까?"],
    expert: {
      theory: "패턴 이해는 사건을 고립된 문제로 보지 않고 촉발 단서, 자동 해석, 정서·행동, 결과의 반복 연결을 보는 메타인지적 역량입니다. 패턴이 보이면 자책 대신 개입 가능한 지점을 선택할 수 있습니다.",
      low: ["반복되는 사건이 매번 새로운 문제처럼 느껴질 수 있습니다.", "원인을 사람이나 상황 하나에만 두면 자신의 자동반응을 조정할 여지가 줄어듭니다. 동일한 결론을 내린 최근 세 장면의 공통 조건을 찾는 작업이 필요합니다."],
      mid: ["지나고 나면 패턴이 보이지만 발생 전 예측은 어렵습니다.", "성찰 능력은 있으나 실제 장면에서 전환 신호를 포착하는 속도가 늦을 수 있습니다. 반복의 가장 이른 단서와 전형적인 자기 문장을 표시하면 개입 시점이 앞당겨집니다."],
      high: ["상황과 자동반응의 반복 구조를 읽는 힘이 있습니다.", "개인의 결함으로 단정하기보다 언제, 누구와, 어떤 조건에서 반응이 생기는지 파악할 수 있습니다. 패턴을 고정된 성격이 아니라 수정 가능한 학습으로 보는 태도가 중요합니다."],
      overuse: "모든 행동의 원인을 분석하느라 결정을 늦추거나, ‘나는 항상 이렇다’는 고정된 이야기로 패턴을 정체성화할 수 있습니다.",
      scene: "같은 감정이 반복되는 대상과 시간, 직전의 단서, 자동으로 떠오르는 문장, 반복 후 얻는 단기 이익과 장기 비용을 살펴봅니다.",
      coaching: "사건-해석-감정-행동-결과를 시간순으로 복원하고 가장 앞쪽의 바꿀 수 있는 지점을 찾습니다. 이해가 충분해지면 더 분석하지 않고 한 가지 다른 반응을 실험합니다."
    }
  },
  VL: {
    group: "awareness", code: "U", name: "고유성 정렬", short: "고유성",
    desc: "타인의 기대와 자기 기준을 구분하고, 자신의 강점·방식·가치를 선택에 반영하는 역량",
    questions: ["타인의 기대를 잠시 내려놓으면, 나는 어떤 방식으로 이 일을 풀고 싶습니까?", "지금 더 살려야 할 나만의 강점과 기준은 무엇입니까?"],
    expert: {
      theory: "고유성 정렬은 외부 압력보다 자신이 동의한 가치와 관심에 맞는 목표를 선택하는 자기일치성, 그리고 개인의 강점을 실제 행동에 사용하는 능력과 연결됩니다. ‘남과 다름’의 강조보다 내 방식이 삶의 선택에 실제 반영되는지가 핵심입니다.",
      low: ["타인의 기대가 자기 기준보다 먼저 작동할 수 있습니다.", "잘해야 한다는 기준은 분명하지만 그것이 누구의 기준인지, 자신의 강점이 어디에 쓰이는지는 흐릴 수 있습니다. 거절이나 독립보다 먼저 ‘내가 동의하는 부분과 동의하지 않는 부분’을 구분해야 합니다."],
      mid: ["나의 기준을 알고도 압박 속에서는 익숙한 기대를 따릅니다.", "원하는 방식과 강점을 말할 수 있지만 평가, 갈등, 책임이 커지면 외부 기준으로 돌아갈 수 있습니다. 작은 선택에서 자기 방식을 반복해 실제 근거를 축적할 필요가 있습니다."],
      high: ["자신의 가치와 강점을 선택에 반영하는 힘이 선명합니다.", "타인의 기대를 그대로 따르기보다 나에게 맞는 방식으로 재구성할 수 있습니다. 고유성을 고집이 아닌 유연한 자기표현으로 유지하면 관계와 성취를 함께 지지합니다."],
      overuse: "‘나는 원래 이렇다’며 피드백을 거부하거나, 적응과 협력을 자기상실로 해석하면 고유성이 경직된 정체성이 될 수 있습니다.",
      scene: "중요한 결정에서 가장 먼저 떠오르는 사람의 기대, 반복해 성과를 낸 자기 방식, 강점을 숨기는 장면, 선택 후 ‘나답다’고 느끼는 기준을 봅니다.",
      coaching: "외부 요구를 모두 버리게 하지 않습니다. 기대와 자기 기준을 분리한 뒤, 지켜야 할 가치·활용할 강점·조정 가능한 방식을 구체화해 자기일치적 선택을 설계합니다."
    }
  },
  CH: {
    group: "awareness", code: "C", name: "선택과 조정", short: "선택",
    desc: "알아차린 뒤 작은 행동을 선택하고 결과에 따라 조정하는 역량",
    questions: ["지금 할 수 있는 가장 작은 다음 행동은 무엇입니까?", "실행 후 무엇을 관찰하면 다음 선택이 선명해집니까?"],
    expert: {
      theory: "선택과 조정은 통찰을 행동으로 번역하는 자기조절 역량입니다. 특정 상황과 행동을 ‘만약-그러면’으로 연결하는 실행의도, 실행 후 피드백을 보고 계획을 수정하는 순환이 의도-행동 간격을 줄입니다.",
      low: ["알아차림이 행동으로 건너가는 다리가 아직 약합니다.", "무엇이 문제인지 알아도 행동 단위가 크거나 성공 기준이 모호해 머물 수 있습니다. 더 깊은 분석보다 언제·어디서·무엇을 할지 한 문장으로 정하는 것이 필요합니다."],
      mid: ["작은 행동은 가능하지만 지속과 조정이 불안정합니다.", "동기가 높을 때 시작해도 방해 상황에서 원래 방식으로 돌아갈 수 있습니다. 실행 실패를 의지 부족으로 보지 말고 조건과 계획을 수정하는 피드백으로 사용해야 합니다."],
      high: ["멈춤 이후 행동을 선택하고 결과에 맞춰 조정할 수 있습니다.", "완벽한 확신을 기다리지 않고 작은 실험을 시작하며, 결과를 다음 선택의 정보로 활용합니다. 통제할 수 없는 영역을 받아들이는 유연성까지 더하면 과도한 자기관리 없이 지속할 수 있습니다."],
      overuse: "모든 경험을 개선 과제로 만들거나, 계획과 측정을 과도하게 늘리고, 받아들여야 할 감정과 한계까지 통제하려 할 수 있습니다.",
      scene: "통찰 후 첫 행동까지 걸리는 시간, 행동의 구체성, 방해 상황의 대안, 실행 후 기록 여부, 실패 뒤 자책과 조정 중 무엇을 먼저 하는지 봅니다.",
      coaching: "고객이 동의한 목표인지 확인한 뒤 ‘만약 이 상황이 오면, 나는 이 작은 행동을 한다’는 실행 문장을 만듭니다. 다음 대화에서는 성공 여부보다 관찰한 정보와 조정점을 검토합니다."
    }
  }
};

const STATE_DATA = {
  aligned: { code: "01", name: "성장을 설계하는 플로리셔", summary: "삶의 여러 영역에서 웰빙이 비교적 안정적으로 작동하고, 자신의 경험을 읽어 다음 선택으로 연결하는 힘도 살아 있습니다. 지금은 부족함을 고치는 시기보다 잘되는 조건을 의식적으로 재현하고 주변으로 확장할 시기입니다." },
  momentum: { code: "02", name: "잘 살아가지만 신호를 놓치기 쉬운 상태", summary: "삶의 성과와 만족은 비교적 잘 유지되지만, 속도가 빠를수록 몸과 감정의 신호를 뒤늦게 볼 수 있습니다. 현재의 좋은 흐름을 오래 이어 가려면 더 노력하기보다 내적 신호를 읽는 정교함이 필요합니다." },
  observer: { code: "03", name: "변화를 준비하는 관찰자", summary: "삶의 만족감은 아직 충분히 차오르지 않았지만, 무엇이 일어나고 있는지 읽어낼 수 있는 힘이 있습니다. 알아차림을 분석에만 머물게 하지 않고 작은 행동으로 옮기면 변화의 감각이 빠르게 살아날 수 있습니다." },
  restore: { code: "04", name: "회복의 바닥을 고르는 시기", summary: "삶의 에너지와 자신을 관찰하는 여유가 함께 낮아진 때일 수 있습니다. 많은 것을 바꾸려 하기보다 한 가지 신호를 알아차리고, 실패하기 어려운 최소 행동을 반복하는 것이 먼저입니다." },
  developing: { code: "05", name: "성장 조건을 조율하는 중", summary: "삶의 여러 요소와 알아차림 역량이 완전히 멈춘 것은 아니지만, 상황과 에너지에 따라 작동 수준이 달라질 수 있습니다. 부족함을 단정하기보다 잘되는 날과 어려운 날의 조건 차이를 찾아 한 가지씩 안정시키는 시기입니다." }
};

const GROUP_ORDER = ["P", "E", "R", "M", "A", "SN", "NM", "PT", "VL", "CH"];
const PAGE_SIZE = 5;
const STORAGE_KEY = "dailycoaching_flourish_notice_v1";
const LETTER_STORAGE_KEY = "dailycoaching_flourish_letters_v1";

const REFLECTION_STEPS = [
  {
    phase: "몸과 감정의 신호",
    stem: "요즘 내가 조금 편안해지는 순간은 …",
    guide: "최근 일주일 안에 마음이나 몸의 힘이 조금 풀렸던 순간을 떠올려 보세요.",
    examples: ["퇴근 후 불을 낮추고 혼자 차를 마실 때", "아무 말 없이 천천히 동네를 걸을 때"]
  },
  {
    phase: "몸과 감정의 신호",
    stem: "반대로 내 몸이 먼저 긴장하는 순간은 …",
    guide: "생각으로 판단하기 전 몸이 먼저 보낸 신호를 적어 보세요. 어깨, 숨, 배, 표정도 좋은 단서입니다.",
    examples: ["회의에서 바로 답을 요구받으면 어깨가 굳는다", "휴대폰 알림이 계속 울리면 숨이 짧아진다"]
  },
  {
    phase: "반복되는 생각과 행동",
    stem: "그 순간 내 머릿속에서 가장 먼저 떠오르는 말은 …",
    guide: "사실인지 따지기보다 자동으로 스쳐 가는 짧은 말을 그대로 붙잡아 보세요.",
    examples: ["또 실수하면 안 돼", "내가 그냥 처리하는 게 빠르다"]
  },
  {
    phase: "반복되는 생각과 행동",
    stem: "그래서 나도 모르게 반복하는 행동은 …",
    guide: "그 생각 다음에 자주 이어지는 행동을 적어 보세요. 미루기, 참기, 혼자 하기처럼 평범한 행동이면 됩니다.",
    examples: ["도움을 청하지 않고 혼자 붙잡고 있는 것", "대답을 미루고 연락을 피하는 것"]
  },
  {
    phase: "실제 필요와 나다운 기준",
    stem: "사실 그때 내가 필요했던 것은 …",
    guide: "‘더 열심히’보다 시간, 휴식, 도움, 경계, 이해처럼 나를 실제로 돕는 조건을 찾아보세요.",
    examples: ["정답보다 잠깐 생각할 시간", "조언보다 내 말을 끝까지 들어주는 사람"]
  },
  {
    phase: "실제 필요와 나다운 기준",
    stem: "남의 기대를 잠시 내려놓으면, 나는 …",
    guide: "잘 보이기 위한 답이 아니라 내 방식과 속도에 가까운 바람을 적어 보세요.",
    examples: ["내 속도로 한 가지씩 끝내고 싶다", "괜찮은 척보다 솔직하게 어렵다고 말하고 싶다"]
  },
  {
    phase: "다음 장면의 작은 선택",
    stem: "비슷한 장면이 다시 오면, 가장 먼저 …",
    guide: "의지나 결심보다 1분 안에 시작할 수 있는 첫 행동을 적으면 실천하기 쉽습니다.",
    examples: ["숨을 길게 내쉬고 확인된 사실부터 적겠다", "혼자 결정하기 전에 한 사람에게 도움을 묻겠다"]
  },
  {
    phase: "다음 장면의 작은 선택",
    stem: "앞으로 7주 동안 내가 자주 기억하고 싶은 문장은 …",
    guide: "힘든 날에도 나를 몰아붙이지 않고 방향을 되찾게 해 줄 한 문장을 만들어 보세요.",
    examples: ["빨리보다 나답게 끝내는 것이 중요하다", "감정은 멈추라는 명령이 아니라 살펴보라는 신호다"]
  }
];

const state = {
  page: 0,
  answers: {},
  name: "",
  context: "life",
  result: null,
  reflection: { step: 0, answers: Array(REFLECTION_STEPS.length).fill(""), letter: "", mode: "intro", savedAt: null }
};

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];
const clamp = (n, min, max) => Math.min(max, Math.max(min, n));
const mean = (numbers) => numbers.reduce((a, b) => a + b, 0) / numbers.length;
const round1 = (n) => Math.round(n * 10) / 10;
const escapeHtml = (value = "") => value.replace(/[&<>'"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[char]);

function getRecords() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]"); }
  catch { return []; }
}

function saveRecord(record) {
  const records = getRecords();
  records.unshift(record);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(records.slice(0, 12)));
  updateHistoryCount();
}

function getLetters() {
  try { return JSON.parse(localStorage.getItem(LETTER_STORAGE_KEY) || "[]"); }
  catch { return []; }
}

function getLetterForResult(resultId) {
  return getLetters().find((entry) => entry.resultId === resultId) || null;
}

function saveLetterRecord(entry) {
  const letters = getLetters().filter((item) => item.resultId !== entry.resultId);
  letters.unshift(entry);
  localStorage.setItem(LETTER_STORAGE_KEY, JSON.stringify(letters.slice(0, 24)));
}

function updateHistoryCount() { $("#history-count").textContent = getRecords().length; }

function showView(id) {
  $$(".view").forEach((view) => { view.hidden = view.id !== id; });
  window.scrollTo({ top: 0, behavior: "smooth" });
  setTimeout(() => $(`#${id}`).focus?.({ preventScroll: true }), 50);
}

function startTest() {
  state.name = $("#participant-name").value.trim();
  state.context = $("input[name='context']:checked").value;
  state.page = 0;
  state.answers = {};
  renderPage();
  showView("test-view");
}

function renderPage() {
  const start = state.page * PAGE_SIZE;
  const items = ITEMS.slice(start, start + PAGE_SIZE);
  const form = $("#question-form");
  form.innerHTML = items.map((item) => `
    <div class="question-card" data-item="${item.id}">
      <span class="question-number">${String(item.id).padStart(2, "0")}</span>
      <p class="question-text">${item.text}</p>
      <div class="scale" role="radiogroup" aria-label="${item.id}번 문항 응답">
        ${[1,2,3,4,5,6,7].map((value) => `<label><input type="radio" name="q${item.id}" value="${value}" ${state.answers[item.id] === value ? "checked" : ""}><span>${value}</span></label>`).join("")}
      </div>
      <div class="scale-labels" aria-hidden="true"><span>전혀 아니다</span><span>매우 그렇다</span></div>
    </div>`).join("");
  form.querySelectorAll("input").forEach((input) => input.addEventListener("change", (event) => {
    state.answers[Number(event.target.name.slice(1))] = Number(event.target.value);
    updatePageStatus();
  }));
  $("#progress-step").textContent = `${String(state.page + 1).padStart(2, "0")} / 07`;
  $("#progress-bar").style.width = `${((state.page + 1) / 7) * 100}%`;
  $("#progress-copy").textContent = state.page < 5 ? "현재의 장면을 떠올려 주세요" : state.page === 5 ? "반복되는 방식을 살펴봅니다" : "선택과 행동을 확인합니다";
  $("#prev-button").disabled = state.page === 0;
  $("#next-button span:first-child").textContent = state.page === 6 ? "결과 보기" : "다음";
  updatePageStatus();
}

function updatePageStatus() {
  const pageItems = ITEMS.slice(state.page * PAGE_SIZE, state.page * PAGE_SIZE + PAGE_SIZE);
  const answered = pageItems.filter((item) => state.answers[item.id]).length;
  $("#answer-status").textContent = answered === PAGE_SIZE ? "응답을 확인했습니다" : `${PAGE_SIZE - answered}개 문항이 남았습니다`;
  $("#next-button").disabled = answered !== PAGE_SIZE;
}

function nextPage() {
  if ($("#next-button").disabled) return;
  if (state.page < 6) {
    state.page += 1;
    renderPage();
    window.scrollTo({ top: 0, behavior: "smooth" });
  } else finishTest();
}

function prevPage() {
  if (state.page === 0) return;
  state.page -= 1;
  renderPage();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function calculateResult() {
  const domainScores = {};
  GROUP_ORDER.forEach((domain) => {
    const domainItems = ITEMS.filter((item) => item.domain === domain);
    const scores = domainItems.map((item) => item.reverse ? 8 - state.answers[item.id] : state.answers[item.id]);
    domainScores[domain] = round1(mean(scores));
  });
  const flourish = round1(mean(["P", "E", "R", "M", "A"].map((key) => domainScores[key])));
  const awareness = round1(mean(["SN", "NM", "PT", "VL", "CH"].map((key) => domainScores[key])));
  const stateKey = classifyState(flourish, awareness);
  return { id: crypto.randomUUID?.() || `${Date.now()}`, createdAt: new Date().toISOString(), name: state.name, context: state.context, domainScores, flourish, awareness, stateKey };
}

function finishTest() {
  state.result = calculateResult();
  saveRecord(state.result);
  renderResult(state.result);
  showView("result-view");
}

function sortedKeys(result, group) {
  return GROUP_ORDER.filter((key) => DOMAINS[key].group === group).sort((a, b) => result.domainScores[b] - result.domainScores[a]);
}

function contextLabel(context) {
  return ({ life: "삶 전체", work: "일과 성장", relationship: "관계", change: "변화 과제" })[context] || "삶 전체";
}

function classifyState(flourish, awareness) {
  if (flourish < 3.5 && awareness < 3.5) return "restore";
  if (flourish >= 5 && awareness >= 5) return "aligned";
  if (flourish >= 5 && awareness < 5) return "momentum";
  if (flourish < 5 && awareness >= 5) return "observer";
  return "developing";
}

function scoreBand(score) {
  if (score < 3.5) return { key: "low", label: "확보가 필요한 상태" };
  if (score < 5) return { key: "mid", label: "상황에 따라 흔들리는 상태" };
  return { key: "high", label: "현재 잘 활용되는 상태" };
}

function awarenessProcessCopy(key) {
  return ({
    SN: "변화는 해석보다 먼저 몸과 에너지의 초기 신호를 포착하는 데서 시작됩니다. 신호를 늦게 보면 선택도 늦어지므로, 감정이 커지기 전 반복되는 전조 하나를 찾는 것이 핵심입니다.",
    NM: "경험이 막연하게 뭉쳐 있으면 가능한 선택도 줄어듭니다. 사실·해석·감정·욕구를 나누어 이름 붙일 때 다룰 수 있는 문제가 선명해집니다.",
    PT: "같은 어려움을 개별 사건으로 처리하면 매번 처음부터 버텨야 합니다. 촉발 조건과 자동반응의 연결을 보면 자책 대신 개입할 지점을 고를 수 있습니다.",
    VL: "목표가 타인의 기대에 가깝다면 실행해도 활력이 축적되기 어렵습니다. 자신의 강점·방식·가치와 일치하는 선택인지 확인하는 과정이 변화의 지속성을 높입니다.",
    CH: "이해와 변화 사이에는 행동 단위가 필요합니다. 완벽한 해결보다 특정 상황에 실행할 작은 반응을 정하고, 결과를 다음 조정의 정보로 사용하는 것이 중요합니다."
  })[key];
}

function pairMechanism(growthKey, leverKey) {
  const target = ({
    P: "긍정정서를 억지로 높이기보다 실제로 안도·감사·희망이 생기는 장면을 확보하는 것",
    E: "집중력을 탓하기보다 강점·과제 난이도·환경이 맞는 몰입 조건을 다시 설계하는 것",
    R: "관계를 늘리기보다 안전하게 도움을 주고받을 수 있는 한 장면을 만드는 것",
    M: "거창한 사명을 추가하기보다 현재의 시간 사용을 자기 가치와 다시 연결하는 것",
    A: "더 큰 목표를 세우기보다 완료 가능한 최소 행동으로 유능감의 피드백을 복원하는 것"
  })[growthKey];
  const route = ({
    SN: "그 과정에서 몸과 에너지의 초기 신호를 먼저 관찰하십시오.",
    NM: "그 과정에서 사실·해석·감정·욕구를 정확히 나누어 말해 보십시오.",
    PT: "그 과정에서 반복되는 촉발 조건과 자동반응을 한 장면씩 연결해 보십시오.",
    VL: "그 과정에서 타인의 기대와 자신의 강점·방식·가치를 분리해 보십시오.",
    CH: "그 과정에서 언제·어디서 실행할지 정한 최소 행동을 실제로 시험해 보십시오."
  })[leverKey];
  return `현재의 우선 전략은 ${target}입니다. ${route}`;
}

function renderExpertLenses(result, strengthKey, growthKey, leverKey, leverTieCount) {
  const flourishValues = ["P", "E", "R", "M", "A"].map((key) => result.domainScores[key]);
  const spread = round1(Math.max(...flourishValues) - Math.min(...flourishValues));
  const balanceTitle = spread >= 1.5 ? `${DOMAINS[strengthKey].name}에 기대어 버티는 비대칭이 보입니다.` : "다섯 플로리싱 요소의 간격이 비교적 크지 않습니다.";
  const balanceCopy = spread >= 1.5
    ? `가장 높은 영역과 낮은 영역의 차이는 ${spread.toFixed(1)}점입니다. 총점만 보면 가려질 수 있는 차이로, ${DOMAINS[strengthKey].name}의 힘이 ${DOMAINS[growthKey].name}의 부족한 체감을 보완하고 있을 가능성이 있습니다. 강점을 줄이기보다 그 작동 조건을 다음 성장영역으로 옮기는 접근이 적절합니다.`
    : `다섯 영역의 최대 차이는 ${spread.toFixed(1)}점입니다. 특정 한 영역이 삶 전체를 떠받치기보다 여러 요소가 비슷한 수준으로 움직이고 있습니다. 이때는 가장 낮은 한 점수보다 전체 수준을 끌어내리는 공통 생활조건을 찾는 편이 유용합니다.`;
  const actionGap = result.awareness - result.flourish;
  const regulationTitle = leverTieCount > 1 ? "알아차림은 첫 단계인 신호 포착부터 연결합니다." : leverKey === "CH" && actionGap > .4 ? "이해는 앞서 있지만 행동 번역이 늦을 수 있습니다." : `${DOMAINS[leverKey].name}이 변화 과정의 첫 연결점입니다.`;
  const regulationCopy = leverTieCount > 1
    ? `${awarenessProcessCopy(leverKey)} 현재 다섯 알아차림 역량이 같은 수준이므로 특정 역량의 부족을 단정하지 않고 신호-명명-패턴-고유성-선택의 순서로 점검합니다.`
    : `${awarenessProcessCopy(leverKey)} 현재 ${DOMAINS[leverKey].name} 점수는 ${result.domainScores[leverKey].toFixed(1)}점이며, 알아차림 전체의 다른 역량보다 상대적으로 먼저 다룰 필요가 있습니다.`;
  $("#expert-lenses").innerHTML = `
    <article class="expert-lens">
      <span class="lens-index">01</span><span class="lens-field">긍정심리학 관점</span>
      <h3>${balanceTitle}</h3><p>${balanceCopy}</p>
    </article>
    <article class="expert-lens">
      <span class="lens-index">02</span><span class="lens-field">자기조절 관점</span>
      <h3>${regulationTitle}</h3><p>${regulationCopy}</p>
    </article>
    <article class="expert-lens coaching">
      <span class="lens-index">03</span><span class="lens-field">코칭학 관점</span>
      <h3>${DOMAINS[growthKey].name} 영역을 ${DOMAINS[leverKey].name} 역량으로 연결합니다.</h3><p>${pairMechanism(growthKey, leverKey)}</p>
    </article>`;
}

function renderDomainExplanations(result, growthKey, leverKey) {
  $("#domain-explanations").innerHTML = GROUP_ORDER.map((key, index) => {
    const domain = DOMAINS[key];
    const score = result.domainScores[key];
    const band = scoreBand(score);
    const reading = domain.expert[band.key];
    const shouldOpen = key === growthKey || key === leverKey;
    return `
      <details class="domain-detail ${domain.group}" ${shouldOpen ? "open" : ""}>
        <summary>
          <span class="domain-seq">${String(index + 1).padStart(2, "0")}</span>
          <h3>${domain.name}<span class="domain-group">${domain.group === "flourish" ? "플로리싱 요소" : "알아차림 역량"}</span></h3>
          <span class="domain-score">${score.toFixed(1)}</span>
          <span class="domain-band">${band.label}</span>
          <span class="domain-toggle" aria-hidden="true">+</span>
        </summary>
        <div class="domain-detail-body">
          <div class="domain-theory"><span>전문 개념</span><p>${domain.expert.theory}</p></div>
          <div class="domain-current"><span>현재 점수 해석 · ${score.toFixed(1)}</span><h4>${reading[0]}</h4><p>${reading[1]}</p></div>
          <div class="expert-notes">
            <article class="expert-note"><span>과사용·오해 주의</span><strong>높다고 언제나 좋은 것은 아닙니다.</strong><p>${domain.expert.overuse}</p></article>
            <article class="expert-note"><span>관찰할 실제 장면</span><strong>점수보다 장면을 확인합니다.</strong><p>${domain.expert.scene}</p></article>
            <article class="expert-note"><span>코칭 적용</span><strong>다음 대화의 초점입니다.</strong><p>${domain.expert.coaching}</p></article>
          </div>
        </div>
      </details>`;
  }).join("");
}

function renderResult(result) {
  const flourishKeys = sortedKeys(result, "flourish");
  const awarenessKeys = sortedKeys(result, "awareness");
  const strengthKey = flourishKeys[0];
  const flourishDomainKeys = ["P", "E", "R", "M", "A"];
  const awarenessDomainKeys = ["SN", "NM", "PT", "VL", "CH"];
  const maxFlourish = Math.max(...flourishDomainKeys.map((key) => result.domainScores[key]));
  const minFlourish = Math.min(...flourishDomainKeys.map((key) => result.domainScores[key]));
  const minAwareness = Math.min(...awarenessDomainKeys.map((key) => result.domainScores[key]));
  const strengthTies = flourishDomainKeys.filter((key) => Math.abs(result.domainScores[key] - maxFlourish) < .11);
  const growthTies = flourishDomainKeys.filter((key) => Math.abs(result.domainScores[key] - minFlourish) < .11);
  const leverTies = awarenessDomainKeys.filter((key) => Math.abs(result.domainScores[key] - minAwareness) < .11);
  const growthKey = growthTies[0];
  const leverKey = leverTies[0];
  result.stateKey = classifyState(result.flourish, result.awareness);
  const stateInfo = STATE_DATA[result.stateKey];
  const displayName = result.name ? `${escapeHtml(result.name)}님의` : "당신의";

  $("#result-title").innerHTML = `${displayName}<br>성장 지도를 읽었습니다.`;
  $("#result-date").textContent = `${new Intl.DateTimeFormat("ko-KR", { dateStyle: "long", timeZone: "Asia/Seoul" }).format(new Date(result.createdAt))} · ${contextLabel(result.context)}`;
  $("#state-code").textContent = stateInfo.code;
  $("#state-name").textContent = stateInfo.name;
  $("#state-summary").textContent = stateInfo.summary;
  $("#flourish-score").textContent = result.flourish.toFixed(1);
  $("#awareness-score").textContent = result.awareness.toFixed(1);

  $("#strength-title").textContent = strengthTies.length > 1 ? "여러 요소가 함께 삶을 받치고 있습니다." : `현재 삶을 받치는 힘은 ${DOMAINS[strengthKey].name}입니다.`;
  $("#strength-copy").textContent = strengthTies.length > 1
    ? `${strengthTies.map((key) => DOMAINS[key].name).join("·")} 영역이 비슷한 수준으로 작동합니다. 한 가지 강점에 의존하기보다 여러 자원이 함께 움직이는 조건을 살펴보는 것이 중요합니다.`
    : `${DOMAINS[strengthKey].desc}이 현재 가장 선명합니다. 이 점수가 높다는 사실보다, 이 힘이 살아나는 조건을 다른 장면에도 옮겨 쓰는 것이 중요합니다.`;
  $("#growth-title").textContent = growthTies.length > 1 ? "한 영역보다 공통 생활조건을 먼저 봅니다." : `${DOMAINS[growthKey].name} 영역에 먼저 여백이 필요합니다.`;
  $("#growth-copy").textContent = growthTies.length > 1
    ? `${growthTies.map((key) => DOMAINS[key].name).join("·")} 영역의 점수가 같습니다. 어느 하나를 결함으로 정하기보다 피로, 시간 압박, 환경처럼 여러 영역을 함께 낮추는 조건을 확인해야 합니다.`
    : `${DOMAINS[growthKey].desc}이 부족하다는 판정이 아닙니다. 지금의 생활에서 이 경험이 상대적으로 덜 확보되어 있음을 뜻합니다.`;
  $("#lever-title").textContent = leverTies.length > 1 ? "알아차림의 첫 단계부터 차례로 연결합니다." : `${DOMAINS[leverKey].name} 역량부터 연결합니다.`;
  $("#lever-copy").textContent = leverTies.length > 1
    ? `${leverTies.map((key) => DOMAINS[key].name).join("·")} 역량이 같은 수준입니다. 이때는 신호 포착에서 시작해 명명, 패턴, 고유성, 선택으로 이어지는 순서를 따라가는 것이 안정적입니다.`
    : `${DOMAINS[leverKey].desc}입니다. 이 역량을 보완하면 ${DOMAINS[growthKey].name} 영역을 의지로 밀어붙이지 않고 실제 장면에서 다룰 수 있습니다.`;

  renderRadar(result);
  renderLegend(result);
  renderExpertLenses(result, strengthKey, growthKey, leverKey, leverTies.length);
  renderDomainExplanations(result, growthKey, leverKey);
  renderBridge(result, growthKey, leverKey);
  renderFocusOptions(result, growthKey);
  initializeReflection(result);
}

function initializeReflection(result) {
  const saved = getLetterForResult(result.id);
  state.reflection = {
    step: 0,
    answers: saved?.answers?.length === REFLECTION_STEPS.length ? [...saved.answers] : Array(REFLECTION_STEPS.length).fill(""),
    letter: saved?.letter || "",
    mode: saved ? "complete" : "intro",
    savedAt: saved?.savedAt || null
  };
  renderReflection();
}

function renderReflection() {
  const panels = {
    intro: $("#reflection-intro"),
    writing: $("#reflection-workspace"),
    letter: $("#letter-workspace"),
    complete: $("#reflection-complete")
  };
  Object.entries(panels).forEach(([key, panel]) => { panel.hidden = key !== state.reflection.mode; });

  if (state.reflection.mode === "writing") renderReflectionStep();
  if (state.reflection.mode === "letter" || state.reflection.mode === "complete") {
    $("#self-letter").value = state.reflection.letter;
    $("#self-letter-print").textContent = state.reflection.letter;
  }
  if (state.reflection.mode === "complete") {
    $("#letter-saved-date").textContent = `${formatKoreanDate(state.reflection.savedAt)} 저장 · 이 편지는 이 브라우저에 보관됩니다.`;
    $("#letter-preview").textContent = state.reflection.letter;
  }
}

function formatKoreanDate(value) {
  if (!value) return "";
  return new Intl.DateTimeFormat("ko-KR", { dateStyle: "long", timeStyle: "short", timeZone: "Asia/Seoul" }).format(new Date(value));
}

function renderReflectionStep() {
  const index = state.reflection.step;
  const step = REFLECTION_STEPS[index];
  $("#reflection-step").textContent = `${String(index + 1).padStart(2, "0")} / ${String(REFLECTION_STEPS.length).padStart(2, "0")}`;
  $("#reflection-progress-bar").style.width = `${((index + 1) / REFLECTION_STEPS.length) * 100}%`;
  $("#reflection-phase").textContent = step.phase;
  $("#reflection-stem").textContent = step.stem;
  $("#reflection-guide-copy").textContent = step.guide;
  $("#reflection-answer").value = state.reflection.answers[index] || "";
  $("#reflection-examples").innerHTML = step.examples.map((example) => `<li>“${example}”</li>`).join("");
  $("#reflection-prev").disabled = index === 0;
  $("#reflection-next span:first-child").textContent = index === REFLECTION_STEPS.length - 1 ? "편지 만들기" : "다음 문장";
  updateReflectionAnswerStatus();
}

function updateReflectionAnswerStatus() {
  const answer = $("#reflection-answer").value.trim();
  $("#reflection-next").disabled = !answer;
  $("#reflection-answer-status").textContent = answer ? `${answer.length}자 기록했습니다.` : "한 문장만 적어도 충분합니다.";
}

function scrollToReflection() {
  $("#reflection-section").scrollIntoView({ behavior: "smooth", block: "start" });
}

function startReflection() {
  state.reflection.mode = "writing";
  state.reflection.step = state.reflection.answers.findIndex((answer) => !answer.trim());
  if (state.reflection.step < 0) state.reflection.step = 0;
  renderReflection();
  scrollToReflection();
  setTimeout(() => $("#reflection-answer").focus(), 350);
}

function previousReflection() {
  if (state.reflection.step === 0) return;
  state.reflection.step -= 1;
  renderReflectionStep();
  $("#reflection-answer").focus();
}

function nextReflection() {
  const answer = $("#reflection-answer").value.trim();
  if (!answer) {
    showToast("지금 떠오르는 장면을 한 문장으로 적어 주세요");
    return;
  }
  state.reflection.answers[state.reflection.step] = answer;
  if (state.reflection.step < REFLECTION_STEPS.length - 1) {
    state.reflection.step += 1;
    renderReflectionStep();
    $("#reflection-answer").focus();
    return;
  }
  state.reflection.letter = buildLetter();
  state.reflection.mode = "letter";
  renderReflection();
  scrollToReflection();
  setTimeout(() => $("#self-letter").focus(), 350);
}

function buildLetter() {
  const answers = state.reflection.answers;
  const result = state.result;
  const recipient = result?.name ? `${result.name}에게,` : "지금의 나에게,";
  const stateName = STATE_DATA[result?.stateKey]?.name || "성장 조건을 살피는 중";
  const writtenDate = new Intl.DateTimeFormat("ko-KR", { dateStyle: "long", timeZone: "Asia/Seoul" }).format(new Date());
  return `${recipient}

오늘 검사를 마치고, 지금의 나를 서두르지 않고 바라본다.
오늘의 성장 지도에 붙은 이름은 “${stateName}”. 점수보다 내가 살아온 실제 장면을 기억하려 한다.

내가 조금 편안해지는 순간
${answers[0]}

내 몸이 먼저 긴장하는 순간
${answers[1]}

그때 가장 먼저 떠오르는 말
“${answers[2]}”

그 말 뒤에 나도 모르게 반복하는 행동
${answers[3]}

이제는 안다. 그때 내게 정말 필요했던 것은
${answers[4]}

남의 기대를 잠시 내려놓은 내 마음
${answers[5]}

비슷한 장면이 다시 오면 가장 먼저
${answers[6]}

앞으로 7주 동안 나는 이 말을 자주 기억하자.
“${answers[7]}”

완벽하게 바뀌지 않아도 괜찮다. 신호를 조금 일찍 알아차리고, 나에게 맞는 작은 선택을 한 번 더 해보면 된다. 오늘 적은 문장은 나를 평가하는 답안이 아니라 다시 나에게 돌아오는 길이다.

${writtenDate}의 내가.`;
}

function editReflection() {
  state.reflection.letter = $("#self-letter").value.trim() || state.reflection.letter;
  state.reflection.mode = "writing";
  state.reflection.step = REFLECTION_STEPS.length - 1;
  renderReflection();
  scrollToReflection();
}

function editLetter() {
  state.reflection.mode = "letter";
  renderReflection();
  scrollToReflection();
}

function saveLetter() {
  const letter = $("#self-letter").value.trim();
  if (!letter) {
    showToast("편지 내용을 한 문장 이상 남겨 주세요");
    return;
  }
  state.reflection.letter = letter;
  state.reflection.savedAt = new Date().toISOString();
  saveLetterRecord({
    resultId: state.result.id,
    resultCreatedAt: state.result.createdAt,
    savedAt: state.reflection.savedAt,
    answers: [...state.reflection.answers],
    letter
  });
  state.reflection.mode = "complete";
  renderReflection();
  scrollToReflection();
  showToast("편지를 저장했습니다. 오늘의 검사를 마칩니다");
}

function copyLetter() {
  const visibleDraft = state.reflection.mode === "letter" ? $("#self-letter").value.trim() : "";
  const letter = visibleDraft || state.reflection.letter;
  if (!letter) return;
  navigator.clipboard.writeText(letter).then(() => showToast("나에게 보내는 편지를 복사했습니다")).catch(() => showToast("복사하지 못했습니다"));
}

function printLetter() {
  if (state.reflection.mode === "letter") state.reflection.letter = $("#self-letter").value.trim() || state.reflection.letter;
  $("#self-letter").value = state.reflection.letter;
  $("#self-letter-print").textContent = state.reflection.letter;
  document.body.classList.add("letter-print-mode");
  const cleanup = () => document.body.classList.remove("letter-print-mode");
  window.addEventListener("afterprint", cleanup, { once: true });
  window.print();
  setTimeout(cleanup, 2000);
}

function pointFor(index, radius, count = 10, center = 300) {
  const angle = -Math.PI / 2 + (Math.PI * 2 * index / count);
  return [center + Math.cos(angle) * radius, center + Math.sin(angle) * radius];
}

function pointsString(radiusFn) {
  return GROUP_ORDER.map((_, index) => pointFor(index, radiusFn(index)).join(",")).join(" ");
}

function renderRadar(result) {
  const svg = $("#radar-chart");
  const grid = [1,2,3,4,5,6,7].map((level) => `<polygon class="radar-grid" points="${pointsString(() => level * 31)}" />`).join("");
  const axes = GROUP_ORDER.map((_, index) => { const [x,y] = pointFor(index, 217); return `<line class="radar-axis" x1="300" y1="300" x2="${x}" y2="${y}" />`; }).join("");
  const area = `<polygon class="radar-area" points="${pointsString((index) => result.domainScores[GROUP_ORDER[index]] * 31)}" />`;
  const dots = GROUP_ORDER.map((key, index) => { const [x,y] = pointFor(index, result.domainScores[key] * 31); return `<circle class="radar-dot" cx="${x}" cy="${y}" r="6" />`; }).join("");
  const labels = GROUP_ORDER.map((key, index) => { const [x,y] = pointFor(index, 257); return `<text class="radar-label" x="${x}" y="${y}">${DOMAINS[key].short}</text>`; }).join("");
  svg.innerHTML = `${grid}${axes}${area}${dots}${labels}`;
}

function renderLegend(result) {
  $("#score-legend").innerHTML = GROUP_ORDER.map((key, index) => `
    <div class="score-item ${DOMAINS[key].group}">
      <span class="code">${String(index + 1).padStart(2, "0")}</span><strong>${DOMAINS[key].name}</strong><b>${result.domainScores[key].toFixed(1)}</b>
      <div class="bar"><span style="width:${(result.domainScores[key] / 7) * 100}%"></span></div>
    </div>`).join("");
}

function renderBridge(result, growthKey, leverKey) {
  const gap = Math.abs(result.flourish - result.awareness);
  const gapCopy = gap < .6 ? "두 축의 간격이 크지 않습니다. 현재의 알아차림을 실제 생활의 반복 가능한 조건으로 만드는 데 초점을 둡니다." : result.flourish > result.awareness ? "삶은 비교적 잘 굴러가지만 내면의 신호를 읽는 속도가 뒤따르지 못할 수 있습니다. 멈춤과 명명이 현재의 흐름을 보호합니다." : "자신을 읽는 힘에 비해 삶의 체감이 아직 따라오지 않을 수 있습니다. 분석을 줄이고 완료 가능한 행동 하나로 옮기는 것이 중요합니다.";
  $("#bridge-copy").textContent = gapCopy;
  const questions = [DOMAINS[growthKey].questions[0], DOMAINS[leverKey].questions[0], DOMAINS[growthKey].questions[1], DOMAINS[leverKey].questions[1]];
  $("#coaching-questions").innerHTML = questions.map((question, i) => `<div class="coaching-question"><span>Q${i + 1}</span><p>${question}</p></div>`).join("");
}

function renderFocusOptions(result, initialKey) {
  const select = $("#focus-select");
  select.innerHTML = ["P", "E", "R", "M", "A"].map((key) => `<option value="${key}" ${key === initialKey ? "selected" : ""}>${DOMAINS[key].name} · ${result.domainScores[key].toFixed(1)}</option>`).join("");
  select.onchange = () => renderExperiment(select.value);
  renderExperiment(initialKey);
}

function renderExperiment(key) {
  const domain = DOMAINS[key];
  $("#experiment-title").textContent = domain.experiment[0];
  $("#experiment-action").textContent = domain.experiment[1];
  $("#experiment-question").textContent = domain.observe;
}

function openMethod() { $("#method-dialog").showModal(); }
function closeDialogs() { $$('dialog[open]').forEach((dialog) => dialog.close()); }

function openHistory() {
  const records = getRecords();
  const letterResultIds = new Set(getLetters().map((entry) => entry.resultId));
  const list = $("#history-list");
  list.innerHTML = records.length ? records.map((record, index) => `
    <article class="history-item">
      <div><h3>${escapeHtml(record.name || "이름 없는 기록")} · ${STATE_DATA[classifyState(record.flourish, record.awareness)]?.name || "성장 지도"}</h3><p>${new Intl.DateTimeFormat("ko-KR", { dateStyle: "medium", timeZone: "Asia/Seoul" }).format(new Date(record.createdAt))} · ${contextLabel(record.context)}${letterResultIds.has(record.id) ? " · 나에게 보낸 편지 저장됨" : ""}</p></div>
      <div class="history-scores"><span>${record.flourish.toFixed(1)} / ${record.awareness.toFixed(1)}</span><button type="button" data-history-index="${index}">보기</button></div>
    </article>`).join("") : `<p class="empty-history">아직 저장된 기록이 없습니다.</p>`;
  list.querySelectorAll("button[data-history-index]").forEach((button) => button.addEventListener("click", () => {
    state.result = records[Number(button.dataset.historyIndex)];
    closeDialogs();
    renderResult(state.result);
    showView("result-view");
  }));
  $("#history-dialog").showModal();
}

function copySummary() {
  if (!state.result) return;
  const r = state.result;
  const flourishKeys = sortedKeys(r, "flourish");
  const awarenessKeys = sortedKeys(r, "awareness");
  const summary = `[플로리싱 × 알아차림 성장지도]\n${r.name ? `${r.name} · ` : ""}${contextLabel(r.context)}\n현재 상태: ${STATE_DATA[r.stateKey].name}\n삶의 플로리싱 ${r.flourish.toFixed(1)} / 알아차림 역량 ${r.awareness.toFixed(1)}\n잘 작동하는 힘: ${DOMAINS[flourishKeys[0]].name}\n먼저 볼 장면: ${DOMAINS[flourishKeys.at(-1)].name}\n연결할 알아차림: ${DOMAINS[awarenessKeys.at(-1)].name}\n\n이 결과는 진단이 아닌 성장 대화용 자기점검입니다.`;
  navigator.clipboard.writeText(summary).then(() => showToast("결과 요약을 복사했습니다")).catch(() => showToast("복사하지 못했습니다"));
}

function showToast(message) {
  const toast = $("#toast");
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => toast.classList.remove("show"), 2200);
}

function goHome() { closeDialogs(); showView("intro-view"); }
function restart() { state.page = 0; state.answers = {}; renderPage(); showView("test-view"); }

document.addEventListener("click", (event) => {
  const action = event.target.closest("[data-action]")?.dataset.action;
  if (!action) return;
  ({
    home: goHome,
    start: startTest,
    next: nextPage,
    prev: prevPage,
    restart,
    method: openMethod,
    history: openHistory,
    "close-dialog": closeDialogs,
    copy: copySummary,
    print: () => window.print(),
    "start-reflection": startReflection,
    "reflection-prev": previousReflection,
    "reflection-next": nextReflection,
    "edit-reflection": editReflection,
    "edit-letter": editLetter,
    "save-letter": saveLetter,
    "copy-letter": copyLetter,
    "print-letter": printLetter
  })[action]?.();
});

$("#reflection-answer").addEventListener("input", (event) => {
  state.reflection.answers[state.reflection.step] = event.target.value;
  updateReflectionAnswerStatus();
});

$("#self-letter").addEventListener("input", (event) => {
  state.reflection.letter = event.target.value;
});

document.addEventListener("keydown", (event) => {
  if (!$("#test-view").hidden && /^[1-7]$/.test(event.key)) {
    const activeItem = ITEMS[state.page * PAGE_SIZE];
    const target = document.querySelector(`input[name="q${activeItem.id}"][value="${event.key}"]`);
    if (target) { target.checked = true; target.dispatchEvent(new Event("change", { bubbles: true })); }
  }
});

updateHistoryCount();
