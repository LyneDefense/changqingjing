# 腾讯云 COS 联调清单

## 需要提供的开发环境资料

- 开发用私有 Bucket 完整名称（包含 AppID 后缀）与 Region。
- 只供后端使用、可调用 STS 获取联合身份临时凭证的最小权限 SecretId／SecretKey。
- 管理后台实际 HTTPS Origin；开发阶段可另加明确的本地 Origin，不能使用任意来源。
- 一张 JPEG／PNG／WebP 图片和一个计划上线规格的 MP4 视频，用于格式、大小和真机兼容验证。

真实凭据写入不提交 Git 的环境文件，不粘贴到源码、前端环境变量、工单截图或普通日志。测试和生产使用不同 Bucket 或至少不同前缀与凭据。

## Bucket 设置

1. Bucket 保持私有读写，不创建长期公开 URL。
2. CORS 的 Allowed Origin 精确填写管理后台 Origin；允许 `PUT`，允许 COS SDK 实际发送的请求头，并暴露 `ETag`。完成浏览器 Network 验证后进一步收窄请求头。
3. 不授予浏览器列举、读取、删除 Bucket 或写入其他 Object Key 的能力。后端下发的 STS 策略只包含指定 Object Key 的 `PutObject`。
4. 资源读取使用后端签发的短期 GET URL。把真实 COS HTTPS 域名加入微信小程序合法域名。
5. 为视频保留 Range 请求能力，不通过会剥离 `Range`／`Content-Range` 的代理转发。

## 联调验收

1. 从管理后台分别上传有效图片和 MP4，确认进度经过上传、校验中、READY，并能预览。
2. 检查浏览器请求使用临时 `tmpSecretId` 与安全令牌，前端构建产物中不存在永久 SecretId／SecretKey。
3. 尝试用同一临时凭证写入另一个 Object Key，预期 COS 拒绝；从非允许 Origin 上传，预期 CORS 拒绝。
4. 上传伪造扩展名、错误 Content-Type、大小不符和超限文件，预期不能进入 READY。
5. 发布视频、封面与公司正文图片；匿名小程序只取得已发布版本的短期 URL，草稿资源只在后台预览。
6. 保存一个失败的替换草稿，确认线上旧视频仍播放；下架后业务接口不再签发新地址。
7. 验证视频响应 `206 Partial Content`、`Accept-Ranges: bytes` 和正确的 `Content-Range`，再在微信开发者工具、iOS 与 Android 真机完成播放、拖动、暂停和全屏检查。
8. 让签名 URL 到期后重新进入页面，确认接口刷新并返回新地址；日志中不得出现签名查询参数。
9. 运行过期上传清理，确认失败／中断且无引用的对象被清理，历史草稿或已发布版本引用的对象保留。
