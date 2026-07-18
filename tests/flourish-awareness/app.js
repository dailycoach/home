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

const INTEGRATED_LOOPS = {
  P: {
    flourish: "P", awareness: "SN", label: "긍정정서 ↔ 신호 포착",
    title: "좋은 감정을 만들기보다 편안함이 시작되는 신호를 붙잡습니다.",
    connection: "긍정정서는 생각으로 강요할수록 멀어질 수 있습니다. 숨이 길어짐, 어깨가 풀림, 표정이 부드러워짐처럼 몸이 먼저 반응한 작은 순간을 등록하면 실제 만족과 회복의 조건을 찾기 쉬워집니다.",
    scene: "괜찮은 순간이 있어도 바로 다음 걱정이나 할 일로 넘어가는 때",
    notice: "숨·어깨·표정이 아주 조금 편안해지는 최초의 변화",
    action: "좋았던 장면에 20초 머물며 감정과 몸의 변화를 한 문장으로 적기",
    experiment: {
      title: "편안함 신호에서 긍정정서를 키우는 7주",
      action: "매주 세 번, 조금 괜찮았던 장면에 20초 더 머물고 ‘무슨 일이 있었는지–몸이 어떻게 달라졌는지’를 한 문장으로 기록하세요.",
      notice: "숨이 길어짐, 어깨가 내려감, 미소, 따뜻함처럼 좋은 감정이 시작되는 신체 신호",
      choice: "다음 일로 바로 넘어가기 전에 20초 머물고 감정 이름 하나 붙이기",
      observe: "내가 실제로 편안함을 느끼기 쉬운 시간·장소·사람에는 어떤 공통점이 있었습니까?"
    },
    questions: ["최근 좋았던 일을 몸이 먼저 알아본 순간은 언제였습니까?", "괜찮은 순간을 너무 빨리 지나치게 하는 생각은 무엇입니까?", "이번 주 반복하고 싶은 편안함의 조건 하나는 무엇입니까?", "그 장면에서 20초 더 머물면 무엇이 달라집니까?"],
    examples: [
      ["출근길 햇빛을 받을 때 숨이 조금 길어졌다", "가족과 웃던 순간 어깨의 힘이 빠졌다"],
      ["좋은 말을 들어도 다음 걱정 때문에 가슴이 답답해진다", "쉬는 중에도 할 일이 떠올라 턱에 힘이 들어간다"],
      ["이 정도로 만족하면 뒤처질 거야", "곧 또 문제가 생길 텐데"],
      ["좋았던 순간을 축소하고 바로 다음 일을 찾는다", "괜찮다는 느낌을 무시하고 휴대폰부터 본다"],
      ["문제가 없는 20초를 그대로 인정하는 것", "죄책감 없이 쉬어도 된다는 허락"],
      ["내 숨이 길어졌다는 작은 변화", "나는 조용한 시간에 회복이 빠르다는 사실"],
      ["20초 머물고 지금 감정을 한 단어로 적겠다", "다음 일을 시작하기 전에 어깨를 한 번 풀겠다"],
      ["좋은 순간도 충분히 내 삶의 일부다", "회복은 더 하는 일이 아니라 이미 온 신호를 보는 일이다"]
    ]
  },
  E: {
    flourish: "E", awareness: "PT", label: "몰입 ↔ 패턴 이해",
    title: "집중력을 탓하기보다 몰입이 열리고 닫히는 반복 조건을 찾습니다.",
    connection: "몰입은 의지만의 문제가 아닙니다. 과제 난이도, 강점 사용, 방해 요소, 시작 시간처럼 집중을 살리거나 끊는 패턴을 알면 ‘나는 집중을 못 한다’는 평가 대신 재현 가능한 조건을 설계할 수 있습니다.",
    scene: "해야 할 일 앞에서 자꾸 다른 창을 열거나 시작만 반복하는 때",
    notice: "집중이 끊기기 직전의 과제 난이도·알림·피로·자동 회피 행동",
    action: "방해 요소 하나를 치우고 25분 집중한 뒤 잘된 조건 한 가지 기록하기",
    experiment: {
      title: "내 몰입 패턴을 찾아 재현하는 7주",
      action: "매주 한 번, 집중이 필요한 일 하나를 골라 방해 요소를 하나 치우고 25분 실행하세요. 끝난 뒤 집중이 살아난 조건과 끊긴 조건을 각각 한 가지씩 적습니다.",
      notice: "집중 직전의 에너지, 과제 난이도, 알림, 주변 소리, 다른 일을 열고 싶은 충동",
      choice: "막연한 과제를 25분짜리 한 단계로 줄이고 방해 요소 하나만 제거하기",
      observe: "집중이 잘된 날과 어려운 날의 시작 조건에는 어떤 반복 차이가 있었습니까?"
    },
    questions: ["최근 20분 이상 자연스럽게 집중한 장면의 조건은 무엇이었습니까?", "집중이 끊어지기 직전에 반복되는 행동은 무엇입니까?", "내 강점이 쓰일 때와 쓰이지 않을 때 주의는 어떻게 달라집니까?", "다음 몰입을 위해 없앨 방해 요소 하나는 무엇입니까?"],
    examples: [
      ["자료를 구조화할 때 시간 가는 줄 몰랐다", "조용한 오전에 글을 쓸 때 집중이 살아났다"],
      ["과제가 막연하면 자꾸 새 창을 연다", "알림이 한 번 울리면 다시 집중하기 어렵다"],
      ["완벽하게 할 수 없으면 시작하지 말자", "일단 메일부터 확인해야 마음이 놓여"],
      ["준비만 늘리고 핵심 작업을 미룬다", "어려운 부분이 나오면 휴대폰을 본다"],
      ["완료 기준이 분명한 25분짜리 과제", "강점을 쓸 수 있는 조용한 시간"],
      ["막연함이 회피를 시작하게 한다는 패턴", "오전에는 생각하는 일이 더 잘된다는 조건"],
      ["할 일을 한 문장으로 줄이고 타이머를 켜겠다", "알림을 끄고 필요한 창 하나만 열겠다"],
      ["집중은 의지가 아니라 조건에서 시작된다", "완벽한 준비보다 25분의 실제 시작"]
    ]
  },
  R: {
    flourish: "R", awareness: "NM", label: "관계 ↔ 경험 명명",
    title: "관계를 판단하기보다 사실·감정·필요를 분명한 말로 연결합니다.",
    connection: "관계가 어려울 때 ‘서운하다’는 한 덩어리 안에는 관찰한 사실, 해석, 감정, 원하는 것이 섞여 있습니다. 경험을 나누어 이름 붙이면 상대를 공격하거나 혼자 참는 대신 구체적으로 요청할 수 있습니다.",
    scene: "상대의 반응을 미리 짐작해 말하지 않거나 한꺼번에 폭발하는 때",
    notice: "관찰한 사실과 내가 붙인 해석, 그때의 감정과 필요의 차이",
    action: "한 사람에게 ‘사실–내 느낌–바라는 것’을 세 문장으로 전하기",
    experiment: {
      title: "감정과 필요를 말로 연결하는 7주",
      action: "매주 한 번, 중요한 관계의 작은 장면을 골라 ‘실제로 일어난 일–내 감정–바라는 것’을 각각 한 문장으로 적고 가능한 경우 상대에게 구체적으로 전하세요.",
      notice: "상대의 말과 내가 추측한 의도, 내 감정과 실제로 원했던 도움의 차이",
      choice: "비난이나 침묵 대신 지금의 사실·감정·요청을 짧게 나누기",
      observe: "내 경험을 정확히 말했을 때 예상했던 반응과 실제 반응은 어떻게 달랐습니까?"
    },
    questions: ["최근 관계에서 실제로 일어난 사실은 무엇입니까?", "그 사실에 내가 붙인 해석과 감정은 각각 무엇입니까?", "그때 말하지 못한 필요나 부탁은 무엇입니까?", "누구에게 어떤 한 문장을 먼저 전할 수 있습니까?"],
    examples: [
      ["친구가 먼저 안부를 물었을 때 안심됐다", "동료가 내 말을 끊지 않고 들을 때 가까워졌다"],
      ["답장이 늦으면 가슴이 답답해지고 말을 줄인다", "회의에서 말이 끊기면 얼굴이 뜨거워진다"],
      ["나를 중요하게 생각하지 않는 거야", "말해 봐야 부담만 줄 거야"],
      ["괜찮은 척하고 연락을 피한다", "도움을 청하지 않고 혼자 처리한다"],
      ["조언보다 끝까지 들어주는 것", "오늘은 어렵다고 솔직히 말할 수 있는 안전감"],
      ["답장이 늦은 사실과 거절당했다는 해석은 다르다", "내 감정은 화보다 서운함에 가깝다"],
      ["사실과 내 느낌을 나누어 한 문장으로 말하겠다", "필요한 도움을 구체적으로 한 가지 부탁하겠다"],
      ["추측보다 확인, 참기보다 구체적인 요청", "내 마음을 정확히 말하는 것도 관계를 돌보는 일이다"]
    ]
  },
  M: {
    flourish: "M", awareness: "VL", label: "의미 ↔ 고유성 정렬",
    title: "해야 하는 이유와 내가 동의하는 이유를 구분해 나다운 방향을 찾습니다.",
    connection: "의미는 거창한 사명보다 지금 쓰는 시간이 내가 중요하게 여기는 가치와 이어져 있다는 감각입니다. 타인의 기대와 자기 기준을 구분하면 같은 일도 ‘끌려가는 의무’인지 ‘내가 선택한 기여’인지 다시 볼 수 있습니다.",
    scene: "바쁘게 움직이지만 왜 하는지 모르거나 남의 기대만 남는 때",
    notice: "선택 앞에서 가장 먼저 떠오른 외부 기대와 내가 지키고 싶은 가치",
    action: "이번 주 일정 하나를 고르고 ‘이 일에서 지킬 내 가치’를 한 문장으로 정하기",
    experiment: {
      title: "내 가치가 시간표에 보이게 만드는 7주",
      action: "매주 한 번, 중요한 일정 하나를 골라 ‘남이 기대하는 것–내가 동의하는 것–내 방식으로 바꿀 한 가지’를 적고 작은 조정을 실행하세요.",
      notice: "결정할 때 먼저 떠오르는 타인의 기대, 반복해 힘이 났던 자기 방식, 지키고 싶은 가치",
      choice: "요구를 모두 버리지 않고 내 가치와 강점이 보이도록 방식 하나 조정하기",
      observe: "내 기준을 반영한 선택 뒤에는 활력·납득감·지속성 중 무엇이 달라졌습니까?"
    },
    questions: ["요즘 시간을 많이 쓰지만 의미가 흐린 일은 무엇입니까?", "그 일에서 남의 기대와 내가 동의하는 부분은 각각 무엇입니까?", "그동안 나답게 잘해 온 방식이나 강점은 무엇입니까?", "이번 주 일정 하나에 내 가치를 어떻게 보이게 할 수 있습니까?"],
    examples: [
      ["후배가 성장하도록 도왔을 때 일이 의미 있게 느껴졌다", "가족과 약속을 지켰을 때 내 삶답다고 느꼈다"],
      ["요청을 거절하려 하면 배가 무거워진다", "일정표를 볼 때 내가 빠진 느낌에 숨이 막힌다"],
      ["좋은 사람이라면 이 정도는 해야 해", "인정받으려면 남들 방식대로 해야 해"],
      ["내 우선순위를 미루고 모든 요청을 받는다", "잘해 온 내 방식을 버리고 비교부터 한다"],
      ["내가 동의하는 이유를 확인할 시간", "요구 속에서도 지킬 내 가치 한 가지"],
      ["나는 사람을 연결할 때 강점이 살아난다", "내게 중요한 기준은 속도보다 정직함이다"],
      ["요청을 받으면 내 기준을 확인한 뒤 답하겠다", "일정 하나를 내 강점이 쓰이는 방식으로 바꾸겠다"],
      ["남의 기대 속에서도 내 이유를 선택할 수 있다", "나답다는 느낌은 방향을 알려 주는 자료다"]
    ]
  },
  A: {
    flourish: "A", awareness: "CH", label: "성취 ↔ 선택과 조정",
    title: "큰 결심보다 지금 선택할 최소 행동과 다음 조정을 연결합니다.",
    connection: "성취감은 큰 결과만이 아니라 선택한 행동을 끝내고 피드백을 얻는 과정에서 생깁니다. 알아차린 내용을 특정 장면의 작은 행동으로 바꾸고, 결과에 맞춰 조정하면 의지 부족이라는 자책에서 벗어날 수 있습니다.",
    scene: "문제를 잘 알고도 첫 행동이 크거나 모호해 시작하지 못하는 때",
    notice: "계획이 멈추는 구체적 상황과 ‘이 정도로는 부족하다’는 자동 기준",
    action: "할 일을 10분 안에 끝낼 첫 단계로 줄여 실행하고 다음 조정 한 줄 남기기",
    experiment: {
      title: "최소 행동과 조정을 쌓아 성취를 회복하는 7주",
      action: "매주 한 가지 목표를 10분 안에 시작할 행동으로 줄여 실행하세요. 끝난 뒤 성공 여부보다 ‘무엇이 쉬웠고 다음에는 무엇을 바꿀지’를 한 줄로 남깁니다.",
      notice: "시작을 미루는 순간, 너무 큰 완료 기준, 방해 상황, 실행 뒤의 자책이나 피드백",
      choice: "완벽한 계획 대신 10분짜리 첫 행동을 하고 결과를 다음 계획의 자료로 쓰기",
      observe: "작은 완료를 반복했을 때 자신감과 다음 행동의 선명함은 어떻게 달라졌습니까?"
    },
    questions: ["지금 미루는 일의 첫 10분 행동은 무엇입니까?", "시작을 막는 완료 기준이 실제로 너무 크지는 않습니까?", "실행을 방해하는 상황이 오면 어떤 대안을 쓸 수 있습니까?", "결과에서 배운 조정점 한 가지는 무엇입니까?"],
    examples: [
      ["자료 제목과 목차만 만들었을 때 시작감이 생겼다", "미뤘던 전화를 한 통 끝내고 마음이 가벼워졌다"],
      ["할 일 전체를 떠올리면 몸이 무거워진다", "마감 생각에 손이 굳고 자료만 다시 본다"],
      ["제대로 못 할 거면 시작하지 말자", "이 정도 작은 행동은 아무 의미 없어"],
      ["계획을 계속 고치고 실제 시작을 미룬다", "한 번 놓치면 이번 주 전체를 포기한다"],
      ["성공하기 쉬운 10분짜리 첫 단계", "실패가 아니라 조정할 자료로 보는 태도"],
      ["완료 기준이 너무 커서 시작이 멈춘다", "나는 작게 끝낼 때 다음 행동이 더 선명해진다"],
      ["파일을 열고 제목 한 줄부터 쓰겠다", "실행 뒤 잘된 점과 바꿀 점을 한 줄씩 적겠다"],
      ["작은 완료도 분명한 전진이다", "계획의 목적은 나를 평가하는 것이 아니라 움직이게 하는 것이다"]
    ]
  }
};

const REFLECTION_PHASES = [
  "삶의 영역이 살아나는 장면", "흐려지기 시작하는 신호", "자동으로 떠오르는 생각", "반복되는 행동",
  "실제로 필요한 조건", "알아차림으로 다시 보기", "다음 장면의 작은 선택", "7주 동안 기억할 문장"
];

const REFLECTION_GUIDES = [
  "최근 일주일 안에 이 삶의 영역이 조금이라도 살아났던 실제 순간을 떠올려 보세요.",
  "생각으로 판단하기 전 몸과 감정이 먼저 보낸 작은 신호를 적어 보세요.",
  "사실인지 따지기보다 그 장면에서 자동으로 스쳐 간 짧은 말을 붙잡아 보세요.",
  "그 생각 다음에 자주 이어지는 미루기, 참기, 과하게 하기 같은 행동을 적어 보세요.",
  "‘더 열심히’보다 시간, 도움, 경계, 휴식처럼 실제로 도움이 되는 조건을 찾아보세요.",
  "나의 알아차림 손잡이를 사용하면 같은 장면에서 무엇이 새롭게 보이는지 적어 보세요.",
  "의지나 결심보다 1분에서 10분 안에 시작할 수 있는 첫 행동을 적어 보세요.",
  "힘든 날에도 나를 몰아붙이지 않고 방향을 되찾게 해 줄 한 문장을 만들어 보세요."
];

const state = {
  page: 0,
  answers: {},
  name: "",
  context: "life",
  result: null,
  reflection: { step: 0, answers: Array(8).fill(""), steps: [], loopKey: "P", letter: "", mode: "intro", savedAt: null }
};

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];
const clamp = (n, min, max) => Math.min(max, Math.max(min, n));
const mean = (numbers) => numbers.reduce((a, b) => a + b, 0) / numbers.length;
const round1 = (n) => Math.round(n * 10) / 10;
const escapeHtml = (value = "") => String(value).replace(/[&<>'"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[char]);

function parseStoredArray(key) {
  try {
    const value = JSON.parse(localStorage.getItem(key) || "[]");
    return Array.isArray(value) ? value : [];
  } catch { return []; }
}

function isValidResultRecord(record) {
  return Boolean(record && record.domainScores && GROUP_ORDER.every((key) => Number.isFinite(record.domainScores[key])) && Number.isFinite(record.flourish) && Number.isFinite(record.awareness) && record.createdAt && !Number.isNaN(new Date(record.createdAt).getTime()));
}

function resultRecordKey(result) {
  return result?.id || result?.createdAt || null;
}

function getRecords() {
  return parseStoredArray(STORAGE_KEY).filter(isValidResultRecord);
}

function saveRecord(record) {
  const records = getRecords();
  records.unshift(record);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(records.slice(0, 12)));
    updateHistoryCount();
    return true;
  } catch {
    showToast("결과를 이 브라우저에 저장하지 못했지만 화면에서는 계속 확인할 수 있습니다");
    return false;
  }
}

function getLetters() {
  return parseStoredArray(LETTER_STORAGE_KEY).filter((entry) => entry && entry.resultId && typeof entry.letter === "string" && Array.isArray(entry.answers));
}

function getLetterForResult(result) {
  const resultId = resultRecordKey(result);
  return resultId ? getLetters().find((entry) => entry.resultId === resultId) || null : null;
}

function saveLetterRecord(entry) {
  const letters = getLetters().filter((item) => item.resultId !== entry.resultId);
  letters.unshift(entry);
  try {
    localStorage.setItem(LETTER_STORAGE_KEY, JSON.stringify(letters.slice(0, 24)));
    return true;
  } catch {
    return false;
  }
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
  $("#test-progress").setAttribute("aria-valuenow", String(state.page + 1));
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

function loopScore(result, loopKey) {
  const loop = INTEGRATED_LOOPS[loopKey];
  return round1(mean([result.domainScores[loop.flourish], result.domainScores[loop.awareness]]));
}

function loopPriorityScore(result, loopKey) {
  const loop = INTEGRATED_LOOPS[loopKey];
  return Math.min(result.domainScores[loop.flourish], result.domainScores[loop.awareness]);
}

function sortedLoopKeys(result) {
  return Object.keys(INTEGRATED_LOOPS).sort((a, b) => loopScore(result, a) - loopScore(result, b));
}

function choosePrimaryLoop(result) {
  const ordered = Object.keys(INTEGRATED_LOOPS).sort((a, b) => loopPriorityScore(result, a) - loopPriorityScore(result, b) || loopScore(result, a) - loopScore(result, b));
  const lowest = loopPriorityScore(result, ordered[0]);
  const ties = ordered.filter((key) => Math.abs(loopPriorityScore(result, key) - lowest) < .11);
  const contextPreference = ({ life: "M", work: "E", relationship: "R", change: "A" })[result.context] || "M";
  return ties.includes(contextPreference) ? contextPreference : ties[0];
}

function loopReading(result, loopKey) {
  const loop = INTEGRATED_LOOPS[loopKey];
  const lifeScore = result.domainScores[loop.flourish];
  const awarenessScore = result.domainScores[loop.awareness];
  const gap = round1(lifeScore - awarenessScore);
  if (lifeScore < 3.5 && awarenessScore < 3.5) {
    return `${DOMAINS[loop.flourish].name}의 체감과 ${DOMAINS[loop.awareness].name}의 손잡이가 함께 충분하지 않은 때입니다. 큰 변화를 만들기보다 한 장면에서 신호 하나를 보고 작은 선택 하나를 끝내는 것부터 시작하세요.`;
  }
  if (gap >= .8) {
    return `${DOMAINS[loop.flourish].name} 영역은 어느 정도 경험하고 있지만 ${DOMAINS[loop.awareness].name} 역량이 상대적으로 늦게 따라옵니다. 잘되는 순간을 우연으로 지나치지 말고, 그때의 조건과 신호를 붙잡아 재현하는 것이 우선입니다.`;
  }
  if (gap <= -.8) {
    return `${DOMAINS[loop.awareness].name} 역량은 비교적 살아 있지만 ${DOMAINS[loop.flourish].name} 영역의 실제 체감으로 아직 충분히 이어지지 않을 수 있습니다. 더 분석하기보다 알아차린 내용을 생활 조건과 작은 행동으로 번역하세요.`;
  }
  if (loopScore(result, loopKey) >= 5) {
    return `${DOMAINS[loop.flourish].name}의 경험과 ${DOMAINS[loop.awareness].name}의 역량이 함께 비교적 안정적으로 작동합니다. 이 연결이 살아나는 조건을 다른 장면에도 의식적으로 옮겨 쓰면 좋은 자원이 됩니다.`;
  }
  return `${DOMAINS[loop.flourish].name} 영역과 ${DOMAINS[loop.awareness].name} 역량이 상황에 따라 함께 흔들릴 수 있습니다. 잘되는 날과 어려운 날을 비교해 두 점수가 동시에 달라지는 실제 조건을 찾는 것이 중요합니다.`;
}

function buildReflectionSteps(loopKey) {
  const loop = INTEGRATED_LOOPS[loopKey];
  const life = DOMAINS[loop.flourish].name;
  const awareness = DOMAINS[loop.awareness].name;
  const stems = [
    `최근 ‘${life}’ 영역이 조금 살아났던 순간은 …`,
    `‘${life}’ 영역이 흐려지기 시작할 때, 내 몸과 감정의 신호는 …`,
    "그 장면에서 자동으로 떠오르는 생각은 …",
    `그 생각 때문에 ‘${life}’ 영역을 어렵게 만드는 내 행동은 …`,
    `사실 ‘${life}’ 영역을 회복하기 위해 내가 필요했던 것은 …`,
    `‘${awareness}’의 관점으로 다시 보면, 내가 놓치고 있던 것은 …`,
    "비슷한 장면이 다시 오면, 나는 가장 먼저 …",
    `앞으로 7주 동안 ‘${life}’ 영역을 위해 기억할 나다운 문장은 …`
  ];
  return stems.map((stem, index) => ({
    phase: REFLECTION_PHASES[index],
    stem,
    guide: REFLECTION_GUIDES[index],
    examples: loop.examples[index]
  }));
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

function renderExpertLenses(result, strongestLoopKey, primaryLoopKey) {
  const strongestLoop = INTEGRATED_LOOPS[strongestLoopKey];
  const primaryLoop = INTEGRATED_LOOPS[primaryLoopKey];
  const flourishValues = ["P", "E", "R", "M", "A"].map((key) => result.domainScores[key]);
  const spread = round1(Math.max(...flourishValues) - Math.min(...flourishValues));
  const lifeScore = result.domainScores[primaryLoop.flourish];
  const awarenessScore = result.domainScores[primaryLoop.awareness];
  const gap = round1(lifeScore - awarenessScore);
  const loopValues = Object.keys(INTEGRATED_LOOPS).map((key) => loopScore(result, key));
  const loopSpread = round1(Math.max(...loopValues) - Math.min(...loopValues));
  const balanceTitle = loopSpread < .2 ? "다섯 통합 성장 루프가 비슷한 수준입니다." : `${strongestLoop.label} 연결이 현재 활용 가능한 자원입니다.`;
  const balanceCopy = loopSpread < .2
    ? `특정 연결 하나가 두드러지기보다 다섯 루프가 함께 움직이고 있습니다. ${contextLabel(result.context)} 맥락에서 먼저 체감하고 싶은 ${primaryLoop.label} 연결을 우선 루프로 삼아 실제 장면의 차이를 관찰합니다.`
    : `이 연결의 참고점수는 ${loopScore(result, strongestLoopKey).toFixed(1)}점입니다. ${strongestLoop.connection} 잘 작동하는 조건을 우선 루프의 생활 장면에도 옮겨 쓰면 약점을 고치는 접근보다 자기 자원을 활용하는 변화가 가능합니다.`;
  const regulationTitle = Math.abs(gap) < .8
    ? `${primaryLoop.label} 두 축이 비슷한 수준으로 움직입니다.`
    : gap > 0 ? `${DOMAINS[primaryLoop.flourish].name}보다 ${DOMAINS[primaryLoop.awareness].name}의 포착이 늦을 수 있습니다.` : `${DOMAINS[primaryLoop.awareness].name}보다 ${DOMAINS[primaryLoop.flourish].name}의 생활 체감이 낮습니다.`;
  const regulationCopy = `${loopReading(result, primaryLoopKey)} 현재 두 점수는 ${lifeScore.toFixed(1)}점과 ${awarenessScore.toFixed(1)}점이며, 통합 참고점수는 ${loopScore(result, primaryLoopKey).toFixed(1)}점입니다.`;
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
      <h3>${primaryLoop.title}</h3><p>관찰할 장면은 “${primaryLoop.scene}”입니다. 그때 ${primaryLoop.notice}을 확인하고, 첫 행동으로 ${primaryLoop.action}를 적용합니다.</p>
    </article>`;
}

function renderIntegratedLoops(result, primaryLoopKey) {
  const primary = INTEGRATED_LOOPS[primaryLoopKey];
  $("#primary-loop-title").textContent = primary.label;
  $("#primary-loop-score").textContent = loopScore(result, primaryLoopKey).toFixed(1);
  $("#primary-loop-reading").textContent = loopReading(result, primaryLoopKey);
  $("#primary-loop-scene").textContent = primary.scene;
  $("#primary-loop-notice").textContent = primary.notice;
  $("#primary-loop-action").textContent = primary.action;

  $("#integrated-loop-list").innerHTML = Object.keys(INTEGRATED_LOOPS).map((key, index) => {
    const loop = INTEGRATED_LOOPS[key];
    const lifeScore = result.domainScores[loop.flourish];
    const awarenessScore = result.domainScores[loop.awareness];
    return `
      <article class="integrated-loop-card ${key === primaryLoopKey ? "priority selected" : ""}">
        <div class="loop-card-top"><span>${String(index + 1).padStart(2, "0")}</span><b>${loopScore(result, key).toFixed(1)}</b></div>
        <h3>${loop.label}</h3>
        <p>${loop.title}</p>
        <div class="loop-pair-scores"><span>${DOMAINS[loop.flourish].name} ${lifeScore.toFixed(1)}</span><i aria-hidden="true">↔</i><span>${DOMAINS[loop.awareness].name} ${awarenessScore.toFixed(1)}</span></div>
        <button type="button" data-action="choose-loop" data-loop-key="${key}" aria-pressed="${key === primaryLoopKey}">${key === primaryLoopKey ? "추천 루프로 적용" : "이 루프로 적용"}<span aria-hidden="true">→</span></button>
      </article>`;
  }).join("");
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
  const loopKeys = sortedLoopKeys(result);
  const primaryLoopKey = choosePrimaryLoop(result);
  const strongestLoopKey = loopKeys.at(-1);
  const primaryLoop = INTEGRATED_LOOPS[primaryLoopKey];
  const strongestLoop = INTEGRATED_LOOPS[strongestLoopKey];
  result.stateKey = classifyState(result.flourish, result.awareness);
  result.primaryLoopKey = primaryLoopKey;
  result.selectedLoopKey = primaryLoopKey;
  const stateInfo = STATE_DATA[result.stateKey];
  const displayName = result.name ? `${escapeHtml(result.name)}님의` : "당신의";

  $("#result-title").innerHTML = `${displayName}<br>성장 지도를 읽었습니다.`;
  $("#result-date").textContent = `${new Intl.DateTimeFormat("ko-KR", { dateStyle: "long", timeZone: "Asia/Seoul" }).format(new Date(result.createdAt))} · ${contextLabel(result.context)}`;
  $("#state-code").textContent = stateInfo.code;
  $("#state-name").textContent = stateInfo.name;
  $("#state-summary").textContent = stateInfo.summary;
  $("#flourish-score").textContent = result.flourish.toFixed(1);
  $("#awareness-score").textContent = result.awareness.toFixed(1);

  const loopSpread = round1(loopScore(result, loopKeys.at(-1)) - loopScore(result, loopKeys[0]));
  $("#strength-title").textContent = loopSpread < .2 ? "다섯 연결이 비슷한 수준입니다." : strongestLoop.label;
  $("#strength-copy").textContent = loopSpread < .2
    ? `특정 강점에만 기대기보다 ${contextLabel(result.context)}에서 가장 먼저 바꾸고 싶은 장면을 기준으로 ${primaryLoop.label} 연결을 선택했습니다.`
    : `${strongestLoop.connection} 이 연결이 살아나는 실제 조건을 우선 성장 루프에도 옮겨 써 보세요.`;
  $("#growth-title").textContent = primaryLoop.label;
  $("#growth-copy").textContent = loopReading(result, primaryLoopKey);
  $("#lever-title").textContent = primaryLoop.action;
  $("#lever-copy").textContent = `“${primaryLoop.scene}”이 나타날 때 “${primaryLoop.notice}”을 먼저 확인하면 플로리싱과 알아차림이 같은 장면 안에서 연결됩니다.`;

  renderIntegratedLoops(result, primaryLoopKey);
  renderRadar(result);
  renderLegend(result);
  renderExpertLenses(result, strongestLoopKey, primaryLoopKey);
  renderDomainExplanations(result, primaryLoop.flourish, primaryLoop.awareness);
  renderBridge(result, primaryLoopKey);
  renderFocusOptions(result, primaryLoopKey);
  initializeReflection(result, primaryLoopKey);
}

function initializeReflection(result, defaultLoopKey) {
  const saved = getLetterForResult(result);
  const loopKey = saved?.loopKey && INTEGRATED_LOOPS[saved.loopKey] ? saved.loopKey : defaultLoopKey;
  state.reflection = {
    step: 0,
    answers: saved?.answers?.length === 8 ? saved.answers.map((answer) => String(answer ?? "")) : Array(8).fill(""),
    steps: buildReflectionSteps(loopKey),
    loopKey,
    letter: saved?.letter || "",
    mode: saved ? "complete" : "intro",
    savedAt: saved?.savedAt || null
  };
  renderReflectionFocus();
  renderReflection();
  if (saved) selectIntegratedLoop(loopKey, false);
}

function renderReflectionFocus() {
  const loop = INTEGRATED_LOOPS[state.reflection.loopKey];
  $("#reflection-loop-title").textContent = loop.label;
  $("#reflection-loop-copy").textContent = `${loop.scene}에 ${loop.notice}을 확인하고, ${loop.action}로 이어 가는 기록입니다.`;
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
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "저장 시각 확인 불가";
  return new Intl.DateTimeFormat("ko-KR", { dateStyle: "long", timeStyle: "short", timeZone: "Asia/Seoul" }).format(date);
}

function renderReflectionStep() {
  const index = state.reflection.step;
  const step = state.reflection.steps[index];
  $("#reflection-step").textContent = `${String(index + 1).padStart(2, "0")} / ${String(state.reflection.steps.length).padStart(2, "0")}`;
  $("#reflection-progress-bar").style.width = `${((index + 1) / state.reflection.steps.length) * 100}%`;
  $("#reflection-progress-track").setAttribute("aria-valuenow", String(index + 1));
  $("#reflection-phase").textContent = step.phase;
  $("#reflection-stem").textContent = step.stem;
  $("#reflection-guide-copy").textContent = step.guide;
  $("#reflection-answer").value = state.reflection.answers[index] || "";
  $("#reflection-examples").innerHTML = step.examples.map((example) => `<li>“${example}”</li>`).join("");
  $("#reflection-prev").disabled = index === 0;
  $("#reflection-next span:first-child").textContent = index === state.reflection.steps.length - 1 ? "편지 만들기" : "다음 문장";
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
  if (state.reflection.step < state.reflection.steps.length - 1) {
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
  const loop = INTEGRATED_LOOPS[state.reflection.loopKey];
  const life = DOMAINS[loop.flourish].name;
  const awareness = DOMAINS[loop.awareness].name;
  const recipient = result?.name ? `${result.name}에게,` : "지금의 나에게,";
  const stateName = STATE_DATA[result?.stateKey]?.name || "성장 조건을 살피는 중";
  const writtenDate = new Intl.DateTimeFormat("ko-KR", { dateStyle: "long", timeZone: "Asia/Seoul" }).format(new Date());
  return `${recipient}

오늘 검사를 마치고, 지금의 나를 서두르지 않고 바라본다.
오늘의 성장 지도에 붙은 이름은 “${stateName}”. 점수보다 내가 살아온 실제 장면을 기억하려 한다.
내가 지금 함께 연결해 볼 것은 “${loop.label}”. 내 삶의 ${life} 영역을 ${awareness}의 손잡이로 다뤄 보려 한다.

내 ${life} 영역이 조금 살아나는 순간
${answers[0]}

그 영역이 흐려질 때 몸과 감정이 보내는 신호
${answers[1]}

그때 가장 먼저 떠오르는 말
“${answers[2]}”

그 말 뒤에 나도 모르게 반복하는 행동
${answers[3]}

이제는 안다. 그때 내게 정말 필요했던 것은
${answers[4]}

${awareness}의 관점으로 다시 보니 놓치고 있던 것
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
  state.reflection.step = state.reflection.steps.length - 1;
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
  const didSave = saveLetterRecord({
    resultId: resultRecordKey(state.result),
    resultCreatedAt: state.result.createdAt,
    savedAt: state.reflection.savedAt,
    loopKey: state.reflection.loopKey,
    answers: [...state.reflection.answers],
    letter
  });
  if (!didSave) {
    showToast("저장 공간을 확인해 주세요. 편지 내용은 현재 화면에 남아 있습니다");
    return;
  }
  state.reflection.mode = "complete";
  renderReflection();
  scrollToReflection();
  showToast("편지를 저장했습니다. 오늘의 검사를 마칩니다");
}

function copyLetter() {
  const visibleDraft = state.reflection.mode === "letter" ? $("#self-letter").value.trim() : "";
  const letter = visibleDraft || state.reflection.letter;
  if (!letter) return;
  copyText(letter, "나에게 보내는 편지를 복사했습니다");
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

function renderBridge(result, loopKey) {
  const loop = INTEGRATED_LOOPS[loopKey];
  $("#bridge-copy").textContent = `${loop.label} 연결을 점수가 아니라 자신의 실제 장면으로 확인하는 질문입니다. 답이 추상적이면 최근 일주일의 한 순간으로 더 작게 좁혀 보세요.`;
  $("#coaching-questions").innerHTML = loop.questions.map((question, i) => `<div class="coaching-question"><span>Q${i + 1}</span><p>${question}</p></div>`).join("");
}

function renderFocusOptions(result, initialKey) {
  const select = $("#focus-select");
  select.innerHTML = Object.keys(INTEGRATED_LOOPS).map((key) => `<option value="${key}" ${key === initialKey ? "selected" : ""}>${INTEGRATED_LOOPS[key].label} · ${loopScore(result, key).toFixed(1)}</option>`).join("");
  select.onchange = () => selectIntegratedLoop(select.value, false);
  renderExperiment(initialKey);
}

function renderExperiment(key) {
  const loop = INTEGRATED_LOOPS[key];
  $("#experiment-title").textContent = loop.experiment.title;
  $("#experiment-action").textContent = loop.experiment.action;
  $("#experiment-notice").textContent = loop.experiment.notice;
  $("#experiment-choice").textContent = loop.experiment.choice;
  $("#experiment-question").textContent = loop.experiment.observe;
}

function selectIntegratedLoop(key, shouldScroll = true) {
  if (!INTEGRATED_LOOPS[key] || !state.result) return;
  const reflectionHasContent = state.reflection.answers.some((answer) => String(answer).trim()) || ["letter", "complete"].includes(state.reflection.mode);
  if (reflectionHasContent && key !== state.reflection.loopKey) {
    $("#focus-select").value = state.reflection.loopKey;
    showToast("문장과 편지의 일관성을 위해 작성 시작 후에는 적용 초점을 바꿀 수 없습니다");
    return;
  }
  state.result.selectedLoopKey = key;
  $("#focus-select").value = key;
  renderExperiment(key);
  renderBridge(state.result, key);
  $$(".integrated-loop-card").forEach((card) => {
    const button = card.querySelector("[data-loop-key]");
    const isSelected = button?.dataset.loopKey === key;
    card.classList.toggle("selected", isSelected);
    button?.setAttribute("aria-pressed", String(isSelected));
  });
  if (["intro", "writing"].includes(state.reflection.mode) && !reflectionHasContent) {
    state.reflection.loopKey = key;
    state.reflection.steps = buildReflectionSteps(key);
    renderReflectionFocus();
    if (state.reflection.mode === "writing") renderReflectionStep();
  }
  if (shouldScroll) $(".experiment-section").scrollIntoView({ behavior: "smooth", block: "start" });
}

function applyPrimaryLoop() {
  selectIntegratedLoop(state.result?.primaryLoopKey);
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
  const loopKey = r.selectedLoopKey || r.primaryLoopKey;
  const selectedLoop = INTEGRATED_LOOPS[loopKey];
  const summary = `[플로리싱 × 알아차림 성장지도]\n${r.name ? `${r.name} · ` : ""}${contextLabel(r.context)}\n현재 상태: ${STATE_DATA[r.stateKey].name}\n삶의 플로리싱 ${r.flourish.toFixed(1)} / 알아차림 역량 ${r.awareness.toFixed(1)}\n현재 선택한 통합 성장 루프: ${selectedLoop.label} · ${loopScore(r, loopKey).toFixed(1)}\n실제 장면: ${selectedLoop.scene}\n알아차릴 것: ${selectedLoop.notice}\n작은 선택: ${selectedLoop.action}\n\n이 결과는 진단이 아닌 성장 대화용 자기점검입니다.`;
  copyText(summary, "결과 요약을 복사했습니다");
}

async function copyText(text, successMessage) {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
    } else {
      const helper = document.createElement("textarea");
      helper.value = text;
      helper.setAttribute("readonly", "");
      helper.style.position = "fixed";
      helper.style.opacity = "0";
      document.body.appendChild(helper);
      helper.select();
      const copied = document.execCommand?.("copy");
      helper.remove();
      if (!copied) throw new Error("copy unavailable");
    }
    showToast(successMessage);
  } catch {
    showToast("자동 복사가 제한되었습니다. 텍스트를 직접 선택해 복사해 주세요");
  }
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
  const trigger = event.target.closest("[data-action]");
  const action = trigger?.dataset.action;
  if (!action) return;
  if (action === "choose-loop") {
    selectIntegratedLoop(trigger.dataset.loopKey);
    return;
  }
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
    "print-letter": printLetter,
    "apply-primary-loop": applyPrimaryLoop
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
  const activeInput = document.activeElement;
  if (!$("#test-view").hidden && /^[1-7]$/.test(event.key) && activeInput?.matches?.(".scale input")) {
    const target = document.querySelector(`input[name="${activeInput.name}"][value="${event.key}"]`);
    if (target) { target.checked = true; target.dispatchEvent(new Event("change", { bubbles: true })); }
  }
});

updateHistoryCount();
