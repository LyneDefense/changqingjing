# 上线运维手册

## 日常状态

服务器安装三个 systemd timer：每 5 分钟检查容器、HTTPS、证书、备份和磁盘；每天生成并校验 PostgreSQL 备份；每天两次检查证书续签。常用命令：

```bash
./deploy/deploy.sh status
systemctl list-timers 'changqingjing-*'
journalctl -u changqingjing-monitor.service --since today
journalctl -u changqingjing-backup.service --since today
journalctl -u changqingjing-cert-renew.service --since today
```

定时任务失败会进入 systemd journal 并返回非零状态。正式环境应在腾讯云监控中为服务器不可达、CPU、内存、磁盘和 5xx 建立通知，并把 systemd 单元失败接入团队实际使用的告警渠道；仓库不猜测手机号、群机器人或通知密钥。

每天至少确认：三个容器为 healthy、`https://域名/healthz` 可达、错误日志没有持续增长、微信登录和 COS 上传没有异常、最新备份未超过 26 小时。证书进入 30 天到期窗口或磁盘达到 85% 会使监控任务失败。

## 内容维护

运营人员只通过管理后台维护内容，遵循“编辑草稿 → 预览 → 发布”。首页宣传视频、公司介绍、景区、福利产品和合作权益互相独立，不直接修改数据库。下架前先确认旧链接预期；替换媒体失败时保留当前线上版本。

## 发布失败

`deploy.sh deploy` 在更新前先备份和迁移，并保存当前与上一版镜像。新后端或 Web 未通过健康检查时会尝试自动回退应用。人工确认：

```bash
./deploy/deploy.sh status
docker compose --env-file deploy/.env.production -f deploy/compose.production.yaml logs --tail 200 backend web
./deploy/deploy.sh rollback
```

数据库迁移不得自动向后执行。若新代码已执行迁移但应用回退，上一版必须能够容忍新增表／列；不兼容问题使用新的 Flyway 前向迁移修复。

## 数据库与恢复

备份位于 `deploy/backups/`，是经过 `pg_restore --list` 校验的 custom format 归档。每天的同机备份不能替代异地备份：应加密复制到访问权限独立的 COS 备份桶或其他存储，并按组织要求设置保留期。

每次大版本前及至少每季度执行：

```bash
./deploy/deploy.sh backup
./deploy/deploy.sh restore-check
```

恢复演练只写入临时数据库并在成功后删除，不覆盖生产库。真实灾难恢复时先停止写入、保留故障数据库卷和日志，在新数据库实例恢复已验证归档，核对 Flyway 版本和关键内容数量，再切换应用连接；不要直接在故障库上反复尝试破坏性命令。

## 常见故障

| 现象 | 首要检查 | 处理原则 |
| --- | --- | --- |
| 后台打不开 | `web` 健康、80/443、安全组、证书 | 保留日志；证书有效时再 reload，不删除证书卷。 |
| API 5xx | `backend` 日志、PostgreSQL 健康、Flyway 状态 | 先阻止继续发布；必要时回退应用，数据库前向修复。 |
| 微信登录失败 | 微信配置、额度、后端错误码与时间同步 | 不打印 code、手机号或 AppSecret；区分平台错误与用户拒绝。 |
| COS 上传失败 | CAM 最小权限、STS、CORS、Bucket/Region | 不扩大到全桶权限；修正资源后重新上传再发布。 |
| 视频无法播放 | COS URL 有效期、Range、MP4 编码、合法域名 | 保持原线上视频；分别在 iOS/Android 复测。 |
| 导航位置错误 | 后台保存坐标与 GCJ-02、是否重新选点 | 停止发布错误地点，不能靠改展示名称修正坐标。 |
| 备份超时或失败 | 磁盘、数据库健康、归档校验 | 不删除最后一份有效备份；修复后立即补做并恢复演练。 |
| 证书续签失败 | DNS、80 端口、ACME webroot、Certbot 日志 | 在到期前处理；续签后必须 `nginx -t` 才 reload。 |

## 安全维护

- 停用离职人员后台账号，定期复核管理员数量和 CAM 最小权限。
- 不把 `.env.production`、证书私钥、数据库备份或发布状态提交 Git。
- 微信 AppSecret、COS 密钥和手机号加密密钥按既定轮换方案处理；手机号加密密钥不能无迁移直接替换。
- 每次依赖升级重新执行 `scripts/verify-release.sh`；高危／严重生产依赖不得带病发布。
- 保持旧小程序客户端可调用既有接口；删除或改变响应字段前先完成兼容版本迁移。

