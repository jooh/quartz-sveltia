import { scanForCredentials } from "./security.js";

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function renderHtml(title: string, scriptUrl: string): string {
  const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="robots" content="noindex, nofollow">
    <title>${escapeHtml(title)}</title>
  </head>
  <body>
    <script src="${escapeHtml(scriptUrl)}"></script>
  </body>
</html>
`;
  scanForCredentials(html, "rendered HTML");
  return html;
}
