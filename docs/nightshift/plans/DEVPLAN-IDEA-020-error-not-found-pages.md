# Dev Plan: [IDEA-020] Branded error.tsx and not-found.tsx for the app shell

## What This Does
The app currently has no `error.tsx` or `not-found.tsx` files. When a server component throws
an unhandled error (Supabase down, network drop, unexpected exception), Next.js shows its own
default error overlay — a generic "Something went wrong" page with no NCCC brand, no Winston
voice, and no graceful recovery. When a member navigates to a nonexistent URL (stale deep link,
typo), they see Next.js's default 404 page.

Adding two small files gives every failure state the same Winston-narrated character as the rest
of the app: a voice line, a clear instruction ("Go home" / "Try again"), and a link to recover.
Zero AI cost, no DB changes, no migrations. About 30 minutes total.

## User Stories
- As a member on poor wifi at the club patio, I want to see a graceful "lost the signal" screen
  with a retry button, not a raw Next.js error page.
- As a member who followed a stale product link in a group text, I want a 404 page that makes
  sense and sends me back to the feed.
- As Winston, I want every moment in the app — including the bad ones — to feel like the club.

## Implementation

### Phase 1: App-shell error boundary
1. Create `apps/web/src/app/(app)/(shell)/error.tsx`.
   Next.js requires error components to be `"use client"` (they mount as React error boundaries).
   ```tsx
   "use client";

   import { useEffect } from "react";
   import { AppShell } from "@/components/layout/app-shell";
   import { Voice } from "@/components/primitives";

   export default function ShellError({
     error,
     reset,
   }: {
     error: Error & { digest?: string };
     reset: () => void;
   }) {
     useEffect(() => {
       // Could log to an error service here if one is added later.
       console.error(error);
     }, [error]);

     return (
       <AppShell>
         <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6 text-center px-4">
           <Voice className="text-lg">
             "The spirits must be at another bar. Give it a moment."
           </Voice>
           <button
             type="button"
             onClick={reset}
             className="h-12 px-6 rounded-[12px] bg-surface border border-border text-base text-foreground hover:bg-surface-2 transition-colors"
           >
             Try again
           </button>
         </div>
       </AppShell>
     );
   }
   ```
2. **Checkpoint:** Trigger an error in a shell route (temporarily throw in a server component,
   then revert). Confirm the branded error page appears instead of Next.js default.

### Phase 2: App-wide not-found page
1. Create `apps/web/src/app/not-found.tsx` at the root app level (catches all 404s).
   `not-found.tsx` is a server component — no `"use client"` needed.
   ```tsx
   import Link from "next/link";
   import { AppShell } from "@/components/layout/app-shell";
   import { Voice } from "@/components/primitives";

   export default function NotFound() {
     return (
       <AppShell>
         <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6 text-center px-4">
           <Voice className="text-lg">
             "Nothing to see here. That bottle may have been moved."
           </Voice>
           <Link
             href="/"
             className="h-12 px-6 rounded-[12px] bg-surface border border-border text-base text-foreground hover:bg-surface-2 transition-colors"
           >
             Back to the feed
           </Link>
         </div>
       </AppShell>
     );
   }
   ```
2. **Checkpoint:** Navigate to `/products/nonexistent-uuid`. Confirm branded 404 appears.

### Phase 3: Build and lint
1. Run `pnpm build`.
2. Run `pnpm lint` (Biome) — both new files are client/server components with standard imports.
3. Run `pnpm test`.

## AI / Embedding Considerations
None. Static text components, no AI calls.

## Design System Compliance
- `<Voice />` is used in "system messages" / empty states — both error and 404 pages qualify.
- No brass element — the buttons are surface-styled, not accent-styled.
- No moss color — no pairing validation implied.
- No Winston on capture or feed — these are error/404 fallbacks.

## Mobile Constraints
- Both pages use `min-h-[60vh]` to center content in the viewport for iPhone.
- The retry / home buttons are full `h-12` height for easy thumb tap.

## Database / RLS
None.

## Testing
- [ ] `pnpm build` passes
- [ ] `pnpm lint` passes
- [ ] Navigating to a nonexistent URL shows the branded 404 with Winston voice + home link
- [ ] Triggering a runtime error in a shell component (temporary throw, then revert) shows
  the branded error page with the Winston voice + "Try again" button that calls `reset()`
- [ ] After pressing "Try again", the page attempts to re-render the failing component

## Dependencies
None.

## Estimated Total: ~30 minutes
