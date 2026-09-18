#!/usr/bin/env python3
"""Turn raw/<slug>.html into bb-reviews.json: one record per review, spec block verbatim.

No interpretation here — this file is the evidence normalize.py works from. Fields:
slug, url, title, brand (JSON-LD), spec {Classification, Company, Distillery, Release Date,
Proof, Age, Mashbill, Color, MSRP}, official_site, rating, date_published, image.
"""
import html, json, pathlib, re

HERE = pathlib.Path(__file__).parent
RAW = HERE / "raw"

# "<strong>Label:</strong> value" and "<strong>Label</strong>: value" both occur; older pages
# also wrap the label in extra tags, so strip tags from the label side too.
SPEC_ROW = re.compile(r"<p>\s*<strong>(.*?)</strong>\s*:?\s*(.*?)</p>", re.S)
LABEL_ALIASES = {"Released": "Release Date", "SRP": "MSRP", "Mash Bill": "Mashbill", "Mash bill": "Mashbill"}
TAG = re.compile(r"<[^>]+>")

def text(fragment: str) -> str:
    return html.unescape(TAG.sub("", fragment)).replace("\xa0", " ").strip()

def parse(page: str, slug: str) -> dict | None:
    m = re.search(r'<h1 class="bold-page-title[^"]*">(.*?)</h1>', page, re.S)
    if not m:
        return None
    rec = {"slug": slug, "url": f"https://breakingbourbon.com/review/{slug}", "title": text(m.group(1))}

    block = re.search(r'class="bottleinfo[^"]*">(.*?)</div>', page, re.S)
    spec = {}
    if block:
        for label, value in SPEC_ROW.findall(block.group(1)):
            label = text(label).rstrip(":").strip()
            if not label or "Official Website" in label:
                continue
            spec[LABEL_ALIASES.get(label, label)] = text(value)
        site = re.search(r'<a href="([^"]+)"[^>]*><strong>Official Website', block.group(1))
        rec["official_site"] = site.group(1) if site else None
    rec["spec"] = spec

    ld = re.search(r'"@type":\s*"Product".*?"name":\s*"((?:[^"\\]|\\.)*)"', page, re.S)
    brand = re.search(r'"brand":\s*\{\s*"@type":\s*"Brand",\s*"name":\s*"((?:[^"\\]|\\.)*)"', page)
    rec["brand"] = json.loads(f'"{brand.group(1)}"') if brand else None
    rating = re.search(r'"ratingValue":\s*"?([\d.]+)"?', page)
    rec["rating"] = float(rating.group(1)) if rating else None
    date = re.search(r'"datePublished":\s*"([^"]+)"', page)
    rec["date_published"] = date.group(1)[:10] if date else None
    image = re.search(r'<meta content="([^"]+)" property="og:image"', page)
    rec["image"] = image.group(1) if image else None
    return rec

def main():
    records, skipped = [], []
    for path in sorted(RAW.glob("*.html")):
        rec = parse(path.read_text(errors="replace"), path.stem)
        (records if rec else skipped).append(rec or path.stem)
    (HERE / "bb-reviews.json").write_text(json.dumps(records, indent=1, ensure_ascii=False))
    spec_full = sum(1 for r in records if {"Proof", "Distillery", "Classification"} <= r["spec"].keys())
    print(f"parsed={len(records)} skipped={len(skipped)} with_core_spec={spec_full} with_brand={sum(1 for r in records if r['brand'])}")
    if skipped:
        print("skipped:", ", ".join(skipped[:20]))

if __name__ == "__main__":
    main()
