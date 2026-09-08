# Mini Program

使用 Taro 4、React 和 TypeScript 开发微信小程序。

```bash
pnpm install
pnpm dev:weapp
```

然后在微信开发者工具中导入本目录；`project.config.json` 已将编译产物目录设置为 `dist`。当前使用开发测试 AppID，接入微信登录前再换成正式 AppID。开发者工具生成的 `project.private.config.json` 仅保留在本机。

接口地址通过 `TARO_APP_API_BASE_URL` 配置。本地可复制 `.env.example` 为 `.env.development.local`，真机调试时需使用手机能访问的 HTTPS 地址。

提交前运行类型、代码和微信构建检查：

```bash
pnpm typecheck
pnpm lint
pnpm build:weapp
```

已安装并登录微信开发者工具的 macOS 可以运行 `pnpm test:e2e`，它会在模拟器中验证匿名首页到公司介绍详情的渲染流程。其他系统通过 `WECHAT_DEVTOOLS_CLI_PATH` 指定开发者工具 CLI 路径。
