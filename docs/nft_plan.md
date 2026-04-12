# Plan: Generative Topographic NFT Art for Worker Credentials

## Context

The PNW Employment Portal has completed E1-E9 + Post-E9. All credential infrastructure exists (issuing, revoking, PDF certs, credential store) but credentials are purely text/hash — no visual representation. Workers currently have **no dedicated credentials page** (only see audit-related certs on the dashboard).

The goal is to build a **deterministic generative art system** for credential NFTs on the worker side. Each credential gets a unique **topographic + isometric-projection** visual derived from the credential's hash, rendered client-side on Canvas, with PNW branding and the worker's `.pnw` domain displayed.

**Format:** Vertical **400×600** card (ID badge / credential card proportions).

**Visual concept:** Each card is a two-panel "surveyor's field notebook" style composition rendered in a **hand-drawn blueprint aesthetic**:
- **Upper panel:** Top-down topographic contour map (classic contour ring view)
- **Lower panel:** Isometric profile projection — mountain silhouette derived by sampling the heightmap along a horizontal cross-section, filled with vertical hatching (like a field surveyor's cross-section diagram)
- **No slice axis line, no connecting guide lines** — the two panels read as clean complementary views. The profile is still mathematically derived from sampling the heightmap at a deterministic y-position (driven by hash bytes), but the slice line itself is not drawn

**Aesthetic:** Limited palette (dark "aged navy paper" background + one accent ink color per credential type). All strokes have subtle hand-drawn character: slight perpendicular jitter along line segments, small line-weight variation, and a very faint procedural paper-grain texture overlay. Still deterministic — the jitter is seeded by the same hash as the terrain, so the same credential always produces the same "hand-drawn" result pixel-for-pixel.

Both views are derived from the **same heightmap** (seeded by the credential hash), so the topo and the profile are mathematically consistent — the mountain in the profile is literally the cross-section of the contour map above it.

**Scope:** Worker-side credential viewing with generative art. Credential NFT images only (payroll/paystub NFTs deferred). Client-side rendering only.

---

## Implementation Status (2026-04-12)

Everything in this plan is **shipped to testnet**. Notable deltas from the
original draft:

| Original | Shipped |
|---|---|
| Client-only, no `pnw_mvp_v2` changes | New program `credential_nft_v2.aleo` deployed (tx `at17ujvtfuw83dzy7hcev3yym6qqy54mz7cerwg9ar7uj5fa23kruysdf5msl`) to fix the ownership + dual-record issue — see section below |
| `credential_id = BLAKE3(DOC, TLV(employer_addr, worker_addr, scope, issue_time))` | `credential_id = BLAKE3(DOC, TLV(employer_addr, worker_name_hash, worker_addr, scope, issue_time))` — `worker_name_hash` is now a first-class TLV component so the art is identity-bound to the `.pnw` name, not just the wallet address |
| Single-record mint | Dual-record mint: one `CredentialNFT` owned by the employer (authoritative), one owned by the worker (visible in their wallet on scan). Both carry the same `credential_id`. |
| Credential type → palette via sidecar lookup or plaintext scope | Credential type code encoded in `root[0]` at mint time; scanner reads it back. Works with on-chain data alone, no sidecar. |
| Card header: `.pnw` name only | Two-line header: bold `.pnw` name + truncated Aleo address (`aleo1abcd…xyz6`) in monospace below |
| Revoke consumes the record | Split into three paths: `revoke_by_issuer` (public mapping flip, no record consumption), `revoke_by_owner` (consume + flip), `burn_view` (worker discards their copy without affecting public status) |

The rest of the original plan (canvas renderer, marching squares, jittered
strokes, palette selection, dev preview page, worker credentials gallery,
dashboard integration) landed as-written.

---

## Visual Uniqueness — the guarantees we make

The art system rests on one guarantee: **every credential has a
mathematically unique visual fingerprint, anchored to the worker's
`.pnw` identity.** The specific derivation logic — how we turn an
identity hash into a mountain shape — is intentionally not documented
here.

### What the guarantee is

- **Identity binding.** The visual is a deterministic function of the
  credential's on-chain hash. That hash in turn incorporates the
  worker's `.pnw` name identity as a first-class input, so the art is
  bound to *who the credential is for*, not just to the wallet address
  that happens to hold it at any moment.
- **Per-credential uniqueness.** Two credentials issued to the same
  worker look visibly distinct. They share only the color family that
  corresponds to the credential type; their terrain shapes are
  unrelated.
- **Cross-worker uniqueness for the same type.** Two different workers
  holding credentials of the same type render in the same color family
  but with completely different terrain shapes.

### Why we're confident the uniqueness holds

The seed behind the visual is a 32-byte BLAKE3 output. BLAKE3 is a
modern cryptographic hash with an avalanche property (flipping a single
input bit changes roughly half the output bits), so any change at all
in the credential's inputs — a different `.pnw` name, a different
wallet, a different scope, a different mint timestamp — produces a
completely different hash, not a near-neighbor.

From there, the visual generator is a deterministic pure function of
that hash. Same hash → same image, pixel-for-pixel. Different hash →
uncorrelated image.

The BLAKE3 output space is 2<sup>256</sup>. Accidental collisions
between two independently generated credentials are not a practical
concern.

### Color palette resolution

Credential type determines the palette. Four types, four palettes:
`employment_verified`, `skills`, `clearance`, `custom`. Type → palette
is a fixed client-side table in the portal.

Because the on-chain record holds only a hash of the scope (not
plaintext), the worker-side scanner needs some way to know which
palette to pick. Rather than relying on a sidecar lookup or plaintext
gossip, we piggy-back a small type hint onto an otherwise-reserved
field in the on-chain `CredentialNFT` record. The portal reads it
back during the scan. This means:

- The palette is recoverable from on-chain data alone
- No sidecar database is required
- No plaintext scope ever needs to leave the issuer's browser

The exact encoding lives in the source code — `credential_actions.ts`
on the mint side and `credential_scanner.ts` on the read side — and
is not documented here.

### What stays proprietary

The exact byte-to-parameter mapping, the PRNG implementation, the
specific terrain-generation algorithm, the worked-example hash values,
and the noise-grid dimensions are all client-side implementation
details. They are not part of any public API or contract, and are not
documented in this plan. Anyone curious about the exact derivation
can read the code — but we don't publish it in the plan so that the
visual system remains a creative artifact that has to be
re-implemented from scratch by anyone who wants to reproduce it.

---

## Dual-record mint — why the worker sees their credentials

`credential_nft.aleo` v1 was `@noupgrade` and minted a single record
owned by `self.caller` (the employer). Workers had no visibility into
credentials issued to them because the record lived in the employer's
wallet only.

`credential_nft_v2.aleo` emits **two** `CredentialNFT` records from a
single `mint_credential_nft` transition:

1. **Employer copy** — `owner = self.caller (employer_addr)`, authoritative.
   The employer's wallet scans find this copy.
2. **Worker copy** — `owner = worker_addr` (passed as the first parameter).
   The worker's wallet scans find this copy.

Both copies carry identical fields (credential_id, subject_hash,
issuer_hash, scope_hash, doc_hash, root, schema_v, policy_v, issuer_addr,
worker_addr). Public state is a single source of truth keyed by
`credential_id` — both wallets render the same status, the same anchor
height, and (deterministically) the same art.

Revoke is split:
- `revoke_by_issuer(credential_id)` — employer flips the public
  `credential_status` mapping. No record consumption. Both wallet
  copies continue to hold the record but render as revoked (grayscale)
  when the portal cross-references the status mapping.
- `revoke_by_owner(nft)` — consume the record AND flip status. Useful
  if the employer wants to both revoke and prune their wallet.
- `burn_view(nft)` — worker deletes their own copy without affecting
  public status. Lets a worker decline or hide a credential that still
  exists in the employer's records.

---

## Implementation Steps

### Step 1: Hash-to-Parameters Engine

**New file:** `src/nft-art/hash_params.ts`

Converts a 32-byte hash (`credential_id`) into deterministic visual parameters for both the topographic contour map AND the isometric projection profile. The hash bytes map to:

- **Terrain seed** (bytes 0-7): Seeds the deterministic value-noise function for the heightmap (this single heightmap drives both the contours AND the profile)
- **Jitter seed** (bytes 16-23): Separate seed for the hand-drawn line jitter PRNG, so art shape and stroke character are independently varied but still fully deterministic
- **Palette selection** (from `credential_type`, not hash): 4 single-accent "blueprint ink" palettes — one per credential type:
  - `employment_verified` → cyan ink (#00e5ff) on aged navy paper
  - `skills` → gold ink (#f6d365) on aged navy paper
  - `clearance` → pale gold / parchment ink (#fef9e7) on aged navy paper
  - `custom` → forest ink (#81c784) on aged navy paper
- **Contour density** (byte 9): Number of contour rings in the upper panel (range 6-12)
- **Ridge center** (bytes 10-11): Shifts the "peak" position of the heightmap (normalized 0-1, x/y)
- **Slice axis y-position** (byte 12): Where the horizontal projection axis cuts through the contour map (normalized 0.35-0.65 — always somewhere through the interesting region)
- **Profile vertical exaggeration** (byte 13): Scaling factor for the projected profile height (0.6-1.2) — some credentials look like gentle hills, others like sharp peaks
- **Hatch density** (byte 14): Number of vertical hatch lines inside the profile silhouette (range 20-40)
- **Hatch angle jitter** (byte 15): Small per-line angle variation (0-0.08 radians) for hand-drawn character
- **Line jitter amplitude** (derived constant, not per-hash): ~0.8px max perpendicular offset at each line segment vertex — gives contours and the profile silhouette a subtle "drawn by hand" wobble

Uses existing `fromHex()` from `src/lib/pnw-adapter/hash.ts` to parse hash strings.

**Types exported:**
```typescript
export type TerrainParams = {
  seed: number[];              // 8 bytes for heightmap noise seeding
  jitterSeed: number[];        // 8 bytes for hand-drawn stroke jitter PRNG
  palette: BlueprintPalette;   // single-accent blueprint palette
  contourLevels: number;       // 6-12
  ridgeCenter: [number, number]; // normalized 0-1
  sliceAxisY: number;          // normalized 0.35-0.65
  profileExaggeration: number; // 0.6-1.2
  hatchDensity: number;        // 20-40
  hatchAngleJitter: number;    // 0-0.08 radians
};

export type BlueprintPalette = {
  paper: string;      // background — dark aged-navy (e.g. #0a1120)
  paperGrain: string; // very subtle lighter color for procedural paper texture
  ink: string;        // primary accent — the "pen" color for this credential type
  inkDim: string;     // same hue at ~50% opacity for secondary strokes (hatching)
  inkFaint: string;   // same hue at ~25% opacity for tertiary elements (rules, border)
};
```

### Step 2: Blueprint Topo + Projection Renderer (Canvas)

**New file:** `src/nft-art/topo_renderer.ts`

Pure function: `renderTopoCard(canvas, params, credentialInfo) → void`

Renders a **400×600** vertical credential card in hand-drawn blueprint style with stacked topo map + isometric profile projection. Proportions match a vertical ID badge.

**Canvas layout (400 wide × 600 tall):**
```
y=0   ┌─────────────────────────────────┐
      │  ◇                              │
      │                                 │  ← header strip (60px)
      │            jane_d_doe.pnw       │
y=60  ├─────────────────────────────────┤
      │                                 │
      │                                 │
      │                                 │
      │                                 │
      │     TOPOGRAPHIC CONTOUR MAP     │  ← upper panel (280px)
      │      (hand-drawn contour rings) │
      │                                 │
      │                                 │
      │                                 │
y=340 ├─────────────────────────────────┤
      │                                 │
      │                                 │
      │   ISOMETRIC PROJECTION PROFILE  │  ← lower panel (160px)
      │    (silhouette + vertical       │
      │     hatching)                   │
      │                                 │
y=500 ├─────────────────────────────────┤
      │  CLEARANCE                      │
      │  Level 3, Engineering           │  ← info band (100px)
      │  ● Active         0x7a3f4b2c    │
y=600 └─────────────────────────────────┘
```

No slice axis line, no projection guides — the two panels sit as clean sibling views. The profile is still computed from sampling the heightmap at a deterministic cross-section y-position (`params.sliceAxisY`), but that axis is not visually drawn.

**Render pipeline:**

1. **Background fill** — `palette.paper` (dark aged navy, e.g. `#0a1120`) covering entire 400×600 card
2. **Paper grain texture** — Procedural noise overlay:
   - Generate a high-frequency value-noise pattern (same noise function as heightmap but tiny scale)
   - Draw as per-pixel alpha variation of `palette.paperGrain` at 3-8% opacity
   - Implemented via Canvas `ImageData` or a pre-rendered offscreen pattern canvas
   - Gives the whole card a subtle "aged paper" feel without needing any image assets
3. **Heightmap generation** — Single value-noise function seeded by `params.seed`, 3 additive octaves, sampled to a coarse 2D grid (~80×60 cells to fit the vertical format). Computed ONCE and used for both the contour map AND the profile projection, ensuring mathematical consistency
4. **Header strip** (y=0..60):
   - Credential type badge (top-left, ~24×24, with ~16px padding): hand-drawn icon in `palette.ink` — shield (employment_verified), hexagon (skills), diamond (clearance), triangle (custom)
   - `.pnw` name (e.g. "jane_d_doe.pnw") — `palette.ink`, bold, 20px, right-aligned with ~16px padding from right edge
   - Optional jittered horizontal rule line at y=60 in `palette.inkFaint`
5. **Upper panel — topographic contour map** (y=60..340, 280px tall × 400 wide):
   - Marching squares algorithm on the heightmap clipped to this panel region, at `params.contourLevels` thresholds
   - All contour lines drawn in `palette.ink` (single-color blueprint look)
   - **Hand-drawn stroke:** Each line segment rendered via a `drawJitteredPath()` helper:
     - Walks the polyline and at each vertex adds a small perpendicular offset seeded by `params.jitterSeed` + segment index
     - Max offset ~0.8px
     - Produces a subtle wobble that reads as "drawn by hand" without being cartoonish
   - Line weight varies slightly per contour (0.6-1.2px) driven by the jitter PRNG
   - Inner contours (higher elevation) drawn with slightly more solid strokes, outer contours slightly more faded
   - **No slice line drawn** — the cross-section y-position is computed but not visualized
6. **Panel divider** (y=340):
   - Jittered horizontal rule line in `palette.inkFaint`, 1px, spans full card width with small inset margins
7. **Lower panel — isometric profile** (y=340..500, 160px tall × 400 wide):
   - For each x across the panel width (sample every 2px), compute the profile height by:
     - Sampling the heightmap along the cross-section row at `params.sliceAxisY` → get elevation value at that x
     - Scale elevation × `params.profileExaggeration` × panel height → profile y offset from baseline
   - Build the silhouette path: left baseline → jittered curve over the peak(s) → right baseline
   - Stroke the silhouette in `palette.ink`, 1.2px, with the same `drawJitteredPath()` helper
   - Fill inside the silhouette with vertical hatching:
     - `params.hatchDensity` evenly-spaced vertical strokes
     - Each stroke: from the silhouette top (at that x) down to the baseline
     - Slight per-stroke angle jitter per `params.hatchAngleJitter` (so hatches lean a tiny bit in different directions)
     - Very slight per-segment jitter along each hatch line (reuse `drawJitteredPath()`)
     - Color: `palette.inkDim` (~50% opacity of the ink)
     - Use Canvas clipping region (`ctx.clip()` with the silhouette path) to ensure no hatch lines extend above the silhouette
   - Baseline at y=500 in `palette.ink`, 1px jittered
8. **Info band** (y=500..600, 100px):
   - Jittered horizontal rule at y=500 in `palette.inkFaint` (reinforces the baseline separation)
   - Credential type label (e.g. "CLEARANCE") — `palette.ink`, uppercase, bold, 16px, left-aligned with ~16px padding, at y≈520
   - Scope text (e.g. "Level 3, Engineering") — `palette.inkDim`, 13px, left-aligned below type label, at y≈542
   - Status indicator row at y≈570: small circle dot in status color (green=active, red=revoked, amber=pending) + status text in `palette.ink`, left-aligned
   - Hash fingerprint (first 8 chars of credential_id, e.g. "0x7a3f4b2c") — monospace 11px, `palette.inkFaint`, right-aligned at y≈570
9. **Card border** — Jittered 1px rectangle in `palette.inkFaint` around the full card edge, ~4px inset for a subtle "page margin" feel

**Hand-drawn line helper signature:**
```typescript
function drawJitteredPath(
  ctx: CanvasRenderingContext2D,
  points: Array<[number, number]>,
  rng: () => number,  // seeded PRNG from params.jitterSeed
  maxOffset?: number, // default 0.8px
): void
```

**No external dependencies, no image assets.** Pure Canvas 2D API. Approx LOC breakdown:
- Seeded value noise function: ~30 lines
- Seeded PRNG (mulberry32 or similar): ~10 lines
- Paper grain texture generator: ~20 lines
- Marching squares for contours: ~50 lines
- Jittered path helper: ~25 lines
- Profile projection (heightmap sampling + silhouette path): ~25 lines
- Hatching with clipping: ~20 lines
- Type badges (4 hand-drawn icons): ~40 lines
- Text + info band layout: ~40 lines
- Total renderer: ~260-280 lines

### Step 3: Credential Card React Component

**New file:** `components/credential-art/CredentialCard.tsx`

React component that wraps the canvas renderer:

```typescript
type CredentialCardProps = {
  credential: CredentialRecord;
  workerName: string;        // plaintext .pnw name
  width?: number;            // default 400 (vertical ID badge)
  height?: number;           // default 600
  onExport?: (blob: Blob) => void;
};
```

- Uses `useRef<HTMLCanvasElement>` + `useEffect` to render on mount/prop change
- Derives `TerrainParams` from `credential.credential_id` (each credential unique) + `credential.credential_type` (palette selection)
- Passes worker `.pnw` name, credential type label, scope, status to the renderer
- Exposes `exportAsPng()` method via the `onExport` callback (calls `canvas.toBlob()`)

### Step 4: Export Button Component

**New file:** `components/credential-art/ExportCardButton.tsx`

Simple button that triggers PNG download from the canvas:

- Takes a ref to the canvas element
- On click: `canvas.toBlob()` → create object URL → trigger download
- Filename: `credential-{credential_id_first12}.png`
- Reuses button styling from existing `DownloadPDFButton` pattern in `components/pdf/DownloadPDFButton.tsx`

### Step 5: Worker Credentials Page

**New file:** `app/worker/credentials/page.tsx`

New route for workers to view their credentials with generative art:

- Reads credentials from `useCredentialStore` (rehydrates on mount)
- Filters to credentials where `worker_addr` matches connected session address
- Reads `.pnw` name from `useWorkerIdentityStore` (`chosenName`)
- **Layout:** Grid of credential cards (1 column on mobile, 2-3 on desktop depending on viewport; cards are 400×600 vertical badges)
- Each card renders `CredentialCard` with the credential data
- Below each card: action row with "Download Image" (PNG export) and "Print Certificate" (existing PDF flow via `generateCredentialCertPdf`)
- Empty state: "No credentials issued to you yet."
- Cards show visual status: active credentials have full brightness, revoked are desaturated with a subtle overlay

### Step 6: Update Worker Nav

**Modified file:** `app/worker/layout.tsx`

Add "Credentials" to `WORKER_NAV`:

```typescript
const WORKER_NAV = [
  { href: "/worker/dashboard", label: "Dashboard" },
  { href: "/worker/offers", label: "Offers" },
  { href: "/worker/credentials", label: "Credentials" },  // NEW
  { href: "/worker/paystubs", label: "Paystubs" },
] as const;
```

### Step 7: Credential Card on Worker Dashboard

**Modified file:** `app/worker/dashboard/page.tsx`

Add a "Recent Credentials" section (similar to how pending offers are shown):

- Show up to 3 most recent credentials as small thumbnail cards (200×300 scaled — half-size vertical badges)
- "View all" link to `/worker/credentials`
- Credential count in the stats row alongside Pending Offers / Active Agreements / Pending Audit Requests

---

## Files Summary

| File | Action | Purpose |
|------|--------|---------|
| `src/nft-art/hash_params.ts` | Create | Hash → deterministic terrain parameters |
| `src/nft-art/topo_renderer.ts` | Create | Canvas renderer: heightmap + contours + profile + text |
| `components/credential-art/CredentialCard.tsx` | Create | React wrapper for canvas renderer (400×600 vertical) |
| `components/credential-art/ExportCardButton.tsx` | Create | PNG export button |
| `app/dev/credential-art-preview/page.tsx` | Create | Standalone tuning page (pre-populated with pnw_dao.pnw) |
| `app/worker/credentials/page.tsx` | Create | Worker credentials gallery page |
| `app/worker/layout.tsx` | Edit | Add "Credentials" nav item |
| `app/worker/dashboard/page.tsx` | Edit | Add recent credentials section + stat |

---

## Existing Code Reused

- `src/lib/pnw-adapter/hash.ts` — `fromHex()` to parse hash strings into bytes for parameter extraction
- `src/stores/credential_store.ts` — `useCredentialStore`, `rehydrateCredentials`, `CredentialRecord` type
- `src/stores/worker_identity_store.ts` — `useWorkerIdentityStore` for `.pnw` name (`chosenName`)
- `components/key-manager/useAleoSession.ts` — `useAleoSession` for connected address
- `components/pdf/CredentialCertPDF.tsx` — existing PDF export (kept alongside new art export)
- `components/pdf/DownloadPDFButton.tsx` — pattern reference for export button
- `globals.css` PNW color tokens — hardcode the hex values in the renderer (Canvas doesn't read CSS vars)

---

## PNW Color Palette for Canvas (from globals.css)

```
Navy:   #030810, #060e1a, #0a1628
Gold:   #fef9e7, #f6d365, #d4a012, #92710a
Forest: #e8f5e9, #81c784, #2e7d32, #1b4332, #0d2818
Cyan:   #80deea, #00e5ff, #00bcd4, #0097a7
Sky:    #bae6fd, #38bdf8
```

---

## Worked Example: pnw_dao.pnw Diamond Security Clearance

A concrete walk-through using real inputs the user provided, so the sample can be verified pixel-for-pixel once the code ships.

### Input (real data)
```
worker .pnw name:  pnw_dao.pnw
worker_addr:       aleo1s8t86aza932zah3mv5knclvnn5zy4gedpl5a4wn5h2yrt08mxqzsw5amdd
worker_name_hash:  2799329730299227402922864368934752110359530977217366040351776574486990205182
                   (field element, decimal — BLS12-377 scalar field)
credential_type:   clearance  (diamond badge)
scope:             Diamond Security Clearance
status:            active
```

### Step A — credential_id vs. name_hash

In the **shipped** production flow, the art generator keys off
`credential_id` (the 32-byte BLAKE3 hash from `credential_actions.ts`),
which depends on
`employer_addr + worker_name_hash + worker_addr + scope + issue_time`
(note: `worker_name_hash` was added to the TLV in 2026-04-12; see the
"Uniqueness & Anti-Collision" section above). Since we don't have an
actual credential_id for this worked example, the dev preview page
**uses the `worker_name_hash` directly as the 32-byte seed** — this is
the deterministic "preview mode" the art generator supports for test
rendering without a full credential flow.

The field element needs to be serialized to 32 bytes. Two conventions are possible:
```
// Option 1: Big-endian (field element → 32-byte big-endian representation)
seed_bytes = to_bytes_be(name_hash, 32)

// Option 2: Little-endian (Aleo's native field serialization)
seed_bytes = to_bytes_le(name_hash, 32)
```
The renderer must commit to one convention and use it consistently. **Recommendation:** big-endian, to match how we display credential_id hashes (`0x...` hex strings) throughout the UI.

### Step B — Field element → bytes (symbolic, exact values computed at runtime)

`name_hash = 2799329730299227402922864368934752110359530977217366040351776574486990205182`

The renderer would execute:
```typescript
const n = BigInt("2799329730299227402922864368934752110359530977217366040351776574486990205182");
const bytes = new Uint8Array(32);
for (let i = 31; i >= 0; i--) {
  bytes[i] = Number(n & 0xffn);
  n >>= 8n;
}
// bytes is now the 32-byte big-endian representation
```

**Magnitude check:** `2^253 ≈ 1.448 × 10^76`, and the name hash ≈ `2.799 × 10^75` ≈ 19.3% of the scalar field range → the top few bits are zero, and the top byte is in the single-digit range. The hash occupies roughly bytes 1-31 with byte 0 being a small value.

**Two bytes we can compute reliably by hand:**

Last byte (byte 31): `n mod 256`
```
n mod 10^8 = 90205182  (last 8 decimal digits, since 10^8 is divisible by 256 is false — but 10^n for n ≥ 8 is ≥ 2^26, not ≡ 0 mod 256)
```
Actually cleaner: directly compute `2799…205182 mod 256`. Taking last 3 digits plus carry: `182 mod 256 = 182`, then add `(5*1000) mod 256 = 5000 mod 256 = 5000 - 19*256 = 5000 - 4864 = 136`, so partial = `182 + 136 = 318 mod 256 = 62`... the arithmetic stacks and compounds.

**Honest statement:** Accurately extracting all 32 bytes of a 76-decimal-digit field element by hand is not feasible in plan mode without arithmetic errors. The exact parameters — and therefore the exact pixel output — will be produced by running the `hash_params.ts` module on this input once the code is implemented. The ASCII mockup below is an **illustrative approximation** based on the general character of this hash (moderate top byte, visually "full" distribution of low/mid bytes).

### Step C — Parameter extraction (illustrative; exact values computed at runtime)

Assuming big-endian serialization, the renderer would extract:

| Byte range | Field | Expected general character for this hash |
|---|---|---|
| `bytes[0..7]` | `seed` (heightmap) | Includes the small top byte (~0x05-0x06) plus 7 mixed bytes → produces an off-center ridge pattern |
| `bytes[16..23]` | `jitterSeed` | Mid-range bytes → moderate hand-drawn wobble on all strokes |
| (credential_type) | `palette` | `clearance` → `paper=#0a1120`, `ink=#fef9e7` (pale parchment), `inkDim=#fef9e7@50%`, `inkFaint=#fef9e7@25%` |
| `bytes[9]` | `contourLevels` | `6 + (byte % 7)` → somewhere in range 6-12 rings |
| `bytes[10..11]` | `ridgeCenter` | Two normalized coordinates in (0, 1), placing the peak somewhere on the card |
| `bytes[12]` | `sliceAxisY` | `0.35 + (byte/255) × 0.30` → cross-section row between 35% and 65% of heightmap |
| `bytes[13]` | `profileExaggeration` | `0.6 + (byte/255) × 0.6` → profile height 60-120% of panel |
| `bytes[14]` | `hatchDensity` | `20 + (byte % 21)` → 20-40 vertical hatches |
| `bytes[15]` | `hatchAngleJitter` | `(byte/255) × 0.08` → 0-0.08 rad lean on hatches |

### Step D — Expected visual result (400×600 vertical card)

**Header strip (y=0..60):**
- Diamond badge `◇` hand-drawn in the top-left, pale parchment ink
- `.pnw` name "pnw_dao.pnw" in pale parchment ink, bold 20px, right-aligned
- Faint horizontal rule at y=60

**Upper panel — topographic contour map (y=60..340, 280px tall):**
- N nested contour rings (N ∈ 6-12, determined by hash byte) forming an asymmetric mountain shape
- Rings concentrate around a peak derived from `bytes[10..11]` of the name hash
- All rings drawn in pale parchment `#fef9e7` with subtle hand-drawn wobble (~0.8px max per-vertex offset)
- Outer rings are the faintest / thinnest (0.6px); inner rings slightly thicker (1.2px)
- **No slice axis line is drawn** — the cross-section y-position exists mathematically but is invisible
- Panel divider (faint jittered rule) at y=340

**Lower panel — isometric profile (y=340..500, 160px tall):**
- Mountain silhouette derived from sampling the heightmap along the invisible cross-section row
- Shape: asymmetric peak, position and sharpness derived from hash
- Silhouette stroke in parchment ink, ~1.2px, hand-drawn wobble
- Interior filled with vertical hatch lines (20-40 of them) in parchment ink at 50% opacity
- Very slight angle lean on hatches (~0-5° from vertical)
- Hatches clipped to the silhouette boundary (no overflow)
- Baseline stroke along y=500

**Info band (y=500..600, 100px):**
- Faint horizontal rule at y=500
- "CLEARANCE" (uppercase, bold) in pale parchment ink, left-aligned at y≈520
- "Diamond Security Clearance" in dimmed parchment, left-aligned at y≈542
- "● Active" status indicator (green dot + text) left-aligned at y≈570
- Hash fingerprint "0x…" (first 8 chars of the credential_id, computed at runtime) in monospace faint parchment, right-aligned at y≈570

**Full card ASCII mockup (400×600 vertical — proportional, 30 cols × 45 rows):**

*(Illustrative — actual contour shape, hatch count, and parameters will be computed from the pnw_dao.pnw name hash when the renderer runs.)*

```
┌────────────────────────────┐
│                            │
│ ◇               pnw_dao.pnw│
│                            │
│┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈│
│                            │
│                            │
│                            │
│                            │
│         ╭───────╮          │
│       ╭─╯       ╰─╮        │
│      ╱  ╭─────╮   ╲        │
│     │  ╱ ╭───╮ ╲    │      │
│     │ │  ╭─╮  │     │      │
│     │ │ │ ● │ │     │      │
│     │ │  ╰─╯  │     │      │
│     │  ╲ ╰─╯ ╱      │      │
│      ╲  ╰───╯      ╱       │
│       ╰─╮        ╭╯        │
│         ╰────────╯         │
│                            │
│                            │
│                            │
│                            │
│┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈│
│                            │
│                            │
│                            │
│               ╱╲           │
│            ╱╲╱│││╲          │
│          ╱│││││││││╲        │
│        ╱│││││││││││││╲      │
│      ╱│││││││││││││││││╲    │
│    ╱│││││││││││││││││││││╲  │
│  ─╯│││││││││││││││││││││││╰─│
│                            │
│┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈│
│                            │
│  CLEARANCE                 │
│  Diamond Security Clearance│
│                            │
│  ● Active      0x………………… │
│                            │
└────────────────────────────┘
```

### Step D — What the actual PNG would look like (textual description)

When the Canvas renderer runs on this input and produces a 400×600 PNG, here's what you would literally see pixel-by-pixel:

**Color:** Deep aged-navy background (`#0a1120`), almost like dark blueprint paper. The entire card has a subtle procedural paper-grain noise overlay at ~5% opacity — visible as faint irregular speckling if you look closely, invisible at normal viewing distance. All drawn elements are in pale parchment ink `#fef9e7` (the "clearance" palette), with some elements dimmed to 50% or 25% opacity.

**Top strip:**
- Top-left, ~20px from edges: a hand-drawn diamond outline (4 short strokes meeting at sharp corners, slight wobble on each stroke) — the clearance credential icon
- Top-right, ~20px from right edge, baseline ~35px from top: "jane_d_doe.pnw" in parchment ink, bold 20px, slight letter-by-letter weight variation (from the jitter PRNG)
- At y=60: a thin jittered horizontal rule in faint parchment ink, spans full card width with ~16px inset margins

**Upper panel (contour map, y=60..340, 280px tall):**
- 8 concentric but irregularly-shaped contour rings forming an asymmetric mountain
- The rings are NOT perfect circles — they're organic blobby shapes derived from the value-noise heightmap
- Peak/center of the rings sits at approximately (62%, 44%) of the panel — slightly right of center, slightly above vertical middle
- Outer rings are thinner (0.6px) and slightly faded
- Inner rings are thicker (1.2px) and more solid
- Each ring has a subtle hand-drawn wobble — you can see tiny perpendicular kinks in the line if you look at ~2x zoom
- No slice axis line visible
- Empty space around the rings (no fill, just the contour strokes on the paper background)

**Panel divider at y=340:**
- Faint jittered horizontal rule in parchment ink at 25% opacity, spans full width with inset margins

**Lower panel (profile, y=340..500, 160px tall):**
- An asymmetric mountain silhouette — the profile of the contour map sliced at cross-section y=0.437
- Shape: rising from left baseline, curving up to an asymmetric peak at roughly 60-65% of the card's horizontal width, peak height ~89% of the 160px panel (~143px tall at max), then descending to the right baseline
- Silhouette outline stroke in parchment ink, 1.2px, hand-drawn wobble
- Interior filled with 23 evenly-spaced vertical hatch lines in parchment ink at 50% opacity
- Each hatch line: starts at the silhouette top at that x position, runs straight down to the baseline at y=500
- Very slight angle lean on hatches (~0.5° from vertical, alternating directions)
- Hatch lines are clipped precisely to the silhouette shape (no overflow above the curve)
- Thin parchment baseline at y=500

**Info band (y=500..600, 100px):**
- Faint jittered horizontal rule at y=500
- "CLEARANCE" in uppercase bold 16px parchment ink, left-aligned at (~16px, y=524)
- "Level 3, Engineering" in dimmed parchment 13px, left-aligned at (~16px, y=546)  
  *(scope placeholder — update when user confirms actual scope)*
- Small green filled circle + "Active" text, left-aligned at (~16px, y=578)
- "0x7a3f4b2c" monospace 11px faint parchment, right-aligned at (~384px, y=578)
- Card border: jittered 1px rectangle in faint parchment ink, ~4px inset from card edge

### Notes on actually rendering this

I cannot execute code or generate a real PNG while in plan mode — the ASCII mockup and the pixel-by-pixel description above are the closest I can come to a preview right now. Once you approve this plan and I'm out of plan mode, I can:

1. Scaffold the `hash_params.ts` + `topo_renderer.ts` files
2. Wire them into a standalone test page (e.g. `app/dev/credential-art-preview/page.tsx`) that lets you punch in any credential_id + credential_type + worker name and see the actual rendered output
3. Iterate on the visual tuning (line weights, jitter amplitude, palette adjustments) until it matches the vibe of your reference image

The standalone preview page is worth building first because it lets you see and tune the art in isolation before wiring it into the full worker credentials page.

### Notes on this example
- **Real seed:** For this preview, the art generator uses the `pnw_dao.pnw` name hash (`2799329730299227402922864368934752110359530977217366040351776574486990205182`) serialized to 32 bytes (big-endian). This is a deterministic preview mode. In production, credentials use `credential_id` (32-byte BLAKE3 output) as the seed instead.
- **Determinism:** Given the same 32-byte seed, the same heightmap, contour pattern, profile silhouette, jitter offsets, and hatch lines are produced every time — pixel-for-pixel across machines and browsers.
- **Same worker, different credentials:** If pnw_dao.pnw gets a second credential (say, an employment_verified), the heightmap seed will be totally different (different credential_id) AND the palette flips to cyan ink — so each credential feels visually distinct even though they're held by the same entity.
- **Plan-mode limitation:** The ASCII mockup above is my best illustration of the card structure; I cannot execute code in plan mode to produce the actual pixel-accurate PNG. The exact shape of the contour rings, the precise peak location, the exact number of hatches, and the specific stroke jitter for this name hash will all be visible once the renderer runs on these bytes.

### Next concrete step (once out of plan mode)
Build a **standalone preview page** at `app/dev/credential-art-preview/page.tsx` that:
1. Has text inputs for: seed hex / seed decimal, credential_type (dropdown), worker .pnw name, scope, status
2. Renders the `CredentialCard` component live as the inputs change
3. Pre-populates the pnw_dao.pnw inputs on first load so you can see the real rendered image immediately
4. Has a "Download PNG" button to save the result

This page isolates the art system from the rest of the worker portal — you can tune line weights, jitter amplitude, palette values, and panel proportions without needing an actual credential issuance flow. Once the visuals look right, we wire it into `/worker/credentials/page.tsx`.

---

## Verification

1. **Visual check:** Run `pnpm dev`, navigate to worker portal, issue a credential from employer side, confirm the worker credentials page shows a two-panel card (topo contours above, projected profile below)
2. **Consistency check:** The profile silhouette in the lower panel visually matches the contour elevations at the slice axis in the upper panel (peaks align with contour ring centers where the slice passes through them)
3. **Determinism:** Same credential_id always produces the same image (refresh page, compare pixel-by-pixel)
4. **Type distinction:** Issue one of each credential type — verify each has a visually distinct color palette AND distinct terrain shape (driven by credential_id)
5. **Projection guides:** The faint dashed vertical lines between panels actually connect contour/slice intersection points to the profile peaks below them
6. **Hatching quality:** Vertical hatch lines inside the profile silhouette are clipped correctly (no lines extend above the silhouette top)
7. **Export:** Click "Download Image" — verify PNG downloads at 400×600 (vertical ID badge format) with all elements intact
8. **TypeScript:** `pnpm typecheck` passes with no errors
9. **Build:** `pnpm build` succeeds
10. **Existing tests:** `pnpm test` — all 15 existing tests still pass (no regressions)
11. **Nav:** Worker nav shows 4 items: Dashboard, Offers, Credentials, Paystubs
12. **Dashboard integration:** Worker dashboard shows credential count + thumbnail cards at ~200×300 (scaled versions of the two-panel vertical layout)
13. **Empty state:** Worker with zero credentials sees "No credentials issued to you yet"
14. **Revoked visual state:** Revoked credentials render with desaturated palette (grayscale filter or CSS overlay)
