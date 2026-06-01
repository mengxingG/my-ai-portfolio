import { FEATURED_PROJECTS } from "@/lib/featured-projects";

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
    items: ["Next.js", "Mermaid", "Electron", "Tailwind CSS"],
  },
  {
    id: "backend",
    label: "后端技术",
    items: ["Python", "Node.js", "Express", "DrissionPage", "Playwright", "SSE"],
  },
  {
    id: "database",
    label: "数据库",
    items: ["Notion"],
  },
  {
    id: "ai",
    label: "AI 能力",
    items: ["DeepSeek", "Gemini", "Claude", "Qwen", "Tavily", "FastAPI", "AI HOT"],
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

/** 按分类顺序展平，供标签分类着色使用 */
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

const TECH_CATEGORY_LOOKUP: Record<string, FeaturedTechCategory> = Object.fromEntries(
  FEATURED_TECH_STACK.flatMap((group) =>
    group.items.map((name) => [name, group.id] as const),
  ),
) as Record<string, FeaturedTechCategory>;

/** 项目 tech 字段别名 → 分类 */
const TECH_CATEGORY_ALIASES: Record<string, FeaturedTechCategory> = {
  Node: "backend",
  "Notion API": "database",
  "Gemini 2.5": "ai",
  "Claude Sonnet": "ai",
  "DeepSeek API": "ai",
  TransformStream: "backend",
};

/** 按项目 tech 数组生成带分类的标签项（首页卡片按项目展示） */
export function resolveProjectTechItems(names: readonly string[]): FeaturedTechItem[] {
  return names.map((name) => ({
    name,
    category:
      TECH_CATEGORY_LOOKUP[name] ?? TECH_CATEGORY_ALIASES[name] ?? "special",
  }));
}

/** 从特色项目 tech 字段聚合，按分类顺序去重（首页 Tech Stack） */
export function buildHomepageTechStackNames(
  projectTechLists: readonly (readonly string[])[],
): string[] {
  const used = new Set(projectTechLists.flat());
  return FEATURED_TECH_ITEMS.filter((item) => used.has(item.name)).map(
    (item) => item.name,
  );
}

/** 首页 Tech Stack：五大特色项目技术并集，按分类排序 */
export const HOMEPAGE_TECH_STACK_NAMES: readonly string[] = buildHomepageTechStackNames(
  FEATURED_PROJECTS.map((p) => p.tech),
);

/** 首页 Tech Stack 带分类（供彩色标签渲染） */
export const HOMEPAGE_TECH_STACK_ITEMS: readonly FeaturedTechItem[] =
  FEATURED_TECH_ITEMS.filter((item) => HOMEPAGE_TECH_STACK_NAMES.includes(item.name));
