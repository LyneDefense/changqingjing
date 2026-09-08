# 管理后台前端

React + TypeScript + Vite 管理端，生产路径固定为 `/admin/`，后端接口使用同域的 `/api/v1/admin/`。

## 本地开发

```bash
pnpm install
pnpm dev
```

Vite 会把 `/api` 转发到 `http://localhost:8080`。先按照 `backend/README.md` 启动 PostgreSQL、创建首个管理员并运行后端，然后访问 `http://localhost:5173/admin/`。

## 会话安全

- 登录态使用后端签发的 HttpOnly Cookie，前端不把 Cookie 或会话标识写入 Web Storage。
- 页面启动时通过 `/auth/me` 恢复会话；受保护请求返回 401 时跳转登录页并明确提示会话失效。
- CSRF token 由 `/auth/csrf` 获取，只保存在当前页面内存中，所有写请求自动携带服务端指定的请求头。
- 403 显示无权限页。人员和用户菜单只向管理员角色显示，后端仍独立执行权限校验。

## 检查

```bash
pnpm test
pnpm test:e2e
pnpm lint
pnpm build
```

生产构建输出到 `dist/`，其中静态资源路径以 `/admin/` 为前缀。
