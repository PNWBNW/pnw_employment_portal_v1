# PNW Employment Portal — Design Brief for Visual Improvements

> **How to use this document:** Copy this entire file into a Claude.ai conversation.
> Ask Claude to generate specific component code, CSS improvements, or visual designs.
> Then bring the output back to Claude Code for review and implementation.

---

## The Project in 60 Seconds

**Proven National Workers (PNW)** is a privacy-first payroll portal built on Aleo
zero-knowledge proofs. Employers use it to pay workers without any plaintext wages,
identities, or employment data ever leaving the browser. Everything on-chain is hashes
and commitments — mathematical proofs that verify correctness without revealing content.

The web app is built with:
- **Next.js 16** (App Router, client-first, no backend)
- **Tailwind CSS 4** (utility classes)
- **Framer Motion 12** (scroll animations, interactions)
- **shadcn/ui** (Radix-based component primitives)
- **Geist Sans / Geist Mono** fonts (local, no CDN)

The landing page features a painted Pacific Northwest tree with two doors — one blue
(employer), one green (worker). The tree's roots represent the cryptographic network
flowing underground. The entire scroll journey moves from sky → canopy → trunk/doors →
roots → deep underground → footer CTA.

---

## The Visual Metaphor

A massive old-growth Pacific Northwest tree at night. The scene is atmospheric —
stars twinkling, trees swaying in wind, mist in the canopy. Two doors are set into
the trunk: a **blue door** (employer portal) and a **green door** (worker portal).
They swing open in 3D perspective, warm light pouring from behind.

Below the surface, the tree's **roots pulse with cyan light** — representing data
flowing through the Aleo network. The deeper you scroll, the more "underground" and
technical the visual language becomes.

**The scroll story:**
```
SKY (wonder, scale, stars twinkling)
  → CANOPY (protection, privacy, trees swaying)
    → TRUNK / DOORS (choice, entry — interactive 3D doors)
      → CONTENT SECTIONS (what, who, why — 6 cards)
        → ROOTS (technology, cryptography — cyan data flow)
          → FOOTER CTA ("Enter the Portal")
```

---

## What Exists Today

### Landing Page Components

**HeroSection** (~99 lines) — Full-viewport hero with the tree image, constellation
overlay, tree sway overlay, portal doors, wallet connect button, and tagline
"Privacy-First Payroll on Aleo". Fades on scroll.

**PortalDoors** (~325 lines) — Two 3D-perspective doors positioned over the painted
doors in the tree image. Auto-play intro animation (doors swing open on load). Hover
effects with glow, tooltips, and light-through-gap effect. Employer door (blue, hinges
right), worker door (green, hinges left).

**ConstellationOverlay** (~76 lines) — 15 SVG star dots in the upper 20% of viewport
with independent opacity pulsing. Faint lines connecting every third pair.

**TreeSwayOverlay** (~77 lines) — Four semi-transparent gradient overlays positioned
over tree regions, using CSS skew animations (8–11s cycles) with mix-blend-mode overlay.

**CinematicSections** (~198 lines) — Six narrative cards in a 2-column grid:
1. What is PNW? (gold accent)
2. Who is it for? (forest accent)
3. Why privacy? (sky accent)
4. Security model (cyan accent)
5. Inner workings (gold accent)
6. Dignity by default (forest accent)

Each card has scroll-triggered entrance animation, section number, icon, and accent
underline. They sit below the hero over a dark navy background.

**FooterCTA** (~93 lines) — "Enter the Portal" heading with two CTA buttons (employer
blue, worker green), glow effects, and a vertical root glow line from above.

### Available Images

- `public/images/pnw-tree.png` — Main tree painting (1024x1536, portrait orientation)
- `public/images/pnw-hero.png` — Secondary hero (wider framing)
- `public/images/pnw-roots.png` — Root/underground detail image

### CSS Animations Already Defined (in globals.css)

These keyframes exist and are available for use. Some are currently used by components,
others were used by components that were later removed (keyframes kept for reuse):

| Keyframe | What it does | Currently used? |
|----------|-------------|-----------------|
| `bird-fly-1` | Bird arc left→right across viewport | No (component removed) |
| `bird-fly-2` | Bird arc right→left across viewport | No (component removed) |
| `bird-flap` | SVG path morph for wing flapping | No (component removed) |
| `tree-sway` | Gentle skewX oscillation | Yes (TreeSwayOverlay) |
| `tree-sway-alt` | Alternate sway timing | Yes (TreeSwayOverlay) |
| `root-pulse` | Opacity + brightness pulse for roots | No (component removed) |
| `root-flow` | Background-position scroll for root gradient | No (component removed) |
| `deep-root-flow` | Vertical translateY loop for deep roots | No (component removed) |
| `deep-root-pulse` | Top-to-bottom opacity fade for root energy | No (component removed) |
| `constellation` | Opacity pulse 0.3→0.8 | Yes (ConstellationOverlay) |
| `binary-rain` | Falling code/data translateY | No (unused) |
| `door-glow` | Box-shadow pulse for doors | Yes (PortalDoors) |
| `float-up` | translateY + opacity entrance | No (unused) |
| `pulse-down` | Top position + opacity exit | No (unused) |

### Employer Portal (behind the blue door)

Currently functional but visually generic. Uses default shadcn/ui light-mode styling
(white backgrounds, slate borders, standard cards). Key pages:
- **Dashboard** — stat cards (Active Workers, USDCx Balance), quick actions, recent activity
- **Payroll Table** (`/payroll/new`) — TanStack Table spreadsheet for entering payroll data
- **Run Status** (`/payroll/[run_id]`) — chunk-by-chunk settlement progress
- **Workers** — list with agreement status badges
- **Credentials** — credential cards with issue/revoke states
- **Audit** — audit log and authorization requests

### Worker Portal (behind the green door)

Basic stub pages with same generic shadcn styling:
- **Dashboard** — agreements, recent paystubs
- **Offers** — pending job offers to review/accept
- **Paystubs** — paystub list decoded via view key

### Color System

```
Deep navy:     #030810 → #060e1a → #0a1628  (backgrounds, depth)
Employer blue: #2563eb                        (blue door, employer identity)
Worker green:  #16a34a                        (green door, worker identity)
Cyan:          #00e5ff → #00bcd4              (data flow, crypto, network)
Gold:          #f6d365 → #d4a012              (value, wages, warmth)
Forest green:  #2e7d32 → #1b4332             (nature, PNW, organic)
Sky blue:      #38bdf8                        (light accent)
Slate:         #94a3b8 → #cbd5e1             (body text, muted)
```

**Rule:** Bright colors are accents on dark backgrounds only. The feeling is a dark
forest at night with bioluminescent roots glowing beneath your feet.

### Glass/Frosted Surface Pattern

```css
/* Standard glass (cards, panels) */
background: rgba(10, 22, 40, 0.6);
backdrop-filter: blur(16px);
border: 1px solid rgba(255, 255, 255, 0.06);

/* Glow system for interactive elements */
box-shadow: 0 0 20px rgba(37, 99, 235, 0.4), 0 0 60px rgba(37, 99, 235, 0.15); /* employer */
box-shadow: 0 0 20px rgba(22, 163, 74, 0.4), 0 0 60px rgba(22, 163, 74, 0.15); /* worker */
box-shadow: 0 0 15px rgba(0, 229, 255, 0.3), 0 0 45px rgba(0, 229, 255, 0.1);  /* cyan data */
```

---

## What Needs Design Work

### Priority 1: Landing Page — Root Network Section

**The gap:** Between the 6 cinematic cards and the footer CTA, there's nothing
representing the "underground" part of the scroll journey. The transition from
content to footer is abrupt.

**What we want:** A visual section that represents the root network — the cryptographic
layer beneath the surface. Think: glowing cyan root lines branching downward, data
pulses flowing through them, the `pnw-roots.png` image as a background, and perhaps
animated "proof fragments" or hash snippets floating along the root paths.

**Use:** The existing `root-pulse`, `root-flow`, `deep-root-flow`, `deep-root-pulse`
CSS keyframes. The `pnw-roots.png` image. Framer Motion for scroll-linked effects.

**Output needed:** A React component (`RootNetworkSection.tsx`) with Tailwind + Framer
Motion that slots between CinematicSections and FooterCTA.

---

### Priority 2: Landing Page — Section Connectors

**The gap:** The 6 cinematic cards float independently. There's no visual thread
connecting them to the tree trunk or to each other.

**What we want:** Thin glowing lines or root tendrils that visually connect sections —
creating the feeling that the content grows organically from the central tree. These
could be SVG paths, CSS gradients, or Framer Motion animated lines.

**Output needed:** Either modifications to CinematicSections.tsx or a new overlay
component that draws connection lines between cards/sections.

---

### Priority 3: Employer Portal — Dark Theme Transformation

**The gap:** The employer portal uses default shadcn light-mode styling. Once you
click through the blue door, the atmospheric PNW identity disappears completely.

**What we want:** The employer portal should feel like you're inside the tree — the
warm space behind the blue door. Specifically:
- Dark navy backgrounds (not white)
- Glass/frosted card surfaces
- Employer blue (#2563eb) as the accent throughout
- Sidebar nav with a trunk-like vertical accent line
- Payroll table that feels like a premium data surface (dark, dense, with cyan
  highlights for data and blue for actions)
- Status badges with glow effects (green=settled, cyan=proving, red=failed)
- Stat cards on dashboard with subtle gradients

**Output needed:** A Tailwind theme/class system or component modifications for the
employer layout, nav, dashboard cards, and table styling.

---

### Priority 4: Worker Portal — Warm Green Identity

**The gap:** Same generic styling as employer portal, no distinct identity.

**What we want:** The worker portal should feel warmer, more personal — you're behind
the green door. Worker green (#16a34a) replaces employer blue as the accent. Paystub
cards should feel like documents. The offer review flow should feel ceremonial.

**Output needed:** Theme modifications and component suggestions for worker layout,
dashboard, paystub cards, and offer review flow.

---

### Priority 5: Ambient Life — Birds and Root Pulse

**The gap:** We removed the AnimatedBirds and RootPulse components (they weren't
imported anywhere), but the CSS keyframes remain and the visual intent is still valid.

**What we want:** Subtle ambient motion on the landing page:
- 2-3 bird SVGs that fly across the sky region on long arcs (22–38s cycles)
- Root pulse effects in the lower portion of the hero / underground section

These should be barely-noticeable peripheral animations — like seeing movement in
your peripheral vision in a real forest.

**Output needed:** `AnimatedBirds.tsx` and `RootPulse.tsx` components using the
existing CSS keyframes.

---

## Technical Constraints

When generating designs, use **only** these tools:

| Tool | Usage |
|------|-------|
| Tailwind CSS 4 | All styling via utility classes |
| CSS custom properties | `var(--pnw-navy-950)`, `var(--pnw-employer)`, etc. |
| Framer Motion 12 | `motion.div`, `useInView`, `useScroll`, `useTransform`, `AnimatePresence` |
| shadcn/ui components | `Card`, `Badge`, `Button`, `Table`, `Dialog`, etc. from `@/components/ui/` |
| Geist fonts | `font-sans` (Geist Sans), `font-mono` (Geist Mono) |
| Lucide React icons | Any icon from `lucide-react` |
| CSS @keyframes | For ambient loops (defined in globals.css) |

**Do NOT use:**
- External images, fonts, or CDN assets
- New npm dependencies
- Pure white (#ffffff) for body text on dark backgrounds — use slate-300
- Sharp opaque borders on dark surfaces — always translucent
- Layout property animations (width, height, margin) — transform + opacity only
- `ease` or `linear` for entrances — use `[0.22, 1, 0.36, 1]`

**Animation rules:**
- First element entrance: 0.3s delay minimum
- Scroll animations: `once: true`
- Ambient effects: never reach full opacity (0.3–0.8 range)
- Respect `prefers-reduced-motion`
- Stagger siblings by 0.10–0.15s

---

## How to Format Your Response

For each design area, provide:

1. **Component name and file path** (e.g., `components/landing/RootNetworkSection.tsx`)
2. **Full TSX code** — ready to paste into the file
3. **Any CSS additions** needed in globals.css (new keyframes, etc.)
4. **Where it plugs in** — which parent component imports it and where in the JSX tree
5. **Brief rationale** — why this design choice serves the story

Keep components self-contained. Use the existing PNW CSS custom properties. Match the
patterns already established in the codebase (Framer Motion for interactions, CSS
keyframes for ambient loops).
