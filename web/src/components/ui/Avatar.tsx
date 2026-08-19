import { cn } from "@/lib/cn";

/**
 * An identicon, drawn from the account address.
 *
 * This replaced a stored emoji chosen from a list of eight, which meant the ninth citizen was
 * someone else's twin. Here the address *is* the avatar: nothing is stored, nothing can drift
 * out of sync with the account, and two people never collide in practice.
 *
 * Deliberately not random-looking noise. The grid is mirrored down the middle, which is what
 * makes these read as a face or a crest rather than as television static, and the palette is
 * the app's own -- so a page full of them still looks like this product.
 */

/** Hues taken from the palette, so an avatar never introduces a colour the app does not own. */
const PALETTE = [
  ["#0f8570", "#7ed4c1"], // teal
  ["#e8a33d", "#f7cf7a"], // amber
  ["#3d84c6", "#a8cdec"], // sky
  ["#6d5bd0", "#b6adea"], // violet
  ["#3f9757", "#9ed0ac"], // emerald
  ["#b4478c", "#e0a8cc"], // berry
] as const;

/** FNV-1a: tiny, dependency-free, and spreads adjacent addresses across different patterns. */
function hash(value: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < value.length; i += 1) {
    h ^= value.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

export function Avatar({
  address,
  className,
  title,
}: {
  address: string;
  className?: string;
  title?: string;
}) {
  const seed = hash(address.toLowerCase());
  const [strong, soft] = PALETTE[seed % PALETTE.length]!;

  // A 5x5 grid, mirrored across the vertical axis: three columns decide, two are reflections.
  const cells: { x: number; y: number; fill: string }[] = [];
  for (let x = 0; x < 3; x += 1) {
    for (let y = 0; y < 5; y += 1) {
      const bit = (seed >>> ((x * 5 + y) % 30)) & 3;
      if (bit === 0) continue;
      const fill = bit === 1 ? soft : strong;
      cells.push({ x, y, fill });
      if (x < 2) cells.push({ x: 4 - x, y, fill });
    }
  }

  return (
    <svg
      viewBox="0 0 5 5"
      className={cn("size-10 rounded-2xl bg-paper-sunk", className)}
      role={title ? "img" : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
      shapeRendering="crispEdges"
    >
      {cells.map((cell, index) => (
        <rect key={index} x={cell.x} y={cell.y} width={1} height={1} fill={cell.fill} />
      ))}
    </svg>
  );
}
