"use client";

import { useCallback, useEffect, useState } from "react";
import type { AINews } from "@/utils/notion";
import { AiNewsGeekHub } from "@/app/components/ai-news/AiNewsGeekHub";
import { patchAINewsStarred } from "@/utils/ai-news-star-api";

export default function AINewsRadarClient({ news }: { news: AINews[] }) {
  const [items, setItems] = useState<AINews[]>(news);

  useEffect(() => {
    setItems(news);
  }, [news]);

  const toggleStarred = useCallback(async (pageId: string, next: boolean) => {
    setItems((prev) => prev.map((i) => (i.id === pageId ? { ...i, starred: next } : i)));
    try {
      await patchAINewsStarred(pageId, next);
    } catch {
      setItems((prev) => prev.map((i) => (i.id === pageId ? { ...i, starred: !next } : i)));
    }
  }, []);

  return (
    <div className="flex min-h-screen flex-col">
      <AiNewsGeekHub items={items} onToggleStar={toggleStarred} layout="full" />
    </div>
  );
}
