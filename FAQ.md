# 常见问题解答 (FAQ)

## 一般问题

### Q1: 这个系统适合多大规模的实验室？

**A**: 系统基于 SQLite 数据库，适合小到中型实验室（10-100人）。如果您的实验室有更多成员，建议迁移到 PostgreSQL 或 MySQL。

### Q2: 系统是否开源和免费？

**A**: 是的，本系统采用 MIT 许可证，完全开源免费，可以自由使用、修改和分发。

### Q3: 可以部署到云服务器吗？

**A**: 可以。系统支持部署到任何支持 Node.js 的服务器，包括阿里云、腾讯云、AWS 等。

### Q4: 支持多个实验室吗？

**A**: 当前版本是单实验室设计。如需支持多实验室，需要修改数据库结构添加实验室表。

## 安装和配置

### Q5: 安装时提示 "node: command not found"

**A**: 这表示 Node.js 未安装或未添加到环境变量。请：
1. 访问 https://nodejs.org/ 下载安装 Node.js
2. 安装后重启终端
3. 运行 `node --version` 验证安装

### Q6: 如何修改默认端口？

**A**: 
- **后端**: 编辑 `backend/.env` 文件中的 `PORT` 变量
- **前端**: 编辑 `frontend/vite.config.ts` 中的 `server.port`

### Q7: JWT_SECRET 应该设置什么值？

**A**: 使用强随机字符串。生成方法：

Linux/Mac:
```bash
openssl rand -base64 32
```

Windows (PowerShell):
```powershell
[Convert]::ToBase64String((1..32 | ForEach-Object { Get-Random -Maximum 256 }))
```

或使用在线工具生成随机字符串。

### Q8: 数据库文件在哪里？

**A**: 默认在 `backend/database.sqlite`。可以在 `backend/.env` 中修改 `DATABASE_PATH` 更改位置。

## 使用问题

### Q9: 忘记管理员密码怎么办？

**A**: 
1. 停止服务器
2. 删除 `backend/database.sqlite`
3. 运行 `cd backend && npm run init-db`
4. 使用默认账户登录（admin/admin123）

### Q10: 如何添加新的管理员？

**A**: 
1. 使用现有管理员账户登录
2. 进入"管理面板"
3. 在用户列表中找到要设置的用户
4. 点击设置图标
5. 确认设置为管理员

### Q11: 可以批量导入用户吗？

**A**: 当前版本不支持。但可以：
1. 让成员自行注册
2. 或编写脚本直接插入数据库
3. 未来版本会添加此功能

### Q12: 如何导出积分数据？

**A**: 当前版本需要手动操作：
1. 使用 SQLite 工具打开数据库文件
2. 导出 users 表
3. 或使用 SQL 查询导出

计划在未来版本添加 Excel 导出功能。

### Q13: 积分可以是小数吗？

**A**: 当前版本只支持整数。如需支持小数，需要修改数据库结构和相关代码。

### Q14: 如何查看积分变动历史？

**A**: 当前版本管理员可以查看，但普通用户暂不支持。未来版本会添加个人积分历史功能。

## 部署问题

### Q15: 部署后无法访问怎么办？

**A**: 检查：
1. 服务器是否启动成功
2. 防火墙是否开放端口
3. Nginx 配置是否正确
4. 查看错误日志 `pm2 logs`

### Q16: 如何配置 HTTPS？

**A**: 参考 [DEPLOYMENT.md](DEPLOYMENT.md) 中的 SSL 配置部分，使用 Let's Encrypt 免费证书。

### Q17: 如何更新到新版本？

**A**: 
```bash
# 停止服务
pm2 stop robotlab-manage

# 拉取最新代码
git pull

# 安装依赖
npm run install:all

# 重新构建
npm run build

# 重启服务
pm2 restart robotlab-manage
```

### Q18: 如何备份数据？

**A**: 
```bash
# 备份数据库文件
cp backend/database.sqlite backup/database-$(date +%Y%m%d).sqlite

# 设置自动备份（crontab）
0 2 * * * cp /path/to/database.sqlite /backup/database-$(date +\%Y\%m\%d).sqlite
```

## 性能问题

### Q19: 系统运行缓慢怎么办？

**A**: 
1. 检查服务器资源（CPU/内存）
2. 优化数据库（重建索引）
3. 使用 PM2 集群模式
4. 考虑迁移到更强大的数据库

### Q20: 可以处理多少用户？

**A**: 在推荐配置下：
- SQLite: 100人以内流畅
- PostgreSQL/MySQL: 1000+人

## 开发问题

### Q21: 如何添加新功能？

**A**: 
1. 阅读 [CONTRIBUTING.md](CONTRIBUTING.md)
2. 在 `backend/src/routes/` 添加 API
3. 在 `frontend/src/components/` 添加界面
4. 更新类型定义
5. 测试功能

### Q22: 如何修改界面样式？

**A**: 
- 全局样式: 编辑 `frontend/src/index.css`
- 组件样式: 使用 Tailwind CSS 类
- 主题颜色: 编辑 `frontend/tailwind.config.js`

### Q23: 如何添加新的数据表？

**A**: 
1. 在 `backend/src/database/init.ts` 中添加建表语句
2. 在 `backend/src/types/index.ts` 中添加类型
3. 创建对应的 API 路由
4. 删除旧数据库重新初始化

### Q24: 支持其他数据库吗？

**A**: 支持，但需要修改代码：
1. 安装对应的数据库驱动
2. 修改 `backend/src/database/db.ts` 连接逻辑
3. 调整 SQL 语法差异

## 安全问题

### Q25: 系统安全吗？

**A**: 系统实现了基本的安全措施：
- 密码加密存储
- JWT 认证
- 输入验证
- SQL 注入防护

但仍建议：
- 使用强密码策略
- 配置 HTTPS
- 定期更新依赖
- 限制管理员数量

### Q26: 如何防止暴力破解？

**A**: 当前版本未实现，建议：
1. 使用 Nginx 限流
2. 添加登录失败次数限制（需自行实现）
3. 使用强密码
4. 启用双因素认证（需自行实现）

### Q27: 数据会丢失吗？

**A**: 只要定期备份数据库文件，数据不会丢失。建议：
- 每日自动备份
- 保留多个备份版本
- 异地备份

## 技术问题

### Q28: 为什么选择 SQLite 而不是 MySQL？

**A**: 
- 部署简单，无需独立数据库服务器
- 单文件存储，易于备份
- 适合中小规模应用
- 可以轻松迁移到其他数据库

### Q29: 为什么使用 TypeScript？

**A**: 
- 类型安全，减少错误
- 更好的 IDE 支持
- 代码可维护性高
- 符合现代开发趋势

### Q30: 可以用 JavaScript 代替 TypeScript 吗？

**A**: 技术上可以，但不推荐。TypeScript 提供了类型安全和更好的开发体验。

## 其他问题

### Q31: 系统有移动 App 吗？

**A**: 当前只有响应式网页版，完美支持移动浏览器。未来可能开发独立的移动 App。

### Q32: 可以集成到现有系统吗？

**A**: 可以。系统提供 RESTful API，可以与其他系统集成。

### Q33: 支持国际化吗？

**A**: 当前版本仅支持中文。如需其他语言，需要添加国际化框架。

### Q34: 如何获得技术支持？

**A**: 
1. 查看文档
2. 搜索已有 Issues
3. 创建新的 Issue
4. 联系开发者

### Q35: 可以商用吗？

**A**: 可以。MIT 许可证允许商业使用，但需保留版权声明。

---

## 找不到答案？

如果您的问题未在此列出：

1. 查看 [README.md](README.md)
2. 查看其他文档
3. 搜索 GitHub Issues
4. 创建新的 Issue

我们会持续更新此 FAQ，添加更多常见问题。

