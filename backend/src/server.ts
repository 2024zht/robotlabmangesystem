import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import authRoutes from './routes/auth';
import userRoutes from './routes/users';
import ruleRoutes from './routes/rules';
import leaveRoutes from './routes/leaves';
import ebookRoutes from './routes/ebooks';
import attendanceRoutes from './routes/attendances';
import equipmentRoutes from './routes/equipment';
import equipmentRequestRoutes from './routes/equipment-requests';
import { startAttendanceScheduler } from './services/scheduler';

// 加载环境变量
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// 中间件
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 路由
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/rules', ruleRoutes);
app.use('/api/leaves', leaveRoutes);
app.use('/api/ebooks', ebookRoutes);
app.use('/api/attendances', attendanceRoutes);
app.use('/api/equipment', equipmentRoutes);
app.use('/api/equipment-requests', equipmentRequestRoutes);

// 健康检查
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// 错误处理中间件
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Error:', err);
  res.status(500).json({ error: '服务器内部错误' });
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  
  // 启动点名定时任务调度器
  startAttendanceScheduler();
});

