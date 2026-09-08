# Backend

Spring Boot 后端，同时提供：

- `/api/v1/app/**`：微信小程序 API。
- `/api/v1/admin/**`：管理后台 API。

构建和运行均固定使用 JDK 18。当前 Mac 默认 JDK 是 17，首次初始化阶段可通过项目 Dockerfile 验证 JDK 18 构建；IDE 需要另外选择 JDK 18。

本地启动前先在仓库根目录启动 PostgreSQL：

```bash
docker compose -f compose.local.yaml up -d postgres
```

然后在 JDK 18 环境运行：

```bash
./mvnw spring-boot:run
```

Spring Session 使用 PostgreSQL 持久化，会话表由 Flyway 管理，应用不会自动建表。

数据库迁移集成测试通过 Testcontainers 启动真实 PostgreSQL 16，因此运行完整测试前需要启动 Docker Desktop：

```bash
./mvnw test
```

API 成功响应使用 `{ "data": ... }`。错误响应包含稳定的 `code`、可展示的 `message` 和 `traceId`；参数校验失败时还会返回字段级 `violations`。所有 `/api/v1/**` 响应通过 `X-Trace-Id` 响应头返回同一请求的跟踪编号。

分页请求统一使用 `page` 和 `pageSize`，默认值为 1 和 20，`pageSize` 最大为 100；响应数据使用 `items`、`page`、`pageSize`、`total`。业务 ID 使用 UUID 字符串，接口时间使用带时区的 ISO 8601，数据库连接统一使用 UTC。

小程序受保护接口只接受 Bearer 会话，管理后台只接受 Cookie 会话；两套凭据不能互用。后台写请求必须通过 CSRF 校验，未在安全规则中列出的接口默认拒绝。

API 访问日志只记录请求方法、路由模板、响应状态和耗时。禁止记录查询参数、请求体、Cookie、Authorization、异常消息，以及密码、手机号、微信临时 code 或业务 token。

后台使用 Spring Session JDBC Cookie 会话，闲置 30 分钟、最长 12 小时失效；生产 Cookie 启用 `HttpOnly`、`Secure` 和 `SameSite=Lax`。登录前先调用 `GET /api/v1/admin/auth/csrf`，所有后台写请求（包括登录和退出）均携带返回的 CSRF 请求头。

首次创建管理员时，在未提交的环境文件中临时填写 `ADMIN_BOOTSTRAP_LOGIN_NAME`、`ADMIN_BOOTSTRAP_DISPLAY_NAME`、`ADMIN_BOOTSTRAP_PASSWORD` 并将 `ADMIN_BOOTSTRAP_ENABLED` 设为 `true` 后启动一次应用。创建成功后立即关闭开关并删除明文密码；数据库已有后台账号时，该命令会拒绝再次执行。
