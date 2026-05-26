/** 研究对象类型（与《横纵分析法》Skill 对齐） */
export const OBJECT_TYPES = ["product", "company", "concept", "person", "auto"] as const;
export type HvObjectType = (typeof OBJECT_TYPES)[number];

export const OBJECT_TYPE_LABELS: Record<HvObjectType, string> = {
  product: "产品 / 工具",
  company: "公司 / 组织",
  concept: "概念 / 技术范式",
  person: "人物",
  auto: "自动识别（由 AI 判断）",
};

export function objectTypeDisplayLabel(type: HvObjectType | string | undefined): string {
  if (!type || type === "auto") return "自动识别";
  return OBJECT_TYPE_LABELS[type as HvObjectType] ?? type;
}

/** 解析 API / 表单传入的类型 */
export function resolveObjectType(input?: string): HvObjectType {
  const v = input?.trim().toLowerCase();
  if (v === "product" || v === "产品") return "product";
  if (v === "company" || v === "公司") return "company";
  if (v === "concept" || v === "概念" || v === "技术") return "concept";
  if (v === "person" || v === "人物") return "person";
  return "auto";
}

const CORE_PRINCIPLE = `核心原则不变：纵向追时间深度，横向追同期广度，最终在交汇处产出判断。`;

const FULL_TYPE_RULES = `
**研究产品时**：纵轴重点关注版本迭代、技术路线演变、用户增长曲线、关键产品决策；横轴重点关注功能对比、性能对比、用户体验、定价。

**研究公司时**：纵轴重点关注创始团队、融资历程、战略转向、组织变革、关键人事变动；横轴重点关注商业模式差异、市场份额、营收对比、组织架构差异。

**研究概念时**（技术范式、商业模式、文化现象）：纵轴重点关注概念的起源（谁提出的、基于什么理论/需求）、如何流行起来、经历了哪些争论和演变；横轴重点关注与相近概念的区别、各自适用场景、不同阵营的论证。

**研究人物时**：纵轴重点关注个人经历、职业轨迹、关键决策、成长曲线、公开言论变化；横轴重点关注与同领域其他人物的对比（做事方式、风格、成就、影响力、路线选择差异）。
`.trim();

const LOCKED_RULES: Record<Exclude<HvObjectType, "auto">, string> = {
  product: `【已锁定：研究对象类型 = 产品】
纵轴必须重点关注：版本迭代、技术路线演变、用户增长曲线、关键产品决策。
横轴必须重点关注：功能对比、性能对比、用户体验、定价。`,

  company: `【已锁定：研究对象类型 = 公司】
纵轴必须重点关注：创始团队、融资历程、战略转向、组织变革、关键人事变动。
横轴必须重点关注：商业模式差异、市场份额、营收对比、组织架构差异。`,

  concept: `【已锁定：研究对象类型 = 概念/技术范式】
纵轴必须重点关注：概念的起源（谁提出的、基于什么理论/需求）、如何流行起来、经历了哪些争论和演变。
横轴必须重点关注：与相近概念的区别、各自适用场景、不同阵营的论证。`,

  person: `【已锁定：研究对象类型 = 人物】
纵轴必须重点关注：个人经历、职业轨迹、关键决策、成长曲线、公开言论变化。
横轴必须重点关注：与同领域其他人物的对比（做事方式、风格、成就、影响力、路线选择差异）。`,
};

/** 注入 System Prompt 的完整适配块 */
export function buildAdaptationRules(
  targetName: string,
  objectType?: string,
): string {
  const resolved = resolveObjectType(objectType);

  if (resolved !== "auto") {
    return `
【研究对象动态适配 · 用户已指定类型】
${CORE_PRINCIPLE}
分析对象：【${targetName}】
${LOCKED_RULES[resolved]}

写作时纵轴章节与横轴章节必须严格按上述侧重点展开，不得写成通用模板。
`.trim();
  }

  return `
【研究对象动态适配逻辑】
${CORE_PRINCIPLE}
请根据分析对象【${targetName}】的名称与检索资料，先判断其属于产品、公司、概念（含技术范式/商业模式/文化现象）或人物，再严格套用对应侧重点：

${FULL_TYPE_RULES}

判断后须在正文中适当点明对象类型；若无法确定，取最接近的一类并说明理由。
`.trim();
}

/** 纵向章节的类型化检查清单（追加到 promptCh1） */
export function buildVerticalTypeChecklist(objectType?: string): string {
  const resolved = resolveObjectType(objectType);
  const blocks: Record<Exclude<HvObjectType, "auto">, string> = {
    product: `【本章类型化侧重 · 产品】必须充分展开：版本迭代时间线、技术路线演变脉络、用户/营收增长曲线（有数据写数据，无则标暂缺）、每一次关键产品决策的前因后果。`,
    company: `【本章类型化侧重 · 公司】必须充分展开：创始团队与早期文化、各轮融资与估值节点、战略转向与业务线取舍、组织变革、CEO/核心高管人事变动及其影响。`,
    concept: `【本章类型化侧重 · 概念】必须充分展开：谁提出/何理论或需求催生、传播与「流行起来」的关键机制、学界/产业界争论与概念内涵的演变史。`,
    person: `【本章类型化侧重 · 人物】必须充分展开：成长与教育背景、职业轨迹转折、关键决策时刻、能力/影响力的成长曲线、公开言论或立场随时间的变化。`,
  };
  if (resolved !== "auto") return blocks[resolved];
  return `【本章类型化侧重】请先判断对象类型，再按产品/公司/概念/人物四类之一的纵向要点展开（见 System Prompt）。`;
}

/** 横向章节的类型化检查清单（追加到 promptCh2） */
export function buildHorizontalTypeChecklist(objectType?: string): string {
  const resolved = resolveObjectType(objectType);
  const blocks: Record<Exclude<HvObjectType, "auto">, string> = {
    product: `【本章类型化侧重 · 产品】对比须覆盖：功能差异、性能基准或评测、真实用户体验与口碑、定价/套餐策略；引用用户原声。`,
    company: `【本章类型化侧重 · 公司】对比须覆盖：商业模式差异、市场份额或行业地位、营收/利润或 ARR 等财务指标（暂缺则标注）、组织架构与治理差异。`,
    concept: `【本章类型化侧重 · 概念】对比须覆盖：与相近/易混概念的边界、各自典型适用场景、不同阵营（学派/路线）的核心论证与反驳。`,
    person: `【本章类型化侧重 · 人物】对比须覆盖：与同领域关键人物的做事方式、风格气质、代表性成就、行业影响力、路线选择（如商业化 vs 学术）差异。`,
  };
  if (resolved !== "auto") return blocks[resolved];
  return `【本章类型化侧重】请先判断对象类型，再按产品/公司/概念/人物四类之一的横向要点展开（见 System Prompt）。`;
}

/** 搜索规划器：按类型调整检索侧重 */
export function buildSearchPlannerTypeHint(
  targetName: string,
  objectType?: string,
): string {
  const resolved = resolveObjectType(objectType);
  if (resolved === "concept") {
    return `研究对象类型：概念/技术。检索词须覆盖理论起源、学术争论、与相近概念对比；至少 1–2 条含 site:arxiv.org 或 paper pdf。`;
  }
  if (resolved === "product") {
    return `研究对象类型：产品。检索词须覆盖版本历史、用户增长/口碑、竞品功能与定价对比。`;
  }
  if (resolved === "company") {
    return `研究对象类型：公司。检索词须覆盖融资、战略转型、组织架构、市场份额与财务数据。`;
  }
  if (resolved === "person") {
    return `研究对象类型：人物。检索词须覆盖职业经历、关键决策、公开言论、与同领域人物对比。`;
  }
  return `请根据「${targetName}」判断其为产品/公司/概念/人物，并生成对应侧重的检索词；概念类须含 arxiv/paper pdf 后缀。`;
}
