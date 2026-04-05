#!/usr/bin/env python3
"""
db-store.py — Insert extracted items into SQLite, with dedup.

Matches my-epidemic-monitor's DiseaseOutbreakItem schema + Jaccard title dedup
(threshold 0.4 for outbreaks, as used in src/services/llm-data-pipeline.ts).

Input: JSON from extract-m27.py ({source_type, count, items: [...]})
Output: {stored, duplicated, errors} stats

Usage: db-store.py <extracted.json> <keyword> <pipeline_version> [db_path]
"""
import os, sys, json, sqlite3, hashlib, re, time

DEFAULT_DB = os.path.expanduser("~/.openclaw/pipelines/epidemic-monitor/db/epidemic-monitor.db")

# Stop words — match news-dedup-rules.ts logic
STOPWORDS_VI = set("""
và của trong cho với không có là được đã sẽ các một những này đó nào như từ
để theo về tại khi bởi sau trước trên dưới ra vào ở cả hay hoặc rất thì mà
""".split())
STOPWORDS_EN = set("""
the a an and or of in to for on at by with from as is are was were be been being
""".split())
STOPWORDS = STOPWORDS_VI | STOPWORDS_EN

SEVERITY_TO_ALERT = {
    "outbreak": "alert",
    "warning": "warning",
    "watch": "watch",
}

# VN province → ISO-ish lat/lng (subset, expand as needed)
PROVINCE_COORDS = {
    "TP.HCM": (10.7626, 106.6602), "Hà Nội": (21.0285, 105.8542),
    "Đà Nẵng": (16.0544, 108.2022), "Cần Thơ": (10.0452, 105.7469),
    "Hải Phòng": (20.8449, 106.6881), "Khánh Hòa": (12.2388, 109.1967),
    "Đồng Tháp": (10.5831, 105.7780), "Thanh Hóa": (19.8067, 105.7852),
    "Hải Dương": (20.9373, 106.3146), "Nghệ An": (19.2342, 104.9200),
    "Quảng Ninh": (20.9590, 107.0820), "Lâm Đồng": (11.9404, 108.4583),
    "Bình Dương": (11.3254, 106.4770), "Đồng Nai": (11.0686, 107.1676),
    "Bình Thuận": (11.0904, 108.0721), "Tây Ninh": (11.3351, 106.1098),
}

def hash_string(s: str) -> str:
    return hashlib.md5(s.encode("utf-8")).hexdigest()[:16]

def tokenize(title: str) -> set:
    # Lowercase, strip punctuation, tokenize, remove stopwords, short tokens
    text = re.sub(r"[^\w\s]", " ", (title or "").lower())
    return {t for t in text.split() if len(t) >= 3 and t not in STOPWORDS}

def jaccard(a: set, b: set) -> float:
    if not a or not b: return 0.0
    return len(a & b) / len(a | b)

def find_duplicate(conn, disease: str, province: str | None, title_tokens: set, threshold: float = 0.6) -> str | None:
    """Find dup: same disease + same province (if both set) + Jaccard(title) >= threshold."""
    rows = conn.execute(
        "SELECT id, title, province FROM outbreak_items WHERE disease = ? AND ingested_at > ?",
        (disease, int(time.time() * 1000) - 30 * 86400_000),  # 30-day window
    ).fetchall()
    for (rid, t, p) in rows:
        # Require same province OR one side missing
        if province and p and province != p:
            continue
        if jaccard(title_tokens, tokenize(t)) >= threshold:
            return rid
    return None

def to_outbreak_row(item: dict, keyword: str, pipeline_version: str) -> dict:
    """Map pipeline item → outbreak_items row (match DiseaseOutbreakItem)."""
    url = item.get("_source_url", "")
    title = item.get("_source_title") or item.get("summary_vi", "")[:100]
    disease = (item.get("disease") or "other").strip().lower()
    severity = (item.get("severity") or "watch").strip().lower()
    alert_level = SEVERITY_TO_ALERT.get(severity, "watch")
    province = item.get("province")
    lat, lng = PROVINCE_COORDS.get(province, (None, None)) if province else (None, None)

    # Parse date → unix ms
    published_at = int(time.time() * 1000)
    if item.get("date"):
        try:
            from datetime import datetime
            published_at = int(datetime.strptime(item["date"], "%Y-%m-%d").timestamp() * 1000)
        except Exception:
            pass

    source_type = item.get("_source_type", "unknown")
    # Source label: "web:tuoitre.vn"
    host = ""
    m = re.search(r"https?://([^/]+)", url)
    if m:
        host = m.group(1).replace("www.", "")
    source_label = f"{source_type}:{host}" if host else source_type

    return {
        "id": hash_string(url or title),
        "disease": disease,
        "country": "Vietnam",
        "country_code": "VN",
        "alert_level": alert_level,
        "title": title[:500],
        "summary": item.get("summary_vi", "")[:2000],
        "url": url,
        "published_at": published_at,
        "lat": lat, "lng": lng,
        "cases": item.get("cases"),
        "deaths": item.get("deaths"),
        "province": province,
        "district": item.get("district"),
        "source": source_label,
        "source_type": source_type,
        "confidence": item.get("confidence"),
        "keyword_used": keyword,
        "ingested_at": int(time.time() * 1000),
        "pipeline_version": pipeline_version,
    }

def main():
    if len(sys.argv) < 4:
        print("usage: db-store.py <extracted.json> <keyword> <pipeline_version> [db_path]", file=sys.stderr)
        sys.exit(1)
    input_json = sys.argv[1]
    keyword = sys.argv[2]
    pipeline_version = sys.argv[3]
    db_path = sys.argv[4] if len(sys.argv) > 4 else DEFAULT_DB

    data = json.load(open(input_json))
    items = data.get("items", [])

    conn = sqlite3.connect(db_path)
    conn.execute("PRAGMA foreign_keys = ON")

    MIN_CONFIDENCE = float(os.environ.get("MIN_CONFIDENCE", "0.5"))
    stored = 0
    duplicated = 0
    rejected = 0
    errors = 0

    for item in items:
        try:
            # Confidence gate + require province (no VN geo → not useful)
            conf = item.get("confidence") or 0
            if conf < MIN_CONFIDENCE or not item.get("province"):
                rejected += 1
                continue
            row = to_outbreak_row(item, keyword, pipeline_version)
            # Skip if ID already exists
            existing = conn.execute("SELECT 1 FROM outbreak_items WHERE id = ?", (row["id"],)).fetchone()
            if existing:
                duplicated += 1
                continue
            # Jaccard dedup against recent items
            dup_id = find_duplicate(conn, row["disease"], row.get("province"), tokenize(row["title"]))
            if dup_id:
                duplicated += 1
                continue
            # Insert
            cols = ",".join(row.keys())
            placeholders = ",".join(["?"] * len(row))
            conn.execute(f"INSERT INTO outbreak_items ({cols}) VALUES ({placeholders})", list(row.values()))
            stored += 1
        except Exception as e:
            errors += 1
            print(f"[db-store] err: {e}", file=sys.stderr)

    conn.commit()
    conn.close()

    stats = {"stored": stored, "duplicated": duplicated, "rejected": rejected, "errors": errors, "total": len(items)}
    print(json.dumps(stats), flush=True)
    print(f"[db-store] {stats}", file=sys.stderr)

if __name__ == "__main__":
    main()
