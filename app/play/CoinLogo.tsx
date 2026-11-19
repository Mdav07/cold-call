// The Plumpurse coin, the game's logo (public/logo.svg; drawn by tools/art/coin_logo.py).
// Pixel art: keep the size a multiple of 16 or close to it so the pixels stay crisp.
export function CoinLogo({ size = 16, className = "" }: { size?: number; className?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- a 16px SVG; next/image adds nothing here
    <img src="/logo.svg" width={size} height={size} alt="" aria-hidden="true" className={`inline-block shrink-0 [image-rendering:pixelated] ${className}`} />
  );
}
