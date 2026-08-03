/** 수강기간 만료 권한 회수용 일일 트리거 설치 */

function ensureExpiryTrigger_() {
  const handler = 'expireStudentAccesses';
  const exists = ScriptApp.getProjectTriggers().some(function(trigger) {
    return trigger.getHandlerFunction() === handler;
  });
  if (!exists) {
    ScriptApp.newTrigger(handler)
      .timeBased()
      .atHour(3)
      .everyDays(1)
      .create();
  }
}
