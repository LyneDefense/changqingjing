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
