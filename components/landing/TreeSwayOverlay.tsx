"use client";

/**
 * Semi-transparent overlays positioned over the tree regions of the hero image.
 * They apply a subtle skew animation to simulate wind sway.
 * Because the trees are part of the raster image, these overlays use
 * mix-blend-mode to avoid obscuring the underlying art.
 */
export function TreeSwayOverlay() {
  return (
    <div className="absolute inset-0 pointer-events-none z-[5]">
      {/* Left trees (P region) */}
      <div
        className="absolute"
        style={{
          left: "2%",
          top: "5%",
          width: "22%",
          height: "55%",
          transformOrigin: "bottom center",
          animation: "tree-sway 8s ease-in-out infinite",
          background:
            "linear-gradient(180deg, rgba(46,125,50,0.04) 0%, transparent 100%)",
          mixBlendMode: "overlay",
          borderRadius: "40% 40% 0 0",
        }}
      />
      {/* Right trees (W region) */}
      <div
        className="absolute"
        style={{
          right: "2%",
          top: "5%",
          width: "24%",
          height: "55%",
          transformOrigin: "bottom center",
          animation: "tree-sway-alt 9s ease-in-out 0.5s infinite",
          background:
            "linear-gradient(180deg, rgba(46,125,50,0.04) 0%, transparent 100%)",
          mixBlendMode: "overlay",
          borderRadius: "40% 40% 0 0",
        }}
      />
      {/* Background forest left */}
      <div
        className="absolute"
        style={{
          left: "0",
          top: "10%",
          width: "15%",
          height: "45%",
          transformOrigin: "bottom center",
          animation: "tree-sway 11s ease-in-out 1s infinite",
          background:
            "linear-gradient(180deg, rgba(27,67,50,0.03) 0%, transparent 100%)",
          mixBlendMode: "overlay",
        }}
      />
      {/* Background forest right */}
      <div
        className="absolute"
        style={{
          right: "0",
          top: "10%",
          width: "15%",
          height: "45%",
          transformOrigin: "bottom center",
          animation: "tree-sway-alt 10s ease-in-out 2s infinite",
          background:
            "linear-gradient(180deg, rgba(27,67,50,0.03) 0%, transparent 100%)",
          mixBlendMode: "overlay",
        }}
      />
    </div>
  );
}
