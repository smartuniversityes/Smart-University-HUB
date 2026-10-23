/**
 * Public product name. One source of truth for the header, footer, page titles
 * and the chatbot prompt. It reads NEXT_PUBLIC_SITE_NAME so a deployment can
 * rebrand without touching code, with a sensible fallback when it is unset.
 */
export const SITE_NAME =
  process.env.NEXT_PUBLIC_SITE_NAME?.trim() || "Smart Study EcoSystem";

/** Tagline shown under the name in the header and logo. */
export const SITE_TAGLINE = "Study Material Hub";
