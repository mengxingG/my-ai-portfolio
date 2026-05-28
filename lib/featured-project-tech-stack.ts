export type FeaturedTechCategory =
  | "frontend"
  | "backend"
  | "database"
  | "ai"
  | "deploy"
  | "special";

export type FeaturedTechGroup = {
  id: FeaturedTechCategory;
  label: string;
  items: readonly string[];
};

/** 特色项目技术栈：按能力分类，展示顺序固定 */
export const FEATURED_TECH_STACK: readonly FeaturedTechGroup[] = [
  {
    id: "frontend",
    label: "前端技术",
    items: ["Next.js", "Mermaid", "Electron"],
  },
  {
    id: "backend",
    label: "后端技术",
    items: ["Python", "Node.js", "Express"],
  },
  {
    id: "database",
    label: "数据库",
    items: ["Notion"],
  },
  {
    id: "ai",
    label: "AI 能力",
    items: ["DeepSeek", "Gemini", "Claude", "Tavily", "AI HOT"],
  },
  {
    id: "deploy",
    label: "部署",
    items: ["Vercel"],
  },
  {
    id: "special",
    label: "特殊能力",
    items: ["飞书", "OpenClaw"],
  },
] as const;

export type FeaturedTechItem = {
  name: string;
  category: FeaturedTechCategory;
};

/** 按分类顺序展平，供单行标签区使用 */
export const FEATURED_TECH_ITEMS: readonly FeaturedTechItem[] = FEATURED_TECH_STACK.flatMap(
  (group) => group.items.map((name) => ({ name, category: group.id })),
);

export const FEATURED_TECH_PILL_CLASS: Record<FeaturedTechCategory, string> = {
  frontend:
    "border-blue-400/40 bg-blue-500/12 text-blue-200/95",
  backend:
    "border-emerald-400/40 bg-emerald-500/12 text-emerald-200/95",
  database:
    "border-amber-400/40 bg-amber-500/12 text-amber-200/95",
  ai: "border-purple-400/35 bg-purple-500/12 text-purple-200/95",
  deploy:
    "border-cyan-400/40 bg-cyan-500/12 text-cyan-200/95",
  special:
    "border-fuchsia-400/40 bg-fuchsia-500/12 text-fuchsia-200/95",
};

const PILL_BASE =
  "inline-flex rounded-full border px-2.5 py-1 text-[11px] font-medium tracking-wide";

export function featuredTechPillClass(category: FeaturedTechCategory): string {
  return `${PILL_BASE} ${FEATURED_TECH_PILL_CLASS[category]}`;
}
