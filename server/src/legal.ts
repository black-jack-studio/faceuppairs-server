import { APP_NAME, COPYRIGHT_YEARS, HOSTING_PROVIDER, PUBLISHER, SUPPORT_EMAIL } from "../../src/config/app";
import en from "../../src/locales/en/legal.json";
import fr from "../../src/locales/fr/legal.json";

// The public copies of the in-app legal texts, rendered from the very same JSON so the page
// behind the App Store "Privacy Policy URL" can never drift from what the app shows.
const DOCS = ["privacy", "terms", "notice", "support"] as const;
type Doc = (typeof DOCS)[number];

const VARS: Record<string, string> = {
  app: APP_NAME,
  publisher: PUBLISHER,
  email: SUPPORT_EMAIL,
  host: HOSTING_PROVIDER,
  years: COPYRIGHT_YEARS,
};

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch]!);
}

function fill(text: string): string {
  return escapeHtml(text.replace(/{{(\w+)}}/g, (_, key: string) => VARS[key] ?? "")).replace(/\n/g, "<br>");
}

export function renderLegalPage(doc: string, lang: "fr" | "en"): string | null {
  if (!DOCS.includes(doc as Doc)) return null;
  const texts = lang === "en" ? en : fr;
  const page = texts[doc as Doc];
  const other = lang === "en" ? "fr" : "en";
  const sections = page.sections
    .map((s) => `<section><h2>${fill(s.title)}</h2><p>${fill(s.body)}</p></section>`)
    .join("\n");

  return `<!doctype html>
<html lang="${lang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(page.title)} — ${escapeHtml(APP_NAME)}</title>
<style>
  :root { color-scheme: dark; }
  body { margin: 0; background: #1c1c1e; color: #f5f5f5; font: 16px/1.55 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
  main { max-width: 680px; margin: 0 auto; padding: 40px 20px 64px; }
  h1 { font-size: 28px; margin: 0 0 4px; }
  h2 { font-size: 18px; margin: 28px 0 6px; }
  p { color: #b8b8bc; margin: 0; }
  .meta { color: #8a8a8e; font-size: 13px; }
  a { color: #0a84ff; }
</style>
</head>
<body>
<main>
<h1>${escapeHtml(page.title)}</h1>
<p class="meta">${fill(texts.copyright)} · <a href="?lang=${other}">${other.toUpperCase()}</a></p>
${sections}
</main>
</body>
</html>`;
}
