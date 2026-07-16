(() => {
  'use strict';
  const data = window.DISC16_YOUTH_DATA;
  if (!data) return;

  const order = [0, 8, 9, 1, 2, 10, 3, 11, 12, 4, 13, 5, 6, 14, 15, 7];
  data.QUESTIONS = order.map(index => data.QUESTIONS[index]);
  data.DISPLAY = order.map(index => data.DISPLAY[index]);

  if (data.PROFILES?.I) data.PROFILES.I.name = '사교형';
})();
