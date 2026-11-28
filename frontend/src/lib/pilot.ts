/** Shared feedback form for the preview banner and the landing-page gate. */
export const PILOT_FEEDBACK_URL = 'https://forms.cloud.microsoft/r/F1JdNhsbBh';

/** Short build id injected by CI; "dev" outside a deployed build. */
export const BUILD_ID = import.meta.env.VITE_BUILD_ID ?? 'dev';

/**
 * The landing-page preview acknowledgment gate. It is on for preview builds;
 * set `VITE_PREVIEW_GATE=false` (or pass `enabled={false}`) for a build that
 * should not show it.
 */
export const PREVIEW_GATE_ENABLED = import.meta.env.VITE_PREVIEW_GATE !== 'false';
