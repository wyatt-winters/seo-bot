import { check, getTextContent, resolveUrl, countWords } from '../utils.js';

export function analyzeMeta(doc, baseUrl) {
  const checks = [];
  const head = doc.head;

  // Title
  const titleEl = doc.querySelector('title');
  const title = getTextContent(titleEl);
  if (!title) {
    checks.push(check('title-missing', 'Meta', 'Title tag', 'error', 'No <title> element found.'));
  } else if (title.length < 30) {
    checks.push(check('title-short', 'Meta', 'Title tag', 'warning', `Title is ${title.length} chars (recommended 30–60). "${truncate(title, 80)}"`));
  } else if (title.length > 60) {
    checks.push(check('title-long', 'Meta', 'Title tag', 'warning', `Title is ${title.length} chars (recommended 30–60). May truncate in SERPs.`));
  } else {
    checks.push(check('title-ok', 'Meta', 'Title tag', 'pass', `"${truncate(title, 80)}" (${title.length} chars)`));
  }

  // Meta description
  const descEl = head?.querySelector('meta[name="description"]');
  const desc = descEl?.getAttribute('content')?.trim() || '';
  if (!desc) {
    checks.push(check('desc-missing', 'Meta', 'Meta description', 'error', 'Missing meta description.'));
  } else if (desc.length < 70) {
    checks.push(check('desc-short', 'Meta', 'Meta description', 'warning', `${desc.length} chars (recommended 70–160).`));
  } else if (desc.length > 160) {
    checks.push(check('desc-long', 'Meta', 'Meta description', 'warning', `${desc.length} chars — may truncate in search results.`));
  } else {
    checks.push(check('desc-ok', 'Meta', 'Meta description', 'pass', `${desc.length} chars.`));
  }

  // Viewport
  const viewport = head?.querySelector('meta[name="viewport"]');
  if (!viewport) {
    checks.push(check('viewport-missing', 'Meta', 'Mobile viewport', 'error', 'Missing viewport meta tag.'));
  } else {
    const content = viewport.getAttribute('content') || '';
    if (!/width\s*=\s*device-width/i.test(content)) {
      checks.push(check('viewport-invalid', 'Meta', 'Mobile viewport', 'warning', `Viewport may not be mobile-friendly: ${content}`));
    } else {
      checks.push(check('viewport-ok', 'Meta', 'Mobile viewport', 'pass', content));
    }
  }

  // Charset
  const charset = head?.querySelector('meta[charset]') || head?.querySelector('meta[http-equiv="Content-Type"]');
  if (!charset) {
    checks.push(check('charset-missing', 'Meta', 'Character encoding', 'warning', 'No charset declaration found.'));
  } else {
    checks.push(check('charset-ok', 'Meta', 'Character encoding', 'pass', charset.getAttribute('charset') || charset.getAttribute('content') || 'declared'));
  }

  // Canonical
  const canonical = head?.querySelector('link[rel="canonical"]');
  if (!canonical) {
    checks.push(check('canonical-missing', 'Meta', 'Canonical URL', 'warning', 'No canonical link — duplicate content risk on multi-URL pages.'));
  } else {
    const href = canonical.getAttribute('href');
    const resolved = resolveUrl(href, baseUrl);
    checks.push(check('canonical-ok', 'Meta', 'Canonical URL', 'pass', resolved || href));
  }

  // Robots meta
  const robots = head?.querySelector('meta[name="robots"]');
  if (robots) {
    const content = (robots.getAttribute('content') || '').toLowerCase();
    if (content.includes('noindex')) {
      checks.push(check('robots-noindex', 'Meta', 'Robots meta', 'error', `noindex detected: ${content}`));
    } else if (content.includes('nofollow')) {
      checks.push(check('robots-nofollow', 'Meta', 'Robots meta', 'warning', `nofollow detected: ${content}`));
    } else {
      checks.push(check('robots-ok', 'Meta', 'Robots meta', 'pass', content));
    }
  } else {
    checks.push(check('robots-default', 'Meta', 'Robots meta', 'pass', 'No robots meta — defaults to index, follow.'));
  }

  // Language
  const lang = doc.documentElement.getAttribute('lang');
  if (!lang) {
    checks.push(check('lang-missing', 'Meta', 'HTML lang attribute', 'warning', 'Missing lang on <html> — accessibility and locale signal.'));
  } else {
    checks.push(check('lang-ok', 'Meta', 'HTML lang attribute', 'pass', lang));
  }

  return checks;
}

function truncate(str, len) {
  return str.length <= len ? str : str.slice(0, len) + '…';
}

export function analyzeContent(doc) {
  const checks = [];
  const body = doc.body;
  if (!body) {
    checks.push(check('body-missing', 'Content', 'Body element', 'error', 'No <body> found.'));
    return checks;
  }

  const wordCount = countWords(body.innerHTML);
  if (wordCount < 300) {
    checks.push(check('content-thin', 'Content', 'Word count', 'warning', `~${wordCount} words — thin content may rank poorly (aim for 300+).`));
  } else {
    checks.push(check('content-ok', 'Content', 'Word count', 'pass', `~${wordCount} words.`));
  }

  // H1
  const h1s = [...doc.querySelectorAll('h1')];
  if (h1s.length === 0) {
    checks.push(check('h1-missing', 'Content', 'H1 heading', 'error', 'No H1 found.'));
  } else if (h1s.length > 1) {
    checks.push(check('h1-multiple', 'Content', 'H1 heading', 'warning', `${h1s.length} H1 tags — use one primary H1.`));
  } else {
    checks.push(check('h1-ok', 'Content', 'H1 heading', 'pass', getTextContent(h1s[0]).slice(0, 100)));
  }

  // Heading hierarchy
  const headings = [...doc.querySelectorAll('h1, h2, h3, h4, h5, h6')];
  let prevLevel = 0;
  const skips = [];
  for (const h of headings) {
    const level = parseInt(h.tagName[1], 10);
    if (prevLevel && level > prevLevel + 1) {
      skips.push(`${h.tagName} after H${prevLevel}`);
    }
    prevLevel = level;
  }
  if (skips.length) {
    checks.push(check('heading-skip', 'Content', 'Heading hierarchy', 'warning', `Skipped levels: ${skips.slice(0, 3).join(', ')}${skips.length > 3 ? '…' : ''}`));
  } else if (headings.length) {
    checks.push(check('heading-ok', 'Content', 'Heading hierarchy', 'pass', `${headings.length} headings in logical order.`));
  }

  return checks;
}

export function analyzeImages(doc) {
  const checks = [];
  const images = [...doc.querySelectorAll('img')];
  const missingAlt = images.filter((img) => !img.hasAttribute('alt'));
  const emptyAlt = images.filter((img) => img.getAttribute('alt') === '');
  const decorative = emptyAlt.length;
  const noAlt = missingAlt.length;

  if (!images.length) {
    checks.push(check('images-none', 'Images', 'Image alt text', 'pass', 'No images on page.'));
    return checks;
  }

  if (noAlt > 0) {
    checks.push(check('alt-missing', 'Images', 'Image alt text', 'error', `${noAlt} of ${images.length} images missing alt attribute.`));
  } else {
    checks.push(check('alt-ok', 'Images', 'Image alt text', 'pass', `${images.length} images — all have alt (${decorative} decorative with alt="").`));
  }

  const noSrc = images.filter((img) => !img.getAttribute('src') && !img.getAttribute('srcset'));
  if (noSrc.length) {
    checks.push(check('img-no-src', 'Images', 'Image sources', 'warning', `${noSrc.length} images without src or srcset.`));
  }

  return checks;
}

export function analyzeLinks(doc, baseUrl) {
  const checks = [];
  const anchors = [...doc.querySelectorAll('a[href]')];
  let internal = 0;
  let external = 0;
  let empty = 0;
  let noText = 0;

  for (const a of anchors) {
    const href = a.getAttribute('href') || '';
    if (!href || href === '#') {
      empty++;
      continue;
    }
    if (/^(mailto:|tel:|javascript:)/i.test(href)) continue;

    const resolved = resolveUrl(href, baseUrl);
    try {
      const linkOrigin = new URL(resolved).origin;
      const pageOrigin = baseUrl ? new URL(baseUrl).origin : window.location.origin;
      if (linkOrigin === pageOrigin) internal++;
      else external++;
    } catch {
      internal++;
    }

    const text = getTextContent(a);
    if (!text && !a.querySelector('img[alt]')) noText++;
  }

  if (!anchors.length) {
    checks.push(check('links-none', 'Links', 'Internal links', 'warning', 'No links found — orphan page risk.'));
  } else {
    checks.push(check('links-count', 'Links', 'Link profile', 'pass', `${internal} internal, ${external} external.`));
  }

  if (noText > 0) {
    checks.push(check('links-notext', 'Links', 'Link anchor text', 'warning', `${noText} links without visible text (accessibility issue).`));
  } else if (anchors.length) {
    checks.push(check('links-text-ok', 'Links', 'Link anchor text', 'pass', 'All links have discernible text or image alt.'));
  }

  if (empty > 2) {
    checks.push(check('links-empty', 'Links', 'Empty/hash links', 'warning', `${empty} links with empty or # href.`));
  }

  return checks;
}

export function analyzeSocial(doc) {
  const checks = [];
  const head = doc.head;
  if (!head) return checks;

  const ogTitle = head.querySelector('meta[property="og:title"]');
  const ogDesc = head.querySelector('meta[property="og:description"]');
  const ogImage = head.querySelector('meta[property="og:image"]');
  const ogUrl = head.querySelector('meta[property="og:url"]');
  const twitterCard = head.querySelector('meta[name="twitter:card"]');

  const ogCount = [ogTitle, ogDesc, ogImage, ogUrl].filter(Boolean).length;
  if (ogCount === 0) {
    checks.push(check('og-missing', 'Social', 'Open Graph tags', 'warning', 'No Open Graph tags — poor social sharing previews.'));
  } else if (ogCount < 4) {
    const missing = [];
    if (!ogTitle) missing.push('og:title');
    if (!ogDesc) missing.push('og:description');
    if (!ogImage) missing.push('og:image');
    if (!ogUrl) missing.push('og:url');
    checks.push(check('og-partial', 'Social', 'Open Graph tags', 'warning', `Missing: ${missing.join(', ')}.`));
  } else {
    checks.push(check('og-ok', 'Social', 'Open Graph tags', 'pass', 'title, description, image, and url present.'));
  }

  if (!twitterCard) {
    checks.push(check('twitter-missing', 'Social', 'Twitter Card', 'warning', 'No twitter:card meta tag.'));
  } else {
    checks.push(check('twitter-ok', 'Social', 'Twitter Card', 'pass', twitterCard.getAttribute('content')));
  }

  return checks;
}

export function analyzeStructuredData(doc) {
  const checks = [];
  const scripts = [...doc.querySelectorAll('script[type="application/ld+json"]')];
  const microdata = doc.querySelectorAll('[itemscope]');

  if (!scripts.length && !microdata.length) {
    checks.push(check('schema-missing', 'Structured Data', 'Schema.org markup', 'warning', 'No JSON-LD or microdata found.'));
    return checks;
  }

  let valid = 0;
  let invalid = 0;
  const types = [];

  for (const script of scripts) {
    try {
      const data = JSON.parse(script.textContent);
      const items = Array.isArray(data) ? data : [data];
      for (const item of items) {
        if (item['@type']) types.push(item['@type']);
      }
      valid++;
    } catch (e) {
      invalid++;
    }
  }

  if (invalid > 0) {
    checks.push(check('schema-invalid', 'Structured Data', 'JSON-LD', 'error', `${invalid} JSON-LD block(s) have parse errors.`));
  }
  if (valid > 0) {
    const typeStr = types.length ? types.slice(0, 5).join(', ') : 'present';
    checks.push(check('schema-ok', 'Structured Data', 'JSON-LD', 'pass', `${valid} valid block(s): ${typeStr}.`));
  }
  if (microdata.length) {
    checks.push(check('schema-microdata', 'Structured Data', 'Microdata', 'pass', `${microdata.length} itemscope element(s).`));
  }

  return checks;
}

export function analyzeTechnical(doc, baseUrl) {
  const checks = [];

  // Favicon
  const favicon = doc.querySelector('link[rel="icon"], link[rel="shortcut icon"]');
  if (!favicon) {
    checks.push(check('favicon-missing', 'Technical', 'Favicon', 'warning', 'No favicon link found.'));
  } else {
    checks.push(check('favicon-ok', 'Technical', 'Favicon', 'pass', favicon.getAttribute('href')));
  }

  // HTTPS (if base URL known)
  if (baseUrl) {
    try {
      const u = new URL(baseUrl);
      const isLocal = u.hostname === 'localhost' || u.hostname === '127.0.0.1';
      if (u.protocol === 'https:') {
        checks.push(check('https-ok', 'Technical', 'HTTPS', 'pass', 'Page URL uses HTTPS.'));
      } else if (!isLocal) {
        checks.push(check('https-no', 'Technical', 'HTTPS', 'warning', 'Page URL is not HTTPS.'));
      }
    } catch { /* ignore */ }
  }

  // Doctype (from raw check - doc always has html in parser)
  checks.push(check('doctype-ok', 'Technical', 'HTML document', 'pass', 'Parsed as HTML document.'));

  return checks;
}
