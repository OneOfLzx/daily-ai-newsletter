/**
 * Root `index.html` for GitHub Pages: repo root is the site root; editions live under `public/YYYY-MM-DD/`.
 * @param {string} dateKey - YYYY-MM-DD
 * @returns {string}
 */
export function rootLandingRedirectHtml(dateKey) {
  const target = `./public/${dateKey}/index.en.html`;
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Daily AI Newsletter</title>
  <link rel="icon" href="./public/favicon.svg" type="image/svg+xml">
  <meta name="theme-color" content="#2563eb">
  <meta http-equiv="refresh" content="0; url=${target}">
</head>
<body>
  <p><a href="${target}">Continue to latest newsletter</a></p>
</body>
</html>`;
}
