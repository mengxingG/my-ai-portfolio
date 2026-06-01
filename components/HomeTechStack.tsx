"use client";

type HomeTechStackProps = {
  items: readonly string[];
  reducedMotion?: boolean;
};

const TAG_CLASS = "tech-tag shrink-0 whitespace-nowrap";

/** 首页 Hero 技术栈：紫色标签 + 水平无限滚动 */
export function HomeTechStack({ items, reducedMotion = false }: HomeTechStackProps) {
  if (reducedMotion) {
    return (
      <div className="flex flex-wrap justify-center gap-2 py-1">
        {items.map((name) => (
          <span key={name} className={TAG_CLASS}>
            {name}
          </span>
        ))}
      </div>
    );
  }

  return (
    <div className="stack-marquee w-full py-2">
      <div className="stack-marquee-track">
        {items.map((name) => (
          <span key={`a-${name}`} className={TAG_CLASS}>
            {name}
          </span>
        ))}
        {items.map((name) => (
          <span key={`b-${name}`} className={TAG_CLASS}>
            {name}
          </span>
        ))}
      </div>
    </div>
  );
}
