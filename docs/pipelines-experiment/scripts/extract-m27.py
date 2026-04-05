#!/usr/bin/env python3
"""
extract-m27.py — Extract epidemic data from articles/transcripts using MiniMax M2.7 (OpenRouter).

Input: JSON file with {results: [{url, title, markdown}, ...]} OR {items: [{url, title, text}, ...]}
Output: JSON array of OutbreakItem-shaped records.

Usage: extract-m27.py <input.json> <output.json> <source_type>
"""
import json, os, sys, re
import urllib.request, urllib.error

OPENROUTER_API_KEY = os.environ.get("OPENROUTER_API_KEY", "")
if not OPENROUTER_API_KEY:
    # Try reading from ~/.openclaw env
    env_file = os.path.expanduser("~/.openclaw/.env")
    if os.path.exists(env_file):
        for line in open(env_file):
            if line.startswith("OPENROUTER_API_KEY="):
                OPENROUTER_API_KEY = line.split("=",1)[1].strip().strip('"').strip("'")
                break

MODEL = "minimax/minimax-m2.7"
API_URL = "https://openrouter.ai/api/v1/chat/completions"

SYSTEM_PROMPT = """Bạn là chuyên gia phân tích dữ liệu dịch bệnh Việt Nam. Extract thông tin từ bài báo/transcript/post.

Trả về JSON object với các trường:
- is_outbreak_news: true nếu là tin dịch bệnh thực sự (có ca, ổ dịch, cảnh báo), false nếu bài hướng dẫn sức khỏe, quảng cáo, nấu ăn, thể thao...
- disease: tên bệnh tiếng Anh normalized (dengue|measles|hand-foot-mouth|tuberculosis|influenza|covid-19|rabies|cholera|typhoid|hepatitis|chikungunya|diphtheria|meningitis|other). null nếu không rõ.
- disease_vn: tên bệnh tiếng Việt
- province: tên tỉnh/thành VN (viết chuẩn: "TP.HCM", "Hà Nội", "Đồng Nai"...). null nếu không có.
- district: quận/huyện. null nếu không có.
- cases: số ca (int). null nếu không đề cập.
- deaths: số tử vong (int). null nếu không đề cập.
- severity: "outbreak" (bùng phát, tăng mạnh, khẩn), "warning" (cảnh báo, gia tăng), "watch" (theo dõi, thông thường)
- date: ngày sự kiện YYYY-MM-DD. null nếu không rõ.
- confidence: 0.0-1.0 mức tự tin extraction
- summary_vi: 1 câu tóm tắt tiếng Việt

Chỉ trả JSON, không giải thích."""

def clean_markdown(md: str) -> str:
    """Strip nav/menu boilerplate from markdown, keep article body."""
    lines = md.split("\n")
    # Drop lines that are pure links or nav (start with `[` + `](`) when line has no alphabetic content outside link
    kept = []
    for ln in lines:
        s = ln.strip()
        if not s:
            kept.append(ln); continue
        # Drop lines that are mostly links/images
        link_chars = sum(1 for c in s if c in "[]()")
        if len(s) > 0 and link_chars / len(s) > 0.15:
            continue
        # Drop pure navigation markers
        if s.startswith("* [") or s.startswith("![") or s.startswith("["):
            continue
        kept.append(ln)
    out = "\n".join(kept)
    # Collapse multiple blank lines
    out = re.sub(r"\n{3,}", "\n\n", out)
    return out

def call_m27(text: str) -> dict:
    if not OPENROUTER_API_KEY:
        return {"error": "no api key"}
    # Truncate very long content
    text = text[:8000]
    payload = {
        "model": MODEL,
        "messages": [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": text},
        ],
        "response_format": {"type": "json_object"},
        "temperature": 0.1,
    }
    req = urllib.request.Request(
        API_URL,
        data=json.dumps(payload).encode(),
        headers={
            "Authorization": f"Bearer {OPENROUTER_API_KEY}",
            "Content-Type": "application/json",
            "HTTP-Referer": "https://openclaw.local",
            "X-Title": "epidemic-pipeline-experiment",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=60) as resp:
            data = json.loads(resp.read().decode())
        content = data["choices"][0]["message"]["content"]
        # strip code fences if any
        content = re.sub(r"^```(?:json)?\s*|\s*```$", "", content.strip(), flags=re.MULTILINE)
        return json.loads(content)
    except urllib.error.HTTPError as e:
        return {"error": f"http {e.code}: {e.read().decode()[:200]}"}
    except Exception as e:
        return {"error": str(e)}

def main():
    inp, outp, source_type = sys.argv[1], sys.argv[2], sys.argv[3]
    raw = json.load(open(inp))

    # Normalize input: accept {results:[...]} or {items:[...]} or list
    if isinstance(raw, dict):
        items = raw.get("results") or raw.get("items") or []
    else:
        items = raw

    extracted = []
    for i, it in enumerate(items):
        url = it.get("url") or it.get("link") or ""
        title = it.get("title") or ""
        content = it.get("markdown") or it.get("text") or it.get("transcript") or ""
        if not content or len(content) < 100:
            continue
        # Clean markdown (strip nav/menu) if it's web content
        if it.get("markdown"):
            content = clean_markdown(content)
        input_text = f"URL: {url}\nTITLE: {title}\n\nCONTENT:\n{content}"
        print(f"  [{i+1}/{len(items)}] {title[:70]}...", file=sys.stderr)
        result = call_m27(input_text)
        if "error" in result:
            print(f"    ERR: {result['error']}", file=sys.stderr)
            continue
        if not result.get("is_outbreak_news"):
            print(f"    SKIP (not outbreak)", file=sys.stderr)
            continue
        result["_source_url"] = url
        result["_source_title"] = title
        result["_source_type"] = source_type
        extracted.append(result)
        print(f"    OK: {result.get('disease')}/{result.get('province')}/{result.get('cases')}ca", file=sys.stderr)

    json.dump({"source_type": source_type, "count": len(extracted), "items": extracted},
              open(outp,"w"), ensure_ascii=False, indent=2)
    print(f"[extract] wrote {len(extracted)} outbreak items to {outp}", file=sys.stderr)

if __name__ == "__main__":
    main()
