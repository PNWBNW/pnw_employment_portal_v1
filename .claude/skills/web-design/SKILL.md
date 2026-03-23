# Web Design Skill — PNW Employment Portal

> This skill encodes the visual design language, animation choreography, and component
> patterns for the PNW Employment Portal. Apply these standards whenever creating or
> modifying UI components, pages, or visual elements.

---

## 1. Design Philosophy

**Bold Modern SaaS** — think Vercel, Clerk, Linear. The portal feels premium, alive,
and trustworthy. Every surface has intention. Motion is choreographed, not decorative.
Color is systematic, not random.

### Core Principles

1. **Motion with purpose** — Every animation communicates state, hierarchy, or flow.
   No gratuitous bounce or spin.
2. **Layered depth** — Surfaces stack with clear visual hierarchy via shadows, blur,
   and opacity. The UI feels three-dimensional.
3. **Vibrant restraint** — Bold gradients and glows exist, but are used as accents
   against dark, calm backgrounds. Never overwhelming.
4. **Rhythmic spacing** — Typography and layout follow a consistent scale. White space
   is generous and deliberate.
5. **Progressive disclosure** — Content reveals itself through scroll and interaction.
   The page tells a story as you move through it.

---

## 2. Color System

### Brand Palette (from CSS custom properties)

| Token | Hex | Usage |
|-------|-----|-------|
| `--pnw-navy-950` | `#030810` | Deepest background |
| `--pnw-navy-900` | `#060e1a` | Section backgrounds |
| `--pnw-navy-800` | `#0a1628` | Card backgrounds |
| `--pnw-forest-500` | `#2e7d32` | Nature accent, success |
| `--pnw-forest-700` | `#1b4332` | Deep nature accent |
| `--pnw-gold-300` | `#f6d365` | Warm accent, highlights |
| `--pnw-gold-500` | `#d4a012` | Primary gold |
| `--pnw-cyan-400` | `#00e5ff` | Data flow, crypto accent |
| `--pnw-cyan-500` | `#00bcd4` | Secondary data accent |
| `--pnw-sky-400` | `#38bdf8` | Light accent |
| `--pnw-employer` | `#2563eb` | Employer portal identity |
| `--pnw-worker` | `#16a34a` | Worker portal identity |

### Gradient Patterns

Use these gradient formulas consistently:

```css
/* Hero / section background vignette */
background: radial-gradient(ellipse at center, transparent 40%, var(--pnw-navy-950) 100%);

/* Accent glow behind interactive elements */
background: radial-gradient(circle, rgba(0, 229, 255, 0.15) 0%, transparent 70%);

/* Card shimmer (hover state) */
background: linear-gradient(135deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0.08) 50%, rgba(255,255,255,0.03) 100%);

/* CTA button gradient */
background: linear-gradient(135deg, var(--pnw-employer) 0%, #3b82f6 100%);

/* Gold accent line */
background: linear-gradient(90deg, transparent, var(--pnw-gold-300), transparent);
```

### Glow System

Glows reinforce identity colors. Always use `rgba` with controlled opacity:

```css
/* Employer glow */
box-shadow: 0 0 20px rgba(37, 99, 235, 0.4), 0 0 60px rgba(37, 99, 235, 0.15);

/* Worker glow */
box-shadow: 0 0 20px rgba(22, 163, 74, 0.4), 0 0 60px rgba(22, 163, 74, 0.15);

/* Cyan data glow */
box-shadow: 0 0 15px rgba(0, 229, 255, 0.3), 0 0 45px rgba(0, 229, 255, 0.1);

/* Hover intensification: increase opacity by ~50% */
/* Idle: 0.4 → Hover: 0.6 */
```

---

## 3. Typography Rhythm

### Font Stack

- **Sans:** `var(--font-geist-sans)` — all UI text
- **Mono:** `var(--font-geist-mono)` — code snippets, hashes, addresses, data labels

### Type Scale (rem-based, fluid)

| Role | Size | Weight | Letter Spacing | Line Height |
|------|------|--------|----------------|-------------|
| Display / Hero | `clamp(2.5rem, 5vw, 4.5rem)` | 700 | `-0.02em` | 1.1 |
| Section Heading | `clamp(1.75rem, 3vw, 2.5rem)` | 600 | `-0.01em` | 1.2 |
| Card Title | `1.25rem` | 600 | `0` | 1.3 |
| Body | `1rem` | 400 | `0` | 1.6 |
| Small / Caption | `0.875rem` | 400 | `0.01em` | 1.5 |
| Label / Tag | `0.75rem` | 500 | `0.08em` | 1.4 |
| Monospace Data | `0.875rem` | 400 | `0.05em` | 1.5 |

### Typography Rules

- **Never use more than 3 font weights** on a single page section.
- **Headings** always use negative letter-spacing (tighter).
- **Labels and tags** always use positive letter-spacing (wider) + uppercase.
- **Body text** on dark backgrounds uses `text-slate-300` (`#cbd5e1`), never pure white.
- **Headings** on dark backgrounds use `text-white`.
- **Accent text** (stats, numbers, highlights) uses the relevant brand color.

---

## 4. Scroll Animation Choreography

### Entrance Animations (Intersection Observer / Framer `useInView`)

All section entrances follow this pattern:

```tsx
// Standard reveal pattern
const ref = useRef(null);
const isInView = useInView(ref, { once: true, margin: "-80px" });

<motion.div
  ref={ref}
  initial={{ opacity: 0, y: 30 }}
  animate={isInView ? { opacity: 1, y: 0 } : {}}
  transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
>
```

### Stagger Pattern

When multiple children enter together, stagger by `0.12–0.15s`:

```tsx
// Parent container
<motion.div
  variants={{
    visible: { transition: { staggerChildren: 0.12 } }
  }}
  initial="hidden"
  animate={isInView ? "visible" : "hidden"}
>
  {items.map((item, i) => (
    <motion.div
      key={i}
      variants={{
        hidden: { opacity: 0, y: 24 },
        visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] } }
      }}
    />
  ))}
</motion.div>
```

### Scroll-Linked Parallax

For hero sections and backgrounds:

```tsx
const { scrollYProgress } = useScroll();
const opacity = useTransform(scrollYProgress, [0, 0.3], [1, 0]);
const y = useTransform(scrollYProgress, [0, 0.5], [0, -80]);
```

### Timing Rules

| Animation Type | Duration | Easing |
|---------------|----------|--------|
| Element entrance | `0.5–0.7s` | `[0.22, 1, 0.36, 1]` (ease-out expo) |
| Hover state | `0.2–0.3s` | `ease-out` or `[0.33, 1, 0.68, 1]` |
| Micro-interaction (button press) | `0.1–0.15s` | `ease-in-out` |
| Page transition | `0.3–0.4s` | `[0.22, 1, 0.36, 1]` |
| Background loop (pulse, sway) | `2–10s` | `ease-in-out` (CSS keyframe) |
| Stagger delay between siblings | `0.10–0.15s` | — |
| Auto-play intro sequence | `0.4–1.5s` delay offsets | — |

### Rules

1. **Never animate on load without delay.** First element: `0.3s` delay minimum. Stagger from there.
2. **Scroll animations trigger once** (`once: true`) unless they're ambient/looping.
3. **Never animate layout properties** (`width`, `height`, `top`, `left`) — use `transform` and `opacity` only for 60fps.
4. **Exit animations are optional** but when used, should be faster (60% of entrance duration).
5. **Respect `prefers-reduced-motion`** — wrap animations in a check or use Framer's built-in support.

---

## 5. Layered Depth System

### Z-Index Scale

| Layer | z-index | Usage |
|-------|---------|-------|
| Background effects | `0` | Constellation, gradient overlays |
| Content base | `1` | Cards, sections |
| Interactive overlays | `10` | Tooltips, door overlays |
| Floating UI | `20` | Dropdowns, popovers |
| Modal backdrop | `40` | Dimming layer |
| Modal content | `50` | Dialog, sheet |
| Toast / notification | `60` | Top-level alerts |
| Wallet modal | `100` | Always on top |

### Shadow Scale

```css
/* Elevation 1 — subtle lift (cards at rest) */
box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3), 0 1px 2px rgba(0, 0, 0, 0.2);

/* Elevation 2 — interactive hover */
box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4), 0 2px 4px rgba(0, 0, 0, 0.3);

/* Elevation 3 — floating panels */
box-shadow: 0 12px 40px rgba(0, 0, 0, 0.5), 0 4px 12px rgba(0, 0, 0, 0.3);

/* Elevation 4 — modals */
box-shadow: 0 24px 80px rgba(0, 0, 0, 0.6), 0 8px 24px rgba(0, 0, 0, 0.4);
```

### Glass / Frosted Effect

```css
/* Standard glass panel */
background: rgba(10, 22, 40, 0.6);
backdrop-filter: blur(16px);
border: 1px solid rgba(255, 255, 255, 0.06);

/* Elevated glass (modals, popovers) */
background: rgba(10, 22, 40, 0.8);
backdrop-filter: blur(24px);
border: 1px solid rgba(255, 255, 255, 0.1);
```

### Depth Rules

1. **Dark backgrounds get lighter as they elevate.** Navy-950 → Navy-900 → Navy-800.
2. **Borders are always subtle** — `rgba(255,255,255,0.06)` to `0.12` max.
3. **Never use sharp borders on dark mode.** Always translucent or gradient.
4. **Glow replaces shadow for accent elements.** Shadows for neutral surfaces, glows for branded ones.

---

## 6. Component Patterns

### Card Pattern

```tsx
<motion.div
  className="relative rounded-xl border border-white/[0.06] bg-[var(--pnw-navy-800)] p-6
             hover:border-white/[0.12] transition-colors duration-200"
  whileHover={{ y: -2 }}
  transition={{ duration: 0.2 }}
>
  {/* Optional: subtle gradient overlay on hover */}
  <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-white/[0.02] to-transparent
                  opacity-0 group-hover:opacity-100 transition-opacity" />

  {/* Tag */}
  <span className="font-mono text-xs tracking-widest text-[var(--pnw-cyan-400)] uppercase">
    01
  </span>

  {/* Icon */}
  <div className="mt-3 mb-2 text-[var(--pnw-gold-300)]">
    <IconComponent className="w-6 h-6" />
  </div>

  {/* Title */}
  <h3 className="text-lg font-semibold text-white">{title}</h3>

  {/* Body */}
  <p className="mt-2 text-sm text-slate-400 leading-relaxed">{description}</p>

  {/* Accent underline */}
  <motion.div
    className="mt-4 h-px bg-gradient-to-r from-transparent via-[var(--pnw-cyan-400)] to-transparent"
    initial={{ scaleX: 0 }}
    whileInView={{ scaleX: 1 }}
    transition={{ duration: 0.8, delay: 0.3 }}
  />
</motion.div>
```

### CTA Button Pattern

```tsx
<motion.button
  className="relative px-8 py-3 rounded-lg font-semibold text-white
             bg-gradient-to-r from-[var(--pnw-employer)] to-blue-500
             shadow-[0_0_20px_rgba(37,99,235,0.3)]
             hover:shadow-[0_0_30px_rgba(37,99,235,0.5)]
             transition-shadow duration-300"
  whileHover={{ scale: 1.03 }}
  whileTap={{ scale: 0.97 }}
>
  {label}
</motion.button>
```

### Section Layout Pattern

```tsx
<section className="relative py-24 px-6">
  {/* Background vignette */}
  <div className="absolute inset-0 bg-radial-[ellipse_at_center]
                  from-transparent via-transparent to-[var(--pnw-navy-950)]" />

  <div className="relative z-[1] max-w-6xl mx-auto">
    {/* Section tag */}
    <span className="font-mono text-xs tracking-[0.2em] text-[var(--pnw-cyan-400)] uppercase">
      Features
    </span>

    {/* Heading */}
    <h2 className="mt-3 text-3xl md:text-4xl font-bold text-white tracking-tight">
      {heading}
    </h2>

    {/* Subtitle */}
    <p className="mt-4 max-w-2xl text-lg text-slate-400">
      {subtitle}
    </p>

    {/* Content grid */}
    <div className="mt-16 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {children}
    </div>
  </div>
</section>
```

### Hero Section Pattern

```tsx
<section className="relative min-h-screen flex items-center justify-center overflow-hidden">
  {/* Background layers (lowest z) */}
  <div className="absolute inset-0 z-0">
    {/* Gradient, image, particles, etc. */}
  </div>

  {/* Content (mid z) */}
  <div className="relative z-10 text-center px-6">
    <motion.h1
      className="text-5xl md:text-7xl font-bold text-white tracking-tight"
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.8, delay: 0.3, ease: [0.22, 1, 0.36, 1] }}
    >
      {title}
    </motion.h1>

    <motion.p
      className="mt-6 text-xl text-slate-300 max-w-2xl mx-auto"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.7, delay: 0.6, ease: [0.22, 1, 0.36, 1] }}
    >
      {subtitle}
    </motion.p>

    <motion.div
      className="mt-10 flex gap-4 justify-center"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.7, delay: 0.9, ease: [0.22, 1, 0.36, 1] }}
    >
      {/* CTA buttons */}
    </motion.div>
  </div>

  {/* Scroll indicator (highest delay) */}
  <motion.div
    className="absolute bottom-8 left-1/2 -translate-x-1/2"
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    transition={{ delay: 2.0 }}
  >
    <ChevronDown className="w-6 h-6 text-slate-500 animate-bounce" />
  </motion.div>
</section>
```

---

## 7. Responsive Breakpoints

| Breakpoint | Width | Behavior |
|-----------|-------|----------|
| Mobile | `< 640px` | Single column, stacked layout, reduced animation complexity |
| Tablet | `640–1024px` | 2-column grids, scaled typography |
| Desktop | `> 1024px` | Full layout, all animations active |

### Responsive Rules

1. **Font sizes use `clamp()`** for fluid scaling.
2. **Padding scales:** `px-4` mobile → `px-6` tablet → `px-8` desktop.
3. **Grid columns:** 1 → 2 → 3 as viewport grows.
4. **Complex SVG animations** (constellation, birds, root pulse) hide or simplify on mobile.
5. **Touch targets** minimum `44px` on mobile.
6. **Viewport-relative units** (`vw`) for hero elements that must scale with screen.

---

## 8. Ambient / Looping Effects

These background effects create life without demanding attention:

| Effect | Technique | Duration | Opacity Range |
|--------|-----------|----------|---------------|
| Star twinkle | CSS `@keyframes` opacity pulse | 2–5s | 0.3–0.8 |
| Tree sway | CSS `@keyframes` skewX | 8–11s | — |
| Root pulse | SVG stroke-dasharray animation | 2.5–3.3s | 0.4–0.6 |
| Door glow | CSS box-shadow pulse | 2–3s | idle: 0.3, hover: 0.6 |
| Code fragments | Framer Motion opacity cycle | 3–6s | 0–0.7 |
| Bird flight | CSS `@keyframes` translateX arc | 22–38s | 0.55 |

### Ambient Rules

1. **Durations are intentionally varied** between similar elements — prevents robotic sync.
2. **Opacity never hits 1.0** for ambient effects — they stay peripheral.
3. **Ease-in-out for all loops** — smooth, organic rhythm.
4. **Stagger start times randomly** — no two identical effects begin simultaneously.

---

## 9. Interaction Feedback

| Interaction | Visual Response |
|-------------|----------------|
| Button hover | `scale(1.03)`, glow intensifies, shadow deepens |
| Button press | `scale(0.97)`, brief |
| Card hover | `y: -2px`, border brightens, optional gradient overlay |
| Link hover | Color shifts to accent, underline animates in |
| Input focus | Border color → accent, subtle glow ring |
| Toggle/switch | Smooth background color transition `0.2s` |
| Error state | Red glow pulse, shake animation `0.4s` |
| Success state | Green flash, checkmark scale-in |
| Loading | Skeleton shimmer gradient OR pulsing opacity |

---

## 10. Do Not

- Use pure white (`#ffffff`) for body text on dark backgrounds. Use `slate-300` or lighter.
- Use sharp, opaque borders on dark surfaces. Always translucent.
- Animate `width`, `height`, `margin`, or `padding`. Transform and opacity only.
- Stack more than 3 simultaneous animations on a single element.
- Use `ease` or `linear` for UI entrances. Use the expo curve `[0.22, 1, 0.36, 1]`.
- Add motion without a `prefers-reduced-motion` escape hatch.
- Use z-index values outside the defined scale without documenting why.
- Place bright saturated colors directly on navy without a glow/gradient transition.
- Use generic placeholder colors (`gray-500`, `blue-500`) — always reference the PNW token system.
- Create new color values without adding them to the token system in `globals.css`.
