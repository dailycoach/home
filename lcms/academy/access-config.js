(() => {
  'use strict';

  window.RSEDU_ACADEMY_ACCESS = Object.freeze({
    playbackWorkerUrl: 'https://lmc-r2-video-gateway.ros2468.workers.dev',
    courseId: 'lmc-lifetime-management-counselor',
    entryPath: './enter.html',
    defaultNext: './course.html?course=lmc-lifetime-management-counselor',
    storageKey: 'rsedu-academy-access:v1',
    requestTimeoutMs: 35000,
    sessionHours: 12
  });
})();
