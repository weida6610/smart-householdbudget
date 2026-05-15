# Smart Household Budget Deployment

This file is the handoff checklist for publishing the tool manually.

## 1. Create The GitHub Repo Manually

1. Open GitHub and create a new repository.
2. Recommended repo name: `smart-householdbudget`.
3. Keep it private while testing. GitHub Pages can still be enabled for private repos only on paid plans; if private Pages is unavailable, use a public repo and keep secrets out of files.
4. Do not initialize with README, `.gitignore`, or license because the local project already has files.
5. After GitHub creates the repo, copy the repository URL.

Back in PowerShell:

```powershell
cd C:\Users\User\smart-householdbudget
git add .
git commit -m "Initial smart household budget app"
git branch -M main
git remote add origin <GITHUB_REPO_URL>
git push -u origin main
```

Enable GitHub Pages:

1. In the repo, open `Settings` -> `Pages`.
2. Source: `Deploy from a branch`.
3. Branch: `main`.
4. Folder: `/docs`.
5. Save.
6. Wait for GitHub to show the Pages URL.

The Pages URL becomes the Apps Script property `MINI_APP_URL`.

## 2. Apps Script Project

Create or choose an Apps Script project, then bind this local project:

```powershell
cd C:\Users\User\smart-householdbudget
Copy-Item .clasp.json.example .clasp.json
```

Edit `.clasp.json` and replace `PUT_APPS_SCRIPT_PROJECT_ID_HERE` with the Apps Script project ID.

Install local clasp dependency if needed:

```powershell
npm.cmd install
```

Push the GAS source:

```powershell
npm.cmd run push
```

## 3. Apps Script Properties

Open Apps Script project settings and add these Script Properties:

| Property | Value |
| --- | --- |
| `TG_BOT_TOKEN` | Paste the Telegram bot token from BotFather. Do not commit this value. |
| `OWNER_CHAT_ID` | `8958254633` |
| `SPREADSHEET_ID` | `1h1qhOeeWEDF_doYncAd2eBhXADj18MaM6DX9XTheqf4` |
| `MINI_APP_URL` | GitHub Pages URL from step 1 |
| `GAS_WEBAPP_URL` | Apps Script Web App `/exec` URL from step 4 |

Optional browser fallback:

| Property | Value |
| --- | --- |
| `APP_SHARED_SECRET` | Any long random string, only if you want to use the app outside Telegram. |

## 4. Deploy The Apps Script Web App

1. In Apps Script, open `Deploy` -> `New deployment`.
2. Type: `Web app`.
3. Execute as: `Me`.
4. Who has access: `Anyone`.
5. Deploy.
6. Copy the `/exec` URL.
7. Save that URL into Script Properties as `GAS_WEBAPP_URL`.

Then run these functions once in Apps Script:

1. `setup()`
2. `setupTelegramWebhook()`
3. `setupTelegramMenu()`

`setupTelegramWebhook()` creates a random `WEBHOOK_SECRET` Script Property if it does not already exist, then registers Telegram webhook with that secret in the webhook URL query string. Apps Script web apps do not expose incoming HTTP headers to `doPost(e)`, so the Telegram header-based secret is not usable directly in this GAS endpoint.

## 5. Telegram Checks

In Telegram, open the bot and send:

```text
/start
```

Expected behavior:

- The bot shows a lower reply keyboard: `記一筆`, `本月摘要`, `查詢紀錄`, `設定`.
- The bot sends an inline `開啟記帳工具` button.
- `本月摘要` returns the current month totals.
- Quick entry works with text like:

```text
支出 餐飲 120 午餐
收入 薪資 50000 五月薪水
```

## 6. Browser Check

Open the GitHub Pages URL directly.

If not inside Telegram, go to `設定` and enter:

- Apps Script API URL: the `/exec` deployment URL.
- Browser App Key: the `APP_SHARED_SECRET`, if you configured it.

Telegram Mini App use should not need the browser app key because it uses Telegram `initData` validation.
