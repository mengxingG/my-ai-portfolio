import fs from "node:fs";
import path from "node:path";

/** 简历 Markdown 源稿路径（仓库内） */
export const RESUME_MARKDOWN_FILE = "resume/resume.md";

const RESUME_MD_ABSOLUTE = path.join(process.cwd(), "resume", "resume.md");

export function getResumeMarkdown(): string {
  return fs.readFileSync(RESUME_MD_ABSOLUTE, "utf-8");
}
