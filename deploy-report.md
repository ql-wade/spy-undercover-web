# Spy-Undercover 部署报告

**日期**: 2026-04-26 03:37 CST
**状态**: ⚠️ **部署失败 — 认证缺失**
**操作人**: Ops (subagent)

---

## 环境检查结果

| 检查项 | 结果 |
|--------|------|
| Wrangler CLI | ✅ v4.85.0 (via npx) |
| Wrangler 登录状态 | ❌ 未认证 (`You are not authenticated`) |
| `CLOUDFLARE_API_TOKEN` 环境变量 | ❌ 未设置 |
| `.env` 文件中的 token | ❌ 不存在 |
| `~/.wrangler/config/` 配置 | ❌ 不存在 |
| `dist/` 构建产物 | ✅ 已就绪 (index.html + assets/) |

## 失败原因

```
In a non-interactive environment, it is necessary to set a 
CLOUDFLARE_API_TOKEN environment variable for wrangler to work.
```

**根因**: 当前环境（sandbox/非交互式）中 wrangler 无法完成 OAuth 登录流程，且未配置 API Token。

---

## 修复步骤（按优先级排序）

### 方案 A：配置 API Token（推荐，1 分钟）

1. 登录 [Cloudflare Dashboard](https://dash.cloudflare.com/profile/api-tokens)
2. 点击 **Create Token** → 选择 **Edit Cloudflare Workers** 模板
3. 设置权限：
   - **Account** → **Cloudflare Pages** → **Edit
   - **Zone** → （不需要）
4. 创建后复制 Token
5. 在 Mac mini 终端执行：
   ```bash
   export CLOUDFLARE_API_TOKEN="你的token"
   cd ~/.openclaw/workspaces/tech-lead/shared/spy-undercover
   npx wrangler pages deploy dist --project-name=spy-undercover-web
   ```

### 方案 B：交互式登录（需要浏览器，2 分钟）

在 Mac mini 本地终端执行（**不是 sandbox 环境**）：

```bash
cd ~/.openclaw/workspaces/tech-lead/shared/spy-undercover
npx wrangler login
# 浏览器会弹出授权页面，授权后：
npx wrangler pages deploy dist --project-name=spy-undercover-web
```

⚠️ 此方案需要在有浏览器的交互式终端运行。

### 方案 C：持久化 Token 到环境配置

将 token 写入 shell profile 后所有 session 可用：

```bash
echo 'export CLOUDFLARE_API_TOKEN="你的token"' >> ~/.zshrc
source ~/.zshrc
```

---

## 备选部署平台

如果暂时无法获取 Cloudflare Token，以下平台均可免费托管静态站点：

| 平台 | 免费额度 | 部署方式 | 优势 | 劣势 |
|------|----------|----------|------|------|
| **Vercel** | 100GB 带宽/月 | `npx vercel --prod` | Git 集成好、自动 HTTPS | 需注册账号 |
| **Netlify** | 100GB 带宽/月 | `npx netlify deploy --prod --dir=dist` | 拖拽部署、表单处理 | 构建时间限制 |
| **GitHub Pages** | 无限（软限 100GB/月） | Push 到 `gh-pages` 分支 | 与代码仓库集成 | 仅静态文件、无 SSR |
| **Cloudflare Pages** (Dashboard) | 无限（500 次构建/月） | Dashboard 上传 dist.zip 或连接 Git | 最快 CDN、免费 SSL | ⚠️ 当前无法 CLI 部署 |

### 快速备选命令

```bash
# Vercel（如果已登录）
cd /Users/qingli/.openclaw/workspaces/tech-lead/shared/spy-undercover
npx vercel --prod --yes

# Netlify（如果已登录）
npx netlify deploy --prod --dir=dist

# GitHub Pages（需要 git repo）
git add dist -f && git commit -m "deploy" && git subtree push --prefix dist origin gh-pages
```

---

## 构建产物确认

```
dist/
├── _headers        (871 B)  ✅ CF Pages headers 配置
├── index.html      (2607 B) ✅ SPA 入口
└── assets/         ✅ JS/CSS 打包产物
    ├── index-[hash].css
    └── index-[hash].js
```

产物完整，随时可部署。唯一阻塞点是 **Cloudflare API 认证**。

---

## 下一步行动

1. 🔑 **首选**：Kev 提供 Cloudflare API Token → 重新触发部署
2. 🔄 **备选**：切换到 Vercel/Netlify 部署
3. 🖥️ **手动**：Kev 在本地终端执行 `wrangler login` + deploy
