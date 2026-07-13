'use strict';
const {test,expect}=require('@playwright/test');

const APP='/tests/kgm210/index.html';

async function waitForWeeklyAssets(page){
  await expect.poll(()=>page.evaluate(()=>Boolean(
    window.KGMWeeklyJourneyV315&&
    window.KGM_WEEKLY_JOURNEY_V315?.ok&&
    window.KGM_WEEKLY_QA_V3151?.ok
  )),{timeout:20000}).toBe(true);
}

async function openClean(page){
  await page.goto(APP,{waitUntil:'domcontentloaded'});
  await page.evaluate(()=>localStorage.clear());
  await page.reload({waitUntil:'domcontentloaded'});
  await waitForWeeklyAssets(page);
}

async function openJourney(page,source='e2e'){
  await page.evaluate(source=>window.KGM_WEEKLY_JOURNEY_V315.open(source),source);
  await expect(page.locator('#weeklyJourneyScreenV315')).toBeVisible();
}

async function fillWeek(page,week){
  await page.locator('#weeklyPostInsightV315').fill(`${week}주차에 새롭게 알게 된 것`);
  await page.locator('#weeklyPostPhraseV315').fill(`${week}주차에 가져갈 한 문장`);
  await page.locator('#weeklyPostActionV315').fill(`${week}주차에 확인할 작은 행동`);
  await page.locator('#weeklyPostReturnV315').fill('흔들려도 다음 장면에서 다시 시작한다');
  await page.locator('#weeklyPostNextV315').fill('다음 대화에서 실제 장면을 확인한다');
}

test.describe('KGM210 7주 성장여정 모바일 회귀검수',()=>{
  test.beforeEach(async({page})=>{
    page.on('dialog',dialog=>dialog.accept());
    await openClean(page);
  });

  test('시작 → 자동저장 → 새로고침 복원 → 7주 완료 → 인쇄 상태',async({page})=>{
    await openJourney(page);

    await page.locator('#weeklyThemeV315').fill('책임을 다 떠안는 장면에서 내 몫을 구분하기');
    await page.locator('#weeklySuccessV315').fill('필요한 기준을 말하고 타인의 몫을 돌려준다');
    await page.locator('#weeklyStartV315').click();

    await expect(page.locator('#weeklyJourneyScreenV315 h2')).toContainText('1주차');
    await page.locator('#weeklyPreSceneV315').fill('팀 회의에서 다른 사람의 일까지 대신 맡은 장면');
    await page.locator('#weeklyAttemptV315').selectOption({label:'조금 해봄'});
    await page.locator('#weeklyPreLearningV315').fill('기준을 말하지 않고 대신 처리했다');
    await page.locator('#weeklyPreAgendaV315').fill('내 몫을 구분하고 싶다');
    await fillWeek(page,1);

    await expect(page.locator('#weeklyAutosaveV3151')).toHaveText('이 기기에 자동 저장됨',{timeout:5000});
    await expect.poll(()=>page.evaluate(()=>{
      const row=JSON.parse(localStorage.getItem('kgm210:seven-week-journey:v1'));
      return row?.weeks?.[0]?.pre?.scene||'';
    })).toContain('팀 회의');

    await page.reload({waitUntil:'domcontentloaded'});
    await waitForWeeklyAssets(page);
    await openJourney(page,'reload');

    await expect(page.locator('#weeklyPreSceneV315')).toHaveValue('팀 회의에서 다른 사람의 일까지 대신 맡은 장면');
    await expect(page.locator('#weeklyPostPhraseV315')).toHaveValue('1주차에 가져갈 한 문장');

    await page.locator('#weeklyCloseV315').click();
    await expect(page.locator('#weeklyEntryV315 .weeklyConversationPreviewV3151')).toContainText('K · 주도권 열기');
    await expect(page.locator('#weeklyEntryV315 .weeklyConversationPreviewV3151')).toContainText('1주차에 가져갈 한 문장');

    await openJourney(page,'reentry');

    for(let week=1;week<=7;week++){
      if(week>1)await fillWeek(page,week);
      await page.locator('#weeklyCompleteWeekV315').click();
      if(week<7){
        await expect(page.locator('#weeklyJourneyScreenV315 h2')).toContainText(`${week+1}주차`);
      }else{
        await expect(page.locator('#weeklyJourneyScreenV315 h2')).toContainText('7주 성장통합');
      }
    }

    const stored=await page.evaluate(()=>JSON.parse(localStorage.getItem('kgm210:seven-week-journey:v1')));
    expect(stored.status).toBe('completed');
    expect(stored.weeks.filter(w=>w.completedAt).length).toBe(7);
    expect(stored.weeks.map(w=>w.key)).toEqual(['K','I','N','G','D','O','M']);

    const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(1);

    await page.emulateMedia({media:'print'});
    await expect(page.locator('#weeklyJourneyScreenV315')).toBeVisible();
    const buttonDisplay=await page.locator('#weeklyJourneyScreenV315 button').first().evaluate(el=>getComputedStyle(el).display);
    expect(buttonDisplay).toBe('none');
  });

  test('고객 화면의 7일 문구는 7주로 바꾸고 이전 단기기록 표기는 보존',async({page})=>{
    const qaAttempts=await page.evaluate(()=>window.KGM_WEEKLY_QA_V3151.attempts);
    expect(qaAttempts).toBeGreaterThanOrEqual(0);

    await page.evaluate(()=>{
      const current=document.createElement('div');
      current.id='weeklyCurrentTermProbe';
      current.textContent='7일 성장기록 · 오늘 기록하기';
      const legacy=document.createElement('div');
      legacy.id='weeklyLegacyTermProbe';
      legacy.className='weeklyLegacyV315';
      legacy.textContent='기존 7일 기록 3건';
      document.body.append(current,legacy);
    });

    await expect(page.locator('#weeklyCurrentTermProbe')).toHaveText('7주 성장여정 · 이번 주 기록하기');
    await expect(page.locator('#weeklyLegacyTermProbe')).toHaveText('기존 7일 기록 3건');
  });
});