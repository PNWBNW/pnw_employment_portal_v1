# NFT Art Gameplan — Generative Topographic Credential Cards

> Reference document for building deterministic generative art for worker credential NFTs.
> Created 2026-04-08 during project review session.

---

## Project State Recap (as of 2026-04-08)

**Phase:** E9 Complete + Post-E9 Done. E10 (end-to-end testnet) pending.

| Area | Status |
|------|--------|
| Wallet connection (5 adapters + manual fallback) | Done |
| Employer/Worker onboarding (.pnw names) | Done |
| Payroll table + manifest compiler | Done |
| Settlement coordinator (chunks, retries, credentials) | Done |
| Batch anchor finalizer (Cycle NFT) | Done |
| Credential issuance/revocation | Done |
| Audit authorization (dual-consent) | Done |
| PDF generation (paystubs, certs, audit docs) | Done |
| Cinematic landing page | Done |
| Encrypted draft persistence (IndexedDB + AES-256-GCM) | Done |

**101 commits**, clean working tree. A couple known bugs remain in payroll transaction finalization — parked for now.

---

## Current NFT Architecture (What Exists)

Three NFT types with deterministic token IDs via BLAKE3:

| NFT Type | Program | Token ID Prefix | Data Attached |
|----------|---------|-----------------|---------------|
| **Cycle NFT** | `payroll_nfts.aleo` | `0x01` | batch_id, batch_root, epoch, worker_count, total_gross |
| **Credential NFT** | `credential_nft.aleo` | `0x02` | credential_id, subject_hash, issuer_hash, scope_hash, doc_hash |
| **Paystub NFT** | `payroll_nfts.aleo` | `0x03` | row_hash (planned, not yet minted individually) |

**Currently: zero visual/image representation.** NFTs are pure data anchors — hashes on-chain, PDFs generated client-side. No metadata URI, no image, no visual identity.

### Credential Record Structure (from `src/stores/credential_store.ts`)

```typescript
type CredentialRecord = {
  credential_id: Bytes32;
  credential_type: CredentialType;  // "employment_verified" | "skills" | "clearance" | "custom"
  credential_type_label: string;
  worker_addr: Address;
  employer_addr: Address;
  subject_hash: Field;   // worker name hash
  issuer_hash: Field;    // employer name hash
  scope: string;
  scope_hash: Bytes32;
  doc_hash: Bytes32;
  issued_epoch: number;
  expires_epoch?: number;
  status: "active" | "revoked" | "pending";
  tx_id?: string;
  revoke_tx_id?: string;
  signature_proof?: string;
};
```

### Token ID Derivation (from `src/lib/pnw-adapter/token_id.ts`)

```typescript
// Credential NFT token ID
deriveCredentialTokenId(credentialHash: Bytes32): Field {
  const data = new TextEncoder().encode(`${0x02}:${credentialHash}`);
  return toHex(domainHash("PNW::LEAF", data));
}
```

### Worker Side Current State

- Worker dashboard at `app/worker/dashboard/page.tsx` — shows offers, agreements, audit requests
- Worker nav has 3 items: Dashboard, Offers, Paystubs
- **No dedicated credential viewing page for workers**
- Worker identity store has: `chosenName` (plaintext .pnw name), `workerNameHash`, `walletAddress`

---

## Design Decisions Made

| Decision | Choice | Rationale |
|----------|--------|-----------|
| **Art style** | Topographic / data-viz | Hash bytes generate contour map terrain; emphasizes crypto/tech + PNW nature palette |
| **Rendering size** | 600x400 card format | Horizontal badge, good for inline portal display and PNG export |
| **Renderer** | Canvas API | Pixel-level control, easy PNG export via `toDataURL()`, no SVG-to-canvas conversion needed |
| **NFT scope** | Credential NFTs on worker side only | Start small, expand to payroll/paystub NFTs later |
| **Storage** | Client-side only (no IPFS) | Render on-demand from deterministic hash inputs; explore pinning later when Shield wallet supports NFT viewing |
| **pnw_mvp_v2 changes** | None needed | `credential_hash` field in `CredentialNftParams` already acts as content commitment |
| **Uniqueness source** | `credential_id` hash bytes | Each credential gets a unique terrain; credential_type selects color palette |
| **Identity display** | Worker `.pnw` name on card | Plaintext from `useWorkerIdentityStore.chosenName` |

---

## Implementation Plan

### Step 1: Hash-to-Parameters Engine

**New file:** `src/nft-art/hash_params.ts`

Converts a 32-byte hash (`credential_id`) into deterministic visual parameters. The hash bytes map to:

- **Terrain seed** (bytes 0-7): Seeds a deterministic noise function for the heightmap
- **Color palette**: Selected by `credential_type`, not hash byte — ensures visual type distinction:
  - `employment_verified` → navy-to-cyan gradient (trust/verification)
  - `skills` → forest-to-gold gradient (growth/achievement)
  - `clearance` → navy-to-gold gradient (authority/prestige)
  - `custom` → forest-to-cyan gradient (flexibility)
- **Contour density** (byte 9): Number of contour levels (8-16 range)
- **Ridge offset** (bytes 10-11): Shifts the "mountain center" position
- **Flow direction** (byte 12): Angle of the terrain gradient
- **Accent intensity** (byte 13): Brightness of peak highlights

Uses existing `fromHex()` from `src/lib/pnw-adapter/hash.ts` to parse hash strings.

**Types:**

```typescript
export type TerrainParams = {
  seed: number[];           // 8 bytes for noise seeding
  palette: PNWPalette;      // color stops for contours
  contourLevels: number;    // 8-16
  ridgeCenter: [number, number]; // normalized 0-1
  flowAngle: number;        // radians
  accentIntensity: number;  // 0-1
};

export type PNWPalette = {
  deep: string;    // lowest elevation color
  mid: string;     // mid elevation
  high: string;    // high elevation / peaks
  accent: string;  // contour line highlight
  glow: string;    // peak glow color
};
```

---

### Step 2: Topographic Renderer (Canvas)

**New file:** `src/nft-art/topo_renderer.ts`

Pure function: `renderTopoCard(canvas, params, credentialInfo) → void`

Renders a 600x400 topographic credential card onto an HTML5 Canvas:

1. **Background fill** — Deep navy (`#030810`)
2. **Heightmap generation** — Simple value noise function seeded by `params.seed`. Uses additive octaves (3 layers) to create organic terrain. No external library — just a seeded pseudo-random + bilinear interpolation on a coarse grid (~30 lines).
3. **Contour line drawing** — Marching squares algorithm on the heightmap at `params.contourLevels` thresholds. Lines colored from `palette.deep` → `palette.high` by elevation. Lower contours thinner (0.5px), higher contours thicker (1.5px). (~50 lines)
4. **Peak glow** — Radial gradient at highest elevation points using `palette.glow` with low opacity.
5. **Credential type badge** — Small icon (top-left): shield for employment_verified, hexagon for skills, lock for clearance, diamond for custom. Drawn with canvas paths in accent color.
6. **Text overlay** (bottom section, semi-transparent dark band):
   - `.pnw` name (large, e.g. "alice_smith.pnw") — white, bold
   - Credential type label — accent color, smaller
   - Scope text — muted white, smaller
   - Status badge — green dot (active), red (revoked), yellow (pending)
7. **Hash fingerprint** — Bottom-right: first 8 chars of credential_id in monospace, very small, muted — visual serial number
8. **Subtle border** — 1px border in accent color at 30% opacity

**No external dependencies.** Pure Canvas 2D API only.

---

### Step 3: Credential Card React Component

**New file:** `components/credential-art/CredentialCard.tsx`

```typescript
type CredentialCardProps = {
  credential: CredentialRecord;
  workerName: string;        // plaintext .pnw name
  width?: number;            // default 600
  height?: number;           // default 400
  onExport?: (blob: Blob) => void;
};
```

- `useRef<HTMLCanvasElement>` + `useEffect` to render on mount/prop change
- Derives `TerrainParams` from `credential.credential_id` + `credential.credential_type`
- Passes `.pnw` name, credential type label, scope, status to renderer
- Exposes `exportAsPng()` via `onExport` callback (`canvas.toBlob()`)

---

### Step 4: Export Button Component

**New file:** `components/credential-art/ExportCardButton.tsx`

- Takes a ref to the canvas element
- On click: `canvas.toBlob()` → create object URL → trigger download
- Filename: `credential-{credential_id_first12}.png`
- Follows styling pattern from `components/pdf/DownloadPDFButton.tsx`

---

### Step 5: Worker Credentials Page

**New file:** `app/worker/credentials/page.tsx`

- Reads from `useCredentialStore` (rehydrates on mount)
- Filters to credentials where `worker_addr === session address`
- Reads `.pnw` name from `useWorkerIdentityStore` (`chosenName`)
- **Layout:** Grid — 1 column mobile, 2 columns desktop
- Each card: `CredentialCard` + action row ("Download Image" + "Print Certificate")
- Empty state: "No credentials issued to you yet."
- Active credentials full brightness; revoked desaturated with overlay

---

### Step 6: Update Worker Nav

**Modified file:** `app/worker/layout.tsx`

```typescript
const WORKER_NAV = [
  { href: "/worker/dashboard", label: "Dashboard" },
  { href: "/worker/offers", label: "Offers" },
  { href: "/worker/credentials", label: "Credentials" },  // NEW
  { href: "/worker/paystubs", label: "Paystubs" },
] as const;
```

---

### Step 7: Credential Cards on Worker Dashboard

**Modified file:** `app/worker/dashboard/page.tsx`

- Add credential count to stats row (alongside Pending Offers / Active Agreements / Pending Audit Requests)
- Add "Recent Credentials" section showing up to 3 thumbnail cards (300x200 scaled)
- "View all" link → `/worker/credentials`

---

## Files Summary

| File | Action | Purpose |
|------|--------|---------|
| `src/nft-art/hash_params.ts` | Create | Hash → deterministic terrain parameters |
| `src/nft-art/topo_renderer.ts` | Create | Canvas renderer: heightmap + contours + text overlay |
| `components/credential-art/CredentialCard.tsx` | Create | React wrapper for canvas renderer |
| `components/credential-art/ExportCardButton.tsx` | Create | PNG export button |
| `app/worker/credentials/page.tsx` | Create | Worker credentials gallery page |
| `app/worker/layout.tsx` | Edit | Add "Credentials" nav item |
| `app/worker/dashboard/page.tsx` | Edit | Add recent credentials section + stat |

---

## Existing Code Reused

| File | What's Reused |
|------|---------------|
| `src/lib/pnw-adapter/hash.ts` | `fromHex()` to parse hash strings into bytes |
| `src/stores/credential_store.ts` | `useCredentialStore`, `rehydrateCredentials`, `CredentialRecord` |
| `src/stores/worker_identity_store.ts` | `useWorkerIdentityStore` for `.pnw` name (`chosenName`) |
| `components/key-manager/useAleoSession.ts` | `useAleoSession` for connected address |
| `components/pdf/CredentialCertPDF.tsx` | Existing PDF export (kept alongside new art export) |
| `components/pdf/DownloadPDFButton.tsx` | Pattern reference for export button styling |

---

## PNW Color Palette for Canvas

Hardcoded in renderer (Canvas doesn't read CSS custom properties):

```
Navy:   #030810, #060e1a, #0a1628
Gold:   #fef9e7, #f6d365, #d4a012, #92710a
Forest: #e8f5e9, #81c784, #2e7d32, #1b4332, #0d2818
Cyan:   #80deea, #00e5ff, #00bcd4, #0097a7
Sky:    #bae6fd, #38bdf8
```

### Credential Type Palettes

| Type | Deep | Mid | High | Accent | Glow |
|------|------|-----|------|--------|------|
| employment_verified | #060e1a | #0097a7 | #00e5ff | #80deea | #00e5ff |
| skills | #0d2818 | #2e7d32 | #f6d365 | #81c784 | #f6d365 |
| clearance | #060e1a | #92710a | #f6d365 | #d4a012 | #fef9e7 |
| custom | #0d2818 | #0097a7 | #00e5ff | #81c784 | #00e5ff |

---

## How the Generative Art Works (Conceptual)

```
credential_id (32 bytes, BLAKE3 hash)
        │
        ▼
┌─────────────────────────┐
│  Hash-to-Parameters     │
│  Engine                 │
│                         │
│  bytes 0-7  → seed      │
│  byte 9    → contours   │
│  bytes 10-11 → ridge    │
│  byte 12  → flow angle  │
│  byte 13  → intensity   │
│  cred_type → palette    │
└───────────┬─────────────┘
            │
            ▼
┌─────────────────────────┐
│  Topographic Renderer   │
│  (Canvas 2D)            │
│                         │
│  1. Navy background     │
│  2. Seeded noise →      │
│     heightmap grid      │
│  3. Marching squares →  │
│     contour lines       │
│  4. Palette colors      │
│     by elevation        │
│  5. Peak glow radial    │
│  6. Type badge icon     │
│  7. Text overlay:       │
│     - .pnw name         │
│     - Credential type   │
│     - Scope             │
│     - Status dot        │
│  8. Hash fingerprint    │
└───────────┬─────────────┘
            │
            ▼
     600×400 Canvas
     (deterministic — same hash = same art)
```

**Key property:** The same `credential_id` always produces the exact same visual. Different workers get different terrains. Different credential types get different color families. The `.pnw` name ties the visual identity to the worker.

---

## Future Extensions (Not in Scope Now)

| Extension | When | Notes |
|-----------|------|-------|
| **Payroll cycle NFT art** | After this ships | Same engine, different card layout — batch summary instead of credential |
| **Paystub NFT art** | After cycle NFTs | Per-worker per-epoch card with amount info |
| **IPFS pinning** | When Shield wallet supports NFT viewing | Pin generated PNG, store CID alongside credential |
| **User-uploaded avatar overlay** | Post-MVP | Optional profile image composited into card corner |
| **Animated version** | Post-MVP | Framer Motion or WebGL for flowing contour animation |
| **Employer-side art** | After worker side proven | Employer credentials page with same engine |

---

## Verification Checklist

- [ ] `pnpm dev` → navigate to worker portal → credentials page loads
- [ ] Issue a credential from employer side → appears on worker credentials page with topographic art
- [ ] Same credential_id always produces identical image (refresh, compare)
- [ ] Issue one of each type → each has visually distinct color palette
- [ ] "Download Image" → PNG downloads at 600x400
- [ ] "Print Certificate" → existing PDF still works alongside new art
- [ ] `pnpm typecheck` passes
- [ ] `pnpm build` succeeds
- [ ] `pnpm test` — all 15 existing tests pass (no regressions)
- [ ] Worker nav shows: Dashboard, Offers, Credentials, Paystubs
- [ ] Worker dashboard shows credential count + thumbnail previews
