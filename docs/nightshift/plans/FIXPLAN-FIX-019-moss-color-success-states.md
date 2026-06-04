# Fix: [FIX-019] Moss color used for success/feedback states — design system violation

## Problem
The design system reserves `text-moss-*` / `bg-moss-*` exclusively for "club has tested this" pairing validation signals. However, five places in the UI use `text-moss-500` or `bg-moss-500` for generic success/ok feedback messages. Two are member-visible (product detail "Club staple" label, photo-manager ok feedback); three are admin-only forms. None of these are pairing-validation signals, so they misuse moss.

Member-visible impact: the "Club staple" badge on product detail implies club validation in the same visual language as moss-colored validated pairings, which is semantically wrong.

## Files

| File | Line | Context | Severity |
|------|------|---------|----------|
| `apps/web/src/app/(app)/(shell)/products/[id]/page.tsx` | 196 | `<p className="... text-moss-500 ...">Club staple</p>` | Member-visible |
| `apps/web/src/components/product/photo-manager.tsx` | 151 | `feedback.type === "ok" ? "text-moss-500" : ...` | Admin-only |
| `apps/web/src/app/(app)/(shell)/products/[id]/edit/edit-form.tsx` | 225 | `<p className="text-xs text-moss-500 ...">` enrichment done | Admin-only |
| `apps/web/src/app/(app)/(shell)/makers/[slug]/maker-admin-actions.tsx` | 72 | `{success ? <p className="text-sm text-moss-500 ...">` | Admin-only |
| `apps/web/src/app/(app)/(shell)/admin/meetup/meetup-form.tsx` | 72 | `{success ? <p className="text-sm text-moss-500">` | Admin-only |

## Root Cause
Moss was chosen as a "positive green" during development, conflating the design-system concept of "club pairing validation" with "generic success." The distinction only matters in member-facing UI; admin forms are low-stakes, but consistency is worth maintaining.

## Steps

### 1. Member-visible fix (highest priority)

Open `apps/web/src/app/(app)/(shell)/products/[id]/page.tsx` line 196.

Change:
```tsx
<p className="text-[11px] uppercase tracking-widest text-moss-500 mt-2">Club staple</p>
```
To:
```tsx
<p className="text-[11px] uppercase tracking-widest text-foreground-muted mt-2">Club staple</p>
```

### 2. Photo-manager feedback

Open `apps/web/src/components/product/photo-manager.tsx` line 151.

Change:
```tsx
feedback.type === "ok" ? "text-moss-500" : "text-ember-500",
```
To:
```tsx
feedback.type === "ok" ? "text-foreground" : "text-ember-500",
```

### 3. Edit-form enrichment done message

Open `apps/web/src/app/(app)/(shell)/products/[id]/edit/edit-form.tsx` line 225.

Change:
```tsx
<p className="text-xs text-moss-500 mt-2 text-center">
```
To:
```tsx
<p className="text-xs text-foreground-muted mt-2 text-center">
```

### 4. Maker admin actions success

Open `apps/web/src/app/(app)/(shell)/makers/[slug]/maker-admin-actions.tsx` line 72.

Change:
```tsx
{success ? <p className="text-sm text-moss-500 mt-3">{success}</p> : null}
```
To:
```tsx
{success ? <p className="text-sm text-foreground-muted mt-3">{success}</p> : null}
```

### 5. Meetup form success

Open `apps/web/src/app/(app)/(shell)/admin/meetup/meetup-form.tsx` line 72.

Change:
```tsx
<p className="text-sm text-moss-500">{success}</p>
```
To:
```tsx
<p className="text-sm text-foreground-muted">{success}</p>
```

### 6. Verify

```bash
pnpm lint
pnpm build
```

## Files Modified
- `apps/web/src/app/(app)/(shell)/products/[id]/page.tsx` — "Club staple" text color
- `apps/web/src/components/product/photo-manager.tsx` — ok-feedback text color
- `apps/web/src/app/(app)/(shell)/products/[id]/edit/edit-form.tsx` — enrichment done text color
- `apps/web/src/app/(app)/(shell)/makers/[slug]/maker-admin-actions.tsx` — success text color
- `apps/web/src/app/(app)/(shell)/admin/meetup/meetup-form.tsx` — success text color

## Verify
- [ ] Build passes
- [ ] Lint passes
- [ ] "Club staple" label on product detail is no longer green (moss)
- [ ] Validated pairing indicators still moss-colored (not changed)
- [ ] Admin form success messages render in foreground-muted (readable, not bold green)
