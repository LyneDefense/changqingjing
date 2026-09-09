# 生产式部署

本目录把 PostgreSQL、Spring Boot、管理后台、Nginx 和 Certbot 编排在同一台 Ubuntu 服务器上。公网只开放 80/443；PostgreSQL 和后端端口只存在于 Docker 内部网络。管理后台固定为 `https://你的域名/admin/`，两类 API 分别保持 `/api/v1/admin/**` 与 `/api/v1/app/**`。

## 首次部署前

服务器需要 Ubuntu、Docker Engine、Docker Compose v2、`curl`、`getent`、`ss`、`openssl`、`flock` 和 `systemd`。还需要提前完成：

- 域名 A 记录已经指向服务器公网 IPv4；腾讯云安全组和系统防火墙放行 TCP 80/443。
- COS、微信小程序、手机号加密密钥和首个管理员信息均为生产专用值。
- COS CORS 的后台来源是最终的 `https://你的域名`，Object 前缀不是 `dev/`。
- 每次发布为 `BACKEND_IMAGE`、`WEB_IMAGE` 使用新的版本标签，禁止 `latest`。

在仓库根目录执行：

```bash
cp deploy/.env.production.example deploy/.env.production
chmod 600 deploy/.env.production
# 编辑 deploy/.env.production，替换全部 CHANGE_ME
./deploy/deploy.sh bootstrap
```

`bootstrap` 会核对 Ubuntu、Docker、DNS 和端口，构建镜像，启动数据库，单独执行 Flyway，启动 HTTP ACME 入口，申请 Let's Encrypt 证书，切换 HTTPS，生成首份数据库备份，并安装 `changqingjing-cert-renew.timer`。

首个管理员创建并确认可以登录后，把 `ADMIN_BOOTSTRAP_ENABLED` 改回 `false`，同时清空三个初始化字段，再使用新镜像标签执行日常发布：

```bash
./deploy/deploy.sh deploy
```

发布固定按“构建镜像 → 等待数据库 → 生成并校验备份 → Flyway 迁移 → 后端健康检查 → Web/HTTPS 健康检查”执行。应用健康失败会自动尝试恢复上一个成功镜像；数据库迁移不做危险的自动降级，应保持向前兼容并通过后续迁移修复。

## 运维命令

```bash
./deploy/deploy.sh status
./deploy/deploy.sh backup
./deploy/deploy.sh restore-check
./deploy/deploy.sh renew-cert --dry-run
./deploy/deploy.sh renew-cert
./deploy/deploy.sh rollback
```

`restore-check` 将最新备份恢复到随机命名的临时数据库，确认存在 public 表后立即删除临时库，不覆盖生产库。备份保存在 `deploy/backups/`，默认保留 14 天；该目录、证书、生产环境文件和发布状态均被 Git 忽略。仍需把备份定期加密复制到另一存储位置，避免服务器磁盘故障同时损坏数据与备份。

证书定时器每天检查两次。检查状态：

```bash
systemctl status changqingjing-cert-renew.timer
journalctl -u changqingjing-cert-renew.service
```

## 本地验证部署配置

以下命令只检查 Compose、构建管理后台镜像，并分别校验无证书 HTTP 模式和有证书 HTTPS 模式的 Nginx 配置，不会触碰生产环境：

```bash
./deploy/test-config.sh
```

