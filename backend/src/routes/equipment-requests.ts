import express, { Response } from 'express';
import { db, getAll, getOne, runQuery } from '../database/db';
import { authenticateToken, requireAdmin, AuthRequest } from '../middleware/auth';
import { sendEquipmentRequestEmail, sendEquipmentApprovalEmail, sendEquipmentRejectionEmail } from '../services/email';

const router = express.Router();

// 获取所有借用申请（管理员）
router.get('/', authenticateToken, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { status } = req.query;
    
    let query = `
      SELECT 
        er.*,
        u.name as user_name,
        u.studentId as student_id,
        u.email as user_email,
        u.className as class_name,
        ei.code as equipment_code,
        et.name as equipment_name,
        et.image as equipment_image,
        admin.name as approver_name
      FROM equipment_requests er
      JOIN users u ON er.user_id = u.id
      JOIN equipment_instances ei ON er.equipment_id = ei.id
      JOIN equipment_types et ON ei.type_id = et.id
      LEFT JOIN users admin ON er.approved_by = admin.id
    `;
    
    const params: any[] = [];
    if (status) {
      query += ' WHERE er.status = ?';
      params.push(status);
    }
    
    query += ' ORDER BY er.created_at DESC';
    
    const requests = await getAll(query, params);
    res.json(requests);
  } catch (error) {
    console.error('获取借用申请失败：', error);
    res.status(500).json({ error: '获取借用申请失败' });
  }
});

// 获取我的借用申请
router.get('/my-requests', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const requests = await getAll(`
      SELECT 
        er.*,
        ei.code as equipment_code,
        et.name as equipment_name,
        et.image as equipment_image,
        admin.name as approver_name
      FROM equipment_requests er
      JOIN equipment_instances ei ON er.equipment_id = ei.id
      JOIN equipment_types et ON ei.type_id = et.id
      LEFT JOIN users admin ON er.approved_by = admin.id
      WHERE er.user_id = ?
      ORDER BY er.created_at DESC
    `, [req.user!.userId]);
    
    res.json(requests);
  } catch (error) {
    console.error('获取我的借用申请失败：', error);
    res.status(500).json({ error: '获取我的借用申请失败' });
  }
});

// 获取单个借用申请详情
router.get('/:id', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    
    const request = await getOne<any>(`
      SELECT 
        er.*,
        u.name as user_name,
        u.studentId as student_id,
        u.email as user_email,
        u.className as class_name,
        ei.code as equipment_code,
        ei.status as equipment_status,
        et.name as equipment_name,
        et.image as equipment_image,
        et.description as equipment_description,
        admin.name as approver_name
      FROM equipment_requests er
      JOIN users u ON er.user_id = u.id
      JOIN equipment_instances ei ON er.equipment_id = ei.id
      JOIN equipment_types et ON ei.type_id = et.id
      LEFT JOIN users admin ON er.approved_by = admin.id
      WHERE er.id = ?
    `, [id]);
    
    if (!request) {
      return res.status(404).json({ error: '借用申请不存在' });
    }
    
    // 非管理员只能查看自己的申请
    if (!req.user!.isAdmin && request.user_id !== req.user!.userId) {
      return res.status(403).json({ error: '没有权限查看此申请' });
    }
    
    res.json(request);
  } catch (error) {
    console.error('获取借用申请详情失败：', error);
    res.status(500).json({ error: '获取借用申请详情失败' });
  }
});

// 提交借用申请
router.post('/', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { equipment_id, borrow_date, return_date, reason } = req.body;
    
    // 验证必填字段
    if (!equipment_id || !borrow_date || !return_date || !reason) {
      return res.status(400).json({ error: '请填写完整的申请信息' });
    }
    
    // 验证日期
    const borrowDate = new Date(borrow_date);
    const returnDate = new Date(return_date);
    const now = new Date();
    
    if (borrowDate < now) {
      return res.status(400).json({ error: '借用日期不能早于当前时间' });
    }
    
    if (returnDate <= borrowDate) {
      return res.status(400).json({ error: '归还日期必须晚于借用日期' });
    }
    
    // 检查设备是否存在且可用
    const equipment = await getOne<any>(`
      SELECT ei.*, et.name as type_name
      FROM equipment_instances ei
      JOIN equipment_types et ON ei.type_id = et.id
      WHERE ei.id = ?
    `, [equipment_id]);
    
    if (!equipment) {
      return res.status(404).json({ error: '设备不存在' });
    }
    
    if (equipment.status !== 'available') {
      return res.status(400).json({ error: '该设备当前不可借用' });
    }
    
    // 检查该设备在指定时间段内是否已被预约
    const conflictRequest = await getOne(`
      SELECT id FROM equipment_requests
      WHERE equipment_id = ?
      AND status IN ('pending', 'approved')
      AND (
        (borrow_date <= ? AND return_date >= ?)
        OR (borrow_date <= ? AND return_date >= ?)
        OR (borrow_date >= ? AND return_date <= ?)
      )
    `, [equipment_id, borrow_date, borrow_date, return_date, return_date, borrow_date, return_date]);
    
    if (conflictRequest) {
      return res.status(400).json({ error: '该设备在所选时间段内已被预约' });
    }
    
    // 创建借用申请
    const insertId = await new Promise<number>((resolve, reject) => {
      db.run(
        `INSERT INTO equipment_requests (user_id, equipment_id, borrow_date, return_date, reason, status) VALUES (?, ?, ?, ?, ?, 'pending')`,
        [req.user!.userId, equipment_id, borrow_date, return_date, reason],
        function(err) {
          if (err) reject(err);
          else resolve(this.lastID);
        }
      );
    });
    
    // 获取申请人信息
    const applicant = await getOne<any>(
      `SELECT id, name, email, studentId, className FROM users WHERE id = ?`,
      [req.user!.userId]
    );
    
    // 获取所有管理员邮箱
    const admins = await getAll<any>(
      `SELECT id, name, email FROM users WHERE isAdmin = 1`
    );
    
    // 发送邮件通知给所有管理员
    try {
      await sendEquipmentRequestEmail({
        applicantName: applicant.name,
        studentId: applicant.studentId,
        className: applicant.className,
        equipmentName: equipment.type_name,
        equipmentCode: equipment.code,
        borrowDate: borrow_date,
        returnDate: return_date,
        reason: reason,
        requestId: insertId
      });
      console.log('设备借用申请邮件通知已发送给所有管理员');
    } catch (emailError) {
      console.error('发送邮件通知失败：', emailError);
      // 邮件发送失败不影响申请提交
    }
    
    res.status(201).json({
      message: '借用申请提交成功，请等待管理员审核',
      id: insertId
    });
  } catch (error: any) {
    console.error('提交借用申请失败：', error);
    res.status(500).json({ error: '提交借用申请失败' });
  }
});

// 批准借用申请（管理员）
router.patch('/:id/approve', authenticateToken, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { admin_comment } = req.body;
    
    // 获取申请详情
    const request = await getOne<any>(`
      SELECT 
        er.*,
        u.name as user_name,
        u.email as user_email,
        ei.code as equipment_code,
        ei.status as equipment_status,
        et.name as equipment_name
      FROM equipment_requests er
      JOIN users u ON er.user_id = u.id
      JOIN equipment_instances ei ON er.equipment_id = ei.id
      JOIN equipment_types et ON ei.type_id = et.id
      WHERE er.id = ?
    `, [id]);
    
    if (!request) {
      return res.status(404).json({ error: '借用申请不存在' });
    }
    
    if (request.status !== 'pending') {
      return res.status(400).json({ error: '该申请已被处理' });
    }
    
    // 再次检查设备状态
    if (request.equipment_status !== 'available') {
      return res.status(400).json({ error: '设备当前不可借用' });
    }
    
    const now = new Date().toISOString();
    
    // 更新申请状态
    await runQuery(
      `UPDATE equipment_requests SET status = 'approved', approved_by = ?, approved_at = ?, admin_comment = ? WHERE id = ?`,
      [req.user!.userId, now, admin_comment || null, id]
    );
    
    // 更新设备状态为已借出
    await runQuery(
      `UPDATE equipment_instances SET status = 'borrowed' WHERE id = ?`,
      [request.equipment_id]
    );
    
    // 获取管理员信息
    const admin = await getOne<any>('SELECT name FROM users WHERE id = ?', [req.user!.userId]);
    
    // 发送批准通知邮件给申请人
    sendEquipmentApprovalEmail(
      request.user_email,
      {
        userName: request.user_name,
        equipmentName: request.equipment_name,
        equipmentCode: request.equipment_code,
        borrowDate: request.borrow_date,
        returnDate: request.return_date,
        approverName: admin?.name || '管理员',
        adminComment: admin_comment
      }
    );
    
    res.json({ message: '申请已批准' });
  } catch (error) {
    console.error('批准借用申请失败：', error);
    res.status(500).json({ error: '批准借用申请失败' });
  }
});

// 拒绝借用申请（管理员）
router.patch('/:id/reject', authenticateToken, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { admin_comment } = req.body;
    
    if (!admin_comment) {
      return res.status(400).json({ error: '拒绝申请时必须填写理由' });
    }
    
    // 获取申请详情
    const request = await getOne<any>(`
      SELECT 
        er.*,
        u.name as user_name,
        u.email as user_email,
        ei.code as equipment_code,
        et.name as equipment_name
      FROM equipment_requests er
      JOIN users u ON er.user_id = u.id
      JOIN equipment_instances ei ON er.equipment_id = ei.id
      JOIN equipment_types et ON ei.type_id = et.id
      WHERE er.id = ?
    `, [id]);
    
    if (!request) {
      return res.status(404).json({ error: '借用申请不存在' });
    }
    
    if (request.status !== 'pending') {
      return res.status(400).json({ error: '该申请已被处理' });
    }
    
    const now = new Date().toISOString();
    
    // 更新申请状态
    await runQuery(
      `UPDATE equipment_requests SET status = 'rejected', approved_by = ?, approved_at = ?, admin_comment = ? WHERE id = ?`,
      [req.user!.userId, now, admin_comment, id]
    );
    
    // 获取管理员信息
    const admin = await getOne<any>('SELECT name FROM users WHERE id = ?', [req.user!.userId]);
    
    // 发送拒绝通知邮件给申请人
    sendEquipmentRejectionEmail(
      request.user_email,
      {
        userName: request.user_name,
        equipmentName: request.equipment_name,
        equipmentCode: request.equipment_code,
        borrowDate: request.borrow_date,
        returnDate: request.return_date,
        rejectionReason: admin_comment,
        approverName: admin?.name || '管理员'
      }
    );
    
    res.json({ message: '申请已拒绝' });
  } catch (error) {
    console.error('拒绝借用申请失败：', error);
    res.status(500).json({ error: '拒绝借用申请失败' });
  }
});

// 确认归还设备（管理员）
router.patch('/:id/return', authenticateToken, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { return_notes } = req.body;
    
    // 获取申请详情
    const request = await getOne<any>(`
      SELECT er.*, ei.id as equipment_id
      FROM equipment_requests er
      JOIN equipment_instances ei ON er.equipment_id = ei.id
      WHERE er.id = ?
    `, [id]);
    
    if (!request) {
      return res.status(404).json({ error: '借用申请不存在' });
    }
    
    if (request.status !== 'approved') {
      return res.status(400).json({ error: '只能对已批准的申请执行归还操作' });
    }
    
    const now = new Date().toISOString();
    
    // 更新申请状态为已归还
    await runQuery(
      `UPDATE equipment_requests SET status = 'returned', returned_at = ?, admin_comment = ? WHERE id = ?`,
      [now, return_notes || request.admin_comment, id]
    );
    
    // 更新设备状态为可用
    await runQuery(
      `UPDATE equipment_instances SET status = 'available', notes = ? WHERE id = ?`,
      [return_notes || null, request.equipment_id]
    );
    
    res.json({ message: '设备归还确认成功' });
  } catch (error) {
    console.error('确认设备归还失败：', error);
    res.status(500).json({ error: '确认设备归还失败' });
  }
});

// 取消借用申请（申请人自己）
router.delete('/:id', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    
    const request = await getOne<any>(
      `SELECT * FROM equipment_requests WHERE id = ?`,
      [id]
    );
    
    if (!request) {
      return res.status(404).json({ error: '借用申请不存在' });
    }
    
    // 只能取消自己的申请，且只能取消待审核状态的申请
    if (request.user_id !== req.user!.userId && !req.user!.isAdmin) {
      return res.status(403).json({ error: '没有权限取消此申请' });
    }
    
    if (request.status !== 'pending') {
      return res.status(400).json({ error: '只能取消待审核的申请' });
    }
    
    await runQuery('DELETE FROM equipment_requests WHERE id = ?', [id]);
    
    res.json({ message: '申请已取消' });
  } catch (error) {
    console.error('取消借用申请失败：', error);
    res.status(500).json({ error: '取消借用申请失败' });
  }
});

export default router;
