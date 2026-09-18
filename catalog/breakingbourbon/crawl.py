#!/usr/bin/env python3
"""One-time, polite fetch of every Breaking Bourbon review page listed in review-urls.txt.

Raw HTML lands in raw/<slug>.html (gitignored). Already-fetched pages are skipped, so the
script can be re-run to fill gaps. ~1 request/second.
"""
import pathlib, sys, time, urllib.request, urllib.error

HERE = pathlib.Path(__file__).parent
RAW = HERE / "raw"
UA = "Mozilla/5.0 (compatible; cellar-catalog one-time fetch; contact paul@cobbcorner.com)"

def main():
    urls = [u.strip() for u in (HERE / "review-urls.txt").read_text().splitlines() if u.strip()]
    done = fail = 0
    log = open(HERE / "crawl.log", "a")
    for i, url in enumerate(urls, 1):
        slug = url.rstrip("/").split("/")[-1]
        out = RAW / f"{slug}.html"
        if out.exists() and out.stat().st_size > 5000:
            continue
        try:
            req = urllib.request.Request(url, headers={"User-Agent": UA})
            with urllib.request.urlopen(req, timeout=30) as r:
                out.write_bytes(r.read())
            done += 1
        except (urllib.error.URLError, urllib.error.HTTPError, TimeoutError) as e:
            fail += 1
            log.write(f"{url}\t{e}\n"); log.flush()
        if i % 100 == 0:
            print(f"{i}/{len(urls)} fetched={done} failed={fail}", flush=True)
        time.sleep(1.0)
    print(f"finished: fetched={done} failed={fail} total_on_disk={len(list(RAW.glob('*.html')))}", flush=True)

if __name__ == "__main__":
    main()
