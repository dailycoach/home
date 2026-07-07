# KGM210 Notion Submit API

Cloudflare Worker endpoint for saving completed KGM210 results to Notion.

## Endpoint

- `POST https://daily-coach-ing.com/api/kgm210-submit`
- Compatibility route: `POST https://daily-coach-ing.com/wp-json/kgm210/v1/submit`

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

## Local Mock Test

```bash
node workers/kgm210-notion-submit/test-worker.mjs
```

This test does not call Notion. It stubs Notion API responses and checks validation, create, duplicate, and origin handling.

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
