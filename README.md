# Internal Medicine Training Suite: desktop and web app

This project converts `Internal Medicine Training Suite (Offline)_V19.html` into:

1. **Desktop software** for **Windows** (installer + portable `.exe`) and **macOS** (`.dmg`, Intel + Apple Silicon).
2. **An installable offline web app (PWA)** that works in Edge, Chrome or Safari on either system.

All features work offline: the Clinical Console, Rota Builder, Exam Schedule, printing, JSON backup/restore, and CSV/XLSX import/export.

## Folder layout

| Path | What it is |
|---|---|
| `app/` | The web app (index.html, fonts, icons, Lucide icons, offline service worker) |
| `electron/main.js` | Desktop window shell (menus, print, save dialogs, single instance) |
| `tools/import-bundle.js` | Converter: rebuilds `app/` from a new bundled HTML version |
| `tools/serve.js` | Tiny local web server for the PWA |
| `dist/` | Built Windows installers |
| `build/app-icon-source.png` | App icon (Department of Internal Medicine badge). Replace it and re-run `npm run import` to change the icon |
| `BUILD_MAC_APP.command` | Double-click on a Mac to build the macOS app |

## Windows

In `dist/`:
- `Internal Medicine Training Suite Setup 19.0.0.exe`: installer with Start-menu and desktop shortcuts.
- `Internal Medicine Training Suite-19.0.0-Portable.exe`: runs without installing (for example, from a USB stick).

The build is unsigned, so SmartScreen may warn on first run. Choose **More info → Run anyway**.

## Building on GitHub (no Mac needed to build)

The repository's `.github/workflows/build.yml` builds both apps on GitHub's own machines:
1. Open the private repository on github.com, then **Actions → Build desktop apps → Run workflow**. It also runs automatically whenever the app files change.
2. Wait about 10 minutes for the green tick, then open the run.
3. Under **Artifacts**, download **IM-Training-Suite-macOS**. It contains the `.dmg` and a `.zip`, and works on Intel and Apple Silicon Macs. **IM-Training-Suite-Windows** contains the `.exe` files.

The downloads stay available for 30 days, and you can re-run the build at any time.

### Opening the Mac app the first time
The app is not registered with Apple, so macOS blocks it the first time:
- Open the `.dmg`, drag the app to **Applications**, then try to open it once.
- Go to **System Settings → Privacy & Security**, scroll down and click **Open Anyway** next to the app's name. On older macOS, right-click the app and choose **Open** instead.
- If macOS says the app **"is damaged"**, run this once in Terminal:
  `xattr -cr "/Applications/Internal Medicine Training Suite.app"`

## macOS (building on the MacBook itself)

1. Copy this folder to the Mac. You can leave out `node_modules` and `dist`.
2. Install Node.js LTS from https://nodejs.org.
3. Double-click `BUILD_MAC_APP.command`. If macOS blocks it, run `chmod +x BUILD_MAC_APP.command` once in Terminal.
4. Open the `.dmg` in `dist/` and drag the app to Applications.
5. On first launch, right-click the app and choose **Open → Open**. This is needed because the app is not notarised by Apple.

## Web app (PWA) option

Upload the contents of `app/` to any static HTTPS host, such as the university web server, GitHub Pages or Netlify. Then open the address:
- **Windows (Edge/Chrome):** click the install icon in the address bar.
- **Mac (Safari):** File → Add to Dock. **Mac (Chrome):** use the install icon.

After the first visit it works fully offline. To try it locally, run `npm run serve` and open http://localhost:8765.

## Moving your existing data (important)

Data is stored inside each app or browser. The new app does **not** automatically see data saved by the old `.html` file.
1. In the old V19 HTML file, click **نسخة احتياطية JSON** (JSON backup).
2. In the new app, click **استيراد نسخة JSON** (JSON import) and pick that file.

Use the same backup and import steps to move data between a Windows PC and a MacBook.

## Updating to a new console version (V20, …)

```bash
npm run import -- "F:\2026-2027 Schedules\Internal Medicine Training Suite (Offline)_V20.html"
```

Then update `"version"` in `package.json` and rebuild with `npm run dist:win` (Windows) or `BUILD_MAC_APP.command` (Mac).

Note for Node 26 on Windows: if `npm install` leaves `node_modules/electron/dist` empty, extract the cached `electron-v*-win32-x64.zip` from `%LOCALAPPDATA%\electron\Cache` into `node_modules/electron/dist` and create `node_modules/electron/path.txt` containing `electron.exe`.
