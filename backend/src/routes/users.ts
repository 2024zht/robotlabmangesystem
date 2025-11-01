import express, { Response } from 'express';
import { getAll, getOne, runQuery, db } from '../database/db';
import { User } from '../types';
import { authenticateToken, requireAdmin, AuthRequest } from '../middleware/auth';
import bcrypt from 'bcryptjs';
import { sendPointRequestNotification, sendPointRequestSubmitNotification } from '../services/email';

const router = express.Router();

// 获取所有用户及积分排名
router.get('/', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const users = await getAll<Omit<User, 'password'>>(
      'SELECT id, username, name, studentId, className, email, phone, isAdmin, isSuperAdmin, isMember, points, grade, createdAt FROM users ORDER BY points DESC'
    );
    res.json(users);
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ error: '服务器错误' });
  }
});

// 获取当前用户信息
router.get('/me', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const user = await getOne<Omit<User, 'password'>>(
      'SELECT id, username, name, studentId, className, email, phone, isAdmin, isSuperAdmin, isMember, points, grade, createdAt FROM users WHERE id = ?',
      [req.user!.userId]
    );
    
    if (!user) {
      return res.status(404).json({ error: '用户不存在' });
    }
    
    res.json(user);
  } catch (error) {
    console.error('Get user info error:', error);
    res.status(500).json({ error: '服务器错误' });
  }
});

// 删除用户（管理员）
router.delete('/:id', authenticateToken, requireAdmin, async (req: AuthRequest, res: Response) => {
  const userId = parseInt(req.params.id);

  if (userId === req.user!.userId) {
    return res.status(400).json({ error: '不能删除自己的账户' });
  }

  try {
    await runQuery('DELETE FROM users WHERE id = ?', [userId]);
    await runQuery('DELETE FROM point_logs WHERE userId = ?', [userId]);
    res.json({ message: '用户已删除' });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({ error: '服务器错误' });
  }
});

// 修改用户积分（管理员）
router.patch('/:id/points', authenticateToken, requireAdmin, async (req: AuthRequest, res: Response) => {
  const userId = parseInt(req.params.id);
  const { points, reason } = req.body;

  if (typeof points !== 'number') {
    return res.status(400).json({ error: '积分必须是数字' });
  }

  // 验证单次积分修改不超过200分（正负）
  if (Math.abs(points) > 200) {
    return res.status(400).json({ error: '单次积分修改不能超过200分（加分或扣分）' });
  }

  try {
    // 获取目标用户信息
    const user = await getOne<User>('SELECT points, isAdmin, isSuperAdmin FROM users WHERE id = ?', [userId]);
    
    if (!user) {
      return res.status(404).json({ error: '用户不存在' });
    }

    // 权限检查：普通管理员不能修改其他管理员
    if (user.isAdmin && !req.user!.isSuperAdmin) {
      return res.status(403).json({ error: '没有权限修改管理员的积分，请联系超级管理员' });
    }

    const newPoints = user.points + points;

    // 更新积分
    await runQuery('UPDATE users SET points = ? WHERE id = ?', [newPoints, userId]);

    // 记录积分变动
    await runQuery(
      'INSERT INTO point_logs (userId, points, reason, createdBy, createdAt) VALUES (?, ?, ?, ?, datetime(\'now\', \'localtime\'))',
      [userId, points, reason || '管理员调整', req.user!.userId]
    );

    res.json({ message: '积分已更新', newPoints });
  } catch (error) {
    console.error('Update points error:', error);
    res.status(500).json({ error: '服务器错误' });
  }
});

// 撤销积分修改（管理员）
router.delete('/point-logs/:logId', authenticateToken, requireAdmin, async (req: AuthRequest, res: Response) => {
  const logId = parseInt(req.params.logId);

  try {
    // 获取积分记录
    const log = await getOne<{id: number, userId: number, points: number, reason: string, createdAt: string, createdBy: number}>(
      'SELECT * FROM point_logs WHERE id = ?',
      [logId]
    );

    if (!log) {
      return res.status(404).json({ error: '积分记录不存在' });
    }

    // 获取用户当前积分
    const user = await getOne<{points: number}>('SELECT points FROM users WHERE id = ?', [log.userId]);
    
    if (!user) {
      return res.status(404).json({ error: '用户不存在' });
    }

    // 撤销积分变动（减去原来的积分变动）
    const newPoints = user.points - log.points;
    await runQuery('UPDATE users SET points = ? WHERE id = ?', [newPoints, log.userId]);

    // 删除积分记录
    await runQuery('DELETE FROM point_logs WHERE id = ?', [logId]);

    res.json({ 
      message: '积分修改已撤销', 
      newPoints,
      originalLog: log
    });
  } catch (error) {
    console.error('Revert points error:', error);
    res.status(500).json({ error: '服务器错误' });
  }
});

// 设置管理员权限（管理员）
router.patch('/:id/admin', authenticateToken, requireAdmin, async (req: AuthRequest, res: Response) => {
  const userId = parseInt(req.params.id);
  const { isAdmin } = req.body;

  if (typeof isAdmin !== 'boolean') {
    return res.status(400).json({ error: 'isAdmin必须是布尔值' });
  }

  try {
    // 获取目标用户信息
    const targetUser = await getOne<User>('SELECT isAdmin, isSuperAdmin FROM users WHERE id = ?', [userId]);
    
    if (!targetUser) {
      return res.status(404).json({ error: '用户不存在' });
    }

    // 权限检查：普通管理员不能修改其他管理员的权限
    if (targetUser.isAdmin && !req.user!.isSuperAdmin) {
      return res.status(403).json({ error: '没有权限修改管理员的权限，请联系超级管理员' });
    }

    // 不能移除超级管理员的管理员权限
    if (targetUser.isSuperAdmin && !isAdmin) {
      return res.status(403).json({ error: '不能移除超级管理员的管理员权限' });
    }

    // 只有超级管理员可以设置或取消管理员权限
    if (!req.user!.isSuperAdmin) {
      return res.status(403).json({ error: '只有超级管理员可以设置或取消管理员权限' });
    }

    await runQuery('UPDATE users SET isAdmin = ? WHERE id = ?', [isAdmin ? 1 : 0, userId]);
    res.json({ message: '权限已更新' });
  } catch (error) {
    console.error('Update admin error:', error);
    res.status(500).json({ error: '服务器错误' });
  }
});

// 更新个人信息（用户自己）
router.patch('/me/profile', authenticateToken, async (req: AuthRequest, res: Response) => {
  const { name, email, phone, className } = req.body;
  const userId = req.user!.userId;

  try {
    // 构建更新字段
    const updates: string[] = [];
    const values: any[] = [];

    if (name !== undefined && name.trim()) {
      updates.push('name = ?');
      values.push(name.trim());
    }
    if (email !== undefined && email.trim()) {
      updates.push('email = ?');
      values.push(email.trim());
    }
    if (phone !== undefined && phone.trim()) {
      updates.push('phone = ?');
      values.push(phone.trim());
    }
    if (className !== undefined && className.trim()) {
      updates.push('className = ?');
      values.push(className.trim());
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: '没有需要更新的字段' });
    }

    values.push(userId);
    const sql = `UPDATE users SET ${updates.join(', ')} WHERE id = ?`;
    await runQuery(sql, values);

    // 返回更新后的用户信息
    const updatedUser = await getOne<Omit<User, 'password'>>(
      'SELECT id, username, name, studentId, className, email, phone, isAdmin, isMember, points, grade, createdAt FROM users WHERE id = ?',
      [userId]
    );

    res.json({ message: '个人信息已更新', user: updatedUser });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ error: '服务器错误' });
  }
});

// 修改自己的密码（用户自己）
router.patch('/me/password', authenticateToken, async (req: AuthRequest, res: Response) => {
  const { currentPassword, newPassword } = req.body;
  const userId = req.user!.userId;

  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: '请提供当前密码和新密码' });
  }

  if (newPassword.length < 6) {
    return res.status(400).json({ error: '新密码长度至少6位' });
  }

  try {
    // 获取用户当前密码
    const user = await getOne<User>('SELECT * FROM users WHERE id = ?', [userId]);
    if (!user) {
      return res.status(404).json({ error: '用户不存在' });
    }

    // 验证当前密码
    const validPassword = await bcrypt.compare(currentPassword, user.password);
    if (!validPassword) {
      return res.status(401).json({ error: '当前密码错误' });
    }

    // 加密新密码
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // 更新密码
    await runQuery('UPDATE users SET password = ? WHERE id = ?', [hashedPassword, userId]);

    res.json({ message: '密码已更新' });
  } catch (error) {
    console.error('Update password error:', error);
    res.status(500).json({ error: '服务器错误' });
  }
});

// 修改用户密码（管理员）
router.patch('/:id/password', authenticateToken, requireAdmin, async (req: AuthRequest, res: Response) => {
  const userId = parseInt(req.params.id);
  const { newPassword } = req.body;

  if (!newPassword || newPassword.length < 6) {
    return res.status(400).json({ error: '密码长度至少6位' });
  }

  try {
    // 检查用户是否存在
    const user = await getOne<{id: number}>('SELECT id FROM users WHERE id = ?', [userId]);
    if (!user) {
      return res.status(404).json({ error: '用户不存在' });
    }

    // 加密新密码
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // 更新密码
    await runQuery('UPDATE users SET password = ? WHERE id = ?', [hashedPassword, userId]);

    res.json({ message: '密码已更新' });
  } catch (error) {
    console.error('Update password error:', error);
    res.status(500).json({ error: '服务器错误' });
  }
});

// 获取用户积分日志
router.get('/:id/logs', authenticateToken, async (req: AuthRequest, res: Response) => {
  const userId = parseInt(req.params.id);

  // 只有管理员或本人可以查看积分日志
  if (!req.user!.isAdmin && req.user!.userId !== userId) {
    return res.status(403).json({ error: '没有权限查看此日志' });
  }

  try {
    const logs = await getAll(
      `SELECT pl.*, u.username as createdByUsername 
       FROM point_logs pl 
       LEFT JOIN users u ON pl.createdBy = u.id 
       WHERE pl.userId = ? 
       ORDER BY pl.createdAt DESC`,
      [userId]
    );
    res.json(logs);
  } catch (error) {
    console.error('Get logs error:', error);
    res.status(500).json({ error: '服务器错误' });
  }
});

// 创建积分申诉（用户）
router.post('/requests', authenticateToken, async (req: AuthRequest, res: Response) => {
  const { points, reason } = req.body;

  if (!points || !reason) {
    return res.status(400).json({ error: '请提供积分和理由' });
  }

  try {
    // 获取用户信息
    const user = await getOne<any>(
      'SELECT name, studentId FROM users WHERE id = ?',
      [req.user!.userId]
    );

    if (!user) {
      return res.status(404).json({ error: '用户不存在' });
    }

    // 插入申诉记录
    const requestId = await new Promise<number>((resolve, reject) => {
      db.run(
        'INSERT INTO point_requests (userId, points, reason, status, createdAt) VALUES (?, ?, ?, ?, datetime(\'now\', \'localtime\'))',
        [req.user!.userId, points, reason, 'pending'],
        function (err) {
          if (err) reject(err);
          else resolve(this.lastID);
        }
      );
    });

    // 发送邮件通知管理员
    try {
      await sendPointRequestSubmitNotification(
        user.name,
        user.studentId,
        points,
        reason,
        requestId
      );
      console.log('Point request submit notification sent to admins');
    } catch (emailError) {
      console.error('Failed to send point request submit notification:', emailError);
      // 邮件发送失败不影响申诉提交
    }

    res.status(201).json({ message: '申诉已提交' });
  } catch (error) {
    console.error('Create request error:', error);
    res.status(500).json({ error: '服务器错误' });
  }
});

// 获取我的申诉记录
router.get('/my-requests', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const requests = await getAll(
      `SELECT pr.*, u.username as respondedByUsername 
       FROM point_requests pr
       LEFT JOIN users u ON pr.respondedBy = u.id
       WHERE pr.userId = ?
       ORDER BY pr.createdAt DESC`,
      [req.user!.userId]
    );
    res.json(requests);
  } catch (error) {
    console.error('Get requests error:', error);
    res.status(500).json({ error: '服务器错误' });
  }
});

// 获取所有申诉记录（管理员）
router.get('/requests', authenticateToken, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const requests = await getAll(
      `SELECT pr.*, u.username, u.name, u.studentId, u.className
       FROM point_requests pr
       JOIN users u ON pr.userId = u.id
       ORDER BY 
         CASE pr.status 
           WHEN 'pending' THEN 1
           WHEN 'approved' THEN 2
           WHEN 'rejected' THEN 3
         END,
         pr.createdAt DESC`
    );
    res.json(requests);
  } catch (error) {
    console.error('Get all requests error:', error);
    res.status(500).json({ error: '服务器错误' });
  }
});

// 处理申诉（管理员）
router.patch('/requests/:id', authenticateToken, requireAdmin, async (req: AuthRequest, res: Response) => {
  const requestId = parseInt(req.params.id);
  const { status, adminComment } = req.body;

  if (!['approved', 'rejected'].includes(status)) {
    return res.status(400).json({ error: '无效的状态' });
  }

  try {
    // 获取申诉信息和用户信息
    const request = await getOne<any>(
      `SELECT pr.*, u.email, u.name 
       FROM point_requests pr
       JOIN users u ON pr.userId = u.id
       WHERE pr.id = ?`,
      [requestId]
    );

    if (!request) {
      return res.status(404).json({ error: '申诉不存在' });
    }

    if (request.status !== 'pending') {
      return res.status(400).json({ error: '该申诉已被处理' });
    }

    // 更新申诉状态
    await runQuery(
      'UPDATE point_requests SET status = ?, respondedAt = datetime(\'now\', \'localtime\'), respondedBy = ?, adminComment = ? WHERE id = ?',
      [status, req.user!.userId, adminComment || '', requestId]
    );

    // 如果批准，更新用户积分
    if (status === 'approved') {
      const user = await getOne<User>('SELECT points FROM users WHERE id = ?', [request.userId]);
      if (user) {
        const newPoints = user.points + request.points;
        await runQuery('UPDATE users SET points = ? WHERE id = ?', [newPoints, request.userId]);
        
        // 记录积分变动
        await runQuery(
          'INSERT INTO point_logs (userId, points, reason, createdBy, createdAt) VALUES (?, ?, ?, ?, datetime(\'now\', \'localtime\'))',
          [request.userId, request.points, `申诉通过: ${request.reason}`, req.user!.userId]
        );
      }
    }

    // 发送邮件通知用户
    try {
      await sendPointRequestNotification(
        request.email,
        request.name,
        request.points,
        request.reason,
        status,
        adminComment
      );
      console.log(`Point request notification sent to ${request.email}`);
    } catch (emailError) {
      console.error('Failed to send point request notification:', emailError);
      // 邮件发送失败不影响主流程
    }

    res.json({ message: '申诉处理完成' });
  } catch (error) {
    console.error('Process request error:', error);
    res.status(500).json({ error: '服务器错误' });
  }
});

// 批量导入积分（管理员）
router.post('/batch-import', authenticateToken, requireAdmin, async (req: AuthRequest, res: Response) => {
  const { records, reason } = req.body;

  if (!Array.isArray(records) || records.length === 0) {
    return res.status(400).json({ error: '请提供有效的导入数据' });
  }

  try {
    let successCount = 0;
    let failCount = 0;
    const errors: string[] = [];

    for (const record of records) {
      const { studentId, points } = record;
      
      if (!studentId || points === undefined) {
        failCount++;
        errors.push(`学号 ${studentId || '未知'}: 数据不完整`);
        continue;
      }

      try {
        // 根据学号查找用户
        const user = await getOne<User>('SELECT * FROM users WHERE studentId = ?', [studentId]);
        
        if (!user) {
          failCount++;
          errors.push(`学号 ${studentId}: 用户不存在`);
          continue;
        }

        // 更新积分
        const newPoints = user.points + parseInt(points);
        await runQuery('UPDATE users SET points = ? WHERE id = ?', [newPoints, user.id]);
        
        // 记录积分变动
        await runQuery(
          'INSERT INTO point_logs (userId, points, reason, createdBy, createdAt) VALUES (?, ?, ?, ?, datetime(\'now\', \'localtime\'))',
          [user.id, parseInt(points), reason || '批量导入', req.user!.userId]
        );

        successCount++;
      } catch (err) {
        failCount++;
        errors.push(`学号 ${studentId}: 处理失败`);
      }
    }

    res.json({
      message: '批量导入完成',
      success: successCount,
      failed: failCount,
      errors: errors.length > 0 ? errors : undefined
    });
  } catch (error) {
    console.error('Batch import error:', error);
    res.status(500).json({ error: '服务器错误' });
  }
});

export default router;

