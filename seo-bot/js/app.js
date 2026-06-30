import { auditPage, aggregateResults } from './engine.js';
import { exportJson, exportHtmlReport } from './report.js';
import {
  fetchPage,
  parseSitemap,
  readFileAsText,
  isSameOrigin,
  delay,
} from './utils.js';

/** @type {ReturnType<typeof auditPage>[]} */
let currentPages = [];
let currentFilter = 'all';

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

const statusBar = $('#status-bar');
const summaryPanel = $('#summary');
const resultsSection = $('#results');
const emptyState = $('#empty-state');
const pageResults = $('#page-results');
const scoreValue = $('#score-value');
const scoreRing = $('#score-ring');
const summaryStats = $('#summary-stats');
const btnExportJson = $('#btn-export-json');
const btnExportHtml = $('#btn-export-html');

function setStatus(msg, type = '') {
  statusBar.textContent = msg;
  statusBar.className = 'status-bar' + (type ? ` ${type}` : '');
  statusBar.classList.remove('hidden');
}

function showResults(pages) {
  currentPages = pages;
  const summary = aggregateResults(pages);

  emptyState.classList.add('hidden');
  summaryPanel.classList.remove('hidden');
  resultsSection.classList.remove('hidden');
  btnExportJson.disabled = false;
  btnExportHtml.disabled = false;

  scoreValue.textContent = String(summary.avgScore);
  scoreRing.style.borderColor = scoreColor(summary.avgScore);

  summaryStats.innerHTML = `
    <div class="stat-card"><span class="num">${summary.pageCount}</span><span class="lbl">Pages</span></div>
    <div class="stat-card error"><span class="num">${summary.errors}</span><span class="lbl">Errors</span></div>
    <div class="stat-card warning"><span class="num">${summary.warnings}</span><span class="lbl">Warnings</span></div>
    <div class="stat-card pass"><span class="num">${summary.passed}</span><span class="lbl">Passed</span></div>
  `;

  renderPageCards(pages);
}

function scoreColor(score) {
  if (score >= 80) return 'var(--pass)';
  if (score >= 50) return 'var(--warning)';
  return 'var(--error)';
}

function renderPageCards(pages) {
  pageResults.innerHTML = pages
    .map(
      (page, i) => `
    <article class="page-card" data-page="${i}">
      <div class="page-card-header">
        <h3>${escapeHtml(page.url)}</h3>
        <span class="page-score" style="color: ${scoreColor(page.score)}">${page.score}/100</span>
      </div>
      <ul class="check-list">
        ${page.checks.map((c) => checkItemHtml(c)).join('')}
      </ul>
    </article>`
    )
    .join('');

  applyFilter(currentFilter);
}

function checkItemHtml(c) {
  const badge = { pass: '✓', warning: '!', error: '✕' }[c.status];
  return `
    <li class="check-item" data-status="${c.status}">
      <span class="check-badge ${c.status}" aria-label="${c.status}">${badge}</span>
      <div class="check-body">
        <div class="check-title">${escapeHtml(c.category)} — ${escapeHtml(c.title)}</div>
        ${c.detail ? `<div class="check-detail">${escapeHtml(c.detail)}</div>` : ''}
      </div>
    </li>`;
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function applyFilter(filter) {
  currentFilter = filter;
  $$('.filter-btn').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.filter === filter);
  });

  $$('.check-item').forEach((item) => {
    const show = filter === 'all' || item.dataset.status === filter;
    item.classList.toggle('filtered-out', !show);
  });
}

$$('.tab').forEach((tab) => {
  tab.addEventListener('click', () => {
    const name = tab.dataset.tab;
    $$('.tab').forEach((t) => {
      t.classList.toggle('active', t === tab);
      t.setAttribute('aria-selected', t === tab ? 'true' : 'false');
    });
    $$('.tab-panel').forEach((p) => {
      p.classList.toggle('active', p.dataset.panel === name);
    });
  });
});

$$('.filter-btn').forEach((btn) => {
  btn.addEventListener('click', () => applyFilter(btn.dataset.filter));
});

$('#btn-scan-url').addEventListener('click', async () => {
  const url = $('#url-input').value.trim();
  if (!url) {
    setStatus('Enter a URL to scan.', 'error');
    return;
  }

  setStatus('Fetching page…');

  try {
    if (!isSameOrigin(url)) {
      setStatus(
        'Cross-origin URLs are blocked by the browser. Upload the HTML file or paste the source instead.',
        'error'
      );
      return;
    }

    const { html, url: finalUrl } = await fetchPage(url);
    const result = auditPage(html, finalUrl, 'url');
    showResults([result]);
    setStatus(`Scanned ${finalUrl}`, 'success');
  } catch (e) {
    setStatus(`Could not fetch: ${e.message}`, 'error');
  }
});

const fileInput = $('#file-input');
const btnScanFiles = $('#btn-scan-files');

fileInput.addEventListener('change', () => {
  btnScanFiles.disabled = !fileInput.files?.length;
});

btnScanFiles.addEventListener('click', async () => {
  const files = [...(fileInput.files || [])];
  if (!files.length) return;

  setStatus(`Scanning ${files.length} file(s)…`);
  const pages = [];

  for (const file of files) {
    try {
      const html = await readFileAsText(file);
      pages.push(auditPage(html, file.name, 'upload'));
    } catch (e) {
      setStatus(`Error reading ${file.name}: ${e.message}`, 'error');
      return;
    }
  }

  showResults(pages);
  setStatus(`Scanned ${pages.length} file(s).`, 'success');
});

$('#btn-scan-paste').addEventListener('click', () => {
  const html = $('#paste-input').value.trim();
  if (!html) {
    setStatus('Paste HTML to scan.', 'error');
    return;
  }

  const url = $('#paste-url').value.trim() || 'Pasted HTML';

  try {
    const result = auditPage(html, url, 'paste');
    showResults([result]);
    setStatus('HTML scanned.', 'success');
  } catch (e) {
    setStatus(e.message, 'error');
  }
});

$('#btn-scan-sitemap').addEventListener('click', async () => {
  let xml = $('#sitemap-paste').value.trim();
  const file = $('#sitemap-file').files?.[0];

  if (file) {
    xml = await readFileAsText(file);
  }

  if (!xml) {
    setStatus('Upload or paste a sitemap.xml.', 'error');
    return;
  }

  let urls;
  try {
    urls = parseSitemap(xml);
  } catch (e) {
    setStatus(e.message, 'error');
    return;
  }

  if (!urls.length) {
    setStatus('No URLs found in sitemap.', 'error');
    return;
  }

  const fetchUrls = $('#sitemap-fetch').checked;
  const pages = [];
  const errors = [];

  setStatus(`Found ${urls.length} URL(s). Scanning…`);

  for (let i = 0; i < urls.length; i++) {
    const url = urls[i];
    setStatus(`Scanning ${i + 1}/${urls.length}: ${url}`);

    if (fetchUrls && isSameOrigin(url)) {
      try {
        const { html, url: finalUrl } = await fetchPage(url);
        pages.push(auditPage(html, finalUrl, 'sitemap'));
        await delay(100);
      } catch (e) {
        errors.push(`${url}: ${e.message}`);
      }
    } else if (!fetchUrls) {
      errors.push(`${url}: fetch disabled.`);
    } else {
      errors.push(`${url}: cross-origin — upload HTML or host SEO Bot on same domain.`);
    }
  }

  if (!pages.length) {
    setStatus(
      errors.length ? `No pages scanned. ${errors[0]}` : 'No pages could be scanned.',
      'error'
    );
    return;
  }

  showResults(pages);
  const errNote = errors.length ? ` (${errors.length} skipped)` : '';
  setStatus(`Scanned ${pages.length} page(s) from sitemap${errNote}.`, 'success');
});

btnExportJson.addEventListener('click', () => {
  if (currentPages.length) exportJson(currentPages);
});

btnExportHtml.addEventListener('click', () => {
  if (currentPages.length) exportHtmlReport(currentPages, aggregateResults(currentPages));
});

$('#url-input').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') $('#btn-scan-url').click();
});
