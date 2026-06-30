/**
 * Shared utilities for SEO Bot
 */

export function parseHtml(html, baseUrl = '') {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');

  const parseError = doc.querySelector('parsererror');
  if (parseError) {
    throw new Error('Invalid HTML: parser could not process the document.');
  }

  return { doc, baseUrl: baseUrl || null };
}

export function resolveUrl(href, base) {
  if (!href || !base) return href || '';
  try {
    return new URL(href, base).href;
  } catch {
    return href;
  }
}

export function getTextContent(el) {
  return (el?.textContent || '').replace(/\s+/g, ' ').trim();
}

export function countWords(text) {
  const cleaned = text.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  if (!cleaned) return 0;
  return cleaned.split(' ').filter(Boolean).length;
}

export function stripTags(html) {
  const div = document.createElement('div');
  div.innerHTML = html;
  return getTextContent(div);
}

/**
 * @typedef {'pass' | 'warning' | 'error'} CheckStatus
 * @typedef {{ id: string, category: string, title: string, status: CheckStatus, detail?: string }} Check
 */

export function check(id, category, title, status, detail = '') {
  return { id, category, title, status, detail };
}

export function scoreChecks(checks) {
  if (!checks.length) return 0;
  let points = 0;
  for (const c of checks) {
    if (c.status === 'pass') points += 1;
    else if (c.status === 'warning') points += 0.5;
  }
  return Math.round((points / checks.length) * 100);
}

export async function fetchPage(url, timeoutMs = 15000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      signal: controller.signal,
      credentials: 'same-origin',
      headers: { Accept: 'text/html,application/xhtml+xml' },
    });

    if (!res.ok) {
      throw new Error(`HTTP ${res.status} ${res.statusText}`);
    }

    const contentType = res.headers.get('content-type') || '';
    const html = await res.text();

    return {
      html,
      url: res.url || url,
      contentType,
      status: res.status,
    };
  } finally {
    clearTimeout(timer);
  }
}

export function parseSitemap(xml) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xml, 'text/xml');

  const parseError = doc.querySelector('parsererror');
  if (parseError) {
    throw new Error('Invalid XML: could not parse sitemap.');
  }

  const urls = [];

  // Standard sitemap
  doc.querySelectorAll('url > loc').forEach((loc) => {
    const u = loc.textContent?.trim();
    if (u) urls.push(u);
  });

  // Sitemap index
  if (!urls.length) {
    doc.querySelectorAll('sitemap > loc').forEach((loc) => {
      const u = loc.textContent?.trim();
      if (u) urls.push(u);
    });
  }

  return [...new Set(urls)];
}

export function isSameOrigin(url) {
  try {
    const target = new URL(url, window.location.href);
    return target.origin === window.location.origin;
  } catch {
    return false;
  }
}

export function delay(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

export function readFileAsText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsText(file);
  });
}
