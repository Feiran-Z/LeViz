/**
 * Pilot banner configuration. Paste the feedback form URL here when it exists;
 * an empty value hides the link until the form is ready.
 */
export const PILOT_FEEDBACK_URL = '';

/** Short build id injected by CI; "dev" outside a deployed build. */
export const BUILD_ID = import.meta.env.VITE_BUILD_ID ?? 'dev';
