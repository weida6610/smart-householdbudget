# Smart Household Budget Workflow

## Source Of Truth

- Frontend source: `C:\Users\User\smart-householdbudget\docs`
- GAS source: `C:\Users\User\smart-householdbudget\src\Code.js`
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

## Safety Notes

- Keep Telegram token and app shared secret in Apps Script Properties only.
- Do not commit `.clasp.json`, bot tokens, or app keys.
- Use Telegram initData validation for normal Mini App use.
- The fallback `APP_SHARED_SECRET` is for personal browser access only.
