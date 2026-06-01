import Image from "next/image";

const frameClass =
  "overflow-hidden rounded-2xl border border-white/[0.08] bg-black/20 shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_16px_40px_rgba(0,0,0,0.35)]";

export type ProjectImageSize = "default" | "large" | "full";

const singleFigureSizeClass: Record<ProjectImageSize, string> = {
  default: "mx-auto w-full max-w-[50%] min-w-[18rem] sm:min-w-[20rem]",
  large: "w-full",
  full: "w-full",
};

function overviewGridClass(size: ProjectImageSize, imageCount: number): string {
  if (size === "default") {
    return "grid grid-cols-2 items-start gap-3 sm:gap-4";
  }
  if (imageCount <= 1) {
    return "grid grid-cols-1 gap-8";
  }
  if (size === "full") {
    return "grid grid-cols-1 gap-8 xl:grid-cols-2 xl:gap-8";
  }
  return "grid grid-cols-1 gap-8 xl:grid-cols-2 xl:gap-8";
}

const imageSizesAttr: Record<ProjectImageSize, string> = {
  default: "(max-width: 640px) 45vw, 448px",
  large: "(max-width: 1280px) 95vw, 1200px",
  full: "(max-width: 1280px) 100vw, 1400px",
};

/** 并排双图：各占一格，不单独设 min-width 以免挤换行 */
const rowFigureSizeClass = "min-w-0 w-full";

export type OverviewImage = {
  src: string;
  alt: string;
  caption?: string;
};

type FigureProps = OverviewImage & {
  size?: ProjectImageSize;
  className?: string;
};

export function ProjectDetailFigure({
  src,
  alt,
  caption,
  size = "default",
  className,
}: FigureProps) {
  return (
    <figure
      className={[frameClass, singleFigureSizeClass[size], className].filter(Boolean).join(" ")}
    >
      <Image
        src={src}
        alt={alt}
        width={1600}
        height={960}
        className="h-auto w-full object-contain object-top bg-black/30"
        sizes={imageSizesAttr[size]}
      />
      {caption ? (
        <figcaption className="border-t border-white/[0.06] px-3 py-2 text-center text-xs text-slate-500">
          {caption}
        </figcaption>
      ) : null}
    </figure>
  );
}

export function ProjectOverviewImageRow({
  images,
  size = "default",
  layout = "grid",
}: {
  images: readonly OverviewImage[];
  size?: ProjectImageSize;
  /** stack：每行一张全宽图，适合功能截图竖排展示 */
  layout?: "grid" | "stack";
}) {
  const gridClass =
    layout === "stack" ? "flex flex-col gap-8" : overviewGridClass(size, images.length);

  return (
    <div className={gridClass}>
      {images.map((img) => (
        <figure key={img.src} className={`${frameClass} ${rowFigureSizeClass}`}>
          <Image
            src={img.src}
            alt={img.alt}
            width={1920}
            height={1080}
            className="h-auto w-full object-contain object-top bg-black/30"
            sizes={imageSizesAttr[size]}
            priority={size === "full" && images.length === 1}
          />
          {img.caption ? (
            <figcaption className="border-t border-white/[0.06] px-3 py-2 text-center text-xs text-slate-500">
              {img.caption}
            </figcaption>
          ) : null}
        </figure>
      ))}
    </div>
  );
}
