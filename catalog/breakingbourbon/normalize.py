#!/usr/bin/env python3
"""bb-reviews.json + catalog-snapshot.json → normalized.json + report.md.

Pure: reads the two files, writes two files, touches nothing else. Every rule that turns
review text into a catalog field lives here so it can be argued with and re-run.
"""
import difflib, json, pathlib, re
from collections import defaultdict

HERE = pathlib.Path(__file__).parent
FAMILIES_FILE = HERE / "families.txt"
# Titles use these; the catalog uses the value.
FAMILY_ALIASES = {"Bardstown": "Bardstown Bourbon Company", "Barrell Craft Spirits": "Barrell", "E.H. Taylor": "Colonel E.H. Taylor",
                  "Kentucky Peerless": "Peerless", "Jos. A. Magnus": "Joseph Magnus", "George Remus": "Remus", "Nearest Green": "Uncle Nearest"}

# ---------------------------------------------------------------- text helpers

def norm(s: str | None) -> str:
    s = (s or "").lower().replace("’", "'").replace("&", "and")
    s = re.sub(r"[^a-z0-9 ]+", " ", s)
    return re.sub(r"\s+", " ", s).strip()

def key(s: str | None) -> str:
    """Matching key: normalized, with words that carry no identity dropped."""
    drop = {"bourbon", "whiskey", "whisky", "kentucky", "straight", "the", "yr", "years", "year", "old"}
    words = [w for w in norm(s).split() if w not in drop]
    return " ".join("year" if w == "yr" else w for w in words)

def first_number(s: str | None) -> float | None:
    m = re.search(r"\d+(?:\.\d+)?", s or "")
    return float(m.group(0)) if m else None

# ---------------------------------------------------------------- scope

NON_AMERICAN = re.compile(r"\b(scotch|irish|canadian|japanese|japan|india|taiwan|taiwanese|australian|welsh|english|french|german|swedish|israeli|mexican|world)\b(?!\s+(?:cask|barrel|oak))", re.I)
ORIGIN_HINT = re.compile(r"\b(scotland|ireland|canada|japan|india|taiwan|australia|wales|england|france|germany|sweden|israel|mexico)\b", re.I)
FLAVORED = re.compile(r"infused|flavored|liqueur|cream|honey whiskey|cinnamon|spiced|moonshine|vodka|gin\b|rum\b|tequila|mezcal|brandy", re.I)

def in_scope(rec) -> tuple[bool, str]:
    cls = rec["spec"].get("Classification", "")
    dist = rec["spec"].get("Distillery", "")
    if not cls:
        return False, "no classification"
    if NON_AMERICAN.search(re.sub(r"finished? in .*$", "", cls, flags=re.I)) or ORIGIN_HINT.search(dist):
        return False, "not American"
    if re.search(r"\bwhisky\b", cls, re.I) or re.search(r"\bworld whisky\b", rec["title"], re.I):
        return False, "not American"
    if FLAVORED.search(cls) or FLAVORED.search(rec["title"]):
        return False, "flavored / not whiskey"
    return True, ""

def spirit_type(cls: str) -> str:
    c = cls.lower()
    if "bourbon" in c: return "bourbon"          # includes "Blend of Straight Bourbons"
    if "rye" in c and "malt" not in c: return "rye"   # before tennessee: "Tennessee Rye" is a rye
    if "tennessee" in c: return "tennessee"
    if "single malt" in c or "malt whiskey" in c: return "american_single_malt"
    if "wheat whiskey" in c: return "wheat_whiskey"
    if "blend" in c: return "blend"
    if "rye" in c: return "rye"
    return "other"

# ---------------------------------------------------------------- title → family / expression / release

RELEASE_PATTERNS = [
    r"[“\"]\s*[^”\"]*\bbatch\b[^”\"]*[”\"]",               # “Ronnie's Batch”
    r"\bbatch\s+no\.?\s*[a-z0-9][a-z0-9-]*",
    r"\b(?:19|20)\d\d-\d{1,2}[a-z]?\b",                        # 2022-01
    r"\((?:[^)]*\b(?:batch|barrel|lot|release|edition|20\d\d|19\d\d|chapter|volume|no\.)\b[^)]*)\)",
    r"(?<!small )\bbatch\s+#?(?=[a-z]*\d)[a-z0-9-]+(?!\s*-?\s*(?:year|yr)s?\b)",
    r"\b(?:spring|summer|fall|winter|autumn)\s+(?:19|20)\d\d\b",
    r"\b(?:19|20)\d\d(?:\s+(?:release|edition|limited edition|harvest|vintage))?\b",
    r"\bchapter\s+\d+[^,(]*",
    r"\bvolume\s+\d+\b",
    r"\bbarrel\s+(?:no\.?|#)\s*[a-z0-9-]+",
    r"\blot\s+[a-z0-9-]+\b",
    r"#\s*\d+[a-z]?\b",
]
PROOF_IN_TITLE = re.compile(r"\(?\b\d{2,3}(?:\.\d+)?\s*proof\)?", re.I)
GENERIC_SUFFIX = re.compile(r"\s*\b(kentucky\s+)?(straight\s+)?(bourbon|rye|tennessee|whiskey|whisky)(\s+whiskey)?\s*$", re.I)

STOP_GUESS = re.compile(r"^(\d+|year|yr|single|small|barrel|bottled|cask|straight|bourbon|rye|whiskey|whisky|tennessee|kentucky|wheated|wheat|four|toasted|double|reserve|special|limited|private|select|edition|batch|proof|finished?|blend(ed)?|american|light|malt|organic|amarone|port|sherry|cognac|rum|maple|cabernet|honey|cigar|gold|black|white|red|blue|green|silver|premium|original|old|the|&|and)\b", re.I)

def split_title(title: str, families: list[str], company: str | None = None):
    t = title.replace("’", "'").strip()
    releases = []
    for pat in RELEASE_PATTERNS:
        for m in re.finditer(pat, t, re.I):
            releases.append(m.group(0).strip("() "))
        t = re.sub(pat, " ", t, flags=re.I)
    t = PROOF_IN_TITLE.sub(" ", t)
    t = re.sub(r"\(\s*\)", " ", t)
    t = re.sub(r"\s+", " ", t).strip(" ,-–—:")

    family, guessed = None, False
    tn = norm(t)
    for f in families:                                    # families sorted longest first
        fn = norm(f)
        if tn == fn or tn.startswith(fn + " "):
            family = f
            break
    if family is None:
        words = t.split()
        cw = [norm(w) for w in norm(company or "").split()]
        take = 0
        for i, w in enumerate(words):
            if norm(w) in cw: take = i + 1
            else: break
        if not take:
            take = 1
            for i, w in enumerate(words[1:3], start=1):
                if STOP_GUESS.match(w): break
                take = i + 1
        family = " ".join(words[:take])
        guessed = True

    rest = t[len(family):].strip(" ,-–—:") if norm(t).startswith(norm(family)) else t
    rest = re.sub(r"^'s\b\s*", "", rest)
    family = FAMILY_ALIASES.get(family, family)
    rest = GENERIC_SUFFIX.sub("", rest).strip(" ,-–—")
    # A lone "Bourbon"/"Whiskey" left over means the flagship.
    rest = re.sub(r"^(kentucky\s+)?(straight\s+)?(bourbon whiskey|bourbon|whiskey|rye whiskey|rye)\s+(?=\S)", "", rest, flags=re.I).strip(" ,-–—:")
    expression = rest if rest and norm(rest) not in {"bourbon", "whiskey", "rye whiskey", "rye", "straight bourbon", "batch", "bourbon batch"} else None
    release = " · ".join(dict.fromkeys(r.strip() for r in releases if r.strip())) or None
    return family, expression, release, guessed

# ---------------------------------------------------------------- facts

def parse_age(text: str | None):
    if not text: return None, None
    t = text.strip()
    if re.match(r"nas\b", t, re.I): return None, "NAS"
    if re.search(r"\b(under|blend|&|and|-|to)\b", t, re.I) and not re.match(r"^\d+(\.\d+)?\s*(years?|yrs?)?(,|\s+and)?\s*\d*\s*months?$", t, re.I):
        return None, t[:40]
    years = first_number(t)
    months = re.search(r"(\d+)\s*months?", t, re.I)
    if years is not None and months and "year" in t.lower():
        years = round(years + int(months.group(1)) / 12, 2)
    elif months and years is not None and "year" not in t.lower():
        years = round(int(months.group(1)) / 12, 2)
    return years, (f"{years:g} yr" if years is not None else t[:40])

def parse_mash(text: str | None):
    """→ (style, grains dict) from '70% Corn, 16% Wheat, 14% Malted Barley'."""
    if not text: return None, {}
    t = text.lower()
    grains = {}
    for pct, grain in re.findall(r"(\d{1,2}(?:\.\d+)?)\s*%\s*([a-z ]+?)(?:,|;|\band\b|$|\()", t):
        g = grain.strip()
        for name in ("corn", "wheat", "rye", "barley", "oat", "millet", "rice", "triticale"):
            if name in g:
                grains[name] = max(grains.get(name, 0), float(pct))
                break
    if "four grain" in t or "4 grain" in t or "four-grain" in t: return "four_grain", grains
    if grains:
        distinct = [g for g in grains if g != "barley"]
        if grains.get("rye", 0) >= 51: return "rye", grains
        if "wheat" in grains and "rye" in grains: return "four_grain", grains
        if "wheat" in grains: return "wheated", grains
        if grains.get("rye", 0) >= 20: return "high_rye", grains
        if "corn" in grains: return "traditional", grains
        return "unknown", grains
    if "four grain" in t or "4 grain" in t: return "four_grain", {}
    if "wheat" in t: return "wheated", {}
    if "high rye" in t or "high-rye" in t: return "high_rye", {}
    if "rye" in t and "corn" in t: return "traditional", {}
    if "undisclosed" in t or "unknown" in t or not t.strip(): return None, {}
    return "unknown", {}

FINISH_IN_CLASS = re.compile(r"finished? in (.+?)(?:\s*\(|$)", re.I)
FINISH_IN_TITLE = re.compile(r"\b(double oaked|double double oaked|toasted barrel|toasted|(?:port|sherry|cognac|rum|wine|maple|honey|armagnac|madeira|tequila|mizunara|amburana|cabernet|apple brandy)[a-z ]*(?:cask|barrel)s?(?: finish(?:ed)?)?|finished? in [a-z ,&]+?(?:cask|barrel)s?)\b", re.I)

def facts_for(rec, family, expression, release, makers_by_key, family_style=None):
    spec = rec["spec"]
    title = rec["title"]
    hay = f"{title} {spec.get('Classification','')}".lower()
    proof = first_number(spec.get("Proof"))
    age_years, age_label = parse_age(spec.get("Age"))
    style, grains = parse_mash(spec.get("Mashbill"))
    cls = spec.get("Classification", "")
    st = spirit_type(cls)
    if st == "rye" and style not in (None, "rye"): style = "rye"

    if re.search(r"single (barrel|cask)|single rack", hay): et = "single_barrel"
    elif re.search(r"(store|private|house|shop) (pick|select|barrel)|\bpick\b", hay): et = "store_pick"
    elif "small batch" in hay: et = "small_batch"
    elif re.search(r"limited|anniversary|commemorative|special release|master's keep|heritage collection|antique collection", hay): et = "limited"
    else: et = "standard"

    finish = None
    m = FINISH_IN_CLASS.search(cls) or FINISH_IN_TITLE.search(title)
    if m: finish = m.group(1).strip().rstrip(".")

    distillery = spec.get("Distillery", "")
    company = spec.get("Company", "")
    sourced = bool(re.match(r"sourced|undisclosed|unknown", distillery, re.I))
    maker = None if sourced else makers_by_key.get(maker_key(distillery)) or makers_by_key.get(maker_key(company))
    if re.search(r"four[ -]?grain|4[ -]grain", title, re.I): style = "four_grain"
    if style is None and re.search(r"\bwheat", title, re.I) and st != "rye": style = "wheated"
    if style is None and st == "rye": style = "rye"
    if style is None and family_style: style = family_style
    if style is None:
        style = maker["house_mash_style"] if maker and maker.get("house_mash_style") else "unknown"

    return {
        "proof": proof,
        "age_years": age_years,
        "age_label": age_label,
        "expression_type": et,
        "mash_style": style,
        "mash_bill": (spec.get("Mashbill") or None) if spec.get("Mashbill", "").lower() != "undisclosed" else None,
        "spirit_type": st,
        "bottled_in_bond": bool(re.search(r"bottled[ -]?in[ -]?bond|\bbonded\b|\bbib\b", hay)),
        "barrel_proof": bool(re.search(r"(barrel|cask) (proof|strength)|full proof|uncut", hay)) or (proof or 0) >= 115,
        "finish": finish,
        "msrp_usd": first_number((spec.get("MSRP") or "").replace(",", "")) if "$" in (spec.get("MSRP") or "") else None,
        "is_core_range": (spec.get("Release Date") or "").lower().startswith("ongoing"),
        "distillery": distillery or None,
        "company": company or None,
        "sourced": sourced,
        "maker_id": maker["id"] if maker else None,
        "maker_name": maker["name"] if maker else None,
    }

def maker_key(name: str | None) -> str:
    n = norm(name)
    n = re.sub(r"\b(distillery|distilling|distillers|distilling company|distilling co|company|co|inc|llc|spirits|brands|group)\b", " ", n)
    n = re.sub(r"\(.*?\)", " ", n)
    return re.sub(r"\s+", " ", n).strip()

# ---------------------------------------------------------------- main

def main():
    reviews = json.loads((HERE / "bb-reviews.json").read_text())
    snap = json.loads((HERE / "catalog-snapshot.json").read_text())
    products = [p for p in snap["products"] if not p["merged_into"]]
    makers = snap["makers"]
    makers_by_key = {}
    for m in makers:
        makers_by_key.setdefault(maker_key(m["name"]), m)
        if m.get("owner"): makers_by_key.setdefault(maker_key(m["owner"]), m)
    makers_with_included = {p["producer_id"] for p in products if p["catalog_included"] and p["producer_id"]}

    families = sorted({p["brand_family"] for p in products if p["brand_family"]} | set(FAMILIES_FILE.read_text().splitlines() if FAMILIES_FILE.exists() else []), key=lambda f: -len(f))
    families = [f for f in families if f.strip()]

    link_to_product = defaultdict(set)
    for pid, url in snap["bb_links"]:
        link_to_product[url.replace("https://www.", "https://").rstrip("/")].add(pid)
    by_id = {p["id"]: p for p in products}
    def catalog_expression(p):
        if p["expression"] and p["expression"] != p["name"]: return p["expression"]
        if p["brand_family"] and norm(p["name"]).startswith(norm(p["brand_family"])):
            return p["name"][len(p["brand_family"]):].strip(" ,-–—") or None
        return p["name"]
    catalog_key, catalog_fullname = {}, {}
    for p in products:
        catalog_key.setdefault((key(p["brand_family"]), key(catalog_expression(p)), p["spirit_type"]), p["id"])
        catalog_fullname.setdefault((key(p["name"]), p["spirit_type"]), p["id"])
        if p["brand_family"] and not norm(p["name"]).startswith(norm(p["brand_family"])):
            catalog_fullname.setdefault((key(f"{p['brand_family']} {p['name']}"), p["spirit_type"]), p["id"])
    def compatible(pid, c):
        ps = by_id[pid]["spirit_type"]
        return ps in (None, "other") or ps == c["facts"]["spirit_type"]
    def exact_target(c):
        st = c["facts"]["spirit_type"]
        bare = re.sub(r"\s*\b(rye|single malt|wheat whiskey)$", "", c["expression"] or "", flags=re.I) or None
        for cand in (catalog_key.get((key(c["family"]), key(c["expression"]), st)), catalog_fullname.get((key(c["name"]), st)),
                     catalog_key.get((key(c["family"]), key(bare), st))):
            if cand: return cand
        for ps in ("other", None):
            cand = catalog_key.get((key(c["family"]), key(c["expression"]), ps)) or catalog_fullname.get((key(c["name"]), ps))
            if cand: return cand
        return None

    # 1. scope + split
    excluded, flagged, groups = [], [], defaultdict(list)
    for rec in reviews:
        ok, why = in_scope(rec)
        if not ok:
            excluded.append({"slug": rec["slug"], "title": rec["title"], "why": why, "classification": rec["spec"].get("Classification")})
            continue
        family, expression, release, guessed = split_title(rec["title"], families, rec["spec"].get("Company"))
        rec["_family"], rec["_expression"], rec["_release"] = family, expression, release
        rec["_spirit"] = spirit_type(rec["spec"].get("Classification", ""))
        if guessed: flagged.append({"slug": rec["slug"], "title": rec["title"], "family_guess": family})
        groups[(key(family), key(expression), rec["_spirit"])].append(rec)

    # 2. collapse releases → candidates
    from collections import Counter
    family_styles = {}
    for fam, group in ((p["brand_family"], p) for p in products):
        if fam and group["mash_style"] and group["mash_style"] != "unknown":
            family_styles.setdefault(key(fam), Counter())[group["mash_style"]] += 1
    family_style_of = {k: c.most_common(1)[0][0] for k, c in family_styles.items()}

    candidates = []
    for (fk, ek, sk), recs in groups.items():
        ongoing = [r for r in recs if (r["spec"].get("Release Date") or "").lower().startswith("ongoing")]
        canonical = (ongoing or sorted(recs, key=lambda r: r["date_published"] or ""))[-1] if not ongoing else sorted(ongoing, key=lambda r: r["date_published"] or "")[-1]
        facts = facts_for(canonical, canonical["_family"], canonical["_expression"], canonical["_release"], makers_by_key,
                          family_style_of.get(fk) if sk != "rye" else None)
        expression = canonical["_expression"]
        suffix = {"rye": "Rye", "american_single_malt": "Single Malt", "wheat_whiskey": "Wheat Whiskey"}.get(sk)
        if suffix and suffix.lower() not in (expression or "").lower() and suffix.lower() not in canonical["_family"].lower():
            expression = f"{expression} {suffix}" if expression else suffix
        canonical["_expression"] = expression
        releases = [{"label": r["_release"], "proof": first_number(r["spec"].get("Proof")), "age": r["spec"].get("Age"),
                     "msrp": r["spec"].get("MSRP"), "date": r["date_published"], "url": r["url"], "rating": r["rating"]} for r in recs]
        candidates.append({
            "family": canonical["_family"], "expression": canonical["_expression"],
            "name": canonical["_family"] + (" " + canonical["_expression"] if canonical["_expression"] else ""),
            "canonical_url": canonical["url"], "canonical_title": canonical["title"], "image": canonical["image"],
            "facts": facts, "releases": releases, "urls": [r["url"] for r in recs],
            "aliases": sorted({r["title"] for r in recs if norm(r["title"]) != norm(canonical["_family"] + " " + (canonical["_expression"] or ""))})[:6],
        })

    # 3. match
    matched, proposed, new = [], [], []
    used = set()
    catalog_strings = {p["id"]: key(f"{p['brand_family'] or ''} {catalog_expression(p) or ''}") for p in products}
    def exactness(c): return 0 if exact_target(c) else 1
    for c in sorted(candidates, key=exactness):
        pids = set()
        for u in c["urls"]:
            pids |= link_to_product.get(u.replace("https://www.", "https://").rstrip("/"), set())
        pids = {pid for pid in pids if pid in by_id}
        target, how = exact_target(c), "exact name"
        pids = {pid for pid in pids if compatible(pid, c)}
        def link_sim(pid):
            p = by_id[pid]
            if key(p["brand_family"]) == key(c["family"]):
                a, b = key(catalog_expression(p)), key(c["expression"])
                if a == b: return 1.0
                return difflib.SequenceMatcher(None, a, b).ratio() if a and b else 0.0
            return difflib.SequenceMatcher(None, catalog_strings[pid], key(c["name"])).ratio()
        if not target and pids:
            sim, best = max((link_sim(pid), pid) for pid in pids)
            if sim >= 0.7:
                target, how = best, f"review link (name sim {sim:.2f})" + (" ambiguous" if len(pids) > 1 else "")
            else:
                proposed.append({"candidate": c["name"], "url": c["canonical_url"], "product": by_id[best]["name"], "product_id": best,
                                 "score": round(sim, 3), "note": "existing review link, but names disagree"})
                continue
        if not target: how = None
        if not target:
            scored = sorted(((difflib.SequenceMatcher(None, s, key(c["name"])).ratio(), pid) for pid, s in catalog_strings.items() if compatible(pid, c)), reverse=True)
            def same_numbers(pid): return set(re.findall(r"\d+", catalog_strings[pid])) == set(re.findall(r"\d+", key(c["name"])))
            scored = [x for x in scored if same_numbers(x[1])]
            if scored and scored[0][0] >= 0.9:
                proposed.append({"candidate": c["name"], "url": c["canonical_url"], "product": by_id[scored[0][1]]["name"], "product_id": scored[0][1], "score": round(scored[0][0], 3)})
                continue
        if target and target not in used:
            used.add(target)
            p = by_id[target]
            diff = []
            for f in ["proof", "age_years", "mash_style", "expression_type", "spirit_type", "bottled_in_bond", "barrel_proof", "finish", "mash_bill", "msrp_usd", "is_core_range"]:
                cur, bb = p.get(f), c["facts"].get(f)
                if isinstance(cur, str) and f in ("proof", "age_years", "msrp_usd"): cur = float(cur)
                if bb is None or bb == "unknown" or bb == cur or (f == "spirit_type" and bb == "other"): action = "same"
                elif f in ("is_core_range", "bottled_in_bond", "barrel_proof") and bb is False: action = "same"
                elif f == "finish" and cur: action = "same"
                elif f == "mash_bill" and norm(cur) == norm(bb): action = "same"
                elif cur is None or cur == "unknown": action = "fill"
                elif p["verified"]: action = "blocked"
                else: action = "replace"
                if action != "same": diff.append({"field": f, "catalog": cur, "bb": bb, "action": action})
            if c["facts"]["maker_id"] and c["facts"]["maker_id"] != p["producer_id"]:
                diff.append({"field": "producer_id", "catalog": p["producer_id"], "bb": c["facts"]["maker_id"], "action": "fill" if not p["producer_id"] else "replace"})
            matched.append({"product_id": target, "product": p["name"], "how": how, "verified": p["verified"], "candidate": c, "diff": diff})
        elif target in used:
            proposed.append({"candidate": c["name"], "url": c["canonical_url"], "product": by_id[target]["name"], "product_id": target, "score": None, "note": "product already matched by another candidate"})
        else:
            include = c["facts"]["is_core_range"] and c["facts"]["maker_id"] in makers_with_included
            new.append({**c, "catalog_included": include})

    new_makers = {}
    for c in candidates:
        f = c["facts"]
        if not f["sourced"] and not f["maker_id"] and f["distillery"]:
            new_makers.setdefault(maker_key(f["distillery"]), {"name": f["distillery"], "owner": f["company"], "count": 0})["count"] += 1

    out = {"matched": matched, "proposed": proposed, "new": new, "excluded": excluded, "flagged_families": flagged,
           "new_makers": sorted(new_makers.values(), key=lambda m: -m["count"])}
    (HERE / "normalized.json").write_text(json.dumps(out, indent=1, ensure_ascii=False))
    write_report(out, len(reviews), len(candidates), products)

def write_report(out, n_reviews, n_candidates, products):
    L = []
    fills = sum(1 for m in out["matched"] for d in m["diff"] if d["action"] == "fill")
    reps = sum(1 for m in out["matched"] for d in m["diff"] if d["action"] == "replace")
    blocked = sum(1 for m in out["matched"] for d in m["diff"] if d["action"] == "blocked")
    inc_new = sum(1 for n in out["new"] if n["catalog_included"])
    L += ["# Breaking Bourbon → catalog: diff report", "",
          f"- Review pages parsed: **{n_reviews}**; in scope (American whiskey): {n_reviews - len(out['excluded'])}; excluded: {len(out['excluded'])}",
          f"- Collapsed to **{n_candidates}** expressions",
          f"- Matched to existing products: **{len(out['matched'])}** — {fills} fills, {reps} replacements, {blocked} blocked (verified rows)",
          f"- Proposed matches needing a yes/no: **{len(out['proposed'])}**",
          f"- New expressions: **{len(out['new'])}** ({inc_new} core-range from makers already on the shelf → auto-included; rest hidden drafts)",
          f"- New makers: {len(out['new_makers'])}; family guesses to check: {len(out['flagged_families'])}", ""]
    L += ["## Auto-included new expressions (core range, maker already on the shelf)", ""]
    L.append(", ".join(n["name"] for n in sorted(out["new"], key=lambda n: n["name"]) if n["catalog_included"]))
    L += ["", "## Replacements on non-verified rows (BB wins), by field", ""]
    byf = defaultdict(list)
    for m in out["matched"]:
        for d in m["diff"]:
            if d["action"] == "replace": byf[d["field"]].append((m, d))
    for f, items in sorted(byf.items(), key=lambda kv: -len(kv[1])):
        L += [f"### {f} ({len(items)})", "", "| Product | Catalog | Breaking Bourbon | Page |", "|---|---|---|---|"]
        for m, d in items:
            L.append(f"| {m['product']} | {d['catalog']} | {d['bb']} | [{m['candidate']['canonical_title']}]({m['candidate']['canonical_url']}) |")
        L.append("")
    L += ["", "## Blocked (verified rows — shown, not applied)", "", "| Product | Field | Catalog | Breaking Bourbon |", "|---|---|---|---|"]
    for m in out["matched"]:
        for d in m["diff"]:
            if d["action"] == "blocked":
                L.append(f"| {m['product']} | {d['field']} | {d['catalog']} | {d['bb']} |")
    L += ["", "## Proposed matches (not applied until confirmed)", "", "| Candidate | Existing product | Score |", "|---|---|---|"]
    for p in out["proposed"]:
        L.append(f"| [{p['candidate']}]({p['url']}) | {p['product']} | {p.get('score') or p.get('note')} |")
    L += ["", "## New expressions by family", ""]
    fam = defaultdict(list)
    for n in out["new"]: fam[n["family"]].append(n)
    for f, items in sorted(fam.items(), key=lambda kv: -len(kv[1])):
        names = ", ".join((("★ " if i["catalog_included"] else "") + (i["expression"] or "(flagship)")) for i in items)
        L.append(f"- **{f}** ({len(items)}): {names}")
    L += ["", "★ = core range from a maker already on the shelf → included on import", ""]
    L += ["## New makers (distilleries BB names that we don't have)", ""]
    for m in out["new_makers"][:60]:
        L.append(f"- {m['name']} — owner: {m['owner']} ({m['count']})")
    L += ["", "## Family guesses (no known family matched the title)", ""]
    for f in out["flagged_families"][:80]:
        L.append(f"- {f['title']} → guessed **{f['family_guess']}**")
    L += ["", "## Excluded", ""]
    why = defaultdict(int)
    for e in out["excluded"]: why[e["why"]] += 1
    for k, v in why.items(): L.append(f"- {k}: {v}")
    (HERE / "report.md").write_text("\n".join(L))
    print("\n".join(L[:9]))

if __name__ == "__main__":
    main()
