import express, { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { body, validationResult } from 'express-validator';
import { getOne, runQuery } from '../database/db';
import { User, JWTPayload } from '../types';

const router = express.Router();

// 注册
router.post('/register',
  body('username').trim().isLength({ min: 3, max: 30 }).withMessage('用户名长度必须在3-30个字符之间'),
  body('name').trim().notEmpty().withMessage('姓名不能为空'),
  body('studentId').trim().notEmpty().withMessage('学号不能为空'),
  body('className').trim().notEmpty().withMessage('班级不能为空'),
  body('grade').trim().notEmpty().withMessage('年级不能为空'),
  body('email').isEmail().withMessage('邮箱格式不正确'),
  body('phone').trim().notEmpty().withMessage('电话号码不能为空'),
  body('password').isLength({ min: 6 }).withMessage('密码长度至少为6个字符'),
  body('isMember').optional().isBoolean().withMessage('实验室成员标识格式不正确'),
  async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { username, name, studentId, className, grade, email, phone, password, isMember = true } = req.body;

    try {
      // 检查用户名、学号或邮箱是否已存在
      const existingUser = await getOne<User>(
        'SELECT * FROM users WHERE username = ? OR email = ? OR studentId = ?',
        [username, email, studentId]
      );

      if (existingUser) {
        return res.status(400).json({ error: '用户名、学号或邮箱已存在' });
      }

      // 加密密码
      const hashedPassword = await bcrypt.hash(password, 10);

      // 创建用户
      await runQuery(
        'INSERT INTO users (username, name, studentId, className, grade, email, phone, password, isAdmin, isMember, points) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [username, name, studentId, className, grade, email, phone, hashedPassword, 0, isMember ? 1 : 0, 0]
      );

      res.status(201).json({ message: '注册成功' });
    } catch (error) {
      console.error('Registration error:', error);
      res.status(500).json({ error: '服务器错误' });
    }
  }
);

// 登录
router.post('/login',
  body('username').trim().notEmpty().withMessage('用户名不能为空'),
  body('password').notEmpty().withMessage('密码不能为空'),
  async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { username, password } = req.body;

    try {
      // 查找用户
      const user = await getOne<User>(
        'SELECT * FROM users WHERE username = ?',
        [username]
      );

      if (!user) {
        return res.status(401).json({ error: '用户名或密码错误' });
      }

      // 验证密码
      const validPassword = await bcrypt.compare(password, user.password);
      if (!validPassword) {
        return res.status(401).json({ error: '用户名或密码错误' });
      }

      // 生成JWT
      const secret = process.env.JWT_SECRET || 'default-secret-key';
      const payload: JWTPayload = {
        userId: user.id,
        username: user.username,
        isAdmin: Boolean(user.isAdmin),
        isSuperAdmin: Boolean(user.isSuperAdmin)
      };
      const token = jwt.sign(payload, secret, { expiresIn: '7d' });

      res.json({
        token,
        user: {
          id: user.id,
          username: user.username,
          name: user.name,
          studentId: user.studentId,
          className: user.className,
          grade: user.grade,
          email: user.email,
          phone: user.phone,
          isAdmin: Boolean(user.isAdmin),
          isSuperAdmin: Boolean(user.isSuperAdmin),
          isMember: Boolean(user.isMember),
          points: user.points
        }
      });
    } catch (error) {
      console.error('Login error:', error);
      res.status(500).json({ error: '服务器错误' });
    }
  }
);

export default router;

