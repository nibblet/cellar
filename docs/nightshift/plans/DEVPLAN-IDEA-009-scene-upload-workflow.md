# Dev Plan: [IDEA-009] Scene Upload Workflow — Push Approved Catalog Scenes to Supabase

## What This Does
The `generate-catalog-scenes.ts` script already writes glamour-shot images to `scripts/media/out/{productId}--{sceneSlug}.jpg`. The workflow has a gap: there is no upload step. After Paul reviews the output folder and approves images, he must manually use the admin photo upload UI to push each one — defeating the batch nature of the script.

This plan adds a `--upload` flag (alongside the existing `--run`) that reads the `out/` directory, matches each file to its product by the `{productId}` prefix in the filename, uploads to the `product-catalog` Supabase bucket at `bourbon/{productId}.jpg`, and updates `products.image_url` with the public URL. A `--dry-run-upload` flag shows the plan without committing. Zero new UI or routes; everything lives in the existing script.

## User Stories
- As Paul, I want to run `pnpm gen:catalog-scenes --upload` after reviewing the out/ folder so I can push all approved scenes to the live catalog in one command.
- As Paul, I want `--dry-run-upload` to show me exactly which files would be uploaded and to which products before I commit.

## Implementation

### Phase 1: Parse and Validate out/ Directory
1. Open `apps/web/scripts/media/generate-catalog-scenes.ts`
2. After the `main()` function, add a `uploadGeneratedScenes()` function:
   ```ts
   async function uploadGeneratedScenes(dryRun: boolean) {
     const supa = adminClient();
     if (!existsSync(OUT_DIR)) {
       console.log("No out/ directory found. Run --run first.");
       return;
     }
     const { readdirSync } = await import("node:fs");
     const files = readdirSync(OUT_DIR).filter((f) => f.endsWith(".jpg"));
     if (files.length === 0) {
       console.log("out/ is empty. Run --run first.");
       return;
     }
     console.log(`Found ${files.length} file(s) in out/\n`);
     // ...
   }
   ```
3. Parse each filename: the pattern is `{uuid}--{scene-slug}.jpg`. Split on `"--"` and take the first segment as `productId`. Validate it's a UUID (basic regex: `/^[0-9a-f-]{36}$/`). Skip files that don't match with a warning.
4. **Checkpoint:** `pnpm gen:catalog-scenes --dry-run-upload` prints which files exist and which products they'd update.

### Phase 2: Upload and Update
1. For each valid file:
   - Read the file as a Buffer: `readFileSync(filePath)`
   - Upload to `product-catalog` bucket at `bourbon/{productId}.jpg` with `upsert: true`, `contentType: "image/jpeg"`
   - Call `getPublicUrl("bourbon/{productId}.jpg")` → get `publicUrl`
   - Append `?t=${Date.now()}` (cache-bust, same pattern as `api/product-photo/route.ts`)
   - Update `products.image_url` where `id = productId`
2. Print per-file result: `✓ {productId} → {scene-slug}` or `✗ {productId}: {error}`
3. Print summary: `Uploaded N, skipped M (UUID mismatch), failed K`.

### Phase 3: Wire CLI Flag
1. In `main()`, detect `--upload` or `--dry-run-upload` flags **before** the existing `--run` logic:
   ```ts
   const UPLOAD = process.argv.includes("--upload");
   const DRY_RUN_UPLOAD = process.argv.includes("--dry-run-upload");
   if (UPLOAD || DRY_RUN_UPLOAD) {
     await uploadGeneratedScenes(!UPLOAD); // dryRun = true when DRY_RUN_UPLOAD
     return;
   }
   ```
2. Update the header comment to document the two new flags.
3. Update `pnpm gen:catalog-scenes` in `apps/web/package.json` if a description is added (no change needed — it's just `tsx scripts/media/generate-catalog-scenes.ts`).
4. **Checkpoint:** `pnpm gen:catalog-scenes --upload` reads out/, uploads, and the catalog cards in the app show the new images on next page load (cache-bust in URL ensures freshness).

## AI / Embedding Considerations
None. This is pure storage I/O — no AI calls.

## Design System Compliance
No UI changes. Admin-only script. No Winston, no brass, no dividers needed.

## Mobile Constraints
N/A — this is a local script, not a UI feature.

## Database / RLS
- Writes `products.image_url` using the **admin client** — no RLS check needed for a trusted local script.
- No migration required; `image_url` column already exists.
- Pattern: `bourbon/{productId}.jpg` in the `product-catalog` bucket — same path pattern already used by `api/product-photo/route.ts`.

## Testing
- [ ] `pnpm gen:catalog-scenes --dry-run-upload` prints the plan and exits without touching Supabase
- [ ] `pnpm gen:catalog-scenes --upload` with a populated `out/` uploads files and logs success
- [ ] Files with non-UUID names (e.g. `test.jpg`) are skipped with a warning
- [ ] After upload, the catalog card for that product shows the new image
- [ ] `pnpm build` passes (TypeScript)
- [ ] `pnpm lint` passes

## Dependencies
- Requires `generate-catalog-scenes.ts` to have already been run with `--run` (the `out/` folder must exist)
- Requires `SUPABASE_SERVICE_ROLE_KEY` env var to be set (same as for `--run`, since `adminClient()` is already used)

## Estimated Total: 1 hour
