const QUESTION_CARDS = [
  {id:'people_many',category:'사람',text:'이 직업은 사람을 직접 많이 만나나요?'},
  {id:'people_child',category:'사람',text:'어린이나 청소년을 자주 만나나요?'},
  {id:'people_patient',category:'사람',text:'아프거나 도움이 필요한 사람을 만나나요?'},
  {id:'people_customer',category:'사람',text:'고객에게 서비스를 직접 제공하나요?'},
  {id:'place_indoor',category:'장소',text:'주로 실내에서 일하나요?'},
  {id:'place_outdoor',category:'장소',text:'야외나 현장에서 일하는 시간이 많나요?'},
  {id:'place_move',category:'장소',text:'여러 장소를 이동하며 일하나요?'},
  {id:'place_special',category:'장소',text:'특별한 시설이나 전문 작업실에서 일하나요?'},
  {id:'tool_computer',category:'도구',text:'컴퓨터나 디지털 기기를 자주 사용하나요?'},
  {id:'tool_machine',category:'도구',text:'기계나 장비를 직접 다루나요?'},
  {id:'tool_hand',category:'도구',text:'손기술이나 세밀한 도구 사용이 중요한가요?'},
  {id:'tool_document',category:'도구',text:'문서나 자료를 많이 작성하나요?'},
  {id:'work_safety',category:'하는 일',text:'안전이나 생명과 직접 관련된 일을 하나요?'},
  {id:'work_create',category:'하는 일',text:'새로운 것을 만들거나 표현하나요?'},
  {id:'work_analyze',category:'하는 일',text:'숫자나 자료를 분석하는 일이 많나요?'},
  {id:'work_teach',category:'하는 일',text:'누군가를 가르치거나 성장하도록 돕나요?'},
  {id:'work_solve',category:'하는 일',text:'문제를 발견하고 해결책을 만드는 일이 핵심인가요?'},
  {id:'work_visible',category:'하는 일',text:'일의 결과물이 눈에 보이는 형태로 남나요?'},
  {id:'skill_talk',category:'필요한 힘',text:'말하기와 소통 능력이 특히 중요한가요?'},
  {id:'skill_focus',category:'필요한 힘',text:'오랫동안 집중하고 정확하게 확인해야 하나요?'},
  {id:'skill_team',category:'필요한 힘',text:'팀원과 협력하는 경우가 많나요?'},
  {id:'skill_creative',category:'필요한 힘',text:'창의적인 아이디어가 중요한가요?'},
  {id:'prepare_license',category:'준비',text:'전문 자격증이나 면허가 꼭 필요한가요?'},
  {id:'prepare_major',category:'준비',text:'관련 전공이나 긴 전문교육이 필요한 편인가요?'},
  {id:'condition_uniform',category:'환경',text:'유니폼이나 보호 장비를 착용하나요?'},
  {id:'condition_emergency',category:'환경',text:'갑작스러운 상황에 빠르게 대응해야 하나요?'},
  {id:'condition_schedule',category:'환경',text:'근무 시간이 일정하지 않을 수 있나요?'},
  {id:'nature_animal',category:'대상',text:'자연이나 동물을 직접 다루나요?'}
];

const QUESTION_ANSWER_META = {
  yes:{label:'예',icon:'○',className:'yes'},
  no:{label:'아니오',icon:'×',className:'no'},
  maybe:{label:'상황에 따라 달라요',icon:'△',className:'maybe'}
};

const JOB_CATEGORY_PROFILES = {
  A:{tools:['컴퓨터','개발·설계 프로그램','데이터 도구'],places:['기업 사무실','연구개발실','온라인 협업 환경'],people:['개발자와 디자이너','서비스 이용자','기획자'],strengths:['논리적 사고','문제해결','집중력'],subjects:['정보','수학','과학·기술'],path:'코딩·디지털 제작 경험을 쌓고 관련 전공, 프로젝트, 포트폴리오로 준비할 수 있어요.'},
  B:{tools:['실험·측정 장비','관찰 기록지','자료 분석 프로그램'],places:['연구소','실험실','자연 현장'],people:['연구자','기관 담당자','지역사회'],strengths:['호기심','관찰력','정확성'],subjects:['과학','수학','환경'],path:'과학 탐구와 실험 활동을 경험하고 관련 전공과 연구 프로젝트를 통해 준비할 수 있어요.'},
  C:{tools:['의료·건강 장비','상태 기록지','보호·위생 도구'],places:['병원·의원','보건기관','재활·돌봄 현장'],people:['환자와 가족','의료진','지역 주민'],strengths:['공감','관찰력','책임감'],subjects:['과학','보건','체육'],path:'생명과 건강 분야를 공부하고 실습, 관련 전공, 국가자격 또는 면허 과정을 확인해야 해요.'},
  D:{tools:['교재와 활동지','질문·상담 기록','발표·교육 도구'],places:['학교','교육기관','상담·학습 공간'],people:['학생과 학습자','보호자','교사와 교육 담당자'],strengths:['소통','공감','기획력'],subjects:['국어','사회','도덕'],path:'교육·상담 활동과 봉사를 경험하고 관련 전공, 실습, 자격 과정을 통해 준비할 수 있어요.'},
  E:{tools:['안전 장비','법·행정 문서','통신 장비'],places:['공공기관','법정·사무실','재난·안전 현장'],people:['시민','동료 공무원','사건 관계자'],strengths:['책임감','판단력','용기'],subjects:['사회','법·정치','체육'],path:'공공 문제와 법·안전에 관심을 갖고 관련 시험, 전공, 체력·현장 훈련을 준비해야 해요.'},
  F:{tools:['스프레드시트','시장·재무 자료','기획서와 계약서'],places:['기업 사무실','고객 현장','회의·협상 공간'],people:['고객','기업 구성원','협력사'],strengths:['분석력','설득력','계획성'],subjects:['수학','사회','경제'],path:'경제·경영 활동과 프로젝트를 경험하고 관련 전공, 자격, 데이터 활용 능력을 준비할 수 있어요.'},
  G:{tools:['글쓰기·드로잉 도구','촬영·편집 장비','창작 소프트웨어'],places:['스튜디오','공연·촬영 현장','출판·콘텐츠 회사'],people:['관객과 독자','창작자','제작진'],strengths:['창의성','표현력','협업'],subjects:['국어','미술','음악·미디어'],path:'작품을 꾸준히 만들고 발표하며 포트폴리오, 관련 전공, 현장 프로젝트로 준비할 수 있어요.'},
  H:{tools:['서비스 운영 도구','예약·주문 시스템','직무별 전문 도구'],places:['매장','호텔·주방·여행 현장','고객 서비스 공간'],people:['고객','동료 서비스직','지역 주민'],strengths:['세심함','서비스 태도','손기술'],subjects:['기술·가정','체육','외국어'],path:'서비스·생활 분야 체험을 통해 적성을 확인하고 실습, 자격, 현장 경험으로 준비할 수 있어요.'}
};

const JOB_NAME_RULES = [
  {pattern:/개발자|데이터 분석가|정보보안|UX·UI|게임 기획자/,tools:['컴퓨터','코드·데이터 도구','협업 프로그램'],places:['IT 기업','프로젝트 사무실','원격 협업 환경'],people:['개발팀','서비스 이용자','기획자']},
  {pattern:/로봇|반도체|드론|3D 프린팅/,tools:['설계 프로그램','측정 장비','기계·제작 도구'],places:['연구개발실','제작 현장','시험 공간'],people:['엔지니어','기술자','제품 사용자']},
  {pattern:/과학자|연구원|지질학자|환경 컨설턴트|에너지 전문가/,tools:['실험·측정 장비','현장 조사 도구','분석 프로그램'],places:['연구소','실험실','조사 현장'],people:['연구팀','기관 담당자','지역사회']},
  {pattern:/의사|간호사|약사|치료사|임상심리사|응급구조사|수의사|영양사|치과위생사/,tools:['진료·검사 장비','건강 기록','위생·보호 도구'],places:['병원·의원','보건·재활 기관','돌봄 현장'],people:['환자와 가족','의료진','내담자']},
  {pattern:/교사|교수|지도사|교육사|교육콘텐츠|사서|진로코치/,tools:['교재·책·자료','질문과 활동지','발표 도구'],places:['학교·대학','교육센터','도서관'],people:['학생과 학습자','보호자','교육 담당자']},
  {pattern:/상담교사|진로코치|임상심리사/,tools:['질문지','상담 기록','심리·진로 검사'],places:['상담실','학교','코칭·교육 공간'],people:['학생','내담자','보호자'],strengths:['경청','공감','질문력']},
  {pattern:/소방관|경찰관|군인|재난안전/,tools:['안전·보호 장비','통신 장비','현장 대응 도구'],places:['재난·안전 현장','훈련 시설','공공기관'],people:['시민','동료 대원','구조 대상자'],strengths:['용기','상황판단','협동']},
  {pattern:/변호사|판사|검사|관세사/,tools:['법률 문서','사건 기록','검색·작성 도구'],places:['법원','법률 사무실','공공기관'],people:['의뢰인','사건 관계자','법률 전문가'],strengths:['논리력','공정성','의사소통']},
  {pattern:/외교관|행정공무원/,tools:['정책·행정 문서','회의 자료','통신 도구'],places:['공공기관','대사관','회의 현장'],people:['시민','외국 기관','정책 담당자']},
  {pattern:/기업가|마케터|인사담당자|상품기획자|경영컨설턴트/,tools:['시장 자료','기획서','발표·협업 도구'],places:['기업 사무실','고객 현장','회의 공간'],people:['고객','기업 구성원','협력사']},
  {pattern:/회계사|금융분석가|세무사|감정평가사/,tools:['재무·시장 자료','스프레드시트','계산·분석 도구'],places:['사무실','금융기관','조사 현장'],people:['기업 고객','투자자','기관 담당자'],strengths:['정확성','수리력','분석력']},
  {pattern:/작가|기자|영상감독|사진|디자이너|크리에이터|작곡|배우|큐레이터/,tools:['창작 도구','촬영·편집 장비','자료 조사 도구'],places:['스튜디오','취재·공연 현장','콘텐츠 회사'],people:['독자와 관객','제작진','취재원']},
  {pattern:/요리|제과|호텔|관광|미용|반려|서비스|승무원/,tools:['예약·주문 시스템','고객 응대 도구','직무별 전문 장비'],places:['매장·호텔','여행·이동 현장','서비스 공간'],people:['고객','동료 직원','여행객']}
];

function getJobProfile(job) {
  const base = JOB_CATEGORY_PROFILES[job.cat] || JOB_CATEGORY_PROFILES.H;
  const rule = JOB_NAME_RULES.find(item => item.pattern.test(job.name)) || {};
  const similar = JOBS.filter(item => item.cat === job.cat && item.id !== job.id).slice(0, 3).map(item => item.name);
  return {
    intro: job.desc,
    work: job.desc,
    tools: rule.tools || [job.tags[0], ...base.tools.slice(0, 2)],
    places: rule.places || base.places,
    people: rule.people || base.people,
    strengths: rule.strengths || base.strengths,
    subjects: rule.subjects || base.subjects,
    path: rule.path || base.path,
    similar
  };
}
