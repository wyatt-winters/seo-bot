import { parseHtml, scoreChecks } from './utils.js';
import {
  analyzeMeta,
  analyzeContent,
  analyzeImages,
  analyzeLinks,
  analyzeSocial,
  analyzeStructuredData,
  analyzeTechnical,
} from './analyzers/index.js';

/**
 * Run full SEO audit on HTML string
 * @param {string} html
 * @param {string} pageUrl - display URL / base for relative links
 * @param {string} [source] - how the page was loaded
 * @returns {import('./utils.js').Check[] & { score: number, url: string, source: string }}
 */
export function auditPage(html, pageUrl = '', source = 'unknown') {
  const { doc, baseUrl } = parseHtml(html, pageUrl);
  const url = pageUrl || baseUrl || 'Uploaded page';

  const checks = [
    ...analyzeMeta(doc, url),
    ...analyzeContent(doc),
    ...analyzeImages(doc),
    ...analyzeLinks(doc, url),
    ...analyzeSocial(doc),
    ...analyzeStructuredData(doc),
    ...analyzeTechnical(doc, url),
  ];

  const score = scoreChecks(checks);

  return {
    url,
    source,
    score,
    checks,
    auditedAt: new Date().toISOString(),
  };
}

export function aggregateResults(pages) {
  const allChecks = pages.flatMap((p) => p.checks);
  const errors = allChecks.filter((c) => c.status === 'error').length;
  const warnings = allChecks.filter((c) => c.status === 'warning').length;
  const passed = allChecks.filter((c) => c.status === 'pass').length;

  const avgScore = pages.length
    ? Math.round(pages.reduce((s, p) => s + p.score, 0) / pages.length)
    : 0;

  return { errors, warnings, passed, avgScore, pageCount: pages.length };
}
