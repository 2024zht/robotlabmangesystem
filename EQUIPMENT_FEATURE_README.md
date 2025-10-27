# 设备借用管理功能 - 快速开始 🚀

## 功能亮点

✅ **完整的设备借用流程** - 从申请到归还的全生命周期管理  
✅ **实时状态跟踪** - 设备状态自动更新  
✅ **邮件自动通知** - 申请提交和审批结果即时推送  
✅ **权限控制** - 用户和管理员功能分离  
✅ **初始数据** - 已预置 3 种设备类型共 91 个设备实例

---

## 快速部署（3步完成）

### 1️⃣ 运行数据库迁移

```bash
cd /www/wwwroot/robotlab-manage/backend

# 添加设备相关表
npx ts-node src/database/migrate-add-equipment.ts

# 导入初始设备数据（NAO、小车、树莓派）
npx ts-node src/database/init-equipment-data.ts
```

### 2️⃣ 构建并重启服务

```bash
# 后端
cd /www/wwwroot/robotlab-manage/backend
npm run build
pm2 restart robotlab-backend

# 前端
cd ../frontend
npm run build

# 重载 Nginx
nginx -s reload
```

### 3️⃣ 验证功能

访问 `http://your-domain.com`，你会看到：
- 用户：导航栏新增"设备借用"入口
- 管理员：导航栏新增"设备管理"入口

---

## 功能演示

### 👤 用户端功能

1. **浏览设备**
   - 点击"设备借用"
   - 查看所有设备类型（NAO机器人、智能小车、树莓派）
   - 实时显示每种设备的可用数量

2. **申请借用**
   - 点击设备类型查看具体设备列表
   - 选择状态为"可借用"的设备
   - 填写借用表单：
     - 借用时间
     - 归还时间
     - 借用事由
   - 提交申请

3. **查看申请记录**
   - 点击"我的申请"
   - 查看所有申请及状态
   - 待审核申请可取消

### 👨‍💼 管理员端功能

1. **审批借用申请**
   - 点击"设备管理"
   - 查看待审核申请列表
   - 点击"审批"按钮
   - 选择批准或拒绝（拒绝需填写理由）

2. **确认设备归还**
   - 在"已批准"列表中找到对应申请
   - 用户归还设备后点击"确认归还"
   - 设备状态自动变回"可用"

3. **管理设备类型**
   - 切换到"设备类型管理"标签
   - 查看所有设备类型
   - （可扩展：添加、编辑、删除设备类型）

---

## 初始设备数据

系统已预置以下设备：

| 设备类型 | 数量 | 设备编号范围 |
|---------|------|-------------|
| NAO机器人 V6 | 11台 | NAO-001 ~ NAO-011 |
| 智能小车 | 40个 | CAR-001 ~ CAR-040 |
| 树莓派开发套件 | 40套 | RASP-001 ~ RASP-040 |

**总计：91 个设备实例**

---

## 邮件通知

系统会在以下情况自动发送邮件：

| 场景 | 收件人 | 内容 |
|------|--------|------|
| 新申请提交 | 所有管理员 | 申请人信息、设备、时间、事由 |
| 申请被批准 | 申请人 | 设备信息、借用时间、管理员备注 |
| 申请被拒绝 | 申请人 | 拒绝理由、审批人 |

**注意**：确保 `.env` 文件中配置了正确的邮件设置。

---

## API 接口（供参考）

### 用户接口
```
GET  /api/equipment/types                    # 获取设备类型列表
GET  /api/equipment/instances/type/:typeId   # 获取设备实例
POST /api/equipment-requests                 # 提交借用申请
GET  /api/equipment-requests/my-requests     # 我的申请
```

### 管理员接口
```
GET   /api/equipment-requests                # 所有申请
PATCH /api/equipment-requests/:id/approve    # 批准申请
PATCH /api/equipment-requests/:id/reject     # 拒绝申请
PATCH /api/equipment-requests/:id/return     # 确认归还
```

---

## 故障排除

### ❌ 迁移失败
```bash
# 检查数据库权限
chmod 666 backend/database.sqlite
chmod 755 backend/
```

### ❌ 前端无法访问
```bash
# 检查后端是否运行
pm2 status
pm2 logs robotlab-backend

# 检查 Nginx 配置
nginx -t
```

### ❌ 邮件未发送
```bash
# 查看后端日志
pm2 logs robotlab-backend

# 检查 .env 配置
cat backend/.env | grep SMTP
```

---

## 技术栈

### 后端
- **框架**：Express.js + TypeScript
- **数据库**：SQLite3
- **认证**：JWT
- **邮件**：Nodemailer
- **文件上传**：Multer

### 前端
- **框架**：React 18 + TypeScript
- **路由**：React Router v6
- **HTTP客户端**：Axios
- **UI**：Tailwind CSS + Lucide Icons
- **构建**：Vite

---

## 文件结构

```
backend/
  ├── src/
  │   ├── database/
  │   │   ├── migrate-add-equipment.ts      # 数据库迁移
  │   │   └── init-equipment-data.ts        # 初始数据
  │   ├── routes/
  │   │   ├── equipment.ts                  # 设备类型/实例 API
  │   │   └── equipment-requests.ts         # 借用申请 API
  │   ├── services/
  │   │   └── email.ts                      # 邮件通知（已扩展）
  │   └── types/
  │       └── index.ts                      # 类型定义（已扩展）
  └── uploads/
      └── equipment/                        # 设备图片存储

frontend/
  ├── src/
  │   ├── components/
  │   │   ├── Equipment.tsx                 # 用户设备借用页面
  │   │   ├── EquipmentManagement.tsx       # 管理员设备管理页面
  │   │   └── Layout.tsx                    # 导航菜单（已更新）
  │   ├── services/
  │   │   └── api.ts                        # API调用（已扩展）
  │   └── types/
  │       └── index.ts                      # 类型定义（已扩展）
```

---

## 下一步优化建议

如果需要进一步扩展功能，可以考虑：

1. **设备图片上传** - 在管理界面添加图片上传功能
2. **借用历史统计** - 统计每个设备的借用频率
3. **借用时长限制** - 设置最长借用时间
4. **设备预约** - 允许提前预约未来时间段
5. **设备维护记录** - 记录设备维修历史
6. **批量导入设备** - 通过 CSV 批量添加设备
7. **借用合同生成** - 自动生成借用协议PDF

---

## 支持与反馈

- 📖 详细部署指南：查看 `设备借用功能部署指南.md`
- 🐛 问题反馈：检查后端日志和 Nginx 错误日志
- 📧 邮件配置：参考 `backend/.env.example`

---

## 完成清单

- [x] 数据库表创建
- [x] 后端 API 实现
- [x] 邮件通知功能
- [x] 前端用户界面
- [x] 前端管理界面
- [x] 路由和导航
- [x] 初始数据导入
- [x] 部署文档

**状态：✅ 已完成并可部署**

---

祝你使用愉快！🎉 如有问题，欢迎随时提问。

