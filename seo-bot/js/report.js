/**
 * Export audit results as downloadable files
 */

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function statusLabel(status) {
  return { pass: 'Pass', warning: 'Warning', error: 'Error' }[status] || status;
}

export function exportJson(pages) {
  const payload = {
    generatedAt: new Date().toISOString(),
    tool: 'SEO Bot',
    version: '1.0',
    pages,
  };
  downloadBlob(JSON.stringify(payload, null, 2), 'seo-audit.json', 'application/json');
}

export function exportHtmlReport(pages, summary) {
  const rows = pages
    .map(
      (page) => `
    <section class="page">
      <h2>${escapeHtml(page.url)} <span class="score">Score: ${page.score}</span></h2>
      <table>
        <thead><tr><th>Status</th><th>Category</th><th>Check</th><th>Detail</th></tr></thead>
        <tbody>
          ${page.checks
            .map(
              (c) => `
            <tr class="${c.status}">
              <td>${statusLabel(c.status)}</td>
              <td>${escapeHtml(c.category)}</td>
              <td>${escapeHtml(c.title)}</td>
              <td>${escapeHtml(c.detail || '')}</td>
            </tr>`
            )
            .join('')}
        </tbody>
      </table>
    </section>`
    )
    .join('');

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>SEO Audit Report</title>
  <style>
    body { font-family: system-ui, sans-serif; max-width: 900px; margin: 2rem auto; padding: 0 1rem; color: #1a1a1a; }
    h1 { font-size: 1.5rem; }
    .meta { color: #666; font-size: 0.9rem; margin-bottom: 2rem; }
    .summary { display: flex; gap: 1.5rem; flex-wrap: wrap; margin-bottom: 2rem; }
    .stat { background: #f4f4f5; padding: 1rem 1.5rem; border-radius: 8px; }
    .stat strong { font-size: 1.5rem; display: block; }
    .page { margin-bottom: 2rem; border: 1px solid #e4e4e7; border-radius: 8px; overflow: hidden; }
    .page h2 { margin: 0; padding: 1rem; background: #f4f4f5; font-size: 1rem; display: flex; justify-content: space-between; gap: 1rem; flex-wrap: wrap; }
    .score { font-weight: normal; color: #3b82f6; }
    table { width: 100%; border-collapse: collapse; font-size: 0.85rem; }
    th, td { padding: 0.5rem 0.75rem; text-align: left; border-bottom: 1px solid #e4e4e7; }
    th { background: #fafafa; font-weight: 600; }
    tr.error td:first-child { color: #dc2626; font-weight: 600; }
    tr.warning td:first-child { color: #d97706; font-weight: 600; }
    tr.pass td:first-child { color: #16a34a; }
  </style>
</head>
<body>
  <h1>SEO Audit Report</h1>
  <p class="meta">Generated ${escapeHtml(new Date().toLocaleString())} by SEO Bot</p>
  <div class="summary">
    <div class="stat"><strong>${summary.avgScore}</strong>Avg score</div>
    <div class="stat"><strong>${summary.pageCount}</strong>Pages</div>
    <div class="stat"><strong>${summary.errors}</strong>Errors</div>
    <div class="stat"><strong>${summary.warnings}</strong>Warnings</div>
    <div class="stat"><strong>${summary.passed}</strong>Passed</div>
  </div>
  ${rows}
</body>
</html>`;

  downloadBlob(html, 'seo-audit-report.html', 'text/html');
}

function downloadBlob(content, filename, mime) {
  const blob = new Blob([content], { type: mime });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}
