/**
 * TALK CARD 180 v2.0 theme registry.
 * A01 DATA MODEL — names are locked to the 12 legacy themes.
 */
export const THEMES = [
  {
    "id": "ice",
    "code": "T01",
    "label": "가볍게 인사",
    "type": "text",
    "method": "QUESTION",
    "cardCount": 15,
    "legacyOrder": 1,
    "productOrder": 1,
    "description": "부담 없이 말문을 여는 가벼운 질문"
  },
  {
    "id": "taste",
    "code": "T02",
    "label": "취향·감각",
    "type": "text",
    "method": "QUESTION",
    "cardCount": 15,
    "legacyOrder": 2,
    "productOrder": 2,
    "description": "좋아하는 것과 감각의 차이를 발견하는 질문"
  },
  {
    "id": "lately",
    "code": "T03",
    "label": "요즘 뭐하나요",
    "type": "text",
    "method": "QUESTION",
    "cardCount": 15,
    "legacyOrder": 3,
    "productOrder": 3,
    "description": "지금의 생활과 관심사를 나누는 질문"
  },
  {
    "id": "talk",
    "code": "T04",
    "label": "대화 습관",
    "type": "text",
    "method": "QUESTION",
    "cardCount": 15,
    "legacyOrder": 5,
    "productOrder": 4,
    "description": "서로 다른 말하기와 듣기 방식을 알아보는 질문"
  },
  {
    "id": "work",
    "code": "T05",
    "label": "일·성장",
    "type": "text",
    "method": "QUESTION",
    "cardCount": 15,
    "legacyOrder": 6,
    "productOrder": 5,
    "description": "일하는 방식과 성장의 방향을 돌아보는 질문"
  },
  {
    "id": "value",
    "code": "T06",
    "label": "가치·기준",
    "type": "text",
    "method": "QUESTION",
    "cardCount": 15,
    "legacyOrder": 8,
    "productOrder": 6,
    "description": "선택을 이끄는 기준과 소중한 것을 나누는 질문"
  },
  {
    "id": "courage",
    "code": "T07",
    "label": "용기·도전",
    "type": "text",
    "method": "QUESTION",
    "cardCount": 15,
    "legacyOrder": 9,
    "productOrder": 7,
    "description": "작은 시도와 다음 한 걸음을 꺼내는 질문"
  },
  {
    "id": "tmi",
    "code": "T08",
    "label": "인간미(TMI)",
    "type": "text",
    "method": "QUESTION",
    "cardCount": 15,
    "legacyOrder": 10,
    "productOrder": 8,
    "description": "사소하지만 나다운 면을 즐겁게 나누는 질문"
  },
  {
    "id": "memory",
    "code": "I01",
    "label": "기억 한 조각",
    "type": "image",
    "method": "SCENE",
    "cardCount": 15,
    "legacyOrder": 4,
    "productOrder": 9,
    "assetDirectory": "assets/images/memory",
    "description": "장면을 보며 자신의 기억과 경험을 떠올리는 이미지 덱"
  },
  {
    "id": "recharge",
    "code": "I02",
    "label": "충전·회복",
    "type": "image",
    "method": "EMOTION",
    "cardCount": 15,
    "legacyOrder": 7,
    "productOrder": 10,
    "assetDirectory": "assets/images/recharge",
    "description": "색·형태·공간·질감으로 현재 상태를 표현하는 이미지 덱"
  },
  {
    "id": "future",
    "code": "I03",
    "label": "미래 상상",
    "type": "image",
    "method": "METAPHOR",
    "cardCount": 15,
    "legacyOrder": 11,
    "productOrder": 11,
    "assetDirectory": "assets/images/future",
    "description": "상징적 장면으로 가능성과 방향을 이야기하는 이미지 덱"
  },
  {
    "id": "kind",
    "code": "I04",
    "label": "서로에게 따뜻",
    "type": "image",
    "method": "RELATION",
    "cardCount": 15,
    "legacyOrder": 12,
    "productOrder": 12,
    "assetDirectory": "assets/images/kind",
    "description": "거리·위치·방향을 보며 관계를 자연스럽게 이야기하는 이미지 덱"
  }
];

export const THEME_BY_ID = Object.freeze(
  Object.fromEntries(THEMES.map((theme) => [theme.id, theme]))
);
