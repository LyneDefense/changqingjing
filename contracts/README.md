# API 契约

`openapi.json` 是由 Spring Boot Controller 和 DTO 生成并提交到仓库的 V1 接口快照。默认运行环境关闭 OpenAPI 端点；生成脚本会临时启用专用 `openapi` Profile，并在完成后关闭进程。

生成和校验：

```bash
JAVA_HOME=/path/to/jdk-18 ./scripts/generate-openapi.sh
pnpm --dir admin-web generate:api
pnpm --dir miniprogram generate:api
pnpm --dir admin-web check:api-contract
pnpm --dir miniprogram check:api-contract
```

两个前端都提交生成类型，并通过各自的 `contractCompatibility.ts` 在构建时检查实际使用的 DTO 字段、枚举和关键路由。修改后端接口时必须重新生成三份文件并随同提交，不能手改 `*.generated.ts`。
