#!/usr/bin/env python3
"""
Crawl a single article URL using crawl4ai.
Handles JS-rendered pages (DanTri, VietnamNet) that simple fetch cannot.
Returns JSON to stdout: { url, title, body, markdown, fetchedAt }

Usage: python3 scripts/crawl-article.py <url>
"""
import sys
import json
import asyncio
import time

async def crawl_url(url: str) -> dict:
    from crawl4ai import AsyncWebCrawler, CrawlerRunConfig, CacheMode
    import logging
    logging.getLogger("crawl4ai").setLevel(logging.ERROR)

    config = CrawlerRunConfig(
        cache_mode=CacheMode.BYPASS,
        word_count_threshold=50,
        excluded_tags=["nav", "header", "footer", "aside", "script", "style"],
        remove_overlay_elements=True,
        verbose=False,
    )

    async with AsyncWebCrawler(verbose=False) as crawler:
        result = await crawler.arun(url=url, config=config)

        if not result.success:
            return {"url": url, "error": result.error_message or "Crawl failed", "fetchedAt": int(time.time() * 1000)}

        # Use markdown output (best for LLM consumption)
        body = result.markdown or ""
        # Also get cleaned text
        text = result.cleaned_html or ""
        # Strip HTML from cleaned_html for plain text
        import re
        plain = re.sub(r'<[^>]+>', '', text).strip()
        plain = re.sub(r'\s+', ' ', plain)

        return {
            "url": result.url or url,
            "title": result.metadata.get("title", "") if result.metadata else "",
            "body": plain[:5000],
            "markdown": body[:8000],
            "links": len(result.links.get("internal", [])) if result.links else 0,
            "fetchedAt": int(time.time() * 1000),
        }

async def main():
    if len(sys.argv) < 2:
        print(json.dumps({"error": "Usage: crawl-article.py <url>"}))
        sys.exit(1)

    url = sys.argv[1]
    try:
        result = await crawl_url(url)
        print(json.dumps(result, ensure_ascii=False))
    except Exception as e:
        print(json.dumps({"url": url, "error": str(e), "fetchedAt": int(time.time() * 1000)}))
        sys.exit(1)

if __name__ == "__main__":
    asyncio.run(main())
