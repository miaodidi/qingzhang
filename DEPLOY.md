# 免费发布到 GitHub Pages

`dist/` 是可直接发布的静态站点。建议使用仓库的 `/docs` 文件夹发布，网站配置如下：

- Pages Source：Deploy from a branch
- Branch：main
- Folder：/docs
- Enforce HTTPS：开启

发布前执行 `npm ci && npm run build`，将 `dist/` 的内容复制到 `docs/`（包括图标与 Service Worker），并在 `docs/` 中放置空的 `.nojekyll` 文件。网站使用相对路径，可在仓库子路径运行。

网址一旦确定，尽量不要改变。设备数据库按 origin 隔离；同一域名下多个站点也可能共享 IndexedDB 命名空间，因此轻账数据库名应保留给本应用使用。

仓库只应包含应用代码、测试与构建资源，切勿提交导出的账单备份或密码。

当前发布账号：miaodidi。仓库：https://github.com/miaodidi/qingzhang 。网页：https://miaodidi.github.io/qingzhang/ 。
