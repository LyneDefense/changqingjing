# Mini Program

使用 Taro 4、React 和 TypeScript 开发微信小程序。

```bash
pnpm install
pnpm dev:weapp
```

然后在微信开发者工具中导入本目录；`project.config.json` 已将编译产物目录设置为 `dist`。当前使用测试 AppID `touristappid`，接入微信登录前再换成正式 AppID。

接口地址通过 `TARO_APP_API_BASE_URL` 配置。本地可复制 `.env.example` 为 `.env.development.local`，真机调试时需使用手机能访问的 HTTPS 地址。
