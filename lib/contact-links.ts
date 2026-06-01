/** 联系我 — 链接配置 */
export const CONTACT_LINKS = {
  email: "1149427072@qq.com",
  github: "https://github.com/mengxingG",
  linkedin: "",
  /** 在线简历页 /resume，Markdown 源稿：resume/resume.md */
  resume: "/resume",
} as const;

export type ContactPlatform = keyof Omit<typeof CONTACT_LINKS, "email" | "resume">;
