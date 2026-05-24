# 每日10想

一个“疯狂参谋”式 AI 发散思维工具：输入问题，生成至少 10 个天马行空但可验证的方案，并给出每条方案的最佳第一步。

## 本地运行

```powershell
npm.cmd install
npm.cmd run build
npm.cmd start
```

默认服务地址：

```text
http://127.0.0.1:8787/
```

同一 Wi-Fi 的手机可访问电脑局域网地址，例如：

```text
http://192.168.1.4:8787/
```

## 环境变量

复制 `.env.example` 为 `.env`，并填写：

```env
LLM_PROVIDER=deepseek
DEEPSEEK_API_KEY=你的 DeepSeek Key
DEEPSEEK_MODEL=deepseek-v4-flash
PORT=8787
```

## 数据同步

默认同步到服务端本地文件：

```env
SYNC_PROVIDER=local
```

数据文件位置：

```text
data/sync-state.json
```

如果要跨设备、跨服务器同步，可以使用 GitHub Gist：

```env
SYNC_PROVIDER=github_gist
GITHUB_SYNC_TOKEN=你的 GitHub fine-grained token
GITHUB_SYNC_GIST_ID=你的 Gist ID
GITHUB_SYNC_FILENAME=daily-10-ideas-sync.json
```

建议把 Gist 设为 secret。Token 只放在服务端环境变量里，不要放进前端代码。

GitHub token 需要能读取和写入 Gist。

## 部署到 Firebase

这个项目需要同时部署：

- Firebase Hosting：提供 PWA 前端和 HTTPS 域名
- Cloud Functions for Firebase：提供 `/api/generate` 和 `/api/sync`

先在 Firebase Console 创建项目，然后把项目 ID 写入 `.firebaserc`：

```powershell
copy .firebaserc.example .firebaserc
```

把里面的 `your-firebase-project-id` 改成你的 Firebase 项目 ID。

安装/登录 Firebase CLI：

```powershell
npx.cmd firebase-tools login
```

为 Functions 准备普通环境变量。Firebase Functions 支持 dotenv 文件；推荐创建一个不提交到 GitHub 的 `.env.<projectId>` 文件：

```env
LLM_PROVIDER=deepseek
DEEPSEEK_MODEL=deepseek-v4-flash
SYNC_PROVIDER=github_gist
GITHUB_SYNC_GIST_ID=你的 Gist ID
GITHUB_SYNC_FILENAME=daily-10-ideas-sync.json
```

机密值用 Firebase Secrets 设置：

```powershell
npx.cmd firebase-tools functions:secrets:set DEEPSEEK_API_KEY
npx.cmd firebase-tools functions:secrets:set GITHUB_SYNC_TOKEN
```

部署：

```powershell
npm.cmd run deploy:firebase
```

部署完成后，Firebase 会给出一个 HTTPS Hosting 地址。用手机打开这个地址，再添加到主屏幕。

## 手机安装

本项目已支持 PWA：

- Android Chrome：菜单 -> 添加到主屏幕 / 安装应用
- iPhone Safari：分享 -> 添加到主屏幕

长期稳定安装建议部署到固定 HTTPS 域名。局域网 HTTP 地址只适合测试。

## GitHub 提交注意

不要提交：

- `.env`
- `data/`
- `node_modules/`
- `dist/`

这些已在 `.gitignore` 中忽略。

## 验证

```powershell
npm.cmd test
npm.cmd run build
```
