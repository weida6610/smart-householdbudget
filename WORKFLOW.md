# Smart Household Budget Workflow

## Source Of Truth

- Frontend source: `C:\Users\User\smart-householdbudget\docs`
- GAS source: `C:\Users\User\smart-householdbudget\src\程式碼.js`
- Manifest: `C:\Users\User\smart-householdbudget\src\appsscript.json`

## Standard Change Flow

1. Edit `docs/` or `src/`.
2. Run:

   ```powershell
   npm.cmd test
   ```

3. For GAS changes, push with backup:

   ```powershell
   npm.cmd run push
   ```

4. If webhook or Mini App behavior changed, create a new Apps Script deployment version and update `GAS_WEBAPP_URL` if the `/exec` URL changed.
5. Re-run `setupTelegramWebhook()` and `setupTelegramMenu()` after changing deployment URL or GitHub Pages URL.

## Clasp Run Notes

`npm.cmd run push`, `npx.cmd clasp redeploy`, and `npx.cmd clasp run` use different Google permissions. Push/deploy can work while `clasp run` still fails.

For `clasp run` to work reliably, the project needs:

- The same Google account owning or editing the Apps Script project and the local clasp login.
- A standard Google Cloud project attached to the Apps Script project.
- Apps Script API enabled in that Google Cloud project.
- `executionApi.access` set in `appsscript.json`.
- A fresh `clasp login` using the correct Google account after the Cloud project and API are configured.

## Safety Notes

- Keep Telegram token and app shared secret in Apps Script Properties only.
- Do not commit `.clasp.json`, bot tokens, or app keys.
- Use Telegram initData validation for normal Mini App use.
- Use `setupTelegramWebhook()` after deployment so Telegram webhook requests include the generated `WEBHOOK_SECRET` query token.
- The fallback `APP_SHARED_SECRET` is for personal browser access only.
