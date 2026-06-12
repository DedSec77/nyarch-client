// ── nyarch build-time configuration ─────────────────────────
// These flags are meant to be edited in source by people who fork/self-host
// the project. They are NOT secrets.

/**
 * Desktop update check.
 *
 * The native client compares its running version against the latest GitHub
 * release and shows a small banner when a newer version exists.
 *
 * If you build nyarch from source for your own use and don't want the update
 * nag, set this to `false` (or set VITE_DISABLE_UPDATE_CHECK=true at build).
 */
export const UPDATE_CHECK_ENABLED =
  (import.meta.env.VITE_DISABLE_UPDATE_CHECK as string | undefined) !== 'true'

/** GitHub repo that publishes desktop releases (owner/name). */
export const UPDATE_REPO = 'DedSec77/nyarch-client'

/** App version, injected by Vite from package.json at build time. */
export const APP_VERSION = (import.meta.env.VITE_APP_VERSION as string | undefined) ?? '0.0.0'
