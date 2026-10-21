# V3.1 PHASE 0 · RECHECK

2026-10-21 KST, GitHub API와 로컬 git을 대조했다.

- PR #208: open, draft=true, merged=false.
- 원격 head 및 로컬 HEAD: `99c7cda61e84487afdfd02213fe80401a9c7c256`.
- 원격 main: `6faa99110b2662ba67a88068edc6c12a8c916833`, V3.0의 main 기준과 동일.
- 다른 작업자의 후속 커밋이나 시작 시 로컬 수정 없음. 기존 branch에서 이어갔다.
- 수정 전 index/styles/refinement/viewport/app 및 저장·렌더 계약·기존 테스트를 조사했다.
- 원본 SHA의 detached worktree에서 실제 Chromium/WebKit 기준선 캡처. 변경 코드와 같은 viewport·state로 비교했다.
- 사용자 V3.1 지시의 P1 2건/P2 4건을 구현 범위로 사용했다. 기존 선택 B안 crop은 `../v3/reference-B.png`.
- 후속 커밋은 parent lease를 확인해 기존 branch에 fast-forward로만 반영한다. 강제 push·main 수정·운영 배포 없음.

PHASE 1/2 구현 및 PHASE 3/4 증거는 ../../QA.md, PHASE 5 인계는 ../../HANDOFF.md에 있다.
