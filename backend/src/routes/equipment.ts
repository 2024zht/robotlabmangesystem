import express, { Response } from 'express';
import { db, getAll, getOne, runQuery } from '../database/db';
import { authenticateToken, requireAdmin, AuthRequest } from '../middleware/auth';
import multer from 'multer';
import path from 'path';
import fs from 'fs';

const router = express.Router();

// 配置图片上传 - 保存到 frontend/public 文件夹
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    // 保存到 frontend/public 文件夹，这样图片可以通过前端直接访问
    const uploadDir = path.join(__dirname, '../../../frontend/public');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    // 生成唯一文件名
    const uniqueName = `equipment-${Date.now()}-${Math.random().toString(36).substring(7)}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|webp/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    
    if (extname && mimetype) {
      cb(null, true);
    } else {
      cb(new Error('只允许上传图片文件 (jpeg, jpg, png, gif, webp)'));
    }
  }
});

// ==================== 设备类型 API ====================

// 获取所有设备类型（包含可用数量统计）
router.get('/types', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const types = await getAll(`
      SELECT 
        et.*,
        COUNT(CASE WHEN ei.status = 'available' THEN 1 END) as available_count
      FROM equipment_types et
      LEFT JOIN equipment_instances ei ON et.id = ei.type_id
      GROUP BY et.id
      ORDER BY et.id
    `);

    res.json(types);
  } catch (error) {
    console.error('获取设备类型失败：', error);
    res.status(500).json({ error: '获取设备类型失败' });
  }
});

// 获取单个设备类型详情
router.get('/types/:id', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    
    const type = await getOne(`
      SELECT 
        et.*,
        COUNT(CASE WHEN ei.status = 'available' THEN 1 END) as available_count
      FROM equipment_types et
      LEFT JOIN equipment_instances ei ON et.id = ei.type_id
      WHERE et.id = ?
      GROUP BY et.id
    `, [id]);

    if (!type) {
      return res.status(404).json({ error: '设备类型不存在' });
    }

    res.json(type);
  } catch (error) {
    console.error('获取设备类型详情失败：', error);
    res.status(500).json({ error: '获取设备类型详情失败' });
  }
});

// 创建设备类型（管理员）
router.post('/types', authenticateToken, requireAdmin, upload.single('image'), async (req: AuthRequest, res: Response) => {
  try {
    const { name, description } = req.body;
    // 图片路径改为相对路径，直接使用文件名
    const image = req.file ? `/${req.file.filename}` : null;

    if (!name) {
      return res.status(400).json({ error: '设备名称为必填项' });
    }

    // 自动计算 total_count 为 0，管理员可以后续添加设备实例
    const insertId = await new Promise<number>((resolve, reject) => {
      db.run(
        `INSERT INTO equipment_types (name, image, description, total_count) VALUES (?, ?, ?, 0)`,
        [name, image, description || ''],
        function(err) {
          if (err) reject(err);
          else resolve(this.lastID);
        }
      );
    });

    res.status(201).json({
      message: '设备类型创建成功',
      id: insertId
    });
  } catch (error) {
    console.error('创建设备类型失败：', error);
    res.status(500).json({ error: '创建设备类型失败' });
  }
});

// 更新设备类型（管理员）
router.put('/types/:id', authenticateToken, requireAdmin, upload.single('image'), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { name, description, total_count } = req.body;
    // 图片路径改为相对路径，直接使用文件名
    const image = req.file ? `/${req.file.filename}` : undefined;

    const existing = await getOne<any>('SELECT * FROM equipment_types WHERE id = ?', [id]);
    if (!existing) {
      return res.status(404).json({ error: '设备类型不存在' });
    }

    // 构建更新语句
    let updateFields = [];
    let params = [];
    
    if (name) {
      updateFields.push('name = ?');
      params.push(name);
    }
    if (description !== undefined) {
      updateFields.push('description = ?');
      params.push(description);
    }
    if (total_count) {
      updateFields.push('total_count = ?');
      params.push(parseInt(total_count));
    }
    if (image) {
      updateFields.push('image = ?');
      params.push(image);
      
      // 删除旧图片（仅删除上传的图片，不删除 public 中的原始资源图片）
      if (existing.image && existing.image.startsWith('/equipment-')) {
        const oldImagePath = path.join(__dirname, '../../../frontend/public', existing.image);
        if (fs.existsSync(oldImagePath)) {
          fs.unlinkSync(oldImagePath);
        }
      }
    }

    params.push(id);
    
    await runQuery(
      `UPDATE equipment_types SET ${updateFields.join(', ')} WHERE id = ?`,
      params
    );

    res.json({ message: '设备类型更新成功' });
  } catch (error) {
    console.error('更新设备类型失败：', error);
    res.status(500).json({ error: '更新设备类型失败' });
  }
});

// 删除设备类型（管理员）
router.delete('/types/:id', authenticateToken, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    // 检查是否有关联的设备实例
    const instanceCount = await getOne<{ count: number }>(
      'SELECT COUNT(*) as count FROM equipment_instances WHERE type_id = ?',
      [id]
    );

    if (instanceCount && instanceCount.count > 0) {
      return res.status(400).json({ 
        error: '无法删除：该设备类型下还有设备实例，请先删除所有设备实例' 
      });
    }

    const changes = await new Promise<number>((resolve, reject) => {
      db.run('DELETE FROM equipment_types WHERE id = ?', [id], function(err) {
        if (err) reject(err);
        else resolve(this.changes);
      });
    });

    if (changes === 0) {
      return res.status(404).json({ error: '设备类型不存在' });
    }

    res.json({ message: '设备类型删除成功' });
  } catch (error) {
    console.error('删除设备类型失败：', error);
    res.status(500).json({ error: '删除设备类型失败' });
  }
});

// ==================== 设备实例 API ====================

// 获取指定类型的所有设备实例
router.get('/instances/type/:typeId', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { typeId } = req.params;
    
    const instances = await getAll(`
      SELECT 
        ei.*,
        et.name as type_name
      FROM equipment_instances ei
      JOIN equipment_types et ON ei.type_id = et.id
      WHERE ei.type_id = ?
      ORDER BY ei.code
    `, [typeId]);

    res.json(instances);
  } catch (error) {
    console.error('获取设备实例失败：', error);
    res.status(500).json({ error: '获取设备实例失败' });
  }
});

// 获取设备实例详情（包含借用历史）
router.get('/instances/:id', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    
    const instance = await getOne(`
      SELECT 
        ei.*,
        et.name as type_name,
        et.image as type_image,
        et.description as type_description
      FROM equipment_instances ei
      JOIN equipment_types et ON ei.type_id = et.id
      WHERE ei.id = ?
    `, [id]);

    if (!instance) {
      return res.status(404).json({ error: '设备不存在' });
    }

    // 获取借用历史
    const history = await getAll(`
      SELECT 
        er.*,
        u.name as user_name,
        u.studentId as student_id,
        admin.name as approver_name
      FROM equipment_requests er
      JOIN users u ON er.user_id = u.id
      LEFT JOIN users admin ON er.approved_by = admin.id
      WHERE er.equipment_id = ?
      ORDER BY er.created_at DESC
    `, [id]);

    res.json({ ...instance, history });
  } catch (error) {
    console.error('获取设备实例详情失败：', error);
    res.status(500).json({ error: '获取设备实例详情失败' });
  }
});

// 创建设备实例（管理员）
router.post('/instances', authenticateToken, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { type_id, code, notes } = req.body;

    if (!type_id || !code) {
      return res.status(400).json({ error: '设备类型和编号为必填项' });
    }

    // 检查编号是否已存在
    const existing = await getOne('SELECT id FROM equipment_instances WHERE code = ?', [code]);
    if (existing) {
      return res.status(400).json({ error: '设备编号已存在' });
    }

    const insertId = await new Promise<number>((resolve, reject) => {
      db.run(
        `INSERT INTO equipment_instances (type_id, code, notes, status) VALUES (?, ?, ?, 'available')`,
        [type_id, code, notes || null],
        function(err) {
          if (err) reject(err);
          else resolve(this.lastID);
        }
      );
    });

    res.status(201).json({
      message: '设备实例创建成功',
      id: insertId
    });
  } catch (error) {
    console.error('创建设备实例失败：', error);
    res.status(500).json({ error: '创建设备实例失败' });
  }
});

// 批量创建设备实例（管理员）
router.post('/instances/batch', authenticateToken, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { type_id, prefix, start, count } = req.body;

    if (!type_id || !prefix || start === undefined || !count) {
      return res.status(400).json({ error: '参数不完整' });
    }

    for (let i = 0; i < count; i++) {
      const num = start + i;
      const code = `${prefix}-${String(num).padStart(3, '0')}`;
      await runQuery(
        `INSERT INTO equipment_instances (type_id, code, status) VALUES (?, ?, 'available')`,
        [type_id, code]
      );
    }

    res.status(201).json({
      message: `成功创建 ${count} 个设备实例`,
      count
    });
  } catch (error) {
    console.error('批量创建设备实例失败：', error);
    res.status(500).json({ error: '批量创建设备实例失败' });
  }
});

// 更新设备实例状态（管理员）
router.patch('/instances/:id/status', authenticateToken, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { status, notes } = req.body;

    if (!['available', 'borrowed', 'maintenance'].includes(status)) {
      return res.status(400).json({ error: '无效的设备状态' });
    }

    await runQuery(
      `UPDATE equipment_instances SET status = ?, notes = ? WHERE id = ?`,
      [status, notes || null, id]
    );

    res.json({ message: '设备状态更新成功' });
  } catch (error) {
    console.error('更新设备状态失败：', error);
    res.status(500).json({ error: '更新设备状态失败' });
  }
});

// 删除设备实例（管理员）
router.delete('/instances/:id', authenticateToken, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    // 检查是否有未完成的借用记录
    const activeRequest = await getOne(`
      SELECT id FROM equipment_requests 
      WHERE equipment_id = ? AND status IN ('pending', 'approved')
    `, [id]);

    if (activeRequest) {
      return res.status(400).json({ 
        error: '无法删除：该设备有未完成的借用记录' 
      });
    }

    const changes = await new Promise<number>((resolve, reject) => {
      db.run('DELETE FROM equipment_instances WHERE id = ?', [id], function(err) {
        if (err) reject(err);
        else resolve(this.changes);
      });
    });

    if (changes === 0) {
      return res.status(404).json({ error: '设备不存在' });
    }

    res.json({ message: '设备删除成功' });
  } catch (error) {
    console.error('删除设备失败：', error);
    res.status(500).json({ error: '删除设备失败' });
  }
});

export default router;
