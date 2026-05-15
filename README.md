# Smart Household Budget

Personal bookkeeping tool using:

- GitHub Pages for the static app and Telegram Mini App UI.
- Google Apps Script as the API, Telegram webhook, and Google Sheet writer.
- Google Sheets as the transaction database.

## Main Folders

- `docs/` - GitHub Pages static frontend.
- `src/` - Google Apps Script backend. Main GAS file: `src/程式碼.js`.
- `scripts/` - local clasp backup, push, and pull helpers.

## Sheet Model

`Transactions` keeps one transaction per row:

`id, timestamp, date, type, category, account, amount, currency, note, payee, source, chat_id, updated_at`

`Categories` keeps editable category metadata:

`type, name, budget_monthly, active, sort`

## Required Script Properties

Set these in Apps Script project settings:

- `TG_BOT_TOKEN` - Telegram bot token from BotFather.
- `OWNER_CHAT_ID` - your Telegram numeric chat ID. Keeps the bot personal.
- `SPREADSHEET_ID` - target Google Sheet ID. If omitted, the script creates a spreadsheet on first run.
- `MINI_APP_URL` - GitHub Pages URL for `docs/index.html`.
- `GAS_WEBAPP_URL` - Apps Script `/exec` deployment URL, used by `setupTelegramWebhook()`.

Optional:

- `APP_SHARED_SECRET` - fallback browser key for non-Telegram use. Do not publish it in the repo.
- `MAX_INITDATA_AGE_SECONDS` - Telegram Mini App auth age limit. Default is `86400`.
- `AUTH_DISABLED` - set to `true` only for temporary local testing.

## Setup

For the full manual GitHub, Apps Script, Google Sheet, and Telegram flow, use `DEPLOYMENT.md`.

1. Install clasp dependencies:

   ```powershell
   npm.cmd install
   ```

2. Create or bind an Apps Script project:

   ```powershell
   Copy-Item .clasp.json.example .clasp.json
   ```

   Put the real Apps Script project ID in `.clasp.json`.

3. Push the backend:

   ```powershell
   npm.cmd run push
   ```

4. Deploy Apps Script as a Web App:

   - Execute as: `Me`
   - Who has access: `Anyone`

5. Set `GAS_WEBAPP_URL` to the deployment `/exec` URL.

6. Run these Apps Script functions once:

   - `setup()`
   - `setupTelegramWebhook()`
   - `setupTelegramMenu()`

7. Publish `docs/` with GitHub Pages and set `MINI_APP_URL` to that page.

## Local Check

```powershell
npm.cmd test
```

PowerShell may block `npm.ps1` on this machine, so prefer `npm.cmd`.
