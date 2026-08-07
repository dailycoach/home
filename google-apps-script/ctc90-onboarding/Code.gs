const CTC90_FORM = Object.freeze({
  title: 'DAILYCOACHING 코치더코치 90 | 참여코치 사전 온보딩',
  kakaoUrl: 'https://open.kakao.com/o/s2ZmJFHi',
  propertyKey: 'DAILYCOACHING_CTC90_FORM_ID',
  expectedSpreadsheetTitle: 'DAILYCOACHING CTC90 운영원장',
});

/**
 * 운영원장에 바인딩된 Apps Script에서 한 번 실행합니다.
 * 같은 스크립트 속성에 Form ID가 남아 있으면 중복 생성하지 않습니다.
 *
 * @return {{created: boolean, formId: string, publishedUrl: string, editUrl: string}}
 */
function installCtc90Form() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  if (!spreadsheet) {
    throw new Error('운영원장에서 확장 프로그램 → Apps Script로 열어 실행해 주세요.');
  }

  const properties = PropertiesService.getDocumentProperties();
  const existingId = properties.getProperty(CTC90_FORM.propertyKey);
  if (existingId) {
    const existingForm = FormApp.openById(existingId);
    const existingResult = formResult_(existingForm, false);
    writeFormLinks_(spreadsheet, existingResult);
    console.log(JSON.stringify(existingResult, null, 2));
    return existingResult;
  }

  const form = FormApp.create(CTC90_FORM.title);
  configureForm_(form);
  buildSharedBefore_(form);

  const kacPage = form.addPageBreakItem()
    .setTitle('KAC 90 | 기본 코칭구조를 고객 중심으로')
    .setHelpText('관계·합의·고객 언어 경청·반영·열린 질문·고객 주도·실행을 중심으로 봅니다.');
  buildKacBranch_(form);

  const kpcPage = form.addPageBreakItem()
    .setTitle('KPC 90 | 고객의 전체 흐름에 맞는 통합적 선택')
    .setHelpText('통합적 경청·침묵·감정·에너지·경험·의미·가치·욕구·신념·정체성·은유·직관을 중심으로 봅니다.');
  buildKpcBranch_(form);

  const commonPage = form.addPageBreakItem()
    .setTitle('FILE ACCEPTANCE GATE · 고객동의')
    .setHelpText('영상이 꼭 필요한 것은 아닙니다. 목소리가 분명해야 합니다.');

  // KAC 분기에서 정상 진행하면 KPC 문항을 건너뛰고 공통 페이지로 이동합니다.
  kpcPage.setGoToPage(commonPage);
  setProductRouting_(form, kacPage, kpcPage);
  buildCommonAfter_(form);

  form.setDestination(FormApp.DestinationType.SPREADSHEET, spreadsheet.getId());
  publishForm_(form);

  properties.setProperty(CTC90_FORM.propertyKey, form.getId());
  const result = formResult_(form, true);
  writeFormLinks_(spreadsheet, result);
  console.log(JSON.stringify(result, null, 2));
  return result;
}

function configureForm_(form) {
  form.setTitle(CTC90_FORM.title)
    .setDescription([
      '당신의 코칭을 평가하기 전에, 함께 관찰합니다.',
      '',
      '코치더코치 90은 더 좋은 질문을 외우는 시간이 아닙니다.',
      '실제 고객과 나눈 코칭을 다시 바라보며,',
      '내가 무엇을 했는지, 고객에게 무엇이 일어났는지,',
      '어떤 강점이 반복되고 어디에서 한 걸음 더 성장할 수 있는지 함께 발견합니다.',
      '',
      '이 설문은 단순 신청서가 아닙니다. 지금부터 코치더코치가 시작됩니다.',
      '예상 소요: 약 5~8분',
    ].join('\n'))
    .setConfirmationMessage([
      '준비가 끝났습니다.',
      '',
      '설문을 작성하는 동안 이미 첫 번째 코치더코치가 시작되었습니다.',
      '이제 전용 1:1 카카오톡으로 돌아가 ‘CTC 사전설문 작성완료’라고 남겨주세요.',
      '',
      CTC90_FORM.kakaoUrl,
      '',
      '고객동의가 완료된 뒤 코치와 고객의 음성이 명확하게 구분되는 영상 또는 녹음파일을 전달해 주세요.',
    ].join('\n'))
    .setCollectEmail(false)
    .setAllowResponseEdits(false)
    .setProgressBar(true)
    .setPublishingSummary(false)
    .setShowLinkToRespondAgain(false);
}

function buildSharedBefore_(form) {
  section_(form, 'SECTION 01 — ABOUT YOU', '고객 개인정보가 아닌 참여코치의 기본정보만 받습니다.');
  shortText_(form, '성명', true);
  shortText_(form, '휴대전화', true, '일정·운영 연락을 위한 참여코치 연락처입니다.');
  multipleChoice_(form, '현재 보유 코치자격', ['없음', 'KAC', 'KPC', 'KSC'], true, true);
  multipleChoice_(form, '준비 중인 자격', ['KAC', 'KPC', '기타', '준비 중 아님'], true, false);
  multipleChoice_(form, '코칭경력 범위', ['1년 미만', '1~3년', '3~5년', '5년 이상'], true, false);

  const productItem = form.addMultipleChoiceItem()
    .setTitle('신청할 코치더코치 90을 선택해 주세요.')
    .setHelpText('KAC와 KPC는 동일한 평가상품이 아닙니다. 현재 준비수준과 성장목적에 맞춰 선택합니다.')
    .setRequired(true);
  productItem.setTitle('[상품선택] 신청할 코치더코치 90을 선택해 주세요.');

  section_(form, 'SECTION 02 — WHY NOW?', '지금 이 시점에 실제 코칭을 다시 보고 싶은 이유를 떠올려 봅니다.');
  checkbox_(form, '왜 지금 코치더코치를 받고 싶나요?', [
    '실제 내 코칭의 강점을 알고 싶다.',
    '반복되는 코칭습관을 발견하고 싶다.',
    '질문을 너무 많이 하는 습관을 점검하고 싶다.',
    '고객의 말을 충분히 듣고 있는지 확인하고 싶다.',
    '합의를 더 명확하게 하고 싶다.',
    '고객보다 앞서가는 순간을 발견하고 싶다.',
    '감정·욕구·가치를 더 깊게 듣고 싶다.',
    '실행을 고객 주도로 만들고 싶다.',
    'KAC 준비도를 점검하고 싶다.',
    'KPC 준비도를 점검하고 싶다.',
    '코치추천서 검토가 필요하다.',
    '내 코칭을 한 단계 성장시키고 싶다.',
  ], true, 3, true);
  paragraph_(form, '최근 코칭을 하면서 가장 자주 드는 생각은 무엇인가요?', true);

  section_(form, 'SECTION 03 — EXPECTATION', '이번 90분에서 무엇을 발견하고 싶은지 구체화합니다.');
  checkbox_(form, '이번 90분에서 무엇을 발견하고 싶나요?', [
    '내가 잘하고 있는 행동',
    '가장 먼저 바꿔야 할 습관',
    '고객에게 실제로 미치는 영향',
    '질문의 질',
    '경청과 반영',
    '기다리는 힘',
    '합의',
    '감정·욕구·가치 탐색',
    '실행과 책임',
    'KAC/KPC 수준에서 현재 위치',
    '추천서 검토',
    '나만의 코칭 강점',
  ], true, 3, false);
  paragraph_(form, '단 하나의 코칭행동을 바꿀 수 있다면 무엇을 바꾸고 싶나요?', true);

  section_(form, 'SECTION 04 — SELF OBSERVATION', '정답이 아니라 현재의 자기관찰을 남깁니다.');
  paragraph_(form, '제출할 코칭에서 스스로 잘했다고 느낀 장면이 있었나요?', true);
  paragraph_(form, '다시 돌아간다면 다르게 해보고 싶은 장면이 있나요?', true);
  paragraph_(form, '그 순간 고객에게 어떤 일이 일어났다고 생각하나요?', true);
}

function setProductRouting_(form, kacPage, kpcPage) {
  const productItem = form.getItems(FormApp.ItemType.MULTIPLE_CHOICE)
    .map(function(item) { return item.asMultipleChoiceItem(); })
    .find(function(item) { return item.getTitle().indexOf('[상품선택]') === 0; });
  if (!productItem) throw new Error('상품선택 문항을 찾지 못했습니다.');
  productItem.setChoices([
    productItem.createChoice('KAC 코치더코치 90', kacPage),
    productItem.createChoice('KPC 코치더코치 90', kpcPage),
  ]);
}

function buildKacBranch_(form) {
  checkbox_(form, '특히 확인하고 싶은 KAC 영역을 선택해 주세요.', [
    '관계', '합의', '고객 언어 경청', '감정·의도·욕구 반영', '열린 질문',
    '고객에게 선택권 두기', '실행', '세션 흐름', '아직 잘 모르겠다.',
  ], true, 3, false);
  paragraph_(form, 'KAC 코치더코치에서 가장 기대하는 것은 무엇인가요?', true);
}

function buildKpcBranch_(form) {
  checkbox_(form, '특히 확인하고 싶은 KPC 영역을 선택해 주세요.', [
    '통합적 경청', '침묵', '고객의 감정·에너지', '고객 경험과 의미',
    '가치·욕구·신념', '정체성', '은유·직관', '개입하지 않아야 할 순간',
    '통찰을 성장으로 통합', '코칭 존재감', '아직 잘 모르겠다.',
  ], true, 3, false);
  paragraph_(form, '지금 KPC 수준의 코칭에서 가장 어렵다고 느끼는 것은 무엇인가요?', true);
}

function buildCommonAfter_(form) {
  section_(form, 'VIDEO & AUDIO FILE 기준', '영상 또는 음성파일 모두 가능합니다. 가장 중요한 기준은 코치와 고객의 음성을 명확하게 식별할 수 있는가입니다.');
  consentCheckbox_(form, '실제 고객과 진행한 실제 코칭입니다.');
  consentCheckbox_(form, '코치와 고객의 목소리를 명확하게 구분할 수 있습니다.');
  consentCheckbox_(form, '두 사람의 대화 대부분을 충분히 들을 수 있습니다.');
  consentCheckbox_(form, '심한 잡음이나 음량 차이로 분석이 어려운 자료가 아닙니다.');
  consentCheckbox_(form, '실제 코칭의 흐름을 확인할 수 있는 자료입니다.');

  section_(form, '고객동의 확인', '고객 실명·연락처·상세 코칭주제는 입력하지 않습니다.');
  consentCheckbox_(form, '해당 코칭이 영상 또는 음성으로 기록되는 것에 동의받았습니다.');
  consentCheckbox_(form, '해당 자료가 참여코치의 코칭역량 향상을 위한 코치더코치 목적으로 사용된다는 점을 안내했습니다.');
  consentCheckbox_(form, 'DAILYCOACHING 상위코치가 해당 자료를 전달받아 사전분석한다는 사실을 안내했습니다.');
  consentCheckbox_(form, 'CTC 과정에서 코칭장면이 분석·피드백에 활용될 수 있음을 안내했습니다.');
  consentCheckbox_(form, '해당 자료가 홍보·콘텐츠·마케팅에 자동 활용되지 않는다는 사실을 안내했습니다.');
  consentCheckbox_(form, '정해진 운영정책에 따라 자료가 삭제된다는 사실을 안내했습니다.');
  multipleChoice_(form, '고객이 위 내용을 이해하고 동의했나요?', ['예', '아직 확인 전'], true, false, '‘아직 확인 전’인 경우 고객동의 확인 후 파일을 전달해 주세요.');

  section_(form, '추천서 검토', '추천서는 상품이 아니라 관찰의 결과입니다. 검토는 포함되지만 작성 자체가 자동 보장되지는 않습니다.');
  multipleChoice_(form, '추천서 검토가 필요한가요?', ['예', '아니요', '아직 모르겠습니다.'], true, false);
  paragraph_(form, '추천서보다 이번 CTC에서 더 중요하게 얻고 싶은 것이 있다면 적어주세요.', false);

  section_(form, '마지막 성찰', '이번 CTC의 기대를 한 문장으로 남깁니다.');
  paragraph_(form, '이번 코치더코치 90을 통해 나는 ______을/를 발견하고 싶다.', true);
  paragraph_(form, '이번 CTC에서 상위코치가 꼭 알아줬으면 하는 것이 있나요?', false);
}

function section_(form, title, helpText) {
  return form.addSectionHeaderItem().setTitle(title).setHelpText(helpText || '');
}

function shortText_(form, title, required, helpText) {
  const item = form.addTextItem().setTitle(title).setRequired(required);
  if (helpText) item.setHelpText(helpText);
  return item;
}

function paragraph_(form, title, required, helpText) {
  const item = form.addParagraphTextItem().setTitle(title).setRequired(required);
  if (helpText) item.setHelpText(helpText);
  return item;
}

function multipleChoice_(form, title, values, required, showOther, helpText) {
  const item = form.addMultipleChoiceItem()
    .setTitle(title)
    .setChoiceValues(values)
    .setRequired(required);
  if (showOther) item.showOtherOption(true);
  if (helpText) item.setHelpText(helpText);
  return item;
}

function checkbox_(form, title, values, required, maxSelections, showOther) {
  const item = form.addCheckboxItem()
    .setTitle(title)
    .setChoiceValues(values)
    .setRequired(required);
  if (showOther) item.showOtherOption(true);
  if (maxSelections) {
    const validation = FormApp.createCheckboxValidation()
      .setHelpText('최대 ' + maxSelections + '개까지 선택해 주세요.')
      .requireSelectAtMost(maxSelections)
      .build();
    item.setValidation(validation);
  }
  return item;
}

function consentCheckbox_(form, statement) {
  return form.addCheckboxItem()
    .setTitle(statement)
    .setChoiceValues(['확인했습니다.'])
    .setRequired(true);
}

function publishForm_(form) {
  if (typeof form.supportsAdvancedResponderPermissions === 'function' && form.supportsAdvancedResponderPermissions()) {
    form.setPublished(true);
  } else {
    form.setAcceptingResponses(true);
  }
}

function formResult_(form, created) {
  return {
    created: created,
    formId: form.getId(),
    title: form.getTitle(),
    publishedUrl: form.getPublishedUrl(),
    editUrl: form.getEditUrl(),
    destinationId: form.getDestinationId(),
    itemCount: form.getItems().length,
  };
}

function writeFormLinks_(spreadsheet, result) {
  const designSheet = spreadsheet.getSheetByName('Form 설계');
  if (designSheet) {
    designSheet.getRange('H1:I4').setValues([
      ['실제 Form 연결', '값'],
      ['응답자 URL', result.publishedUrl],
      ['편집 URL', result.editUrl],
      ['Form ID', result.formId],
    ]);
    designSheet.getRange('H1:I1').setFontWeight('bold').setBackground('#061528').setFontColor('#FFFFFF');
    designSheet.getRange('H1:I4').setWrap(true);
    designSheet.setColumnWidth(8, 120);
    designSheet.setColumnWidth(9, 420);
  }

  const gateSheet = spreadsheet.getSheetByName('출시 게이트');
  if (gateSheet) {
    gateSheet.getRange('D6').setValue('검토중');
    gateSheet.getRange('E6').setValue(result.editUrl);
    gateSheet.getRange('F6').setValue('실제 Form 생성 완료. KAC/KPC 분기·필수문항·완료화면 검수 후 통과로 변경합니다.');
  }
}

