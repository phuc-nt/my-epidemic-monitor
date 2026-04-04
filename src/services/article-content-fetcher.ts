/**
 * Fetches full article content from Vietnamese news URLs.
 * Uses a simple HTML-to-text extraction approach (no external lib needed).
 * Runs server-side in dev middleware or Edge functions to avoid CORS.
 */

/** Extracted article content */
export interface ArticleContent {
  url: string;
  title: string;
  body: string;       // Plain text body (stripped HTML)
  fetchedAt: number;
}

/**
 * Extract readable text from HTML page.
 * Targets main article body by looking for common Vietnamese news site patterns.
 */
export function extractArticleText(html: string): string {
  // Remove script, style, nav, header, footer, sidebar
  let cleaned = html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<nav[\s\S]*?<\/nav>/gi, '')
    .replace(/<header[\s\S]*?<\/header>/gi, '')
    .replace(/<footer[\s\S]*?<\/footer>/gi, '')
    .replace(/<aside[\s\S]*?<\/aside>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '');

  // Try to find article body container (common patterns in VN news sites)
  const articlePatterns = [
    /<article[^>]*>([\s\S]*?)<\/article>/i,
    /<div[^>]*class="[^"]*(?:fck_detail|article-body|content-detail|singular-content|detail-content|newsFeatureContent)[^"]*"[^>]*>([\s\S]*?)<\/div>/i,
    /<div[^>]*class="[^"]*(?:detail__content|maincontent|entry-content|post-content)[^"]*"[^>]*>([\s\S]*?)<\/div>/i,
  ];

  for (const pattern of articlePatterns) {
    const match = cleaned.match(pattern);
    if (match && match[1] && match[1].length > 200) {
      cleaned = match[1];
      break;
    }
  }

  // Strip remaining HTML tags, decode entities, normalize whitespace
  return cleaned
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    .slice(0, 5000); // Limit to ~5000 chars for LLM context
}
