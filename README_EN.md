# ReqSmith

[中文](/README.md) | [English](/README_EN.md)

Lightweight request interceptor & mock extension with multi-rule support, notifications, and custom responses.

## Features
- URL pattern interception (`*` wildcard or `re:` regex)
- HTTP Method filter (ANY/GET/POST/PUT/DELETE/PATCH/HEAD/OPTIONS)
- Custom JSON body and status code (effective for page-level interception)
- Multi-rule management (add/edit/delete/enable)
- Optional hit toast notification
- Debug mode logs request/response info
- Optional “Block real request” (DNR block)

## Install & Use
1. Open `chrome://extensions` and enable **Developer mode**.
2. Click **Load unpacked** and select this folder.
3. Open the extension popup, add/save rules.
4. Refresh the target page to apply rules.

## Rule Notes
- **Rule name**: used in list display and notifications.
- **HTTP Method**: intercept only the specified method (ANY = all).
- **URL pattern**: supports `*` wildcard or `re:` regex, e.g.
  - `https://api.example.com/v1/*`
  - `re:^https://log\.example\.com/clientlog/web(\?.*)?$`
- **Response JSON**: payload returned on hit.
- **Status code**: effective in page-level interception.
- **Block real request**: blocks network request (Network may show `ERR_BLOCKED_BY_CLIENT`).
- **Hit toast**: page-level toast notification.
- **Debug output**: console logs for request/response details.

## Debug Output
When Debug is enabled, the console logs:
- Raw URL / resolved URL
- Method
- Request body (when readable)
- Response status & body (truncated)

## Limitations
- **Page-level interception**: only affects page JS `fetch / XHR / sendBeacon`.
- **Browser/Service Worker/Worker requests**: cannot return custom body directly; only block or redirect.
- **No network trace**: page-level interception returns locally, so packet capture may not see the request.

To support **capturable traffic + custom response**, you can extend this to a **proxy mode** (local mock server + Chrome proxy).

## Files
- `manifest.json`: extension config (MV3)
- `popup.html` / `popup.js`: UI
- `background.js`: DNR rules + notifications
- `content-script.js` / `inject.js`: page interception logic

## Publish to GitHub (Suggested Flow)
1. Bump version: update `version` in `manifest.json`.
2. Update notes: add a short change summary in `README.md` (or `CHANGELOG`).
3. Add license: include `LICENSE` (common: MIT/Apache-2.0).
4. Tag and push:
   - `git tag vX.Y.Z`
   - `git push origin vX.Y.Z`
5. Create a GitHub Release for the same tag and paste release notes.

## Dev Tips
After changes, click **Reload** in `chrome://extensions`.
