# KGM210 Item Research Google Sheets Sync

This Apps Script turns the KGM210 Google Spreadsheet into an item-research source workbook based on:

`KGM210_성장검사_문항연구용_마스터엑셀_v1.xlsx`

## Required Sheets

The script creates and maintains the required 11 research sheets:

1. `00_Overview`
2. `01_ItemMaster`
3. `02_ItemReview_CVI`
4. `03_RawWide_Input`
5. `04_RawLong_Template`
6. `05_ItemAnalysis`
7. `06_Scale7_Codebook`
8. `07_ConstructMap`
9. `08_ValidationPlan`
10. `09_NotionPayloadMap`
11. `10_Lists`

It also keeps `KGM210_Log` for operational logs.

## Data Targets

- Wide format target: `03_RawWide_Input`
- Long format target: `04_RawLong_Template`
- One completed test creates:
  - 1 Wide row
  - 210 Long rows

Direct identifying fields such as name and contact are intentionally not written to the research sheets.

## Migration / Backup

Before installing the item-research template, export the current data:

- `GET <WEB_APP_URL>?action=export-wide-csv`
- `GET <WEB_APP_URL>?action=export-long-csv`

When the updated script is deployed, run once:

`GET <WEB_APP_URL>?action=install-item-research-template`

This renames legacy sheets if they exist:

- `KGM210_Wide`
- `KGM210_Long`
- `KGM210_Log`

to:

`archive_before_item_research_v1_YYYYMMDD_HHMMSS_<old_sheet_name>`

Then it creates the new 11-sheet item-research structure.

## Deploy

1. Open the KGM210 Google Spreadsheet.
2. Extensions > Apps Script.
3. Replace `Code.gs` with this file.
4. Deploy > Manage deployments.
5. Edit the Web App deployment.
6. Execute as: `Me`.
7. Who has access: `Anyone`.
8. Deploy/update.
9. Open `<WEB_APP_URL>?action=install-item-research-template` once.

## Browser Submit

The KGM210 HTML sends a `FormData` POST with:

- `action=kgm210Submit`
- `submissionId`
- `payload` as JSON

The browser uses `mode: "no-cors"` for Google Apps Script compatibility. The client also prevents duplicate resubmission with `localStorage.kgm210_last_submission_id`, and the server checks duplicate `submissionId`.

## Export URLs

After deployment:

- `GET <WEB_APP_URL>?action=export-wide-csv`
- `GET <WEB_APP_URL>?action=export-long-csv`
- `GET <WEB_APP_URL>?action=export-log-csv`

## Validation Rules

The script only accepts payloads where:

- `completed === true`
- `answerCount === 210`
- `submissionId` exists
- `anonymousResearchId` exists
- `itemResponsesJson` exists
- `itemResponsesJson` contains 210 values
- all response values are integers from 1 to 7

## Local Check

Run:

```bash
node google-apps-script/kgm210-sheets-sync/test-transform.mjs
```

Expected:

- 210 items
- K/I/N/G/D/O/M each 30 items
- X/Y/Z each 70 items
- Z1~Z10 each 21 items
- 7-flow distribution: 21/42/21/63/21/21/21
- Wide columns: 235
- Long rows per person: 210
