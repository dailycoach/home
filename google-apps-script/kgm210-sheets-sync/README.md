# KGM210 Google Sheets Sync

This replaces the Cloudflare Worker deployment path with a Google Apps Script Web App attached to a Google Spreadsheet.

## Spreadsheet Tabs

The script creates and maintains:

- `KGM210_Wide`: one row per completed test, with `Q001` through `Q210`
- `KGM210_Long`: 210 rows per completed test
- `KGM210_Log`: success, duplicate, and failure logs

Direct identifying fields such as `name` and `contact` are intentionally not written to the research export sheets.

## Deploy

1. Create or open the Google Spreadsheet that will hold the KGM210 data.
2. Extensions > Apps Script.
3. Paste `Code.gs`.
4. Deploy > New deployment > Web app.
5. Execute as: `Me`.
6. Who has access: choose the lowest access that still lets the KGM210 public page post. In many cases this is `Anyone`.
7. Copy the Web App URL.
8. Put that URL into the KGM210 HTML constant:

```js
window.KGM_GOOGLE_SHEETS_ENDPOINT = 'https://script.google.com/macros/s/.../exec';
```

## Browser Submit

The KGM210 HTML sends a `FormData` POST with:

- `action=kgm210Submit`
- `submissionId`
- `payload` as JSON

The browser uses `mode: "no-cors"` for Google Apps Script compatibility. The client still prevents duplicate resubmission with `localStorage.kgm210_last_submission_id`.

## Export URLs

After deployment:

- `GET <WEB_APP_URL>?action=export-wide-csv`
- `GET <WEB_APP_URL>?action=export-long-csv`

