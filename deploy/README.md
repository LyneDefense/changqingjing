# 一键部署

统一入口是 `deploy/deploy.sh`，在 Ubuntu 服务器的仓库根目录执行。它编排 PostgreSQL、Spring Boot、管理后台、Nginx 和 Certbot；媒体仍使用腾讯云 COS，不写入数据库或容器磁盘。

目前只准备部署工具，没有在服务器安装软件、启动应用或搬迁本地数据库数据。首次运行会创建空的服务器数据库并执行项目的 Flyway 建表/升级脚本；**这不等于迁移本地业务数据**，数据搬迁另行安排。

## 1. 准备代码和配置

把代码放到服务器的固定目录，例如 `/opt/changqingjing`。可通过私有 Git 仓库拉取，也可以同步源码；不要上传本机 `.env.local`、`node_modules/`、编译产物或数据库目录。部署目录不能包含空格。

在服务器仓库根目录执行：

```bash
cp deploy/.env.production.example deploy/.env.production
chmod 600 deploy/.env.production
```

编辑 `deploy/.env.production`：

- 暂无域名时，`DOMAIN`、`SERVER_PUBLIC_IP`、`CERTBOT_EMAIL` 留空。
- 填入服务器数据库密码、微信 AppID/Secret、COS 配置、手机号加密密钥、首次管理员账号和密码。不要把示例占位值直接用于部署。
- `BACKEND_IMAGE`、`WEB_IMAGE` 填明确版本标签，例如 `changqingjing-backend:20260915-1` 和 `changqingjing-web:20260915-1`；每次更改代码使用新标签，禁止 `latest`。
- COS 使用生产专用对象前缀，不能使用 `dev` 或 `local`。后台直传所需的 COS CORS 来源要包含实际访问后台的来源：隧道阶段例如 `http://127.0.0.1:18080`，接入域名后改为最终 HTTPS 来源。
- 地图 Key 可选；未配置时不影响景区保存和发布。

生产环境文件不会提交到 Git，也不会进入镜像。它同时被 Bash 和 Compose 读取；值包含空格、`#`、`$` 等特殊字符时，用单引号包住整个值。部署脚本从不自动沿用本机开发密钥。

手机号加密密钥需要是 Base64 编码的 32 字节随机值。若未来要导入已有加密手机号数据，需先确认沿用原密钥或规划重新加密，不能随意替换。

## 2. 无域名预部署

只需执行一次：

```bash
sudo ./deploy/deploy.sh bootstrap
```

脚本会按顺序完成：

1. 检查 Ubuntu；未安装 Docker 时，通过腾讯云提供的 Docker Ubuntu 镜像源安装 Engine 和 Compose 插件，校验下载公钥与已核对的 Docker 官方公钥一致。遇到冲突软件包会停止，不会自行卸载。
2. 检查端口和配置，依次构建 Java、管理后台镜像，避免在 2 GB 内存服务器上同时构建。
3. 启动 PostgreSQL，执行 Flyway，启动后端和 Nginx。
4. 检查健康状态，生成并校验首份数据库备份，记录可回退的镜像版本。
5. 安装宿主机证书续签、每日备份、五分钟健康检查三个 systemd timer。

公钥下载失败会自动重试 3 次，APT 下载也配置 3 次重试。公钥先下载到临时目录，确认不为空且 SHA-256 校验通过后才写入正式配置；失败不会留下半截公钥或覆盖原软件源。若 Docker 官方公钥将来更新，需要先核对新公钥，再更新脚本中的校验值。此处只解决 Docker 安装软件源访问，Docker Hub 镜像拉取是另一条网络链路，不配置未经确认的镜像加速地址。

如首次部署在安装 Docker 阶段因网络中断退出，更新代码后重新运行即可，不必重装系统，也不需要删除生产环境文件：

```bash
git pull --ff-only
sudo ./deploy/deploy.sh bootstrap
```

无域名时后台只绑定服务器的 `127.0.0.1:8088`，不把 HTTP 后台暴露到公网；后端和数据库不发布宿主机端口。要求 Docker Engine 28 或更新版本，避免旧版 localhost 端口发布的局域网访问问题。

在本机另开终端，保持下面的 SSH 隧道运行：

```bash
ssh -N -o ExitOnForwardFailure=yes -L 18080:127.0.0.1:8088 zen
```

随后访问 `http://127.0.0.1:18080/admin/`。如修改了 `PREVIEW_HTTP_PORT`，对应调整隧道右边的端口。

预部署可测试后台和 API，但不能代替小程序正式发布所需的合法 HTTPS 域名。微信开发者工具的本地调试可通过隧道访问 `/api/v1/app/`，前提是仅在开发环境关闭合法域名校验；手机不能直接使用电脑的 `127.0.0.1`。

首次管理员可以登录后，立即把 `ADMIN_BOOTSTRAP_ENABLED` 改回 `false` 并清空三个初始化字段。以后不能再次用 `bootstrap` 覆盖已完成的部署，应使用 `deploy`。

## 3. 有域名后启用 HTTPS

先将域名 A 记录指向服务器公网 IPv4，并在腾讯云安全组/系统防火墙放行 TCP 80、443。然后在同一个环境文件里填写：

```dotenv
DOMAIN=你的真实域名
SERVER_PUBLIC_IP=服务器真实公网IPv4
CERTBOT_EMAIL=你的真实邮箱
CERTBOT_STAGING=false
ADMIN_BOOTSTRAP_ENABLED=false
```

`DOMAIN` 仅填写域名，不带协议、端口或路径。以上为说明，不能原样复制。执行：

```bash
sudo ./deploy/deploy.sh enable-https
sudo ./deploy/deploy.sh renew-cert --dry-run
```

`enable-https` 使用当前已验证镜像，先备份数据库，核对 DNS 和 ACME 公网路径，申请证书，启用 HTTPS 和安全 Cookie，检查应用，并启用运维定时器。不重建数据库，不导入数据，也无需手动运行容器命令。

之后后台为 `https://你的域名/admin/`，管理 API 和小程序 API 分别为 `/api/v1/admin/`、`/api/v1/app/`。证书接入前，公开 HTTP 入口只提供 ACME 和健康检查，不提供后台或业务 API。

也可以一开始就填写域名等三项，再执行 `bootstrap`，一次完成首次部署和证书申请。`CERTBOT_STAGING=true` 仅供独立演练环境使用，测试证书不被浏览器信任；正式部署保持 `false`。

正式发布小程序前，再配置微信后台的合法域名及 COS 相关域名、CORS 和地图授权。域名的云服务及备案要求需按最终域名、服务器所在地另行核对。

## 4. 后续更新与运维

更新服务器代码，为变更的应用填写新镜像标签，执行同一个入口：

```bash
sudo ./deploy/deploy.sh deploy
```

发布顺序是构建镜像、备份、Flyway、后端健康检查、Nginx/应用健康检查。失败会尝试回退应用镜像；数据库升级不会自动降级，需要保持迁移向前兼容。预部署与正式 HTTPS 部署共用此命令。

```bash
sudo ./deploy/deploy.sh status
sudo ./deploy/deploy.sh backup
sudo ./deploy/deploy.sh restore-check
sudo ./deploy/deploy.sh renew-cert --dry-run
sudo ./deploy/deploy.sh rollback
```

`restore-check` 仅恢复到独立临时数据库，校验后删除临时库，不覆盖业务数据库。备份默认保留 14 天，存储于 `deploy/backups/`。证书、备份、环境文件、锁和发布状态均被 Git 忽略；证书与备份目录权限为 700，维护定时器以 root 运行，避免读取私密文件和获取部署锁时权限失败。

自动续签每天检查两次。无域名时跳过，接入域名后沿用相同 timer。Certbot 通过 ACME webroot 续签，只有成功更新证书且 `nginx -t` 通过才重载 Nginx；演练不重载。重载失败会保留更新标记，下次检查重试。

```bash
systemctl list-timers 'changqingjing-*'
sudo journalctl -u changqingjing-monitor.service
sudo journalctl -u changqingjing-backup.service
sudo journalctl -u changqingjing-cert-renew.service
```

监控检查容器、应用健康、备份新鲜度、磁盘使用率以及 HTTPS 模式下的证书到期时间，错误记录在 journal。还未接入外部告警渠道。备份仍需定期加密复制到另一存储位置，避免单机磁盘故障同时损坏数据与备份。

后端构建和运行保持用户指定的 JDK 18。该版本不是 LTS；上线后的维护计划应安排升级到仍在支持期内的 LTS JDK，但本次不改变 Java 主版本。

## 本地验证

```bash
bash deploy/test-deploy.sh
bash deploy/test-install-runtime.sh
bash deploy/test-config.sh
# 本机先构建 changqingjing-backend:verification 后，可验证隔离的空库启动和备份恢复：
bash deploy/test-stack.sh
```

测试仅使用本机 Docker 的验证镜像/独立数据库，不读取生产密钥，不连接服务器。覆盖模式选择、Cookie/端口隔离、证书重载逻辑、Compose、三种 Nginx 配置和 HTTP 后台路由。

参考：[Docker 官方 Ubuntu 安装说明](https://docs.docker.com/engine/install/ubuntu/)、[腾讯云 Docker 软件源安装说明](https://cloud.tencent.com/document/product/213/46000)、[端口发布安全说明](https://docs.docker.com/engine/network/port-publishing/)、[Certbot 续签与 deploy-hook](https://eff-certbot.readthedocs.io/en/stable/man/certbot.html)。
