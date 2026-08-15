(function () {
  "use strict";

  const VERSION = "2.3";
  const PROGRESS_KEY = "dailycoaching.myvoice.v2.3.progress";
  const NOTES_KEY = "dailycoaching.myvoice.v2.3.notes";
  const SCALE_VALUES = [1, 2, 3, 4, 5, 6, 7];
  const SCALE_WORDS = ["전혀 아니다", "아니다", "약간 아니다", "보통", "약간 그렇다", "그렇다", "매우 그렇다"];
  const FLOW_VERSION = "5-plus-1";

  const CONTEXTS = [
    "발표",
    "면접",
    "자기소개",
    "회의·의견발표",
    "일상대화",
    "즉흥질문",
    "설득·반대의견",
    "아직 잘 모르겠다"
  ];

  const CONTEXT_HINTS = {
    "발표": "최근 발표 장면을 떠올리며",
    "면접": "면접관의 질문을 마주한 순간을 떠올리며",
    "자기소개": "처음 나를 소개하는 순간을 떠올리며",
    "회의·의견발표": "회의에서 의견을 꺼내는 순간을 떠올리며",
    "일상대화": "누군가와 대화를 이어가던 순간을 떠올리며",
    "즉흥질문": "예상하지 못한 질문을 받은 순간을 떠올리며",
    "설득·반대의견": "다른 의견과 마주한 순간을 떠올리며",
    "아직 잘 모르겠다": "최근의 말하기 장면 하나를 떠올리며"
  };

  const CONTEXT_NEXT = {
    "발표": "다음 발표에서",
    "면접": "다음 면접에서",
    "자기소개": "다음 자기소개에서",
    "회의·의견발표": "다음 회의에서",
    "일상대화": "다음 대화에서",
    "즉흥질문": "다음 즉흥질문을 받았을 때",
    "설득·반대의견": "다음 반대의견을 마주했을 때",
    "아직 잘 모르겠다": "다음번 비슷한 상황에서"
  };

  const FACTORS = [
    {
      id: "confidence",
      code: "C",
      en: "CONFIDENCE",
      name: "말하기 자신감",
      short: "자신감",
      description: "긴장 속에서도 내 말을 시작하고 이어가는 힘",
      strength: "긴장이나 평가를 의식하는 순간에도 말할 내용을 붙잡고 시작하는 힘을 비교적 자주 사용하고 있습니다.",
      questions: [
        "사람들 앞에서 말을 시작할 때, 긴장하더라도 첫 문장을 꺼낼 수 있다.",
        "내 의견이 다른 사람과 다를 때에도 필요한 말은 분명하게 표현한다.",
        "실수할까 걱정되더라도 말할 기회를 지나치지 않는다.",
        "준비가 완벽하지 않아도 내가 아는 범위에서 말할 수 있다.",
        "여러 사람이 나를 바라봐도 전달할 내용에 다시 집중할 수 있다."
      ]
    },
    {
      id: "message",
      code: "M",
      en: "MESSAGE",
      name: "메시지 구성력",
      short: "메시지",
      description: "핵심을 고르고 이해하기 쉬운 흐름으로 만드는 힘",
      strength: "말하고 싶은 내용을 고르고 핵심과 설명을 연결하는 힘을 비교적 안정적으로 사용하고 있습니다.",
      questions: [
        "말하기 전에 가장 중요한 핵심을 한 문장으로 정리할 수 있다.",
        "설명할 때 시작·중간·마무리의 흐름을 만들 수 있다.",
        "상대가 기억해야 할 핵심과 보조 설명을 구분한다.",
        "말이 길어질 때 다시 요점으로 돌아올 수 있다.",
        "듣는 사람과 상황에 맞춰 표현과 예시를 고른다."
      ]
    },
    {
      id: "delivery",
      code: "DL",
      en: "DELIVERY",
      name: "전달력",
      short: "전달",
      description: "목소리·속도·쉼·강조로 메시지를 들리게 하는 힘",
      strength: "내용의 중요도를 목소리와 속도, 쉼으로 구분해 듣는 사람이 따라오도록 돕는 힘이 있습니다.",
      questions: [
        "중요한 문장을 속도와 강조로 구분해 말한다.",
        "상대가 듣기 편한 음량으로 말한다.",
        "문장과 문장 사이에 필요한 쉼을 둔다.",
        "긴장하더라도 발음과 문장 끝을 또렷하게 유지한다.",
        "표정과 제스처가 메시지를 자연스럽게 돕는다."
      ]
    },
    {
      id: "presence",
      code: "P",
      en: "PRESENCE",
      name: "스피치 존재감",
      short: "존재감",
      description: "시선·자세·표정으로 말하는 장면 안에 머무는 힘",
      strength: "말하는 장면에서 몸과 시선을 숨기기보다 메시지와 함께 머무는 힘을 비교적 잘 사용하고 있습니다.",
      questions: [
        "사람들의 시선을 피하기보다 필요한 만큼 마주본다.",
        "말하는 동안 자세가 비교적 안정되어 있다.",
        "공간과 청중을 의식하며 시선을 자연스럽게 나눈다.",
        "내 말투와 표정이 나답다고 느낀다.",
        "말할 때 존재를 숨기기보다 그 장면 안에 머문다."
      ]
    },
    {
      id: "interaction",
      code: "I",
      en: "INTERACTION",
      name: "대화 대응력",
      short: "상호작용",
      description: "상대의 반응을 듣고 내 말을 조율하는 힘",
      strength: "상대의 말과 반응을 읽으면서도 내 메시지를 놓치지 않고 대화를 조율하는 힘이 있습니다.",
      questions: [
        "상대의 표정과 반응을 보며 설명의 양과 방식을 조절한다.",
        "상대의 말을 끝까지 듣고 핵심을 확인한 뒤 답한다.",
        "반대의견을 들어도 방어하기 전에 상대의 의도를 살핀다.",
        "대화 중 질문을 사용해 서로의 이해를 확인한다.",
        "관계를 배려하면서도 내 의견을 분명하게 말한다."
      ]
    },
    {
      id: "recovery",
      code: "R",
      en: "RECOVERY",
      name: "즉흥·회복력",
      short: "회복력",
      description: "예상 밖의 순간에도 다시 생각하고 이어가는 힘",
      strength: "예상과 다른 질문이나 실수 뒤에도 지금 할 수 있는 말을 찾아 흐름으로 돌아오는 힘이 있습니다.",
      questions: [
        "예상하지 못한 질문에도 잠시 생각한 뒤 아는 범위에서 답한다.",
        "말이 막히면 다른 표현으로 다시 시작할 수 있다.",
        "한 번 실수한 뒤에도 다음 문장에 집중할 수 있다.",
        "질문을 정확히 이해하지 못하면 의도를 다시 물을 수 있다.",
        "준비한 흐름이 흔들려도 핵심을 되짚어 이어갈 수 있다."
      ]
    }
  ];

  const SCENES = [
    {
      id: "scene-1",
      title: "발표를 시작하기까지 30초가 남았습니다. 나는 무엇을 가장 먼저 점검할까요?",
      options: [
        { style: "D", text: "결론과 청중에게 바라는 행동부터 다시 잡는다." },
        { style: "I", text: "청중의 반응을 끌어낼 첫 장면이나 이야기를 떠올린다." },
        { style: "S", text: "청중이 편안하게 따라올 수 있도록 호흡과 말투를 가다듬는다." },
        { style: "C", text: "말할 순서와 근거가 정확한지 마지막으로 확인한다." }
      ]
    },
    {
      id: "scene-2",
      title: "회의에서 갑자기 의견을 요청받았습니다. 나와 가장 가까운 반응은 무엇일까요?",
      options: [
        { style: "D", text: "핵심 판단과 결론을 먼저 짧게 말한다." },
        { style: "I", text: "떠오르는 예시와 아이디어를 연결하며 말한다." },
        { style: "S", text: "앞선 의견을 충분히 듣고 공통점부터 말한다." },
        { style: "C", text: "필요한 정보를 확인한 뒤 논리적인 순서로 말한다." }
      ]
    },
    {
      id: "scene-3",
      title: "처음 만난 사람에게 나를 소개합니다. 무엇을 중심으로 말할까요?",
      options: [
        { style: "D", text: "현재 맡은 역할과 만들어낸 결과를 중심으로 말한다." },
        { style: "I", text: "내가 좋아하는 일과 에너지가 생기는 지점을 이야기한다." },
        { style: "S", text: "함께 있을 때 어떤 사람인지 편안하게 설명한다." },
        { style: "C", text: "경험과 전문성을 흐름에 맞춰 차분히 정리한다." }
      ]
    },
    {
      id: "scene-4",
      title: "상대가 내 의견에 반대합니다. 나는 대화를 어떻게 이어갈까요?",
      options: [
        { style: "D", text: "내 입장과 이유를 더 분명하게 제시한다." },
        { style: "I", text: "분위기가 굳지 않도록 표현을 부드럽게 바꾼다." },
        { style: "S", text: "관계가 상하지 않도록 서로 같은 부분부터 찾는다." },
        { style: "C", text: "쟁점과 근거를 나누어 무엇이 다른지 확인한다." }
      ]
    },
    {
      id: "scene-5",
      title: "예상하지 못한 질문을 받았고 뜻이 조금 모호합니다. 나는 무엇을 할까요?",
      options: [
        { style: "D", text: "질문의 의도를 한 문장으로 확인하고 바로 답한다." },
        { style: "I", text: "질문자와 대화를 주고받으며 생각을 이어간다." },
        { style: "S", text: "질문자의 맥락을 더 듣고 안정적으로 답을 찾는다." },
        { style: "C", text: "질문의 범위와 기준을 명확히 다시 묻는다." }
      ]
    },
    {
      id: "scene-6",
      title: "말하는 중 문장이 꼬였습니다. 가장 자연스럽게 할 행동은 무엇일까요?",
      options: [
        { style: "D", text: "핵심이 무엇인지 한 문장으로 다시 잡는다." },
        { style: "I", text: "가볍게 웃고 자연스럽게 다음 흐름으로 이어간다." },
        { style: "S", text: "호흡을 고르고 천천히 다시 말한다." },
        { style: "C", text: "잘못 표현한 부분을 정확하게 고쳐 말한다." }
      ]
    }
  ];

  const STYLE_META = {
    D: {
      name: "DIRECT",
      ko: "핵심주도형",
      description: "핵심과 방향을 빠르게 잡고 분명하게 말하는 경향입니다. 상대가 따라올 시간과 이해를 확인할 때 이 힘이 더 선명해집니다."
    },
    I: {
      name: "ENGAGING",
      ko: "관여확장형",
      description: "이야기와 에너지로 사람을 말 안으로 끌어들이는 경향입니다. 기억해야 할 한 문장을 남길 때 풍성함이 메시지가 됩니다."
    },
    S: {
      name: "STEADY",
      ko: "안정공감형",
      description: "상대가 편안하도록 듣고 관계의 온도를 살피는 경향입니다. 배려와 함께 내 의견의 첫 문장을 분명히 둘 때 존재감이 살아납니다."
    },
    C: {
      name: "STRUCTURED",
      ko: "정확구조형",
      description: "내용을 정확히 이해하고 논리적인 순서로 말하려는 경향입니다. 충분히 좋은 답을 허용할 때 구조와 자연스러움을 함께 사용할 수 있습니다."
    }
  };

  const QUESTION_BANK = {
    confidence: {
      notice: [
        "사람들 앞에서 말을 시작하기 직전 나는 무엇을 가장 많이 의식하고 있을까?",
        "말하고 싶은 것이 있는데도 멈추는 순간에는 어떤 생각이 가장 먼저 떠오를까?"
      ],
      explore: [
        "내가 확신이 있을 때와 없을 때 말하는 방식은 어떻게 달라질까?",
        "잘 말해야 한다는 생각이 없다면 지금보다 어떤 말을 더 할 수 있을까?"
      ],
      choose: [
        "다음에는 완벽하게 말하는 것보다 무엇을 분명하게 말해보고 싶은가?",
        "다음번에는 첫 문장을 어떻게 시작하면 조금 더 편하게 말할 수 있을까?"
      ]
    },
    message: {
      notice: [
        "내가 말을 길게 할 때 정작 가장 하고 싶은 말은 무엇일까?",
        "내 이야기를 듣는 사람이 가장 자주 놓칠 수 있는 부분은 무엇일까?"
      ],
      explore: [
        "내가 설명을 많이 하는 이유는 전달하기 위해서일까, 빠뜨리지 않기 위해서일까?",
        "내가 하고 싶은 말을 한 문장으로 줄이기 어려운 이유는 무엇일까?"
      ],
      choose: [
        "상대가 내 말에서 딱 하나만 기억한다면 어떤 문장이었으면 좋을까?",
        "다음번에는 무엇을 덜 말해야 오히려 내 메시지가 더 선명해질까?"
      ]
    },
    delivery: {
      notice: [
        "중요한 말을 할수록 내 목소리와 속도는 어떻게 달라질까?",
        "내가 말할 때 상대가 가장 듣기 어려워할 수 있는 부분은 무엇일까?"
      ],
      explore: [
        "내가 빨리 말하게 되는 순간에는 무엇을 서두르고 있을까?",
        "내 목소리를 더 크게 만드는 것과 더 잘 전달하는 것은 어떻게 다를까?"
      ],
      choose: [
        "다음번 말하기에서 속도·쉼·강조 중 하나만 바꾼다면 무엇을 선택하고 싶은가?",
        "내가 정말 중요한 문장을 말할 때 어떻게 들리게 만들고 싶은가?"
      ]
    },
    presence: {
      notice: [
        "사람들이 나를 바라볼 때 나는 말보다 무엇을 더 의식하고 있을까?",
        "말하는 동안 내 몸은 내 메시지를 돕고 있을까, 방해하고 있을까?"
      ],
      explore: [
        "사람들의 시선을 평가가 아니라 듣고 있다는 신호로 본다면 무엇이 달라질까?",
        "내가 가장 자연스럽게 말했던 순간에는 자세와 표정이 어떠했을까?"
      ],
      choose: [
        "다음번에는 사람들에게 어떻게 보일지보다 무엇을 전달하는 데 집중하고 싶은가?",
        "다음 스피치에서 시선·자세·표정 중 하나만 의식한다면 무엇을 선택할까?"
      ]
    },
    interaction: {
      notice: [
        "상대의 반응이 달라지는 순간 내 말도 어떻게 달라질까?",
        "상대의 말을 듣는 동안 나는 내 다음 말을 준비하고 있을까, 정말 듣고 있을까?"
      ],
      explore: [
        "상대에게 이해받는 것과 상대를 설득하는 것은 나에게 어떻게 다를까?",
        "상대가 반대할 때 내가 가장 먼저 지키려고 하는 것은 무엇일까?"
      ],
      choose: [
        "다음 대화에서는 상대에게 어떤 질문을 하나 더 해보고 싶은가?",
        "상대를 존중하면서도 내 의견을 더 분명하게 말하려면 첫 문장을 어떻게 시작할까?"
      ]
    },
    recovery: {
      notice: [
        "말이 막히는 순간 나는 실제로 무엇을 두려워하고 있을까?",
        "한번 실수한 뒤 내 머릿속에서는 어떤 일이 일어날까?"
      ],
      explore: [
        "완벽한 답을 찾으려 하지 않는다면 지금 알고 있는 것만으로 무엇을 말할 수 있을까?",
        "준비된 상황에서는 할 수 있는 것을 즉흥 상황에서는 왜 사용하기 어려울까?"
      ],
      choose: [
        "다음에 말이 막히면 포기하지 않고 다시 시작하기 위해 무엇을 해볼 수 있을까?",
        "예상하지 못한 질문을 받았을 때 나에게 허용하고 싶은 시간은 몇 초일까?"
      ]
    }
  };

  const STYLE_QUESTION_BANK = {
    D: {
      questions: [
        "결론을 빨리 말하는 힘이 상대가 따라올 시간을 줄이고 있지는 않을까?",
        "내가 분명하게 말하면서도 상대가 충분히 이해하도록 돕기 위해 무엇을 더할 수 있을까?",
        "내가 이 대화에서 이기고 싶은 것과 전달하고 싶은 것은 같은 것일까?"
      ],
      action: "다음 대화에서 결론을 말한 뒤 상대가 따라올 수 있도록 무엇을 한 가지 더해볼까?"
    },
    I: {
      questions: [
        "내가 재미있게 말하는 동안 상대가 기억해야 할 핵심도 선명하게 남고 있을까?",
        "분위기가 좋지 않을 때에도 나는 내 메시지를 유지할 수 있을까?",
        "이야기를 조금 덜어낸다면 오히려 어떤 메시지가 더 살아날까?"
      ],
      action: "다음 말하기에서 이야기를 하나 덜어내고 핵심을 한 문장으로 남긴다면 무엇이라고 말할까?"
    },
    S: {
      questions: [
        "상대를 배려하면서 내가 말하지 않고 지나치는 것은 무엇일까?",
        "상대가 편안한 것만큼 내 의견이 분명하게 전달되는 것도 중요하다면 무엇을 바꿀까?",
        "내 의견을 먼저 말한다고 해서 관계가 반드시 불편해질까?"
      ],
      action: "상대를 배려하면서도 내 의견을 먼저 말한다면 첫 문장을 어떻게 시작할까?"
    },
    C: {
      questions: [
        "충분히 좋은 답과 완벽한 답 사이에서 나는 얼마나 오래 머물고 있을까?",
        "정확성을 조금 내려놓으면 내 말에 어떤 자연스러움이 생길까?",
        "모든 내용을 설명하지 않아도 된다면 가장 먼저 말할 핵심은 무엇일까?"
      ],
      action: "완벽한 답이 아니라 지금 전달하기에 충분한 답을 한다면 무엇이라고 말할까?"
    }
  };

  const STYLE_ACTION = Object.fromEntries(
    Object.entries(STYLE_QUESTION_BANK).map(function (entry) {
      return [entry[0], entry[1].action];
    })
  );

  const ACTION_ASSISTS = [
    { label: "생각할 시간 갖기", text: "바로 말하지 않고 3초 생각한다." },
    { label: "핵심부터 말하기", text: "결론을 한 문장으로 먼저 말한다." },
    { label: "천천히 말하기", text: "첫 문장의 속도를 의식적으로 낮춘다." },
    { label: "다시 시작하기", text: "말이 꼬여도 처음부터 다시 하지 않고 이어간다." },
    { label: "질문하기", text: "상대에게 질문의 의도를 한번 확인한다." }
  ];

  function defaultState() {
    return {
      flowVersion: FLOW_VERSION,
      stage: "intro",
      context: "",
      factorPage: 0,
      scenePage: 0,
      factorAnswers: {},
      sceneRanks: {},
      result: null,
      questionOptions: [],
      selectedQuestion: null,
      myAnswer: "",
      moment: "",
      nextVoice: "",
      answeredQuestionIds: [],
      assistOpen: false,
      previousSnapshot: latestNote(),
      startedAt: null,
      completedAt: null
    };
  }

  function loadJSON(key, fallback) {
    try {
      const value = localStorage.getItem(key);
      return value ? JSON.parse(value) : fallback;
    } catch (_) {
      return fallback;
    }
  }

  function latestNote() {
    const notes = loadJSON(NOTES_KEY, []);
    return Array.isArray(notes) && notes.length ? notes[notes.length - 1] : null;
  }

  function loadState() {
    const saved = loadJSON(PROGRESS_KEY, null);
    if (!saved || typeof saved !== "object") return defaultState();
    const restored = Object.assign(defaultState(), saved, {
      factorAnswers: saved.factorAnswers || {},
      sceneRanks: saved.sceneRanks || {},
      answeredQuestionIds: saved.answeredQuestionIds || []
    });
    if (saved.flowVersion !== FLOW_VERSION && ["questions", "scenes"].includes(restored.stage)) {
      const legacyScaleMap = { 1: 1, 2: 3, 3: 4, 4: 6, 5: 7 };
      Object.keys(restored.factorAnswers).forEach(function (id) {
        const legacyValue = Number(restored.factorAnswers[id]);
        if (legacyScaleMap[legacyValue]) restored.factorAnswers[id] = legacyScaleMap[legacyValue];
      });
      for (let index = 0; index < FACTORS.length; index += 1) {
        const factor = FACTORS[index];
        const factorComplete = factor.questions.every(function (_, questionIndex) {
          return SCALE_VALUES.includes(Number(restored.factorAnswers[`${factor.id}-${questionIndex}`]));
        });
        const sceneComplete = (restored.sceneRanks[SCENES[index].id] || []).length === 4;
        restored.factorPage = index;
        restored.scenePage = index;
        restored.stage = factorComplete ? "scenes" : "questions";
        if (!factorComplete || !sceneComplete) break;
      }
    }
    restored.flowVersion = FLOW_VERSION;
    return restored;
  }

  let state = loadState();
  let toastTimer = null;
  const app = document.getElementById("app");

  function escapeHTML(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function nl2br(value) {
    return escapeHTML(value).replace(/\n/g, "<br />");
  }

  function saveState() {
    try {
      localStorage.setItem(PROGRESS_KEY, JSON.stringify(state));
    } catch (_) {
      // The experience remains usable even when browser storage is unavailable.
    }
  }

  function showToast(message) {
    let toast = document.querySelector(".toast");
    if (!toast) {
      toast = document.createElement("div");
      toast.className = "toast";
      toast.setAttribute("role", "status");
      document.body.appendChild(toast);
    }
    toast.textContent = message;
    toast.classList.add("is-visible");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () {
      toast.classList.remove("is-visible");
    }, 2200);
  }

  function go(stage, extras) {
    state = Object.assign({}, state, extras || {}, { stage: stage });
    saveState();
    render(true);
  }

  function factorById(id) {
    return FACTORS.find(function (factor) { return factor.id === id; });
  }

  function progressValue() {
    if (state.stage === "questions" || state.stage === "scenes") {
      const round = state.stage === "questions" ? state.factorPage : state.scenePage;
      const step = round * 2 + (state.stage === "scenes" ? 1 : 0);
      return 8 + (step / (FACTORS.length * 2)) * 67;
    }
    const stages = {
      intro: 0,
      results: 78,
      questionSelect: 84,
      coachingAnswer: 89,
      coachingMoment: 93,
      coachingChoose: 97,
      note: 100
    };
    return Math.max(0, Math.min(100, stages[state.stage] || 0));
  }

  function headerHTML() {
    const canReset = state.stage !== "intro";
    return `
      <header class="site-header">
        <div class="header-inner">
          <a class="brand-lockup" href="https://daily-coach-ing.com/" aria-label="DAILYCOACHING 홈으로 이동">
            <span class="brand-mark" aria-hidden="true">MY</span>
            <span>
              <span class="brand-name">MY VOICE</span>
              <span class="brand-sub">DAILYCOACHING</span>
            </span>
          </a>
          <div class="header-actions">
            <span class="version-chip">V ${VERSION}</span>
            ${canReset ? `<button class="utility-button" type="button" data-action="reset">처음부터</button>` : ""}
          </div>
        </div>
      </header>
      <div class="progress-rail" aria-hidden="true"><div class="progress-fill" style="width:${progressValue()}%"></div></div>
    `;
  }

  function footerHTML() {
    return `
      <footer class="site-footer">
        <strong>DAILYCOACHING</strong><br />
        문제보다 존재 · 답보다 질문 · 변화보다 성장
      </footer>
    `;
  }

  function roundIndicatorHTML(round, phase) {
    const factor = FACTORS[round];
    const isScene = phase === "scene";
    const currentStep = round * 2 + (isScene ? 2 : 1);
    return `
      <section class="round-indicator" aria-label="검사 진행 ${currentStep} / 12">
        <div class="round-indicator-copy">
          <span>ASSESSMENT FLOW</span>
          <strong>ROUND ${String(round + 1).padStart(2, "0")} <small>/ 06</small></strong>
          <em>${escapeHTML(factor.name)} · ${isScene ? "장면 질문" : "5개 문항"}</em>
        </div>
        <div class="round-progress-group">
          <div class="round-markers" role="progressbar" aria-valuemin="1" aria-valuemax="12" aria-valuenow="${currentStep}">
            ${FACTORS.map(function (_, index) {
              const questionState = index < round || (index === round && isScene) ? "is-complete" : index === round ? "is-active" : "";
              const sceneState = index < round ? "is-complete" : index === round && isScene ? "is-active" : "";
              return `<span class="round-marker ${index === round ? "is-current" : ""}"><span class="marker-bars"><i class="${questionState}"></i><i class="${sceneState}"></i></span><b>${String(index + 1).padStart(2, "0")}</b></span>`;
            }).join("")}
          </div>
          <div class="round-key" aria-hidden="true"><span><i></i>5 SPEECH QUESTIONS</span><span><i></i>1 SCENE</span></div>
        </div>
      </section>
    `;
  }

  function introHTML() {
    return `
      <div class="site-shell">
        ${headerHTML()}
        <main id="main-content" class="screen">
          <section class="hero">
            <div class="hero-grid">
              <div>
                <p class="eyebrow on-dark">SPEECH AWARENESS · COACHING QUESTION ENGINE</p>
                <h1 class="display-title">MY<br />VOICE</h1>
                <p class="hero-emphasis">말을 잘하는지 평가하기보다<br />내가 어떻게 말하고 있는지 바라봅니다.</p>
                <p class="lead">스피치 문항 5개 뒤에 실제 장면 질문 1개가 이어집니다. 이 흐름을 여섯 번 지나 지금 나에게 가장 생각해볼 만한 질문 하나를 직접 선택합니다.</p>
                <div class="hero-actions">
                  <button class="button button-light button-arrow" type="button" data-action="jump-context">검사 시작하기</button>
                </div>
                <p class="privacy-note"><span class="privacy-dot" aria-hidden="true"></span>로그인 없이 이용하며, 답변은 이 기기에만 저장됩니다.</p>
              </div>
              <div class="hero-art" aria-hidden="true">
                <div class="voice-orbit"></div>
                <article class="voice-card">
                  <p class="card-kicker">A QUESTION FOR MY VOICE</p>
                  <div class="voice-lines"><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i></div>
                  <blockquote>“다음에는 무엇을<br />한 가지 다르게 말해볼까?”</blockquote>
                  <p class="hand-note">진단 → 알아차림 → 질문 → 선택</p>
                </article>
              </div>
            </div>
          </section>

          <section id="context" class="intro-body">
            <div class="intro-grid">
              <aside class="intro-aside">
                <p class="eyebrow">HOW IT WORKS</p>
                <h2 class="section-title">점수보다<br />질문이 남는 검사</h2>
                <ul class="experience-list">
                  <li><strong>01</strong><span>5개 문항과 1개 장면을 한 묶음으로 살핍니다.</span></li>
                  <li><strong>02</strong><span>나의 스피치 스타일을 보조 렌즈로 확인합니다.</span></li>
                  <li><strong>03</strong><span>세 질문 중 지금 마음에 걸리는 하나를 고릅니다.</span></li>
                  <li><strong>04</strong><span>실제 장면과 다음 행동을 MY VOICE NOTE에 남깁니다.</span></li>
                </ul>
              </aside>
              <div>
                <section class="panel">
                  <p class="panel-label">OPTIONAL CONTEXT</p>
                  <h3 class="panel-title">요즘 가장 신경 쓰이는<br />말하기 상황은 무엇인가요?</h3>
                  <p class="body-copy">점수에는 영향을 주지 않습니다. 결과 질문을 더 현실적인 장면의 언어로 바꾸는 데만 사용합니다.</p>
                  <div class="context-grid" role="group" aria-label="현재 신경 쓰이는 말하기 상황">
                    ${CONTEXTS.map(function (context) {
                      return `<button type="button" class="choice-tile ${state.context === context ? "is-selected" : ""}" data-action="context" data-context="${escapeHTML(context)}" aria-pressed="${state.context === context}"><span class="choice-dot" aria-hidden="true"></span>${escapeHTML(context)}</button>`;
                    }).join("")}
                  </div>
                  <div class="intro-start">
                    <button class="button button-primary button-arrow" type="button" data-action="start">MY VOICE 시작</button>
                    <span class="time-note">약 8–12분 · 정답 없음 · 자동 저장</span>
                  </div>
                </section>
                <p class="disclaimer">MY VOICE는 자기보고형 스피치 알아차림 도구이며, 심리검사·의학적 진단·역량 인증을 대신하지 않습니다.</p>
              </div>
            </div>
          </section>
        </main>
        ${footerHTML()}
      </div>
    `;
  }

  function questionsHTML() {
    const factor = FACTORS[state.factorPage];
    const answered = factor.questions.filter(function (_, index) {
      return Number.isFinite(Number(state.factorAnswers[`${factor.id}-${index}`]));
    }).length;
    const complete = answered === factor.questions.length;
    const startNumber = state.factorPage * 5 + 1;
    const endNumber = startNumber + 4;
    return `
      <div class="site-shell">
        ${headerHTML()}
        <main id="main-content" class="screen">
          <div class="screen-inner reading-width">
            ${roundIndicatorHTML(state.factorPage, "questions")}
            <div class="stage-head">
              <div>
                <p class="step-count">ROUND ${String(state.factorPage + 1).padStart(2, "0")} / 06 · QUESTIONS ${String(startNumber).padStart(2, "0")}–${String(endNumber).padStart(2, "0")}</p>
                <h1 class="screen-title">5개의 스피치 문항에<br />있는 그대로 답해주세요.</h1>
              </div>
              <p class="stage-help">잘해야 하는 나보다, 최근 실제 장면의 나와 가까운 답을 선택합니다.</p>
            </div>
            <section class="factor-banner" aria-labelledby="factor-title">
              <span class="factor-monogram">${factor.code}</span>
              <div>
                <h2 id="factor-title">${factor.name}</h2>
                <p>${factor.en} · ${factor.description}</p>
              </div>
            </section>
            <div class="question-list">
              ${factor.questions.map(function (question, index) {
                const id = `${factor.id}-${index}`;
                const current = Number(state.factorAnswers[id] || 0);
                const globalNo = state.factorPage * 5 + index + 1;
                return `
                  <article class="question-card">
                    <p class="question-number">${String(globalNo).padStart(2, "0")}</p>
                    <p class="question-text">${escapeHTML(question)}</p>
                    <div class="scale-options" role="radiogroup" aria-label="${escapeHTML(question)}">
                      ${SCALE_VALUES.map(function (value) {
                        return `<button type="button" class="scale-button ${current === value ? "is-selected" : ""}" role="radio" aria-checked="${current === value}" aria-label="${value}점 ${SCALE_WORDS[value - 1]}" data-action="factor-answer" data-id="${id}" data-value="${value}"><span class="scale-number">${value}</span><span class="scale-word">${SCALE_WORDS[value - 1]}</span></button>`;
                      }).join("")}
                    </div>
                    <div class="scale-legend"><span>1 · 나와 거리가 멀다</span><span>4 · 보통</span><span>7 · 나와 매우 가깝다</span></div>
                  </article>
                `;
              }).join("")}
            </div>
            <div class="action-bar">
              <span class="action-meta">이 영역 ${answered} / 5 응답</span>
              <div class="action-buttons">
                <button class="button button-ghost" type="button" data-action="factor-back">이전</button>
                <button class="button button-primary button-arrow" type="button" data-action="factor-next" ${complete ? "" : "disabled"}>장면 질문으로</button>
              </div>
            </div>
          </div>
        </main>
      </div>
    `;
  }

  function scenesHTML() {
    const scene = SCENES[state.scenePage];
    const ranking = state.sceneRanks[scene.id] || [];
    const complete = ranking.length === 4;
    const nextScore = 4 - ranking.length;
    return `
      <div class="site-shell scene-stage">
        ${headerHTML()}
        <main id="main-content" class="screen">
          <div class="screen-inner reading-width">
            ${roundIndicatorHTML(state.scenePage, "scene")}
            <div class="stage-head">
              <div>
                <p class="step-count">ROUND ${String(state.scenePage + 1).padStart(2, "0")} / 06 · SCENE QUESTION</p>
                <h1 class="screen-title">방금 살펴본 말하기 힘을<br />실제 장면에 연결해보세요.</h1>
              </div>
              <p class="stage-help">네 가지 모두 순서대로 선택합니다. 스타일은 말하기 결과를 돕는 보조 렌즈입니다.</p>
            </div>
            <section class="scene-card">
              <div class="scene-top">
                <p class="scene-number">SCENE ${String(state.scenePage + 1).padStart(2, "0")}</p>
                <h2 class="scene-title">${escapeHTML(scene.title)}</h2>
              </div>
              <div class="scene-body">
                <p class="ranking-guide">가장 나다운 반응부터 눌러주세요. ${complete ? "<strong>순위 선택을 완료했습니다.</strong>" : `<strong>지금 선택하면 ${nextScore}점</strong>이 됩니다.`}</p>
                <div class="rank-list">
                  ${scene.options.map(function (option) {
                    const position = ranking.indexOf(option.style);
                    const score = position >= 0 ? 4 - position : null;
                    return `<button type="button" class="rank-choice ${score ? "is-ranked" : ""}" data-action="rank" data-style="${option.style}" aria-pressed="${Boolean(score)}"><span class="rank-badge">${score || "+"}</span><span class="rank-copy">${escapeHTML(option.text)}</span></button>`;
                  }).join("")}
                </div>
                <button class="button button-ghost rank-reset" type="button" data-action="rank-reset" ${ranking.length ? "" : "hidden"}>이 장면 다시 선택</button>
              </div>
            </section>
            <div class="action-bar">
              <span class="action-meta">${complete ? "4·3·2·1 선택 완료" : `${ranking.length} / 4 선택`}</span>
              <div class="action-buttons">
                <button class="button button-ghost" type="button" data-action="scene-back">이전</button>
                <button class="button button-primary button-arrow" type="button" data-action="scene-next" ${complete ? "" : "disabled"}>${state.scenePage === SCENES.length - 1 ? "결과 보기" : "다음 5개 문항"}</button>
              </div>
            </div>
          </div>
        </main>
      </div>
    `;
  }

  function calculateResult() {
    const scores = {};
    FACTORS.forEach(function (factor) {
      const total = factor.questions.reduce(function (sum, _, index) {
        return sum + Number(state.factorAnswers[`${factor.id}-${index}`] || 0);
      }, 0);
      scores[factor.id] = Math.round(((total - 5) / 30) * 100);
    });
    const orderedFactors = FACTORS.slice().sort(function (a, b) {
      const delta = scores[b.id] - scores[a.id];
      return delta || FACTORS.indexOf(a) - FACTORS.indexOf(b);
    });
    const styleScores = { D: 0, I: 0, S: 0, C: 0 };
    SCENES.forEach(function (scene) {
      const ranking = state.sceneRanks[scene.id] || [];
      ranking.forEach(function (style, index) {
        styleScores[style] += 4 - index;
      });
    });
    const styleOrder = Object.keys(styleScores).sort(function (a, b) {
      const delta = styleScores[b] - styleScores[a];
      return delta || ["D", "I", "S", "C"].indexOf(a) - ["D", "I", "S", "C"].indexOf(b);
    });
    const overall = Math.round(Object.values(scores).reduce(function (sum, score) { return sum + score; }, 0) / FACTORS.length);
    return {
      date: new Date().toISOString(),
      scores: scores,
      overall: overall,
      strongest: orderedFactors[0].id,
      priority: orderedFactors[orderedFactors.length - 1].id,
      gap: scores[orderedFactors[0].id] - scores[orderedFactors[orderedFactors.length - 1].id],
      styleScores: styleScores,
      primaryStyle: styleOrder[0],
      secondaryStyle: styleOrder[1]
    };
  }

  function scoreState(score) {
    if (score >= 80) return "자주 활용하는 강점";
    if (score >= 60) return "비교적 안정적으로 쓰는 힘";
    if (score >= 40) return "상황에 따라 달라지는 힘";
    return "조금 더 살펴볼 만한 힘";
  }

  function gapInterpretation(result) {
    const strongest = factorById(result.strongest);
    const priority = factorById(result.priority);
    if (result.gap >= 20) {
      return {
        title: `${strongest.short}에서 가진 힘이 ${priority.short}이 필요한 순간에는 충분히 사용되지 않을 수 있습니다.`,
        copy: "이미 있는 능력을 다른 장면으로 가져오는 조건을 살펴볼 만합니다. 약점을 규정하기보다 능력이 멈추는 순간을 봅니다."
      };
    }
    if (result.gap >= 10) {
      return {
        title: `${strongest.short}과 ${priority.short} 사이에 상황에 따라 달라지는 패턴이 보입니다.`,
        copy: "고정된 약점이라기보다 익숙한 상황과 낯선 상황에서 쓰는 힘이 달라지는지 살펴볼 수 있습니다."
      };
    }
    return {
      title: "여섯 가지 말하기 힘 사이의 차이가 크지 않습니다.",
      copy: "특정 영역을 큰 약점으로 보지 않고, 실제 상황에 따라 어느 힘을 더 자주 쓰는지 살펴보는 편이 적절합니다."
    };
  }

  function questionIndex(seed) {
    const contextSeed = (state.context || "").length;
    return (Number(seed || 0) + contextSeed) % 2;
  }

  function gapQuestion(result) {
    const high = result.strongest;
    const low = result.priority;
    const primary = result.primaryStyle;
    const exact = {
      "message|confidence": "이미 할 말은 충분히 있는데 실제로 입 밖에 꺼내는 순간 무엇이 달라질까?",
      "message|recovery": "준비했을 때 보여주는 내 능력을 예상하지 못한 순간에는 왜 믿지 못할까?",
      "delivery|message": "내가 잘 들리게 말하는 것만큼 무엇을 남기며 말하고 싶은가?",
      "message|delivery": "좋은 내용을 가지고 있으면서도 그것이 충분히 전달되지 않는 이유는 무엇일까?",
      "interaction|confidence": "한 사람과 편하게 대화할 때의 나를 여러 사람 앞에서도 사용할 수 있다면 무엇이 달라질까?",
      "confidence|message": "말문은 쉽게 열리는데 끝나고 나서 핵심이 남지 않는 이유는 무엇일까?"
    };
    if (result.gap >= 20) {
      if (low === "presence") return "실제 말하기 능력보다 사람들에게 보이는 내 모습을 더 많이 평가하고 있지는 않을까?";
      if (exact[`${high}|${low}`]) return exact[`${high}|${low}`];
      if (low === "recovery" && primary === "C") return "정확한 답을 찾는 동안 지금 할 수 있는 답까지 놓치고 있지는 않을까?";
      if (low === "message" && primary === "I") return "이야기를 풍성하게 만드는 힘을 유지하면서 한 문장만 남긴다면 무엇을 말하고 싶은가?";
      if (low === "confidence" && primary === "S") return "상대가 어떻게 느낄지 생각하기 전에 내가 말하고 싶은 것은 무엇인가?";
      if (low === "interaction" && primary === "D") return "내 의견을 더 강하게 말하는 것보다 상대가 무엇을 듣고 있는지 확인한다면 무엇이 달라질까?";
      const highFactor = factorById(high);
      const lowFactor = factorById(low);
      return `${highFactor.short}에서 이미 쓰고 있는 힘을 ${lowFactor.short}이 필요한 순간에도 가져온다면 무엇이 달라질까?`;
    }
    const explore = QUESTION_BANK[low].explore;
    return explore[questionIndex(result.scores[low])];
  }

  function contextualizeQuestion(text) {
    const next = CONTEXT_NEXT[state.context || "아직 잘 모르겠다"];
    return text
      .replace("다음번 비슷한 상황에서", next)
      .replace("다음번 말하기에서", next)
      .replace("다음 스피치에서", next)
      .replace("다음 대화에서는", next)
      .replace("다음 대화에서", next)
      .replace("다음번에는", next)
      .replace("다음에는", next);
  }

  function generateQuestions(result) {
    const low = result.priority;
    const noticeBank = QUESTION_BANK[low].notice;
    const noticeText = noticeBank[questionIndex(result.scores[low])];
    return [
      {
        id: `notice-${low}-${questionIndex(result.scores[low])}`,
        role: "NOTICE",
        roleKo: "지금의 나를 알아차리기",
        text: contextualizeQuestion(noticeText)
      },
      {
        id: `explore-${result.strongest}-${low}-${result.primaryStyle}-${result.gap}`,
        role: "EXPLORE",
        roleKo: "말하기 패턴을 탐색하기",
        text: contextualizeQuestion(gapQuestion(result))
      },
      {
        id: `choose-${result.primaryStyle}`,
        role: "CHOOSE",
        roleKo: "다음 말하기를 선택하기",
        text: contextualizeQuestion(STYLE_ACTION[result.primaryStyle])
      }
    ];
  }

  function comparisonHTML(result) {
    const previous = state.previousSnapshot;
    if (!previous || !previous.result || !previous.result.scores) return "";
    const changes = FACTORS.map(function (factor) {
      const before = Number(previous.result.scores[factor.id] || 0);
      const now = Number(result.scores[factor.id] || 0);
      return { factor: factor, before: before, now: now, delta: now - before };
    });
    const rising = changes.slice().sort(function (a, b) { return b.delta - a.delta; })[0];
    const falling = changes.slice().sort(function (a, b) { return a.delta - b.delta; })[0];
    let summary = "여섯 영역의 점수 흐름이 이전과 같은 범위에 머물렀습니다.";
    if (rising.delta > 0 && falling.delta < 0) {
      summary = `가장 크게 높아진 영역은 ${rising.factor.name} +${rising.delta}점이며, 가장 낮아진 영역은 ${falling.factor.name} ${falling.delta}점입니다.`;
    } else if (rising.delta > 0) {
      summary = `가장 크게 높아진 영역은 ${rising.factor.name} +${rising.delta}점입니다.`;
    } else if (falling.delta < 0) {
      summary = `가장 크게 낮아진 영역은 ${falling.factor.name} ${falling.delta}점입니다.`;
    }
    return `
      <section class="comparison-panel" aria-labelledby="comparison-title">
        <p class="eyebrow">BEFORE → NOW → CHANGE</p>
        <h2 id="comparison-title" class="section-title">말하기 힘의<br />변화 흐름을 비교합니다.</h2>
        <div class="comparison-list">
          ${changes.map(function (change) {
            const cls = change.delta > 0 ? "up" : change.delta < 0 ? "down" : "same";
            const sign = change.delta > 0 ? "+" : "";
            return `<div class="comparison-row"><strong>${change.factor.name}</strong><span class="previous-value">이전 ${change.before} → 현재 ${change.now}</span><span class="delta ${cls}">${sign}${change.delta}</span></div>`;
          }).join("")}
        </div>
        <p class="change-summary">${escapeHTML(summary)}</p>
      </section>
    `;
  }

  function resultsHTML() {
    const result = state.result;
    const strongest = factorById(result.strongest);
    const priority = factorById(result.priority);
    const gap = gapInterpretation(result);
    const primary = STYLE_META[result.primaryStyle];
    const secondary = STYLE_META[result.secondaryStyle];
    return `
      <div class="site-shell">
        ${headerHTML()}
        <main id="main-content" class="screen">
          <section class="results-hero">
            <div class="screen-inner results-head">
              <div class="result-intro">
                <div>
                  <p class="eyebrow on-dark">MY SPEECH INDEX</p>
                  <h1 class="screen-title">말을 못하는 것이 아니라,<br />힘을 쓰는 순간이 다릅니다.</h1>
                  <p class="lead">이 결과는 능력의 판정표가 아닙니다. 최근의 내가 어떤 말하기 힘을 자주 쓰고, 어떤 장면에서 덜 쓰는지 보여주는 현재의 지도입니다.</p>
                </div>
                <div class="index-seal" aria-label="MY SPEECH INDEX ${result.overall}점">
                  <div class="index-seal-inner"><span class="index-label">MY SPEECH INDEX</span><strong class="index-number">${result.overall}</strong></div>
                </div>
              </div>
            </div>
          </section>
          <section class="results-body">
            <div class="screen-inner">
              <div class="result-sheet">
                <p class="eyebrow">SIX SPEECH FACTORS</p>
                <h2 class="section-title">여섯 가지 말하기 힘</h2>
                <div class="factor-grid" style="margin-top:24px">
                  ${FACTORS.map(function (factor) {
                    const score = result.scores[factor.id];
                    return `<article class="factor-result"><div class="factor-result-top"><div><span class="factor-result-name">${factor.name}</span><span class="factor-result-en">${factor.en}</span></div><strong class="factor-score">${score}</strong></div><div class="factor-bar" aria-hidden="true"><i style="width:${score}%"></i></div><p class="factor-state">${scoreState(score)}</p></article>`;
                  }).join("")}
                </div>

                <section class="result-section">
                  <p class="eyebrow">STRENGTH & TRAINING PRIORITY</p>
                  <h2 class="section-title">이미 잘 되는 것과<br />지금 연습해볼 것</h2>
                  <div class="insight-grid">
                    <article class="insight-card strength"><div><p class="insight-label">CURRENT STRENGTH</p><h3 class="insight-name">${strongest.name}</h3></div><p class="insight-desc">${strongest.strength}</p></article>
                    <article class="insight-card priority"><div><p class="insight-label">TRAINING PRIORITY</p><h3 class="insight-name">${priority.name}</h3></div><p class="insight-desc">능력이 없는 영역이 아니라, 상황에 따라 아직 충분히 사용하지 못할 수 있는 힘입니다.</p></article>
                  </div>
                  <article class="gap-card">
                    <div><p class="gap-label">SPEECH GAP</p><h3 class="gap-title">${gap.title}</h3><p class="gap-copy">${gap.copy}</p></div>
                    <div class="gap-number"><strong>${result.gap}</strong><span>영역 차이</span></div>
                  </article>
                </section>

                <section class="result-section">
                  <p class="eyebrow">MY SPEECH STYLE</p>
                  <h2 class="section-title">내용을 결정하는 주축이 아니라,<br />말하는 방식을 보는 보조 렌즈</h2>
                  <article class="style-panel">
                    <div class="style-codes">
                      <div class="style-code is-primary"><strong>${result.primaryStyle}</strong><span>PRIMARY</span></div>
                      <div class="style-code is-secondary"><strong>${result.secondaryStyle}</strong><span>SECONDARY</span></div>
                    </div>
                    <h3 class="style-name">${primary.name} / ${secondary.name}</h3>
                    <p class="style-desc"><strong>${primary.ko}</strong>의 말하기를 먼저 사용하고, <strong>${secondary.ko}</strong>의 반응이 그다음으로 나타납니다. ${primary.description}</p>
                  </article>
                </section>

                ${comparisonHTML(result)}

                <div class="disclaimer">점수는 최근 자기보고 응답을 0–100 범위로 환산한 값입니다. 사람의 가치나 고정된 능력을 의미하지 않으며, 상황과 경험에 따라 달라질 수 있습니다.</div>
                <div class="result-action">
                  <span class="action-meta">이제 결과를 질문으로 바꿉니다.</span>
                  <div class="action-buttons"><button class="button button-primary button-arrow" type="button" data-action="open-questions">질문 3개 만나기</button></div>
                </div>
              </div>
            </div>
          </section>
        </main>
        ${footerHTML()}
      </div>
    `;
  }

  function questionSelectHTML() {
    const options = state.questionOptions || [];
    const isFollowup = state.answeredQuestionIds.length > 0;
    return `
      <div class="site-shell">
        ${headerHTML()}
        <main id="main-content" class="screen">
          <div class="screen-inner">
            <div class="question-select-head">
              <p class="eyebrow">THREE QUESTIONS · NOTICE / EXPLORE / CHOOSE</p>
              <h1 class="screen-title">${isFollowup ? "질문 하나를 더 살펴보세요." : "이제 질문 하나를 선택해보세요."}</h1>
              <p class="question-instruction">${isFollowup ? "아직 선택하지 않은 질문입니다. 지금 다시 마음에 걸리는 질문 하나를 고르세요." : "당신의 결과를 바탕으로 세 가지 질문을 골랐습니다. 정답을 찾을 필요는 없습니다. 지금 가장 마음에 걸리는 질문 하나를 선택해주세요."}</p>
            </div>
            <div class="question-grid">
              ${options.map(function (question, index) {
                return `<button class="question-pick" type="button" data-action="select-question" data-id="${escapeHTML(question.id)}"><span class="question-role">QUESTION ${String(index + 1).padStart(2, "0")} · ${question.role}</span><span class="context-hint">${escapeHTML(CONTEXT_HINTS[state.context || "아직 잘 모르겠다"])}</span><span class="question-quote">«${escapeHTML(question.text)}»</span><span class="select-label">이 질문 선택하기</span></button>`;
              }).join("")}
            </div>
            <div class="action-bar"><span class="action-meta">질문은 사용자를 분석하지 않고 현재의 말하기를 보게 합니다.</span><div class="action-buttons"><button class="button button-ghost" type="button" data-action="questions-back">결과로 돌아가기</button></div></div>
          </div>
        </main>
        ${footerHTML()}
      </div>
    `;
  }

  function coachingHTML() {
    const question = state.selectedQuestion;
    const configs = {
      coachingAnswer: {
        step: "STEP 01 · MY ANSWER",
        title: "지금 떠오르는 생각을 적어보세요.",
        prompt: `«${question.text}»`,
        label: "정답을 찾지 말고, 지금 떠오르는 생각을 자유롭게 적어보세요.",
        placeholder: "한 문장도 충분합니다.",
        field: "myAnswer",
        value: state.myAnswer,
        next: "answer-next"
      },
      coachingMoment: {
        step: "STEP 02 · THE MOMENT",
        title: "생각을 실제 장면으로 가져옵니다.",
        prompt: "«최근 실제로 비슷했던 순간 하나를 떠올린다면 언제였나요?»",
        label: "누구와, 어디에서, 어떤 말을 하려던 순간이었는지 적어보세요.",
        placeholder: "예: 지난 회의에서 갑자기 의견을 물었을 때…",
        field: "moment",
        value: state.moment,
        next: "moment-next"
      },
      coachingChoose: {
        step: "STEP 03 · NEXT VOICE",
        title: "다음 말하기의 한 가지를 선택합니다.",
        prompt: "«그 장면이 다시 온다면 이번에는 무엇을 한 가지 다르게 해보고 싶나요?»",
        label: "작고 구체적으로 적을수록 다음 장면에서 떠올리기 쉽습니다.",
        placeholder: "예: 질문을 받은 뒤 바로 답하지 않고 3초 생각한다.",
        field: "nextVoice",
        value: state.nextVoice,
        next: "finish-note"
      }
    };
    const config = configs[state.stage];
    const canContinue = String(config.value || "").trim().length > 0;
    return `
      <div class="site-shell coach-stage">
        ${headerHTML()}
        <main id="main-content" class="screen">
          <div class="coach-layout">
            <p class="coach-step">${config.step}</p>
            <h1 class="screen-title">${config.title}</h1>
            <section class="coach-card">
              <p class="question-quote">${escapeHTML(config.prompt)}</p>
              <label class="input-label" for="coach-input">${config.label}</label>
              <textarea id="coach-input" class="coach-input" data-field="${config.field}" placeholder="${escapeHTML(config.placeholder)}">${escapeHTML(config.value || "")}</textarea>
              <div class="input-foot"><span>글자 수 제한 없음</span><span>답변은 이 기기에만 자동 저장됩니다.</span></div>
              ${state.stage === "coachingChoose" ? `
                <button class="assist-toggle" type="button" data-action="assist-toggle" aria-expanded="${state.assistOpen}">${state.assistOpen ? "행동 선택 보조 닫기" : "바로 떠오르지 않나요? 작은 선택지 보기"}</button>
                ${state.assistOpen ? `<div class="assist-panel"><p>처방이 아니라 생각을 돕는 보조 선택지입니다.</p><div class="assist-chips">${ACTION_ASSISTS.map(function (item) { return `<button class="assist-chip" type="button" data-action="assist" data-value="${escapeHTML(item.text)}">${escapeHTML(item.label)}</button>`; }).join("")}<button class="assist-chip" type="button" data-action="focus-input">내 방식 직접 적기</button></div></div>` : ""}
              ` : ""}
            </section>
            <div class="action-bar">
              <span class="action-meta">${state.stage === "coachingChoose" ? "이 답변이 MY VOICE NOTE의 NEXT VOICE가 됩니다." : "한 문장만 적어도 다음으로 갈 수 있습니다."}</span>
              <div class="action-buttons"><button class="button button-ghost" type="button" data-action="coach-back">이전</button><button class="button button-primary button-arrow" type="button" data-action="${config.next}" data-requires-input="true" ${canContinue ? "" : "disabled"}>${state.stage === "coachingChoose" ? "MY VOICE NOTE 만들기" : "다음 질문"}</button></div>
            </div>
          </div>
        </main>
      </div>
    `;
  }

  function formatDate(iso) {
    try {
      return new Intl.DateTimeFormat("ko-KR", { year: "numeric", month: "long", day: "numeric" }).format(new Date(iso));
    } catch (_) {
      return new Date().toLocaleDateString("ko-KR");
    }
  }

  function noteObject() {
    return {
      id: state.completedAt || new Date().toISOString(),
      version: VERSION,
      date: state.completedAt || new Date().toISOString(),
      context: state.context || "아직 잘 모르겠다",
      result: state.result,
      question: state.selectedQuestion,
      myAnswer: state.myAnswer,
      moment: state.moment,
      nextVoice: state.nextVoice
    };
  }

  function saveCompletedNote() {
    const note = noteObject();
    const notes = loadJSON(NOTES_KEY, []);
    const list = Array.isArray(notes) ? notes : [];
    if (!list.some(function (item) { return item.id === note.id; })) {
      list.push(note);
      try { localStorage.setItem(NOTES_KEY, JSON.stringify(list.slice(-50))); } catch (_) {}
    }
    return note;
  }

  function noteHTML() {
    const result = state.result;
    const strongest = factorById(result.strongest);
    const priority = factorById(result.priority);
    const primary = STYLE_META[result.primaryStyle];
    const secondary = STYLE_META[result.secondaryStyle];
    return `
      <div class="site-shell">
        ${headerHTML()}
        <main id="main-content" class="screen note-stage">
          <div class="note-wrap">
            <div class="note-topline">
              <div><p class="eyebrow">YOUR COACHING OUTPUT</p><h1 class="section-title">MY VOICE NOTE</h1></div>
              <div class="note-actions"><button class="button button-outline" type="button" data-action="download-note">텍스트 저장</button><button class="button button-primary" type="button" data-action="print-note">PDF로 인쇄</button></div>
            </div>
            <article class="note-paper" id="my-voice-note">
              <header class="note-header">
                <div><p class="note-label">DAILYCOACHING · MY VOICE V${VERSION}</p><h2 class="note-logo">MY VOICE NOTE</h2></div>
                <p class="note-date">${formatDate(state.completedAt)}<br />CONTEXT · ${escapeHTML(state.context || "아직 잘 모르겠다")}</p>
              </header>
              <section class="note-section">
                <p class="note-label">MY SPEECH</p>
                <div class="note-speech-grid">
                  <div class="note-speech-item"><span>현재 가장 강한 힘</span><strong>${strongest.name}</strong></div>
                  <div class="note-speech-item"><span>현재 연습 우선영역</span><strong>${priority.name}</strong></div>
                  <div class="note-speech-item"><span>MY SPEECH STYLE</span><strong>${primary.name} / ${secondary.name}</strong></div>
                  <div class="note-speech-item"><span>MY SPEECH INDEX</span><strong>${result.overall}</strong></div>
                </div>
                <div class="note-factor-list">
                  ${FACTORS.map(function (factor) { return `<div class="note-factor"><span>${factor.short}</span><strong>${result.scores[factor.id]}</strong></div>`; }).join("")}
                </div>
              </section>
              <section class="note-section"><p class="note-label">MY QUESTION</p><p class="note-text">«${escapeHTML(state.selectedQuestion.text)}»</p></section>
              <section class="note-section"><p class="note-label">MY ANSWER</p><p class="note-text">${nl2br(state.myAnswer)}</p></section>
              <section class="note-section"><p class="note-label">THE MOMENT</p><p class="note-text">${nl2br(state.moment)}</p></section>
              <section class="note-section"><div class="next-voice"><p class="note-label">NEXT VOICE</p><p class="note-text">«${nl2br(state.nextVoice)}»</p></div></section>
              <p class="note-closing">«다음에 말할 때, 오늘 선택한 한 가지를 기억해보세요.»</p>
            </article>
            <nav class="note-nav" aria-label="MY VOICE 다음 행동">
              <button class="button button-outline" type="button" data-action="result-again">결과 다시 보기</button>
              <button class="button button-outline" type="button" data-action="another-question">질문 하나 더 살펴보기</button>
              <button class="button button-primary" type="button" data-action="retest">나중에 다시 검사하기</button>
            </nav>
          </div>
        </main>
        ${footerHTML()}
      </div>
    `;
  }

  function render(scrollTop) {
    let html = "";
    if (state.stage === "intro") html = introHTML();
    else if (state.stage === "questions") html = questionsHTML();
    else if (state.stage === "scenes") html = scenesHTML();
    else if (state.stage === "results") html = resultsHTML();
    else if (state.stage === "questionSelect") html = questionSelectHTML();
    else if (["coachingAnswer", "coachingMoment", "coachingChoose"].includes(state.stage)) html = coachingHTML();
    else if (state.stage === "note") html = noteHTML();
    else {
      state = defaultState();
      html = introHTML();
    }
    app.innerHTML = html;
    document.title = state.stage === "note" ? "MY VOICE NOTE | DAILYCOACHING" : "MY VOICE | 스피치 알아차림 검사 · DAILYCOACHING";
    if (scrollTop) window.scrollTo({ top: 0, behavior: "auto" });
  }

  function refreshFactorUI(id, value) {
    const group = document.querySelector(`.scale-options [data-id="${id}"]`)?.closest(".scale-options");
    if (group) {
      group.querySelectorAll(".scale-button").forEach(function (button) {
        const selected = Number(button.dataset.value) === Number(value);
        button.classList.toggle("is-selected", selected);
        button.setAttribute("aria-checked", String(selected));
      });
    }
    const factor = FACTORS[state.factorPage];
    const answered = factor.questions.filter(function (_, index) {
      return Number.isFinite(Number(state.factorAnswers[`${factor.id}-${index}`]));
    }).length;
    const meta = document.querySelector(".action-meta");
    if (meta) meta.textContent = `이 영역 ${answered} / 5 응답`;
    const next = document.querySelector('[data-action="factor-next"]');
    if (next) next.disabled = answered !== factor.questions.length;
  }

  function refreshRankUI(scene, ranking) {
    document.querySelectorAll('[data-action="rank"]').forEach(function (button) {
      const position = ranking.indexOf(button.dataset.style);
      const score = position >= 0 ? 4 - position : null;
      button.classList.toggle("is-ranked", Boolean(score));
      button.setAttribute("aria-pressed", String(Boolean(score)));
      const badge = button.querySelector(".rank-badge");
      if (badge) badge.textContent = score || "+";
    });
    const guide = document.querySelector(".ranking-guide");
    if (guide) {
      guide.innerHTML = ranking.length === 4
        ? "가장 나다운 반응부터 눌러주세요. <strong>순위 선택을 완료했습니다.</strong>"
        : `가장 나다운 반응부터 눌러주세요. <strong>지금 선택하면 ${4 - ranking.length}점</strong>이 됩니다.`;
    }
    const meta = document.querySelector(".action-meta");
    if (meta) meta.textContent = ranking.length === 4 ? "4·3·2·1 선택 완료" : `${ranking.length} / 4 선택`;
    const next = document.querySelector('[data-action="scene-next"]');
    if (next) next.disabled = ranking.length !== 4;
    const reset = document.querySelector('[data-action="rank-reset"]');
    if (reset) reset.hidden = ranking.length === 0;
  }

  function startNewAssessment() {
    const previous = latestNote();
    const context = state.context || "아직 잘 모르겠다";
    state = Object.assign(defaultState(), {
      stage: "questions",
      context: context,
      previousSnapshot: previous,
      startedAt: new Date().toISOString()
    });
    saveState();
    render(true);
  }

  function finishAssessment() {
    const result = calculateResult();
    state.result = result;
    state.questionOptions = generateQuestions(result);
    state.stage = "results";
    saveState();
    render(true);
  }

  function downloadNote() {
    const result = state.result;
    const strongest = factorById(result.strongest);
    const priority = factorById(result.priority);
    const primary = STYLE_META[result.primaryStyle];
    const secondary = STYLE_META[result.secondaryStyle];
    const factors = FACTORS.map(function (factor) { return `${factor.name}: ${result.scores[factor.id]}`; }).join("\n");
    const text = `MY VOICE NOTE\nDAILYCOACHING · V${VERSION}\n검사일: ${formatDate(state.completedAt)}\n상황: ${state.context || "아직 잘 모르겠다"}\n\nMY SPEECH\n현재 가장 강한 힘: ${strongest.name}\n현재 연습 우선영역: ${priority.name}\nMY SPEECH STYLE: ${primary.name} / ${secondary.name}\nMY SPEECH INDEX: ${result.overall}\n\n${factors}\n\nMY QUESTION\n«${state.selectedQuestion.text}»\n\nMY ANSWER\n${state.myAnswer}\n\nTHE MOMENT\n${state.moment}\n\nNEXT VOICE\n«${state.nextVoice}»\n\n«다음에 말할 때, 오늘 선택한 한 가지를 기억해보세요.»`;
    const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `MY_VOICE_NOTE_${new Date(state.completedAt).toISOString().slice(0,10)}.txt`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    showToast("MY VOICE NOTE를 저장했습니다.");
  }

  document.addEventListener("click", function (event) {
    const target = event.target.closest("[data-action]");
    if (!target) return;
    const action = target.dataset.action;

    if (action === "jump-context") {
      const section = document.getElementById("context");
      if (section) section.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
    if (action === "context") {
      state.context = target.dataset.context || "";
      saveState();
      document.querySelectorAll('[data-action="context"]').forEach(function (button) {
        const selected = button.dataset.context === state.context;
        button.classList.toggle("is-selected", selected);
        button.setAttribute("aria-pressed", String(selected));
      });
      target.focus();
      return;
    }
    if (action === "start") {
      startNewAssessment();
      return;
    }
    if (action === "reset") {
      if (window.confirm("현재 진행 중인 응답을 지우고 처음부터 시작할까요? 저장된 MY VOICE NOTE는 유지됩니다.")) {
        state = defaultState();
        saveState();
        render(true);
      }
      return;
    }
    if (action === "factor-answer") {
      state.factorAnswers[target.dataset.id] = Number(target.dataset.value);
      saveState();
      refreshFactorUI(target.dataset.id, target.dataset.value);
      return;
    }
    if (action === "factor-next") {
      go("scenes", { scenePage: state.factorPage });
      return;
    }
    if (action === "factor-back") {
      if (state.factorPage > 0) {
        go("scenes", { scenePage: state.factorPage - 1 });
      } else {
        go("intro");
      }
      return;
    }
    if (action === "rank") {
      const scene = SCENES[state.scenePage];
      const style = target.dataset.style;
      const current = (state.sceneRanks[scene.id] || []).slice();
      const existing = current.indexOf(style);
      if (existing >= 0) current.splice(existing, 1);
      else if (current.length < 4) current.push(style);
      state.sceneRanks[scene.id] = current;
      saveState();
      refreshRankUI(scene, current);
      return;
    }
    if (action === "rank-reset") {
      const scene = SCENES[state.scenePage];
      state.sceneRanks[scene.id] = [];
      saveState();
      refreshRankUI(scene, []);
      return;
    }
    if (action === "scene-next") {
      if (state.scenePage < SCENES.length - 1) {
        go("questions", { factorPage: state.scenePage + 1 });
      } else {
        finishAssessment();
      }
      return;
    }
    if (action === "scene-back") {
      go("questions", { factorPage: state.scenePage });
      return;
    }
    if (action === "open-questions") {
      if (!state.questionOptions || !state.questionOptions.length) state.questionOptions = generateQuestions(state.result);
      go("questionSelect");
      return;
    }
    if (action === "questions-back" || action === "result-again") {
      go("results");
      return;
    }
    if (action === "select-question") {
      const question = state.questionOptions.find(function (item) { return item.id === target.dataset.id; });
      if (!question) return;
      go("coachingAnswer", {
        selectedQuestion: question,
        myAnswer: "",
        moment: "",
        nextVoice: "",
        assistOpen: false
      });
      return;
    }
    if (action === "answer-next") {
      if (String(state.myAnswer || "").trim()) go("coachingMoment");
      return;
    }
    if (action === "moment-next") {
      if (String(state.moment || "").trim()) go("coachingChoose");
      return;
    }
    if (action === "coach-back") {
      if (state.stage === "coachingAnswer") go("questionSelect");
      else if (state.stage === "coachingMoment") go("coachingAnswer");
      else go("coachingMoment");
      return;
    }
    if (action === "assist-toggle") {
      state.assistOpen = !state.assistOpen;
      saveState();
      render(false);
      return;
    }
    if (action === "assist") {
      state.nextVoice = target.dataset.value || "";
      saveState();
      render(false);
      const input = document.getElementById("coach-input");
      if (input) input.focus();
      return;
    }
    if (action === "focus-input") {
      const input = document.getElementById("coach-input");
      if (input) input.focus();
      return;
    }
    if (action === "finish-note") {
      if (!String(state.nextVoice || "").trim()) return;
      const answered = new Set(state.answeredQuestionIds || []);
      answered.add(state.selectedQuestion.id);
      state.answeredQuestionIds = Array.from(answered);
      state.completedAt = new Date().toISOString();
      state.stage = "note";
      saveCompletedNote();
      saveState();
      render(true);
      return;
    }
    if (action === "download-note") {
      downloadNote();
      return;
    }
    if (action === "print-note") {
      window.print();
      return;
    }
    if (action === "another-question") {
      const base = generateQuestions(state.result);
      let remaining = base.filter(function (question) { return !state.answeredQuestionIds.includes(question.id); });
      if (!remaining.length) remaining = base;
      go("questionSelect", { questionOptions: remaining, selectedQuestion: null, myAnswer: "", moment: "", nextVoice: "" });
      return;
    }
    if (action === "retest") {
      const previous = noteObject();
      const previousContext = state.context;
      state = Object.assign(defaultState(), {
        stage: "intro",
        context: previousContext,
        previousSnapshot: previous
      });
      saveState();
      render(true);
      showToast("새 검사를 준비했습니다.");
      return;
    }
  });

  document.addEventListener("input", function (event) {
    const field = event.target && event.target.dataset ? event.target.dataset.field : null;
    if (!field) return;
    state[field] = event.target.value;
    saveState();
    const requiredButton = document.querySelector('[data-requires-input="true"]');
    if (requiredButton) requiredButton.disabled = !String(event.target.value || "").trim();
  });

  window.addEventListener("storage", function (event) {
    if (event.key === PROGRESS_KEY && event.newValue) {
      try {
        state = Object.assign(defaultState(), JSON.parse(event.newValue));
        render(false);
      } catch (_) {}
    }
  });

  window.__MYVOICE__ = {
    version: VERSION,
    factorCount: FACTORS.length,
    speechQuestionCount: FACTORS.reduce(function (sum, factor) { return sum + factor.questions.length; }, 0),
    sceneCount: SCENES.length,
    scalePoints: SCALE_VALUES.length,
    flowPattern: FLOW_VERSION,
    reset: function () {
      state = defaultState();
      saveState();
      render(true);
    }
  };

  render(false);
})();
