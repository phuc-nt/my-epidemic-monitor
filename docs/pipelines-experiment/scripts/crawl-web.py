#!/usr/bin/env python3
"""
crawl-web.py — Crawl4AI wrapper for OpenClaw research agent.

Modes:
  markdown  — Fetch page, return clean markdown (default)
  extract   — Extract structured data via CSS/XPath schema
  multi     — Crawl multiple URLs concurrently

Usage:
  python3 crawl-web.py markdown <url> [--fit]
  python3 crawl-web.py extract <url> --schema <json_file>
  python3 crawl-web.py multi <url1> <url2> ... [--fit]

Output: JSON to stdout for agent consumption.
Crawl4ai progress logs go to stderr.
"""

import argparse
import asyncio
import contextlib
import io
import json
import logging
import os
import sys
import time

# Suppress crawl4ai logs
os.environ["CRAWL4AI_LOG_LEVEL"] = "ERROR"
logging.getLogger("crawl4ai").setLevel(logging.ERROR)


async def crawl_markdown(urls, fit_mode=False, word_threshold=0):
    """Crawl one or more URLs, return clean markdown."""
    from crawl4ai import AsyncWebCrawler, CrawlerRunConfig, BrowserConfig

    browser_config = BrowserConfig(verbose=False)
    config = CrawlerRunConfig(
        word_count_threshold=word_threshold,
        remove_overlay_elements=True,
        process_iframes=False,
    )

    results = []
    async with AsyncWebCrawler(config=browser_config) as crawler:
            for url in urls:
                try:
                    result = await crawler.arun(url=url, config=config)
                    md = result.markdown
                    # StringCompatibleMarkdown: str(md) is the raw content
                    # .fit_markdown and .raw_markdown are properties that may be empty
                    if fit_mode and hasattr(md, 'fit_markdown') and md.fit_markdown:
                        content = md.fit_markdown
                    elif hasattr(md, 'raw_markdown') and md.raw_markdown:
                        content = md.raw_markdown
                    else:
                        content = str(md) if md else ""
                    results.append({
                        "url": url,
                        "success": result.success,
                        "status_code": result.status_code,
                        "title": result.metadata.get("title", "") if result.metadata else "",
                        "markdown": content,
                        "word_count": len(content.split()) if content else 0,
                        "links_count": len(result.links.get("internal", [])) + len(result.links.get("external", [])) if result.links else 0,
                    })
                except Exception as e:
                    results.append({
                        "url": url,
                        "success": False,
                        "error": str(e),
                    })
    return results


async def crawl_extract(url, schema_path):
    """Extract structured data using CSS/XPath schema."""
    from crawl4ai import AsyncWebCrawler, CrawlerRunConfig, BrowserConfig
    from crawl4ai.extraction_strategy import JsonCssExtractionStrategy

    with open(schema_path) as f:
        schema = json.load(f)

    browser_config = BrowserConfig(verbose=False)
    strategy = JsonCssExtractionStrategy(schema)
    config = CrawlerRunConfig(extraction_strategy=strategy)

    async with AsyncWebCrawler(config=browser_config) as crawler:
            result = await crawler.arun(url=url, config=config)
            extracted = json.loads(result.extracted_content) if result.extracted_content else []
            return {
                "url": url,
                "success": result.success,
                "data": extracted,
                "count": len(extracted),
            }


def main():
    parser = argparse.ArgumentParser(description="Crawl4AI wrapper for OpenClaw")
    subparsers = parser.add_subparsers(dest="mode", required=True)

    # markdown mode
    md_parser = subparsers.add_parser("markdown", help="Fetch clean markdown")
    md_parser.add_argument("urls", nargs="+", help="URL(s) to crawl")
    md_parser.add_argument("--fit", action="store_true", help="Use LLM-optimized markdown")
    md_parser.add_argument("--threshold", type=int, default=0, help="Min word count per block")

    # extract mode
    ex_parser = subparsers.add_parser("extract", help="Extract structured data")
    ex_parser.add_argument("url", help="URL to crawl")
    ex_parser.add_argument("--schema", required=True, help="Path to JSON schema file")

    # multi mode (alias for markdown with multiple URLs)
    multi_parser = subparsers.add_parser("multi", help="Crawl multiple URLs")
    multi_parser.add_argument("urls", nargs="+", help="URLs to crawl")
    multi_parser.add_argument("--fit", action="store_true", help="Use LLM-optimized markdown")

    args = parser.parse_args()
    t0 = time.time()

    if args.mode in ("markdown", "multi"):
        results = asyncio.run(crawl_markdown(args.urls, fit_mode=args.fit))
    elif args.mode == "extract":
        results = asyncio.run(crawl_extract(args.url, args.schema))
    else:
        parser.print_help()
        sys.exit(1)

    output = {
        "mode": args.mode,
        "duration_seconds": round(time.time() - t0, 2),
        "results": results if isinstance(results, list) else [results],
    }
    # Write to file (crawl4ai pollutes stdout with progress logs)
    outpath = "/tmp/crawl4ai-result.json"
    with open(outpath, "w") as f:
        json.dump(output, f, ensure_ascii=False, indent=2)
    print(f"\nResult saved to {outpath}")


if __name__ == "__main__":
    main()
