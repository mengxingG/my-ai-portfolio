import Link from "next/link";
import { FontSizeSwitcher } from "@/app/components/FontSizeSwitcher";
import { getArticleDetail } from "@/utils/notion";

function renderRichText(richTexts: any[] | undefined, keyPrefix: string) {
  if (!richTexts || richTexts.length === 0) return null;

  return richTexts.map((rt: any, i: number) => {
    const text = rt?.plain_text ?? "";
    const annotations = rt?.annotations ?? {};
    const href = rt?.href;

    const base = (() => {
      if (annotations.code) {
        return (
          <code
            className="rounded bg-white/5 border border-white/10 px-1 font-mono text-cyan-200/90"
            key={`${keyPrefix}-${i}`}
          >
            {text}
          </code>
        );
      }

      const className = [
        annotations.bold ? "font-bold" : "",
        annotations.italic ? "italic" : "",
        annotations.underline ? "underline decoration-white/30" : "",
        annotations.strikethrough ? "line-through" : "",
      ]
        .filter(Boolean)
        .join(" ");

      return (
        <span className={className || undefined} key={`${keyPrefix}-${i}`}>
          {text}
        </span>
      );
    })();

    if (href) {
      return (
        <a
          key={`${keyPrefix}-${i}`}
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="text-cyan-300 underline decoration-cyan-400/50 hover:text-cyan-200"
        >
          {base}
        </a>
      );
    }

    return base;
  });
}

function renderBlocks(blocks: any[]) {
  if (!blocks || blocks.length === 0) return null;

  const out: React.ReactNode[] = [];

  const richTextOf = (value: any) => value?.rich_text ?? [];

  let i = 0;
  while (i < blocks.length) {
    const block = blocks[i];
    const type = block?.type as string;
    const value = block[type];

    // bulleted_list_item: group consecutive blocks into one <ul>
    if (type === "bulleted_list_item") {
      const items: any[] = [];
      const start = i;
      while (i < blocks.length && blocks[i]?.type === "bulleted_list_item") {
        items.push(blocks[i]);
        i++;
      }
      out.push(
        <ul key={`bul-${start}`} className="mt-4 list-disc list-inside text-slate-300">
          {items.map((it, idx) => {
            const v = it.bulleted_list_item ?? it[type];
            return (
              <li key={`bul-${start}-li-${idx}`} className="mt-1 leading-relaxed">
                {renderRichText(richTextOf(v), `bul-${start}-${idx}`)}
              </li>
            );
          })}
        </ul>
      );
      continue;
    }

    // numbered_list_item: group consecutive blocks into one <ol>
    if (type === "numbered_list_item") {
      const items: any[] = [];
      const start = i;
      while (i < blocks.length && blocks[i]?.type === "numbered_list_item") {
        items.push(blocks[i]);
        i++;
      }
      out.push(
        <ol key={`num-${start}`} className="mt-4 list-decimal list-inside text-slate-300">
          {items.map((it, idx) => {
            const v = it.numbered_list_item ?? it[type];
            return (
              <li key={`num-${start}-li-${idx}`} className="mt-1 leading-relaxed">
                {renderRichText(richTextOf(v), `num-${start}-${idx}`)}
              </li>
            );
          })}
        </ol>
      );
      continue;
    }

    switch (type) {
      case "heading_1":
        out.push(
          <h1 key={`h1-${i}`} className="mt-8 text-2xl font-bold text-white">
            {renderRichText(richTextOf(value), `h1-${i}`)}
          </h1>
        );
        i++;
        break;
      case "heading_2":
        out.push(
          <h2 key={`h2-${i}`} className="mt-6 text-xl font-bold text-white border-l-4 border-cyan-500 pl-4">
            {renderRichText(richTextOf(value), `h2-${i}`)}
          </h2>
        );
        i++;
        break;
      case "heading_3":
        out.push(
          <h3 key={`h3-${i}`} className="mt-5 text-lg font-semibold text-white">
            {renderRichText(richTextOf(value), `h3-${i}`)}
          </h3>
        );
        i++;
        break;

      case "quote":
        out.push(
          <blockquote
            key={`q-${i}`}
            className="mt-6 border-l-4 border-purple-500/30 pl-4 text-slate-300 italic"
          >
            {renderRichText(richTextOf(value), `q-${i}`)}
          </blockquote>
        );
        i++;
        break;

      case "callout": {
        const icon = value?.icon;
        const iconEmoji = icon?.type === "emoji" ? icon.emoji : null;
        out.push(
          <div key={`co-${i}`} className="mt-6 rounded-xl bg-white/5 border border-white/10 p-4">
            <div className="flex items-start gap-3">
              {iconEmoji ? <div className="text-lg leading-none">{iconEmoji}</div> : null}
              <p className="text-base leading-relaxed text-slate-300">{renderRichText(richTextOf(value), `co-${i}`)}</p>
            </div>
          </div>
        );
        i++;
        break;
      }

      case "paragraph":
        out.push(
          <p key={`p-${i}`} className="mt-4 text-base leading-relaxed text-slate-300">
            {renderRichText(richTextOf(value), `p-${i}`)}
          </p>
        );
        i++;
        break;

      case "image": {
        const src = value?.type === "external" ? value?.external?.url : value?.file?.url;
        const captionRich = value?.caption ?? [];
        const captionText =
          captionRich?.map((t: any) => t?.plain_text).join("") || "文章图片";

        out.push(
          <div key={`img-${i}`} className="my-8 overflow-hidden rounded-xl border border-white/10">
            {/* styled img (Next image 需要 domain 配置，避免远程图片导致空白） */}
            <img src={src} alt={captionText} className="w-full object-cover rounded-xl" />
            {captionRich?.length ? (
              <p className="bg-white/5 py-2 text-center text-xs text-slate-500">
                {renderRichText(captionRich, `imgcap-${i}`)}
              </p>
            ) : null}
          </div>
        );
        i++;
        break;
      }

      case "code": {
        const language = (value?.language ?? "").toString().toLowerCase();
        const codeText = (value?.rich_text ?? []).map((t: any) => t?.plain_text).join("");

        if (language === "mermaid") {
          out.push(
            <div
              key={`mer-${i}`}
              className="liquid-glass-card my-6 overflow-x-auto rounded-lg border border-cyan-500/20 p-4"
              data-mermaid="true"
            >
              <pre className="whitespace-pre-wrap text-sm text-cyan-300">
                <code>{codeText}</code>
              </pre>
            </div>
          );
        } else {
          out.push(
            <pre
              key={`code-${i}`}
              className="liquid-glass-card my-6 overflow-x-auto rounded-lg border border-cyan-500/20 p-4 text-sm text-cyan-300"
            >
              <code>{codeText}</code>
            </pre>
          );
        }
        i++;
        break;
      }

      default: {
        // 兜底：如果该 block 自带 rich_text，则渲染成段落，避免正文空白
        const maybeRich = value?.rich_text ?? [];
        if (maybeRich?.length) {
          out.push(
            <p key={`def-${i}`} className="mt-4 text-base leading-relaxed text-slate-300">
              {renderRichText(maybeRich, `def-${i}`)}
            </p>
          );
        }
        i++;
        break;
      }
    }
  }

  return out;
}

export default async function ArticlePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  let data: any = null;
  try {
    data = await getArticleDetail(id);
  } catch (err) {
    console.error("页面加载数据失败:", err);
    data = null;
  }

  if (!data) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-200 p-20">
        <Link href="/#knowledge" className="text-cyan-400">
          ← 返回首页
        </Link>
        <div className="mt-10">文章加载失败或不存在。</div>
      </div>
    );
  }

  const created = data.created_at
    ? new Date(data.created_at).toLocaleDateString("zh-CN", {
        year: "numeric",
        month: "short",
        day: "numeric",
      })
    : null;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200">
      <div className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
        <header className="flex items-center justify-between border-b border-white/10 pb-6">
          <Link
            href="/#knowledge"
            className="text-sm font-medium text-slate-400 transition hover:text-cyan-300"
          >
            ← 返回首页
          </Link>
          <div className="flex items-center gap-4">
            {created ? (
              <span className="text-xs font-mono text-slate-500">{created}</span>
            ) : null}
            <FontSizeSwitcher />
          </div>
        </header>

        <main className="py-10">
          <h1 className="text-3xl font-bold tracking-tight text-slate-50 sm:text-4xl">
            {data.title}
          </h1>

          <article className="mt-10">
            {/* 使用 tailwind typography 统一排版 */}
            <div className="prose prose-invert prose-cyan max-w-none">
              {renderBlocks(data.blocks)}
            </div>
          </article>
        </main>
      </div>
    </div>
  );
}

