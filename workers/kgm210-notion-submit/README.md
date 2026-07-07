# KGM210 Notion Submit API

Cloudflare Worker endpoint for saving completed KGM210 results to Notion.

## Endpoint

- `POST https://daily-coach-ing.com/api/kgm210-submit`
- Compatibility route: `POST https://daily-coach-ing.com/wp-json/kgm210/v1/submit`
- Wide CSV export: `GET https://daily-coach-ing.com/wp-json/kgm210/v1/export-wide-csv`
- Long CSV export: `GET https://daily-coach-ing.com/wp-json/kgm210/v1/export-long-csv`
- Wide alias: `GET https://daily-coach-ing.com/wp-json/kgm210/v1/export-csv`
- Serverless aliases:
  - `GET https://daily-coach-ing.com/api/kgm210-export-wide`
  - `GET https://daily-coach-ing.com/api/kgm210-export-long`

## Environment

Set these on the Worker. Never put `NOTION_TOKEN` in browser HTML.

```bash
wrangler secret put NOTION_TOKEN
wrangler deploy
```

Configured in `wrangler.toml`:

- `NOTION_KGM210_DATA_SOURCE_ID=367cc114-9118-43e4-9920-0decf9ae3e75`
- `KGM210_ALLOWED_ORIGIN=https://daily-coach-ing.com`

Optional:

- `NOTION_VERSION=2025-09-03`

## Required Request Rules

- Actual writes accept `POST` only.
- `OPTIONS` is handled only for browser CORS preflight.
- `Origin` must be `https://daily-coach-ing.com`.
- Payload must include:
  - `completed: true`
  - `answerCount: 210`
  - `anonymousResearchId`
  - `submissionId`
  - `itemResponsesJson` as valid JSON array with 210 entries

## Duplicate Handling

The Worker queries Notion by `제출ID`. If the same `submissionId` already exists, it does not create another row and returns:

```json
{ "ok": true, "duplicate": true }
```

## Research CSV Export

Export queries only records that match all of these conditions:

- `연구사용상태 = 사용가능`
- `완료여부 = true`
- `응답수 = 210`
- `문항응답JSON` exists
- `익명연구ID` exists

Wide CSV includes anonymous metadata, score columns, and `Q001` through `Q210`.

Long CSV includes one row per item response:

- `제출ID`
- `익명연구ID`
- `제출일시`
- `검사버전`
- `척도`
- `문항번호`
- `영역`
- `과정`
- `Z지표`
- `응답값`

The export intentionally excludes direct contact fields such as `이름` and `연락처`.

After a record is exported successfully, the Worker updates Notion `스프레드시트동기화` to `완료`. If a matching record cannot be converted because its item JSON is invalid, the Worker updates that page to `실패`. Non-exportable records are not touched.

## Local Mock Test

```bash
node workers/kgm210-notion-submit/test-worker.mjs
node workers/kgm210-notion-submit/test-export.mjs
```

These tests do not call Notion. They stub Notion API responses and check validation, create, duplicate, origin handling, wide export, long export, score preservation, anonymous-only CSV columns, and sync status updates.

## Live Smoke Test Shape

After deploying the Worker and setting `NOTION_TOKEN`, send a real POST with an `Origin` header. Use the complete generated payload shape in `test-worker.mjs` or copy `window.KGM_RESEARCH_PAYLOAD` from a completed browser result.

```bash
curl -i https://daily-coach-ing.com/api/kgm210-submit \
  -H "Origin: https://daily-coach-ing.com" \
  -H "Content-Type: application/json" \
  --data @kgm210-payload.json
```

Expected first response:

```json
{ "ok": true, "duplicate": false }
```

Expected duplicate response for the same `submissionId`:

```json
{ "ok": true, "duplicate": true }
```
