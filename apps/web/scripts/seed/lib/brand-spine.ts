/**
 * PROTOTYPE catalog spine — the curation artifact no public dataset ships.
 *
 * Three layers, smallest-to-largest authoring cost:
 *   1. PRODUCERS       — normalize messy `Distillery` strings to a parent.
 *   2. BRAND_FAMILIES  — map (distillery + name prefix) → the consumer brand.
 *                        This is the critical fix: one distillery (Buffalo
 *                        Trace, Heaven Hill) holds ~10 brands.
 *   3. CORE_RANGES     — for priority shelf brands, the canonical lineup with
 *                        is_core_range / status. Brands without an overlay are
 *                        still resolved + grouped; they're just marked
 *                        uncurated rather than claimed as core.
 */

export type ExpressionStatus = "core" | "limited" | "discontinued" | "uncurated";

export type BrandRule = {
  producer: string;
  brand_family: string;
  /** Which CSV `Distillery` values this rule applies to. */
  distillery: RegExp;
  /** Name prefix that identifies this brand within the distillery. */
  name: RegExp;
};

export type CoreExpression = {
  canonical: string;
  status: Exclude<ExpressionStatus, "uncurated">;
  /** Tested against the apostrophe-restored, proof-stripped product name. */
  pattern: RegExp;
  proof?: number;
  age_label?: string;
  spirit_type?: "bourbon" | "rye";
};

// ---------------------------------------------------------------------------
// Layer 1 — producers
// ---------------------------------------------------------------------------

const PRODUCER_RULES: Array<{ match: RegExp; producer: string }> = [
  { match: /beam|booker|knob creek|basil hayden|baker|old grand|old crow|old tub|legent|little book|hardin/i, producer: "Jim Beam (Beam Suntory)" },
  { match: /maker/i, producer: "Maker's Mark (Beam Suntory)" },
  { match: /buffalo trace|stitzel/i, producer: "Buffalo Trace (Sazerac)" },
  { match: /barton|1792/i, producer: "Barton 1792 (Sazerac)" },
  { match: /a\.? smith bowman/i, producer: "A. Smith Bowman (Sazerac)" },
  { match: /heaven hill/i, producer: "Heaven Hill" },
  { match: /brown-forman|old forester|woodford|jack daniel/i, producer: "Brown-Forman" },
  { match: /four roses/i, producer: "Four Roses (Kirin)" },
  { match: /wild turkey/i, producer: "Wild Turkey (Campari)" },
  { match: /lux row/i, producer: "Lux Row (Luxco)" },
  { match: /michter/i, producer: "Michter's" },
  { match: /angel'?s envy/i, producer: "Angel's Envy (Bacardi)" },
  { match: /bardstown bourbon/i, producer: "Bardstown Bourbon Company" },
  { match: /cascade hollow|george dickel/i, producer: "George Dickel (Diageo)" },
];

export function resolveProducer(distillery: string): string {
  const s = (distillery ?? "").trim();
  if (!s || /^undisclosed$/i.test(s)) return "Undisclosed / sourced";
  for (const r of PRODUCER_RULES) if (r.match.test(s)) return r.producer;
  // default: clean the distillery label
  return s.replace(/\s*\(.*?\)\s*$/, "").replace(/\s+distiller(y|s|ing.*)?$/i, "").trim() || s;
}

// ---------------------------------------------------------------------------
// Layer 2 — brand families (ordered; first match wins, so list specifics first)
// ---------------------------------------------------------------------------

const BT = /buffalo trace|stitzel/i;
const HH = /heaven hill/i;
const BEAM = /beam/i;

export const BRAND_RULES: BrandRule[] = [
  // Buffalo Trace — one distillery, many brands
  { producer: "Buffalo Trace (Sazerac)", brand_family: "Pappy Van Winkle", distillery: BT, name: /^pappy van winkle/i },
  { producer: "Buffalo Trace (Sazerac)", brand_family: "Old Rip Van Winkle", distillery: BT, name: /^(old rip van winkle|van winkle)/i },
  { producer: "Buffalo Trace (Sazerac)", brand_family: "William Larue Weller", distillery: BT, name: /^william larue/i },
  { producer: "Buffalo Trace (Sazerac)", brand_family: "Weller", distillery: BT, name: /^(w\.?l\.? )?weller/i },
  { producer: "Buffalo Trace (Sazerac)", brand_family: "George T. Stagg", distillery: BT, name: /^george t/i },
  { producer: "Buffalo Trace (Sazerac)", brand_family: "Stagg", distillery: BT, name: /^stagg/i },
  { producer: "Buffalo Trace (Sazerac)", brand_family: "E.H. Taylor", distillery: BT, name: /^(colonel )?e\.?h\.? taylor/i },
  { producer: "Buffalo Trace (Sazerac)", brand_family: "Eagle Rare", distillery: BT, name: /^eagle rare/i },
  { producer: "Buffalo Trace (Sazerac)", brand_family: "Blanton's", distillery: BT, name: /^blanton/i },
  { producer: "Buffalo Trace (Sazerac)", brand_family: "Elmer T. Lee", distillery: BT, name: /^elmer t/i },
  { producer: "Buffalo Trace (Sazerac)", brand_family: "Hancock's Reserve", distillery: BT, name: /^hancock/i },
  { producer: "Buffalo Trace (Sazerac)", brand_family: "Benchmark", distillery: BT, name: /^(benchmark|mcafee)/i },
  { producer: "Buffalo Trace (Sazerac)", brand_family: "Ancient Age", distillery: BT, name: /^ancient/i },
  { producer: "Buffalo Trace (Sazerac)", brand_family: "Sazerac Rye", distillery: BT, name: /^sazerac/i },
  { producer: "Buffalo Trace (Sazerac)", brand_family: "Old Charter", distillery: BT, name: /^old charter/i },
  { producer: "Buffalo Trace (Sazerac)", brand_family: "Buffalo Trace", distillery: BT, name: /^buffalo trace|^experimental/i },

  // Heaven Hill
  { producer: "Heaven Hill", brand_family: "Elijah Craig", distillery: HH, name: /^elijah craig/i },
  { producer: "Heaven Hill", brand_family: "Evan Williams", distillery: HH, name: /^evan williams/i },
  { producer: "Heaven Hill", brand_family: "Old Fitzgerald", distillery: HH, name: /^old fitzgerald/i },
  { producer: "Heaven Hill", brand_family: "Larceny", distillery: HH, name: /^larceny/i },
  { producer: "Heaven Hill", brand_family: "Parker's Heritage", distillery: HH, name: /^parker/i },
  { producer: "Heaven Hill", brand_family: "Henry McKenna", distillery: HH, name: /^henry mckenna/i },
  { producer: "Heaven Hill", brand_family: "Rittenhouse", distillery: HH, name: /^rittenhouse/i },
  { producer: "Heaven Hill", brand_family: "Bernheim", distillery: HH, name: /^bernheim/i },
  { producer: "Heaven Hill", brand_family: "Fighting Cock", distillery: HH, name: /^fighting cock/i },
  { producer: "Heaven Hill", brand_family: "Heaven Hill", distillery: HH, name: /^(heaven hill|william heavenhill|j\.?w\.? dant|j\.?t\.?s|pennypacker|john e)/i },

  // Jim Beam
  { producer: "Jim Beam (Beam Suntory)", brand_family: "Booker's", distillery: BEAM, name: /^booker/i },
  { producer: "Jim Beam (Beam Suntory)", brand_family: "Knob Creek", distillery: BEAM, name: /^knob creek/i },
  { producer: "Jim Beam (Beam Suntory)", brand_family: "Basil Hayden", distillery: BEAM, name: /^basil hayden/i },
  { producer: "Jim Beam (Beam Suntory)", brand_family: "Baker's", distillery: BEAM, name: /^baker/i },
  { producer: "Jim Beam (Beam Suntory)", brand_family: "Little Book", distillery: BEAM, name: /^little book/i },
  { producer: "Jim Beam (Beam Suntory)", brand_family: "Legent", distillery: BEAM, name: /^legent/i },
  { producer: "Jim Beam (Beam Suntory)", brand_family: "Old Grand-Dad", distillery: BEAM, name: /^old grand/i },
  { producer: "Jim Beam (Beam Suntory)", brand_family: "Old Crow", distillery: BEAM, name: /^old crow/i },
  { producer: "Jim Beam (Beam Suntory)", brand_family: "Hardin's Creek", distillery: BEAM, name: /^hardin/i },
  { producer: "Jim Beam (Beam Suntory)", brand_family: "Jim Beam", distillery: BEAM, name: /^(jim beam|old tub|distillers'? masterpiece)/i },

  // Wild Turkey
  { producer: "Wild Turkey (Campari)", brand_family: "Russell's Reserve", distillery: /wild turkey/i, name: /^russell/i },
  { producer: "Wild Turkey (Campari)", brand_family: "Bond & Lillard", distillery: /wild turkey/i, name: /^bond &/i },
  { producer: "Wild Turkey (Campari)", brand_family: "Wild Turkey", distillery: /wild turkey/i, name: /^(wild turkey|w\.?b\.? saffell|old ripy)/i },

  // Barton 1792
  { producer: "Barton 1792 (Sazerac)", brand_family: "Very Old Barton", distillery: /barton|1792/i, name: /^very old barton/i },
  { producer: "Barton 1792 (Sazerac)", brand_family: "Thomas S. Moore", distillery: /barton|1792/i, name: /^thomas s/i },
  { producer: "Barton 1792 (Sazerac)", brand_family: "1792", distillery: /barton|1792/i, name: /^(1792|ridgemont reserve|two stars|very old)/i },

  // Lux Row
  { producer: "Lux Row (Luxco)", brand_family: "Rebel", distillery: /lux row/i, name: /^rebel/i },
  { producer: "Lux Row (Luxco)", brand_family: "Ezra Brooks", distillery: /lux row/i, name: /^(ezra|old ezra)/i },
  { producer: "Lux Row (Luxco)", brand_family: "Blood Oath", distillery: /lux row/i, name: /^blood oath/i },
  { producer: "Lux Row (Luxco)", brand_family: "Daviess County", distillery: /lux row/i, name: /^daviess/i },
  { producer: "Lux Row (Luxco)", brand_family: "David Nicholson", distillery: /lux row/i, name: /^david nicholson/i },

  // Brown-Forman
  { producer: "Brown-Forman", brand_family: "Woodford Reserve", distillery: /woodford|brown-forman/i, name: /^woodford/i },
  { producer: "Brown-Forman", brand_family: "Old Forester", distillery: /old forester|brown-forman/i, name: /^old forester/i },
  { producer: "Brown-Forman", brand_family: "Jack Daniel's", distillery: /jack daniel/i, name: /^(jack daniel|gentleman jack)/i },
  { producer: "Brown-Forman", brand_family: "Coopers' Craft", distillery: /brown-forman/i, name: /^coopers/i },
];

/** Single-brand distilleries: brand_family == cleaned distillery name. */
export function brandFromDistillery(distillery: string): string {
  return (distillery ?? "")
    .replace(/\s*\(.*?\)\s*$/, "")
    .replace(/\s+(distiller(y|s)|distilling co\.?|whiskey co\.?|bourbon company|whiskey house|spirits)\.?$/i, "")
    .trim();
}

export function resolveBrandFamily(name: string, distillery: string): { producer: string; brand_family: string } {
  for (const r of BRAND_RULES) {
    if (r.distillery.test(distillery) && r.name.test(name)) {
      return { producer: r.producer, brand_family: r.brand_family };
    }
  }
  const producer = resolveProducer(distillery);
  // Four Roses, Maker's, Michter's, Angel's Envy, Bardstown, Garrison Bros, etc.
  const fam = brandFromDistillery(distillery) || name.split(/[\s,]+/).slice(0, 2).join(" ");
  return { producer, brand_family: fam };
}

// ---------------------------------------------------------------------------
// Layer 3 — curated core ranges for priority shelf brands
// ---------------------------------------------------------------------------

const b = (canonical: string, status: CoreExpression["status"], pattern: RegExp, extra: Partial<CoreExpression> = {}): CoreExpression =>
  ({ canonical, status, pattern, spirit_type: "bourbon", ...extra });

export const CORE_RANGES: Record<string, CoreExpression[]> = {
  "Baker's": [
    b("Single Barrel 13 Year", "core", /\b13\b/i),
    b("Single Barrel 7 Year", "core", /single barrel|\b7\s*year\b/i),
  ],
  "Knob Creek": [
    b("25th Anniversary", "discontinued", /25th anniversary/i),
    b("Quarter Oak", "discontinued", /quarter oak/i),
    b("Rye Single Barrel Select", "core", /\brye\b.*single barrel|single barrel.*\brye\b/i, { spirit_type: "rye" }),
    b("Rye", "core", /\brye\b/i, { spirit_type: "rye", proof: 100 }),
    b("18 Year", "limited", /\b18\s*year/i, { proof: 100 }),
    b("15 Year", "core", /\b15\s*year/i, { proof: 100 }),
    b("12 Year", "core", /\b12\s*year/i, { proof: 100 }),
    b("Single Barrel Select", "core", /single barrel/i, { proof: 120 }),
    b("Small Batch", "core", /./, { proof: 100, age_label: "9 yr" }),
  ],
  "Maker's Mark": [
    b("Cask Strength", "core", /cask strength|\bcs\b/i),
    b("46", "core", /\b46\b/i),
    b("101", "core", /\b101\b/i),
    b("BEP / Wood Finishing", "limited", /bep|wood finish|fae|rc6|se4|bdb/i),
    b("Private Selection", "limited", /private selection/i),
    b("Maker's Mark", "core", /./, { proof: 90 }),
  ],
  "Buffalo Trace": [
    b("Experimental Collection", "limited", /experimental/i),
    b("Kosher", "limited", /kosher/i),
    b("Buffalo Trace", "core", /./, { proof: 90 }),
  ],
  Weller: [
    b("Weller 12 Year", "core", /\b12\b/i, { proof: 90 }),
    b("Weller Antique 107", "core", /antique|107/i, { proof: 107 }),
    b("Weller Full Proof", "limited", /full proof/i, { proof: 114 }),
    b("Weller C.Y.P.B.", "limited", /c\.?y\.?p\.?b/i),
    b("Weller Single Barrel", "limited", /single barrel/i),
    b("Weller Special Reserve", "core", /./, { proof: 90 }),
  ],
  "Eagle Rare": [
    b("Eagle Rare 17 Year", "limited", /\b17\b/i),
    b("Eagle Rare 10 Year", "core", /./, { proof: 90, age_label: "10 yr" }),
  ],
  "Blanton's": [
    b("Gold Edition", "limited", /gold/i),
    b("Straight From the Barrel", "limited", /straight from|sftb/i),
    b("Single Barrel", "core", /./, { proof: 93 }),
  ],
  "Four Roses": [
    b("Limited Edition Small Batch", "limited", /limited edition small batch/i),
    b("Limited Edition Single Barrel", "limited", /limited edition single barrel/i),
    b("Small Batch Select", "core", /small batch select/i, { proof: 104 }),
    b("Single Barrel", "core", /single barrel/i, { proof: 100 }),
    b("Small Batch", "core", /small batch/i, { proof: 90 }),
    b("Bourbon (Yellow Label)", "core", /./, { proof: 80 }),
  ],
  "Wild Turkey": [
    b("Master's Keep", "limited", /master'?s keep/i),
    b("Rare Breed", "core", /rare breed/i, { proof: 116 }),
    b("Kentucky Spirit", "core", /kentucky spirit/i),
    b("Longbranch", "core", /longbranch/i, { proof: 86 }),
    b("Rye 101", "core", /\brye\b/i, { spirit_type: "rye" }),
    b("101", "core", /\b101\b/i, { proof: 101 }),
    b("81", "core", /\b81\b/i, { proof: 81 }),
    b("Wild Turkey 101", "core", /./, { proof: 101 }),
  ],
  "Russell's Reserve": [
    b("13 Year", "limited", /\b13\b/i),
    b("Single Barrel", "core", /single barrel/i, { proof: 110 }),
    b("10 Year", "core", /\b10\b/i, { proof: 90, age_label: "10 yr" }),
    b("Small Batch Rye", "core", /\brye\b/i, { spirit_type: "rye" }),
  ],
  "Woodford Reserve": [
    b("Master's Collection", "limited", /master'?s collection|batch proof|baccarat/i),
    b("Double Oaked", "core", /double oaked/i, { proof: 90.4 }),
    b("Rye", "core", /\brye\b/i, { spirit_type: "rye" }),
    b("Wheat", "core", /wheat/i),
    b("Distiller's Select", "core", /./, { proof: 90.4 }),
  ],
  "Elijah Craig": [
    b("18 Year Single Barrel", "limited", /\b18\b/i),
    b("Barrel Proof", "core", /barrel proof/i, { proof: 124 }),
    b("Toasted Barrel", "limited", /toasted/i),
    b("Rye", "core", /\brye\b/i, { spirit_type: "rye" }),
    b("Small Batch", "core", /./, { proof: 94 }),
  ],
  "Evan Williams": [
    b("23 Year", "limited", /\b23\b/i),
    b("Single Barrel", "core", /single barrel/i),
    b("Bottled-in-Bond", "core", /bond|bib|white label/i, { proof: 100 }),
    b("1783 Small Batch", "core", /1783/i),
    b("Black Label", "core", /./, { proof: 86 }),
  ],
  Larceny: [
    b("Barrel Proof", "core", /barrel proof/i, { proof: 120 }),
    b("Small Batch", "core", /./, { proof: 92 }),
  ],
  "Old Fitzgerald": [
    b("Bottled-in-Bond Decanter", "core", /./, { proof: 100 }),
  ],
  "Henry McKenna": [
    b("10 Year Bottled-in-Bond Single Barrel", "core", /./, { proof: 100, age_label: "10 yr" }),
  ],
  "1792": [
    b("Full Proof", "core", /full proof/i, { proof: 125 }),
    b("Single Barrel", "core", /single barrel/i),
    b("Bottled in Bond", "core", /bottled in bond|bib/i, { proof: 100 }),
    b("12 Year", "limited", /\b12\b/i),
    b("Sweet Wheat", "limited", /sweet wheat/i),
    b("High Rye", "limited", /high rye/i),
    b("Port Finish", "limited", /port/i),
    b("Small Batch", "core", /./, { proof: 93.7 }),
  ],
  "Old Forester": [
    b("Birthday Bourbon", "limited", /birthday/i),
    b("117 Series", "limited", /117/i),
    b("150th Anniversary", "limited", /150th/i),
    b("President's Choice", "limited", /president/i),
    b("1920 Prohibition Style", "core", /1920/i, { proof: 115 }),
    b("1910 Old Fine Whisky", "core", /1910/i, { proof: 93 }),
    b("1897 Bottled in Bond", "core", /1897/i, { proof: 100 }),
    b("1870 Original Batch", "core", /1870/i, { proof: 90 }),
    b("King Ranch", "limited", /king ranch/i),
    b("Single Barrel", "core", /single barrel/i),
    b("Statesman", "core", /statesman/i),
    b("Signature", "core", /signature/i),
    b("Repeal Bourbon", "core", /repeal/i),
    b("Rye", "core", /\brye\b/i, { spirit_type: "rye" }),
    // Entry-level bottle only — never use `/./` here; it matches every name.
    b("86 Proof", "core", /^old forester\s*$|\b86\s*proof\b/i, { proof: 86 }),
  ],
};
