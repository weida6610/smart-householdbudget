# Smart Household Budget Worklog

## 2026-05-15

- Created local project at `C:\Users\User\smart-householdbudget`.
- Built GitHub Pages-ready frontend in `docs/`.
- Built Apps Script backend in `src/Code.js` for:
  - Google Sheet schema setup.
  - Transaction create, update, delete, list, and monthly summary API.
  - Telegram `/start`, reply keyboard, Mini App open button, `/summary`, and quick text entry.
  - Telegram Mini App `initData` validation and optional browser app key fallback.
- Added clasp workflow scripts:
  - `scripts/Backup-Gas.ps1`
  - `scripts/Push-Gas.ps1`
  - `scripts/Pull-Gas.ps1`
- Added setup docs in `README.md` and reopen workflow in `WORKFLOW.md`.
- Initialized a local Git repository. No remote has been added and nothing has been pushed.
- Added `DEPLOYMENT.md` with the manual GitHub repo, GitHub Pages, Apps Script, Script Properties, and Telegram validation flow.
- Added manual handoff text files under `exports/`:
  - `APPS_SCRIPT_CODE.txt`
  - `APPS_SCRIPT_MANIFEST.txt`
  - `SCRIPT_PROPERTIES_TEMPLATE.txt`
  - `MANUAL_FLOW.txt`
- Added `exports/` to `.gitignore` so manual setup files and token fill-in templates are not pushed.
- Captured current deployment inputs without storing the Telegram token in source files:
  - `OWNER_CHAT_ID`: `8958254633`
  - `SPREADSHEET_ID`: `1h1qhOeeWEDF_doYncAd2eBhXADj18MaM6DX9XTheqf4`
- Local checks completed:
  - `npm.cmd test` passed.
  - Preview server responded at `http://127.0.0.1:8125/`.
  - Browser preview loaded with no console warnings or errors.

## Still Needed

- Create or choose the GitHub repository for Pages and push the local repo.
- Create or bind the Apps Script project and set `.clasp.json`.
- Set Apps Script Properties:
  - `TG_BOT_TOKEN`
  - `OWNER_CHAT_ID`
  - `SPREADSHEET_ID`
  - `MINI_APP_URL`
  - `GAS_WEBAPP_URL`
- Deploy the Apps Script Web App and run:
  - `setup()`
  - `setupTelegramWebhook()`
  - `setupTelegramMenu()`
