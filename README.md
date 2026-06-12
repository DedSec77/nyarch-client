# nyarch-client

The native desktop client for **nyarch**, a terminal / cyberpunk IT forum.
Built with Tauri 2: a small native window using the system WebView (WebKitGTK
on Linux, WebView2 on Windows). It ships the same React frontend as the web
app and connects directly to the same Supabase backend, so accounts, posts and
messages are shared with the website.

Android support is planned (Tauri 2 can target mobile from this project).

The web app lives in its own repository (`nyarch`).

---

## Why Tauri (not Electron)

- Small binaries (~5-10 MB vs ~120+ MB) and low RAM, since it uses the OS WebView.
- Same React frontend as the web app, no rewrite.
- Path to mobile: Tauri 2 can target Android/iOS later from this project.

---

## Prerequisites

All platforms:

- Node.js 18+
- Rust (stable): <https://rustup.rs>

Linux build host:

```bash
# Debian/Ubuntu
sudo apt install libwebkit2gtk-4.1-dev build-essential librsvg2-dev \
  libssl-dev libayatana-appindicator3-dev patchelf

# Arch
sudo pacman -S webkit2gtk-4.1 base-devel librsvg openssl
```

Windows build host:

- Microsoft C++ Build Tools (Visual Studio Build Tools, "Desktop development with C++").
- WebView2 runtime (preinstalled on Windows 10/11).

---

## Environment variables

The Supabase and Giphy keys are baked into the build (same as the web app), so
create `.env.local` before building:

```bash
cp .env.example .env.local
```

| Key | Value |
|-----|-------|
| `VITE_SUPABASE_URL` | your Supabase Project URL |
| `VITE_SUPABASE_ANON_KEY` | your Supabase anon public key |
| `VITE_GIPHY_API_KEY` | optional, your Giphy key |

The `anon` key is public by design; database access is enforced by Row Level
Security, not by hiding the key. Never put the `service_role` (secret) key here.

---

## Develop

```bash
npm install
npm run desktop:dev      # opens a native window with hot reload
```

## Build installers locally

```bash
npm run desktop:build
```

Output lands in `src-tauri/target/release/bundle/`:

- Linux: `.deb`, `.rpm`, and `.AppImage` (portable).
- Windows: `.msi` and `.exe` (NSIS), only when built on Windows.

On Arch the binary at `src-tauri/target/release/nyarch` runs directly without
any package.

### AppImage note (Linux)

The AppImage bundler downloads `linuxdeploy` on first run and needs network plus
FUSE. If it fails, build only the native packages:

```bash
npm run tauri build -- --bundles deb,rpm
```

The AppImage builds fine in the GitHub Actions workflow.

---

## Build via GitHub Actions (recommended for Windows)

`.github/workflows/desktop-release.yml` builds Windows and Linux installers and
attaches them to a draft GitHub Release.

1. Push this repository to GitHub.
2. Add repository secrets (Settings -> Secrets and variables -> Actions):
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
   - `VITE_GIPHY_API_KEY` (optional)
3. Push a tag, or run the workflow manually from the Actions tab:
   ```bash
   git tag v0.1.0
   git push origin v0.1.0
   ```
4. Installers appear as assets on a draft Release. Publish when ready.

---

## Android (future)

```bash
npm run tauri android init
npm run tauri android dev      # needs Android Studio + NDK
npm run tauri android build    # produces an .apk / .aab
```

Android icons are already generated under `src-tauri/icons/`.

---

## Backend

The client uses the same Supabase project as the web app. If you are setting up
from scratch, run the SQL files under `supabase/` in this order in the Supabase
SQL Editor: `schema.sql`, `functions.sql`, `storage.sql`, then
`migrations/2026_comment_images.sql`.

---

## Project layout

```
src/                 # React frontend (same as the web app)
src-tauri/           # Tauri 2 Rust shell
  Cargo.toml
  tauri.conf.json    # window size, identifier, bundle targets, icons
  build.rs
  icons/             # generated app icons (desktop + mobile)
  src/
    main.rs
    lib.rs
supabase/            # SQL for the shared backend
.github/workflows/   # desktop-release.yml (Windows + Linux installers)
```

---

## License

MIT.
