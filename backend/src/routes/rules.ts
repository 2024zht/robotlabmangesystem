import express, { Response } from 'express';
import { getAll, getOne, runQuery } from '../database/db';
import { Rule } from '../types';
import { authenticateToken, requireAdmin, AuthRequest } from '../middleware/auth';
import { body, validationResult } from 'express-validator';

const router = express.Router();

// 获取所有规则
router.get('/', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const rules = await getAll<Rule>('SELECT * FROM rules ORDER BY createdAt DESC');
    res.json(rules);
  } catch (error) {
    console.error('Get rules error:', error);
    res.status(500).json({ error: '服务器错误' });
  }
});

// 获取单个规则
router.get('/:id', authenticateToken, async (req: AuthRequest, res: Response) => {
  const ruleId = parseInt(req.params.id);

  try {
    const rule = await getOne<Rule>('SELECT * FROM rules WHERE id = ?', [ruleId]);
    
    if (!rule) {
      return res.status(404).json({ error: '规则不存在' });
    }
    
    res.json(rule);
  } catch (error) {
    console.error('Get rule error:', error);
    res.status(500).json({ error: '服务器错误' });
  }
});

// 创建规则（管理员）
router.post('/',
  authenticateToken,
  requireAdmin,
  body('name').trim().notEmpty().withMessage('规则名称不能为空'),
  body('points').isInt().withMessage('积分必须是整数'),
  body('description').optional().trim(),
  async (req: AuthRequest, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { name, points, description } = req.body;

    try {
      await runQuery(
        'INSERT INTO rules (name, points, description) VALUES (?, ?, ?)',
        [name, points, description || '']
      );
      res.status(201).json({ message: '规则已创建' });
    } catch (error) {
      console.error('Create rule error:', error);
      res.status(500).json({ error: '服务器错误' });
    }
  }
);

// 更新规则（管理员）
router.put('/:id',
  authenticateToken,
  requireAdmin,
  body('name').trim().notEmpty().withMessage('规则名称不能为空'),
  body('points').isInt().withMessage('积分必须是整数'),
  body('description').optional().trim(),
  async (req: AuthRequest, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const ruleId = parseInt(req.params.id);
    const { name, points, description } = req.body;

    try {
      const rule = await getOne<Rule>('SELECT * FROM rules WHERE id = ?', [ruleId]);
      
      if (!rule) {
        return res.status(404).json({ error: '规则不存在' });
      }

      await runQuery(
        'UPDATE rules SET name = ?, points = ?, description = ? WHERE id = ?',
        [name, points, description || '', ruleId]
      );
      
      res.json({ message: '规则已更新' });
    } catch (error) {
      console.error('Update rule error:', error);
      res.status(500).json({ error: '服务器错误' });
    }
  }
);

// 删除规则（管理员）
router.delete('/:id', authenticateToken, requireAdmin, async (req: AuthRequest, res: Response) => {
  const ruleId = parseInt(req.params.id);

  try {
    await runQuery('DELETE FROM rules WHERE id = ?', [ruleId]);
    res.json({ message: '规则已删除' });
  } catch (error) {
    console.error('Delete rule error:', error);
    res.status(500).json({ error: '服务器错误' });
  }
});

export default router;

