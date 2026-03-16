"use client";

/**
 * DeepRoots — the roots backdrop image that sits behind the cinematic
 * descriptor sections. This is a companion to the hero image:
 *   - Hero shows the PNW trees above ground
 *   - This shows the merkle/binary root system underground
 *
 * The image is positioned to start right where the hero section ends,
 * spanning the full height of the cinematic sections and footer.
 * A CSS mask blends the top edge seamlessly with the hero's bottom.
 */
export function DeepRoots() {
  return (
    <div
      className="absolute pointer-events-none overflow-hidden"
      style={{
        /* Start right after the hero (140vh) with slight overlap for blending */
        top: "130vh",
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 1,
      }}
    >
      {/* The roots image — skip the stump at top (~15%), show only roots */}
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: "url('/images/pnw-roots.png')",
          /* Shift the image up to hide the stump/trunk at the top */
          backgroundPosition: "center 18%",
          backgroundSize: "cover",
          backgroundRepeat: "no-repeat",
          /* Mask: seamless fade-in at top to blend with hero roots, fade-out at bottom */
          maskImage: "linear-gradient(180deg, transparent 0%, rgba(0,0,0,0.5) 3%, rgba(0,0,0,0.9) 8%, rgba(0,0,0,1) 15%, rgba(0,0,0,1) 70%, rgba(0,0,0,0.4) 90%, rgba(0,0,0,0.1) 100%)",
          WebkitMaskImage: "linear-gradient(180deg, transparent 0%, rgba(0,0,0,0.5) 3%, rgba(0,0,0,0.9) 8%, rgba(0,0,0,1) 15%, rgba(0,0,0,1) 70%, rgba(0,0,0,0.4) 90%, rgba(0,0,0,0.1) 100%)",
        }}
      />
    </div>
  );
}
