# 📍 Google Maps Saved place organizer: safe first pass

The old script removed saved places before saving them elsewhere. This version replaces that unsafe behavior with a finite, read-only candidate scan. It never clicks, changes list membership, edits notes, makes requests or starts background loops.

## Use

1. Open the saved list (for example Food) and scroll to load rows.
2. In your own browser DevTools, select the container holding only that list.
3. Paste console-script.js into your console to define the helper. Nothing changes.
4. With the container selected in Elements (`$0`), run:

```js
const report = mapsSavedFirstPass.scan({scope: $0, sourceList: 'Food'});
console.table(report.candidates);
// Optional private clipboard export in Chrome DevTools:
copy(JSON.stringify(report, null, 2));
```

The scan stops after 1,000 loaded headings by default (configurable limit 1–5,000). `truncated` describes that local limit, NOT whether Google loaded the whole list. Maps may virtualize rows. Scroll and repeat as needed. Keep exports private: they contain saved names and URLs.

Mexican, taco, burrito and Tex-Mex categories suggest Mexican. Italian, Greek, Turkish and pizza categories suggest Mediterranean. Coffee, tea, bakery and dessert mappings remain. Suggestions require review. Generic restaurants, broad Mediterranean labels and unmapped categories are never guessed or defaulted to Food.

## Move safely after review

This release deliberately does NOT automate moves: DOM heuristics cannot reliably verify note transfer or persistence in current Google Maps.

1. Verify the exact saved pin/address, cuisine and destination.
2. Read and retain the complete original note.
3. Save to the destination FIRST, or confirm it is already there.
4. Reopen the destination and verify the exact pin and complete note. Copy the note if needed and reopen to verify persistence.
5. Only then remove the old membership and verify the final state.

If anything is uncertain, leave the source untouched and reconcile before retrying. Permanently closed places are flagged as removal candidates, not cuisine moves. Verify the exact pin and permanent closure, and preserve the full note in a private record before removing the authorized saved memberships manually. Temporary closure, ordinary closed-now hours, or conflicting closure labels are not removal candidates. The scanner never deletes anything. Missing destination, identity or note never justifies deletion.

## Limits

- English categories and best-effort DOM selectors. Blank category or URL means review, not permission to guess.
- Includes loaded headings with existing notes, not just Add note rows.
- No automatic scrolling, full-list export, cuisine lookup or completeness claim.
- Exact URL deduplication only where a URL includes a Maps identity/data field. Names never deduplicate branches. Missing identities remain separate.
- Place links currently accept HTTPS google.com hosts only. Country-domain links remain unidentified.
- No live Maps integration test has been performed. Validate a few rows against current UI before trusting a large report.
- Assistant integrations must use documented DOM-reading APIs. This repo does not authorize arbitrary script injection in a managed browser. Port the read-only logic to supported APIs or use UI snapshots.

## Tests

No installation or dependencies:

```sh
node --check console-script.js
node --test test.cjs
```


### Heart exception

Keep permanently closed places saved to Heart/Favorites. Unknown Heart membership
blocks removal. The scan cannot infer absence from Heart from a Food-list row,
so it reports `heartMembership: unknown` and a blocked status by default.
Only a separately verified explicit `heartMembership: false` supplied to `plan`
can produce a removal candidate. `true` produces `keep: Heart exception`.
Do not remove Heart places from other lists as part of closure cleanup either.
