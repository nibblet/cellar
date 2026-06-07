# Fix: [FIX-016] Scene generator silently accepts invalid --size values via TypeScript cast

## Problem
`generate-catalog-scenes.ts` accepts a `--size` CLI flag whose value is used in the gpt-image-1 `images.edit` call. The TypeScript type system requires a specific union (`"1024x1024" | "1536x1024" | "1024x1536" | "auto"`), but the script satisfies this with a bare `as "1024x1024"` cast rather than an allowlist check. If someone passes `--size 512x512`, TypeScript is silent, the runtime call reaches the OpenAI API, and fails with a confusing API error — no early feedback to the operator.

The gpt-image-1 valid edit sizes are: `1024x1024`, `1536x1024`, `1024x1536`, `auto`.

## Root Cause
`apps/web/scripts/media/generate-catalog-scenes.ts` line 72 and 129:
```ts
// line 72
const size = arg("--size") ?? "1024x1024";
// line 129
size: size as "1024x1024",
```
The cast overrides TypeScript instead of validating the input.

## Steps
1. Open `apps/web/scripts/media/generate-catalog-scenes.ts`
2. Replace lines 71-72:
   ```ts
   // before
   const quality = (arg("--quality") ?? "low") as "low" | "medium" | "high";
   const size = arg("--size") ?? "1024x1024";
   ```
   ```ts
   // after
   const VALID_QUALITIES = ["low", "medium", "high"] as const;
   const VALID_SIZES = ["1024x1024", "1536x1024", "1024x1536", "auto"] as const;
   const rawQuality = arg("--quality") ?? "low";
   const rawSize = arg("--size") ?? "1024x1024";
   if (!VALID_QUALITIES.includes(rawQuality as never)) throw new Error(`Unknown --quality: ${rawQuality}. Valid: ${VALID_QUALITIES.join(", ")}`);
   if (!VALID_SIZES.includes(rawSize as never)) throw new Error(`Unknown --size: ${rawSize}. Valid: ${VALID_SIZES.join(", ")}`);
   const quality = rawQuality as typeof VALID_QUALITIES[number];
   const size = rawSize as typeof VALID_SIZES[number];
   ```
3. Remove the `as "1024x1024"` cast on line 129 (now `size` is already the correct union type):
   ```ts
   // before
   size: size as "1024x1024",
   // after
   size,
   ```
4. Run `pnpm build` (or tsc on the scripts/) to verify TypeScript is happy.

## Files Modified
- `apps/web/scripts/media/generate-catalog-scenes.ts` — add allowlist validation for `--quality` and `--size`, remove unsafe cast

## Verify
- [x] `pnpm gen:catalog-scenes --size 512x512` exits early with a clear error message
- [x] `pnpm gen:catalog-scenes --size 1536x1024` is accepted and proceeds to plan output (dry run)
- [x] Build passes

**Fixed:** 2026-06-03
