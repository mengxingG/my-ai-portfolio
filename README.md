This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

---

## 文章详情：快 + 发布后立刻更新

文章详情对 Notion 的请求使用 **Next.js Data Cache**（`fetch` + `tags` + `revalidate: false`），日常访问会命中缓存，速度极快。

在 `.env.local` 增加随机密钥：

```bash
REVALIDATE_SECRET=你的长随机字符串
```

**发布 / 更新 Notion 文章后**，任选一种方式刷新缓存：

1. **只刷新某一篇**（`articleId` 为 Notion 页面 ID，带连字符的 UUID）：

```bash
curl -X POST "https://你的域名/api/revalidate" \
  -H "Content-Type: application/json" \
  -H "x-revalidate-secret: 你的长随机字符串" \
  -d '{"articleId":"xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"}'
```

2. **刷新所有已缓存的文章详情**（不记得具体 ID 时）：

```bash
curl -X POST "https://你的域名/api/revalidate" \
  -H "Content-Type: application/json" \
  -H "x-revalidate-secret: 你的长随机字符串" \
  -d '{"allArticles":true}'
```

可在 Notion 自动化、Zapier、或自建 Webhook 里对上述 URL 发 `POST`，实现「点发布 → 立刻调用 revalidate → 线上秒更新」。
