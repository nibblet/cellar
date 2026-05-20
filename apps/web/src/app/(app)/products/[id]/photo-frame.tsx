import { cn } from "@/lib/utils";

type PhotoFrameProps = {
  src: string;
  alt: string;
  className?: string;
  sepia?: boolean;
};

/**
 * Renders a user-contributed photo with the optional NCCC sepia overlay.
 * Originals stay full-color in storage; toggle `sepia` per context.
 */
export function PhotoFrame({ src, alt, className, sepia = true }: PhotoFrameProps) {
  return (
    <div
      className={cn(
        "nccc-photo-frame rounded-[16px] border border-border overflow-hidden",
        sepia && "nccc-photo-frame--sepia",
        className,
      )}
    >
      {/* biome-ignore lint/performance/noImgElement: signed URLs change per-request; not a good fit for next/image */}
      <img src={src} alt={alt} className={cn("nccc-photo", sepia && "nccc-photo--sepia")} />
    </div>
  );
}
