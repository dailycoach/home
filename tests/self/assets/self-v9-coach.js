(() => {
  const DOMAIN_ORDER = ["SR", "ST", "BD", "CS", "RS"];
  const KINGDOM = {
    K: "관계와 주도권 열기",
    I: "현재 장면 인식",
    N: "핵심 욕구·패턴 명명",
    G: "성장 방향 세우기",
    D: "선택과 설계",
    O: "작은 실행",
    M: "의미화와 성장기록"
  };

  const GUIDE = {
    SR: {
      name: "자기존중",
      low: {
        title: "자기평가가 존재 전체를 덮는 상태",
        summary: "성과·실수·타인의 반응이 자기 가치와 빠르게 결합될 수 있습니다. 코치는 긍정적으로 생각하라고 설득하기보다, 고객이 자신에게 사용하는 말투와 기준을 구체적인 장면에서 분리하도록 돕습니다.",
        lenses: {
          coaching: "문제 해결보다 자기대화의 공정성을 먼저 회복합니다. 고객을 교정 대상이 아니라 이미 존중받아야 할 주체로 대하며, 성과와 존재를 분리합니다.",
          psychology: "조건부 자기수용, 자기비난, 수치심 반응이 강화된 모습일 수 있습니다. 감정의 타당성을 인정하되 자기비난을 사실로 확정하지 않도록 돕습니다.",
          development: "외부 평가에 민감한 발달 시기에는 실수 하나가 정체성 전체의 판단으로 번지기 쉽습니다. 안전한 관계 안에서 실패를 학습 정보로 재구성하는 경험이 중요합니다."
        },
        observe: ["실수 뒤 사용하는 자기호칭과 말투", "휴식·도움을 자격과 연결하는지", "칭찬을 축소하거나 밀어내는 방식"],
        caution: ["성급한 칭찬으로 자기비난을 덮지 않기", "낮은 점수를 낮은 가치로 해석하지 않기", "책임 회피와 자기존중을 혼동하지 않기"],
        questions: {
          K: "최근 스스로를 가장 함부로 대했다고 느낀 장면부터 이야기해 주시겠어요?",
          I: "그 순간 마음과 몸에서는 무엇이 먼저 올라왔고, 자신에게 어떤 말을 했나요?",
          N: "그 거친 말이 지키려 했던 기준이나 두려움은 무엇이었을까요?",
          G: "같은 실수를 하더라도 자신을 존중하는 사람이라면 어떻게 반응하고 싶나요?",
          D: "그 장면이 다시 올 때 멈춤 신호와 바꿔 말할 문장을 어떻게 정해볼까요?",
          O: "이번 주 하루 한 번, 자기비난 문장을 사실에 가까운 문장으로 바꿔 써본다면 언제 해보겠어요?",
          M: "자신을 덜 몰아붙였을 때 오히려 더 잘 움직인 점은 무엇이었나요?"
        }
      },
      high: {
        title: "성과와 존재를 분리해 다루는 상태",
        summary: "실수와 평가가 있어도 자신을 통째로 부정하지 않는 힘이 작동합니다. 코칭에서는 이 힘을 유지하는 조건을 발견하고, 자기보호가 책임 회피나 피드백 차단으로 굳지 않도록 균형을 확인합니다.",
        lenses: {
          coaching: "고객은 자기수용을 바탕으로 도전과 피드백을 다룰 여지가 큽니다. 잘되는 방식을 언어화해 재현 가능한 자기운영 원칙으로 만들 수 있습니다.",
          psychology: "비교적 안정된 자기개념과 자기연민이 작동할 가능성이 있습니다. 다만 높은 자기평가와 방어적 자기확신은 구분해야 합니다.",
          development: "자율성과 유능감이 살아 있어 실패를 정체성 위협보다 학습 과정으로 받아들이기 쉽습니다. 타인을 존중하는 방식으로 확장되는지 살펴봅니다."
        },
        observe: ["피드백을 받아들이면서도 자기 가치를 지키는 방식", "자기존중이 타인 존중으로 확장되는지", "과도한 자기보호로 불편한 책임을 피하지 않는지"],
        caution: ["높은 점수를 완성된 상태로 단정하지 않기", "자기확신과 방어를 구별하기", "유지 조건을 묻지 않고 강점으로만 칭찬하지 않기"],
        questions: {
          K: "최근 자신을 존중하면서도 어려운 책임을 감당한 장면은 무엇이었나요?",
          I: "그때 자신을 지켜준 내적 말투와 감정 조절 방식은 무엇이었나요?",
          N: "당신의 자기존중을 가능하게 하는 핵심 기준은 무엇이라고 이름 붙일 수 있을까요?",
          G: "이 힘이 앞으로 관계와 성과에 어떤 방식으로 더 확장되기를 바라나요?",
          D: "잘되는 방식을 반복할 수 있도록 어떤 원칙이나 환경을 고정하면 좋을까요?",
          O: "이번 주 자기존중을 타인 존중으로 연결하는 행동 하나를 무엇으로 정하겠어요?",
          M: "자기존중이 당신의 선택과 관계를 어떻게 바꾸고 있는지 무엇으로 확인할 수 있나요?"
        }
      }
    },
    ST: {
      name: "자기신뢰",
      low: {
        title: "확신을 기다리느라 움직임이 늦어지는 상태",
        summary: "판단의 정확성보다 틀릴 가능성에 주의가 묶이고, 타인의 확신이나 충분한 정보가 있어야 시작할 수 있다고 느낄 수 있습니다. 코치는 정답을 제공하기보다 작은 완료 경험을 통해 자기효능감을 회복하도록 돕습니다.",
        lenses: {
          coaching: "결정을 대신 내려주지 않고 선택 가능한 범위를 줄여 고객이 자기 판단을 사용하게 합니다. 결과보다 결정·실행·수정의 순환을 강화합니다.",
          psychology: "낮은 자기효능감, 실패 회피, 불확실성에 대한 과민성이 나타날 수 있습니다. 과거의 실제 완료 경험을 근거로 인지적 균형을 회복합니다.",
          development: "도전 과제가 발달 수준보다 크거나 반복된 평가 실패가 있었을 때 시도 자체를 줄일 수 있습니다. 근접한 난이도의 과제와 즉각적인 성공 경험이 필요합니다."
        },
        observe: ["결정 전 정보 수집이 얼마나 길어지는지", "타인의 승인 없이는 시작하지 못하는지", "작은 성공을 기억하고 근거로 사용하는지"],
        caution: ["대신 결정해주어 의존을 강화하지 않기", "무조건 도전하라는 압박을 주지 않기", "실행 부족을 의지 문제로 단정하지 않기"],
        questions: {
          K: "최근 알고도 시작하지 못했던 장면 하나를 골라볼까요?",
          I: "시작 직전에 어떤 생각과 감정이 당신을 멈추게 했나요?",
          N: "당신이 기다리는 확신은 실제로 무엇을 보장해주길 바라는 걸까요?",
          G: "완벽한 선택보다 수정 가능한 선택을 한다면 어떤 모습이 되고 싶나요?",
          D: "실패해도 감당 가능한 가장 작은 실험은 어느 정도 크기인가요?",
          O: "오늘 10분 안에 끝낼 수 있는 약속 하나를 무엇으로 정하겠어요?",
          M: "작은 완료가 다음 선택에 준 변화는 무엇이며, 어떤 근거로 남길 수 있나요?"
        }
      },
      high: {
        title: "불확실성 속에서도 선택하고 수정하는 상태",
        summary: "완벽한 확신이 없어도 판단하고 움직이며 결과를 바탕으로 수정할 수 있습니다. 코칭에서는 이 실행력을 재현 가능한 방식으로 정리하고, 과속·과신·성급한 결정으로 넘어가지 않는지 점검합니다.",
        lenses: {
          coaching: "강한 실행 감각을 목표의 질과 정렬시키는 단계입니다. 빠른 행동이 중요한 가치와 연결되는지, 피드백 루프가 실제로 작동하는지 확인합니다.",
          psychology: "자기효능감과 통제감이 비교적 안정적일 수 있습니다. 다만 성공 경험이 과도한 일반화나 위험 과소평가로 이어지지 않도록 현실 검증이 필요합니다.",
          development: "자율적 선택과 숙달 지향성이 발달한 모습입니다. 또래와 타인의 관점을 수용하면서도 자기 판단을 유지하는 통합 능력으로 확장할 수 있습니다."
        },
        observe: ["결정 후 피드백을 실제로 반영하는지", "속도가 중요한 가치와 정렬되는지", "자신의 판단이 타인의 목소리를 압도하지 않는지"],
        caution: ["실행력이 높다는 이유로 더 많은 과제를 얹지 않기", "과신과 자기신뢰를 혼동하지 않기", "수정 없는 밀어붙이기를 강점으로 해석하지 않기"],
        questions: {
          K: "최근 불확실했지만 잘 결정하고 움직인 장면을 들려주시겠어요?",
          I: "그때 무엇을 근거로 충분히 가능하다고 판단했나요?",
          N: "당신의 자기신뢰를 만드는 반복 패턴을 한 문장으로 이름 붙이면 무엇인가요?",
          G: "이 실행력을 앞으로 어떤 중요한 가치와 목표에 사용하고 싶나요?",
          D: "속도를 유지하면서도 놓치지 말아야 할 검토 기준은 무엇인가요?",
          O: "이번 주 한 번, 결정 뒤 피드백을 받아 수정하는 실험을 어디에 적용하겠어요?",
          M: "당신이 신뢰할 수 있는 판단과 수정의 원칙은 무엇으로 정리되었나요?"
        }
      }
    },
    BD: {
      name: "경계와 요청",
      low: {
        title: "관계를 지키기 위해 자신을 뒤로 미루는 상태",
        summary: "거절·조건 조정·도움 요청이 관계 손상으로 이어질 것이라는 걱정 때문에 부담을 떠안을 수 있습니다. 코치는 단호함을 가르치기보다 관계와 자기보호가 함께 가능한 표현을 실제 문장으로 연습하게 합니다.",
        lenses: {
          coaching: "경계는 상대를 밀어내는 기술이 아니라 지속 가능한 관계의 운영 규칙입니다. 추상적 용기보다 기한·범위·우선순위처럼 협상 가능한 요소를 찾습니다.",
          psychology: "승인 욕구, 갈등 회피, 과잉 책임감이 작동할 수 있습니다. 상대 감정과 자신의 책임을 구분하고, 죄책감을 행동의 옳고 그름과 동일시하지 않도록 돕습니다.",
          development: "또래 수용과 소속감이 중요한 시기에는 거절이 배제의 위험처럼 느껴질 수 있습니다. 안전한 관계에서 의견 차이를 경험하고 회복하는 연습이 중요합니다."
        },
        observe: ["즉답 후 후회하거나 부담이 누적되는지", "상대 감정을 자신의 책임으로 떠안는지", "도움 요청을 약함이나 민폐로 해석하는지"],
        caution: ["무조건 거절하라고 지시하지 않기", "관계 맥락과 권력 차이를 무시하지 않기", "경계 설정 후 생기는 죄책감을 실패로 해석하지 않기"],
        questions: {
          K: "최근 원하지 않았지만 받아들인 부탁이나 역할은 무엇이었나요?",
          I: "그때 거절하거나 조정하려 할 때 어떤 걱정이 가장 컸나요?",
          N: "당신이 지키려 했던 관계의 의미와 동시에 잃고 있던 것은 무엇인가요?",
          G: "나와 관계를 함께 지키는 경계는 어떤 모습이어야 할까요?",
          D: "기한·범위·방식 중 무엇을 조정하면 현실적인 대안이 될까요?",
          O: "이번 주 한 번 ‘지금은 어렵고, 대신 이것은 가능합니다’라고 말할 장면은 어디인가요?",
          M: "경계를 말한 뒤 실제 관계와 자신의 에너지는 어떻게 달라졌나요?"
        }
      },
      high: {
        title: "자기보호와 관계 협상을 함께 수행하는 상태",
        summary: "가능한 범위와 어려운 조건을 비교적 분명하게 말하고 도움을 요청할 수 있습니다. 코칭에서는 이 강점이 유연한 협상으로 작동하는지, 단절·통제·과도한 독립으로 굳지 않는지 살펴봅니다.",
        lenses: {
          coaching: "경계와 요청을 명료한 협업 언어로 사용할 수 있습니다. 다른 사람의 필요도 들으면서 상호 가능한 조건을 만드는 능력으로 확장합니다.",
          psychology: "자기주장과 관계 안정감이 비교적 균형을 이룰 수 있습니다. 다만 경계가 정서적 거리두기나 취약성 회피를 위한 방어가 아닌지 확인합니다.",
          development: "자율성과 상호의존성을 함께 다루는 발달 과제가 잘 작동하는 모습입니다. 다양한 권력 관계와 문화적 맥락에 맞게 표현을 조절하는 능력을 키울 수 있습니다."
        },
        observe: ["상대의 관점과 제안을 함께 들을 수 있는지", "도움을 요청할 때 취약성을 허용하는지", "경계가 유연한 원칙인지 고정된 벽인지"],
        caution: ["단호함을 무조건 높은 성숙도로 평가하지 않기", "직설성이 상대에게 주는 영향을 놓치지 않기", "독립성과 고립을 혼동하지 않기"],
        questions: {
          K: "최근 경계를 분명히 말하면서도 관계를 지킨 장면은 무엇이었나요?",
          I: "그 대화에서 당신이 안정감을 유지하도록 도운 것은 무엇이었나요?",
          N: "당신의 건강한 경계를 만드는 핵심 원칙은 무엇인가요?",
          G: "이 힘을 협업과 친밀한 관계에서 어떻게 더 유연하게 쓰고 싶나요?",
          D: "상대의 필요와 자신의 한계를 함께 담는 대화 구조를 어떻게 만들 수 있을까요?",
          O: "이번 주 먼저 도움을 요청하거나 협상해볼 한 가지는 무엇인가요?",
          M: "건강한 경계가 관계의 신뢰와 지속성에 준 의미는 무엇이었나요?"
        }
      }
    },
    CS: {
      name: "자기기준",
      low: {
        title: "외부의 속도와 평가가 자기 가치까지 결정하는 상태",
        summary: "성과·팔로워·점수·주변 사람의 속도가 자신의 기준을 대신할 수 있습니다. 코치는 비교를 없애려 하기보다 비교가 시작되는 장면과 그 안에서 놓친 개인의 가치·맥락·성장 기준을 되찾도록 돕습니다.",
        lenses: {
          coaching: "외부 지표를 정보로 사용하되 정체성의 판정 기준으로 사용하지 않도록 분리합니다. 고객에게 맞는 성공의 정의와 측정 방식을 함께 만듭니다.",
          psychology: "사회비교, 조건부 자기가치, 수치심 민감성이 강화될 수 있습니다. 비교 자극을 조정하고 자신의 실제 증거를 수집하는 과정이 도움이 됩니다.",
          development: "또래 기준과 사회적 인정이 정체성 형성에 큰 영향을 주는 시기에는 외부 기준이 필요합니다. 이를 배제하기보다 개인의 가치와 맥락을 통합한 기준으로 발달시키는 것이 중요합니다."
        },
        observe: ["비교 뒤 행동 에너지가 생기는지 꺾이는지", "칭찬과 성취를 받아들이는 방식", "자신의 성공 기준을 구체적으로 설명할 수 있는지"],
        caution: ["SNS를 끊으라는 단순 처방에 머물지 않기", "비교하는 마음을 미성숙으로 비난하지 않기", "개인 기준을 현실 검증 없는 자기합리화로 만들지 않기"],
        questions: {
          K: "최근 다른 사람의 속도 때문에 자신의 가치가 흔들린 장면은 무엇이었나요?",
          I: "그 비교가 시작된 순간 어떤 감정과 자동문장이 올라왔나요?",
          N: "그 비교가 말해주는 당신의 욕구나 중요하게 여기는 가치는 무엇일까요?",
          G: "당신의 현재 삶과 맥락에 맞는 성장 기준은 어떻게 정의하고 싶나요?",
          D: "외부 지표와 자신의 기준을 함께 볼 수 있는 측정 방식을 어떻게 만들까요?",
          O: "하루 동안 비교 자극 하나를 줄이고, 자신이 지킨 것 하나를 기록해보겠어요?",
          M: "비교가 줄었을 때 다시 들리기 시작한 당신의 기준은 무엇이었나요?"
        }
      },
      high: {
        title: "외부 평가를 정보로 사용하며 자기 기준으로 돌아오는 상태",
        summary: "다른 사람의 성과를 보아도 자신의 맥락과 속도를 비교적 분리할 수 있습니다. 코칭에서는 이 기준을 구체화해 삶의 선택에 사용하고, 외부 피드백을 차단하는 폐쇄적 기준으로 변하지 않는지 확인합니다.",
        lenses: {
          coaching: "자기 기준을 목표·선택·측정에 연결할 수 있는 상태입니다. 기준이 가치와 현실 모두에 근거하는지 검토하고, 학습을 위한 외부 피드백 창구를 유지합니다.",
          psychology: "내적 기준과 안정된 자기가치가 비교적 작동할 수 있습니다. 다만 자기확증 편향이나 평가 회피가 내적 기준이라는 이름으로 숨지 않는지 봅니다.",
          development: "정체성의 연속성과 자율적 가치 선택이 발달한 모습입니다. 다양한 관점을 통합하면서도 중심을 잃지 않는 성숙한 판단으로 확장할 수 있습니다."
        },
        observe: ["자기 기준이 실제 선택에 사용되는지", "다른 관점과 피드백을 수용할 여지가 있는지", "기준이 현재 발달과 환경에 맞게 수정되는지"],
        caution: ["남을 신경 쓰지 않는 것을 건강한 기준으로 단정하지 않기", "외부 데이터의 가치를 과소평가하지 않기", "자기 기준을 고정된 정체성으로 만들지 않기"],
        questions: {
          K: "최근 외부 평가와 달라도 자신의 기준을 지킨 선택은 무엇이었나요?",
          I: "그 선택을 할 때 내면에서 무엇이 당신을 안정시켰나요?",
          N: "당신의 삶을 관통하는 핵심 기준을 짧은 문장으로 표현하면 무엇인가요?",
          G: "그 기준이 앞으로 어떤 사람과 삶의 방향으로 이어지기를 바라나요?",
          D: "자기 기준과 외부 피드백을 함께 검토하는 정기적인 방법은 무엇이 좋을까요?",
          O: "이번 주 중요한 선택 하나에 그 기준을 명시적으로 적용해보겠어요?",
          M: "자기 기준으로 선택했을 때 얻은 자유와 책임은 각각 무엇이었나요?"
        }
      }
    },
    RS: {
      name: "회복력",
      low: {
        title: "흔들린 뒤 복귀 경로가 흐려진 상태",
        summary: "스트레스가 커지면 생활 리듬과 집중이 함께 무너지고, 해결하려는 압박이 회복을 더 늦출 수 있습니다. 코치는 강해지라고 요구하기보다 몸·환경·관계에서 작동하는 복귀 버튼을 찾아 작은 순서로 회복하게 합니다.",
        lenses: {
          coaching: "성과 목표를 잠시 낮추고 정상 운영의 최소 기준을 정합니다. 의지보다 복구 절차와 환경을 설계하며, 회복을 실행의 전제 조건으로 봅니다.",
          psychology: "정서조절 자원이 소진되거나 스트레스 반응이 장기화된 모습일 수 있습니다. 감정·신체·사고를 구분하고, 과부하가 심하면 전문적 도움의 필요성을 함께 살핍니다.",
          development: "자기조절 기능은 관계와 환경의 공동조절을 통해 발달합니다. 혼자 버티게 하기보다 예측 가능한 루틴, 안전한 성인·또래 관계, 적절한 과제 조정이 중요합니다."
        },
        observe: ["수면·식사·정리 등 기본 리듬의 변화", "힘들수록 더 몰아붙이거나 회피하는 패턴", "도움받을 사람과 회복 환경이 있는지"],
        caution: ["회복을 개인 의지의 문제로 만들지 않기", "심각한 기능 저하를 코칭만으로 다루지 않기", "빠른 행동 계획으로 감정과 신체 신호를 건너뛰지 않기"],
        questions: {
          K: "최근 흔들림이 길어졌던 장면을 안전한 범위에서 이야기해 주시겠어요?",
          I: "가장 먼저 무너진 것은 몸, 감정, 생각, 생활 리듬 중 무엇이었나요?",
          N: "그 순간 당신에게 필요했던 회복 자원은 무엇이었다고 볼 수 있을까요?",
          G: "완전히 괜찮아지는 것보다 ‘다시 돌아오는 상태’를 어떻게 정의하고 싶나요?",
          D: "복귀 순서를 세 단계로 만든다면 무엇부터 무엇까지일까요?",
          O: "오늘 바로 실행할 수 있는 회복 버튼 하나를 무엇으로 정하겠어요?",
          M: "이번 회복 경험을 통해 다음 흔들림 전에 알아차릴 신호는 무엇이 생겼나요?"
        }
      },
      high: {
        title: "흔들림 뒤 자신만의 방식으로 돌아오는 상태",
        summary: "스트레스가 있어도 기본 리듬을 유지하거나 비교적 빠르게 복귀하는 방법을 알고 있습니다. 코칭에서는 이 회복 자원을 명확히 해 유지하고, 높은 회복력이 과부하를 견디는 능력으로 오용되지 않는지 살펴봅니다.",
        lenses: {
          coaching: "회복의 우연한 요소를 루틴·관계·환경의 구조로 바꿀 수 있습니다. 버티는 힘보다 조기에 멈추고 조정하는 예방적 회복력으로 확장합니다.",
          psychology: "적응적 대처, 정서조절, 인지적 유연성이 비교적 작동할 수 있습니다. 다만 감정을 억제한 채 기능만 유지하는 가성 회복은 구별해야 합니다.",
          development: "자기조절과 도움 요청의 통합이 발달한 모습입니다. 개인의 회복 경험을 타인의 속도와 비교하지 않고, 공동체 안에서 상호조절하는 능력으로 확장할 수 있습니다."
        },
        observe: ["회복 과정에서 감정을 실제로 처리하는지", "과부하를 조기에 줄이는 선택을 하는지", "도움을 주고받는 관계가 있는지"],
        caution: ["잘 버틴다는 이유로 과제를 더 얹지 않기", "기능 유지와 정서적 회복을 동일시하지 않기", "자신의 회복 방식을 타인에게 그대로 요구하지 않기"],
        questions: {
          K: "최근 흔들렸지만 비교적 잘 돌아온 장면은 무엇이었나요?",
          I: "복귀를 시작하게 한 가장 이른 신호와 행동은 무엇이었나요?",
          N: "당신의 회복을 가능하게 하는 핵심 자원을 이름 붙이면 무엇인가요?",
          G: "앞으로는 무너진 뒤 회복하는 것에서 어떤 예방적 회복으로 나아가고 싶나요?",
          D: "과부하 전에 멈추기 위한 상한선과 도움 요청 기준을 어떻게 정할까요?",
          O: "이번 주 회복 자원 하나를 일정에 먼저 배치한다면 무엇을 언제 넣겠어요?",
          M: "당신의 회복력이 자신과 주변 사람에게 어떤 의미를 만들고 있나요?"
        }
      }
    }
  };

  const $ = (selector) => document.querySelector(selector);
  const dialog = $("#coachDialog");
  const openButton = $("#coachViewBtn");
  const closeButton = $("#coachCloseBtn");
  const tabs = $("#coachTabs");
  const content = $("#coachContent");
  let activeDomain = "SR";
  let activeState = "low";
  let previousFocus = null;

  if (!dialog || !openButton || !closeButton || !tabs || !content) return;

  function readScores() {
    const scoreNodes = [...document.querySelectorAll("#domainList .domain-score")];
    return DOMAIN_ORDER.reduce((result, key, index) => {
      const value = Number.parseInt(scoreNodes[index]?.textContent || "", 10);
      result[key] = Number.isFinite(value) ? value : null;
      return result;
    }, {});
  }

  function currentScore(scores, key) {
    return Number.isFinite(scores[key]) ? scores[key] : null;
  }

  function defaultDomain(scores) {
    const scored = DOMAIN_ORDER.filter((key) => Number.isFinite(scores[key]));
    if (!scored.length) return "SR";
    return scored.sort((a, b) => scores[a] - scores[b])[0];
  }

  function renderTabs(scores) {
    tabs.innerHTML = "";
    DOMAIN_ORDER.forEach((key) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = `coach-tab${key === activeDomain ? " is-active" : ""}`;
      const score = currentScore(scores, key);
      button.innerHTML = `${GUIDE[key].name}${score === null ? "" : `<small>${score}</small>`}`;
      button.addEventListener("click", () => {
        activeDomain = key;
        activeState = score !== null && score >= 70 ? "high" : "low";
        render();
      });
      tabs.appendChild(button);
    });
  }

  function renderQuestions(questions) {
    return Object.entries(KINGDOM).map(([code, label]) => `
      <div class="kingdom-item">
        <span class="kingdom-code">${code}</span>
        <div><b>${label}</b><p>${questions[code]}</p></div>
      </div>
    `).join("");
  }

  function render() {
    const scores = readScores();
    const score = currentScore(scores, activeDomain);
    const guide = GUIDE[activeDomain];
    const stateGuide = guide[activeState];
    const isMiddle = score !== null && score >= 45 && score < 70;
    renderTabs(scores);
    content.innerHTML = `
      <div class="coach-domain-head">
        <div><h3>${guide.name}</h3></div>
        <span class="coach-score-pill">${score === null ? "점수 없음" : `현재 ${score}점`}</span>
      </div>
      ${isMiddle ? '<div class="coach-mid-note"><b>중간 구간</b>입니다. 상황에 따라 저점 패턴과 고점 패턴이 교차할 수 있으므로 두 해석을 모두 대화 자료로 사용하세요.</div>' : ""}
      <div class="coach-state-toggle" role="group" aria-label="해석 상태 선택">
        <button type="button" data-coach-state="low" class="${activeState === "low" ? "is-active" : ""}">낮을 때의 해석</button>
        <button type="button" data-coach-state="high" class="${activeState === "high" ? "is-active" : ""}">높을 때의 해석</button>
      </div>
      <div class="coach-summary"><strong>${stateGuide.title}</strong>${stateGuide.summary}</div>
      <h4 class="coach-lens-title">세 관점으로 읽기</h4>
      <div class="coach-lenses">
        <div class="coach-lens"><b>코칭학 관점</b><p>${stateGuide.lenses.coaching}</p></div>
        <div class="coach-lens"><b>심리학 관점</b><p>${stateGuide.lenses.psychology}</p></div>
        <div class="coach-lens"><b>교육발달학 관점</b><p>${stateGuide.lenses.development}</p></div>
      </div>
      <h4 class="coach-practice-title">코치 실전 메모</h4>
      <div class="coach-practice">
        <div class="coach-practice-card"><b>관찰할 것</b><ul>${stateGuide.observe.map((item) => `<li>${item}</li>`).join("")}</ul></div>
        <div class="coach-practice-card"><b>주의할 것</b><ul>${stateGuide.caution.map((item) => `<li>${item}</li>`).join("")}</ul></div>
      </div>
      <h4 class="coach-kingdom-title">KINGDOM 7단계 코칭질문</h4>
      <div class="kingdom-list">${renderQuestions(stateGuide.questions)}</div>
      <div class="coach-footer-note">이 해석은 진단이나 위험 판정이 아닙니다. 점수만으로 고객을 규정하지 말고, 최근 장면·발달 맥락·관계 환경·기능 수준을 함께 확인한 뒤 코칭 대화의 가설로 사용하세요.</div>
    `;
    content.querySelectorAll("[data-coach-state]").forEach((button) => {
      button.addEventListener("click", () => {
        activeState = button.dataset.coachState;
        render();
      });
    });
  }

  function openDialog() {
    const scores = readScores();
    activeDomain = defaultDomain(scores);
    const score = currentScore(scores, activeDomain);
    activeState = score !== null && score >= 70 ? "high" : "low";
    previousFocus = document.activeElement;
    render();
    dialog.hidden = false;
    document.body.classList.add("coach-dialog-open");
    closeButton.focus();
  }

  function closeDialog() {
    dialog.hidden = true;
    document.body.classList.remove("coach-dialog-open");
    if (previousFocus && typeof previousFocus.focus === "function") previousFocus.focus();
  }

  openButton.addEventListener("click", openDialog);
  closeButton.addEventListener("click", closeDialog);
  dialog.querySelector("[data-coach-close]")?.addEventListener("click", closeDialog);
  document.addEventListener("keydown", (event) => {
    if (!dialog.hidden && event.key === "Escape") closeDialog();
  });
})();
