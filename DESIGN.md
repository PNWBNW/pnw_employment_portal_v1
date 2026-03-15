# DESIGN.md — Front Page Cinematic Redesign Plan (Phase E7 Prework)

## Purpose
This document captures the approved front-page redesign for the PNW Employment Portal. The goal is to create a visually engaging, cinematic homepage that explains the product narrative and gives a clear entry path for both employers and workers.

## Scope
- In scope:
  - Landing page visual redesign and interaction model.
  - Employer and Worker entry affordances through "door" interactions.
  - Scroll-driven narrative sections for product story.
- Out of scope:
  - Building additional roadmap phases.
  - Worker business workflows beyond route access.
  - Core payroll/coordinator/manifest logic changes.

## Design Pillars
1. **Cinematic first impression**
   - Hero section should feel immersive and thematic.
2. **Dual-audience clarity**
   - Portal clearly supports Employers and Workers.
3. **Cryptographic metaphor**
   - "Merkle roots" and binary/code visuals represent deterministic trust.
4. **Security-forward language**
   - Messaging keeps privacy and deterministic behavior front and center.
5. **Accessible motion**
   - Interactive animations degrade gracefully for reduced-motion users.

## Hero Concept
### Core visual treatment
- Full-screen hero with layered gradients inspired by the provided PNW artwork.
- Visual hierarchy:
  1. Branded title and subtitle.
  2. Interactive door choices.
  3. Animated root/code stream transitioning to lower content.

### Door interaction model
- Two interactive cards representing doors:
  - **Employer Portal**
  - **Worker Portal**
- Hover/focus behavior:
  - Door panel rotates as if partially opening.
  - Warm interior light becomes visible.
  - Context prompt + call-to-action appears.
- Click behavior:
  - Employer actions: connect wallet or enter keys.
  - Worker action: enter worker route.

## Merkle Roots / Code Stream Effect
- Decorative animated layer below hero content:
  - Vertical glowing branch lines (“roots”).
  - Falling binary bits (“code rain”).
- Motion choices:
  - CSS keyframes only (performance-friendly).
  - No heavy runtime animation dependencies.
  - Reduced-motion media query disables non-essential movement.

## Scroll Storyline
As users scroll, they should feel like they are following roots deeper into the system:
1. **What is PNW**
2. **How it works**
3. **Who it is for**
4. **Benefits**
5. **Security**

Each section uses:
- High-contrast cinematic cards.
- Compelling headline + concise narrative copy.
- Subtle reveal animation for readability and drama.

## Content Voice
- Tone: cinematic, trustworthy, modern.
- Language goals:
  - Avoid buzzwords without meaning.
  - Pair emotional hooks with concrete system behavior.
  - Reinforce that both employers and workers are first-class users.

## Technical Notes
- Primary files:
  - `app/page.tsx` (layout + interactions + copy)
  - `app/globals.css` (cinematic styles + animations)
- Existing key-management modals remain integrated.
- Existing route behaviors remain intact.

## Future Enhancements (Optional)
- Replace gradient hero with a shipped art asset in `public/` when available.
- Add parallax based on scroll position for background layers.
- Add section-specific iconography with subtle line animation.
- Add analytics events for Employer vs Worker door engagement.

## Acceptance Criteria
- Landing page is visually cinematic and no longer minimalist.
- User can clearly choose Employer or Worker path.
- Door hover/focus interaction communicates “partial opening with light”.
- Merkle root / code metaphor is visible and animated.
- Scroll sections explain what PNW is, how it works, who it is for, benefits, and security.
- Motion/accessibility support includes `prefers-reduced-motion` behavior.
