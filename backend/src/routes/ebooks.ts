import { Router, Response } from 'express';
import { db } from '../database/db';
import { authenticateToken, requireAdmin, AuthRequest } from '../middleware/auth';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { exec } from 'child_process';
import { promisify } from 'util';
import axios from 'axios';

const execAsync = promisify(exec);
const router = Router();

// 从Cloudflare Worker获取电子书列表
const fetchBooksFromWorker = async () => {
  const workerUrl = process.env.CF_WORKER_URL || 'https://divine-glade-0efd.hengtangzhao.workers.dev/api';
  
  try {
    const response = await axios.get(workerUrl + '/', {
      timeout: 5000, // 5秒超时
      headers: {
        'User-Agent': 'RobotLab-Management-System',
      }
    });
    
    // 解析XML
    const xml = response.data;
    const books: any[] = [];
    
    // 简单的XML解析（提取Key和Size）
    const keyMatches = xml.matchAll(/<Key>(.*?)<\/Key>/g);
    const sizeMatches = xml.matchAll(/<Size>(.*?)<\/Size>/g);
    const modifiedMatches = xml.matchAll(/<LastModified>(.*?)<\/LastModified>/g);
    
    const keys = Array.from(keyMatches).map((m) => (m as RegExpMatchArray)[1]);
    const sizes = Array.from(sizeMatches).map((m) => parseInt((m as RegExpMatchArray)[1]));
    const dates = Array.from(modifiedMatches).map((m) => (m as RegExpMatchArray)[1]);
    
    for (let i = 0; i < keys.length; i++) {
      books.push({
        id: i + 1, // 为Worker数据添加临时ID
        filename: keys[i],
        originalName: keys[i],
        fileSize: sizes[i],
        uploadedAt: dates[i],
        b2Synced: true,
        fromWorker: true // 标记为从Worker获取的数据
      });
    }
    
    return books;
  } catch (error: any) {
    // 抛出异常以便上层处理
    console.error('Failed to fetch books from Worker:', error.message || error);
    throw new Error(`Worker connection failed: ${error.message || 'Network error'}`);
  }
};

// 配置multer用于文件上传
const storage = multer.diskStorage({
  destination: function (req: Express.Request, file: Express.Multer.File, cb: (error: Error | null, destination: string) => void) {
    const uploadDir = path.join(process.cwd(), 'uploads', 'ebooks');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: function (req: Express.Request, file: Express.Multer.File, cb: (error: Error | null, filename: string) => void) {
    // 使用时间戳和原始文件名
    // 确保文件名使用 UTF-8 编码
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    
    // 解码文件名（multer可能将其编码为 latin1）
    const originalname = Buffer.from(file.originalname, 'latin1').toString('utf8');
    
    cb(null, uniqueSuffix + '-' + originalname);
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 500 * 1024 * 1024 // 500MB
  },
  fileFilter: (req: Express.Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
    // 允许的文件类型
    const allowedTypes = ['.pdf', '.epub', '.mobi', '.azw3', '.txt', '.doc', '.docx'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowedTypes.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('不支持的文件类型'));
    }
  }
});

// 获取所有电子书列表（只返回本地数据库数据）
router.get('/', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    // 只返回本地数据库中的书籍
    console.log('Fetching books from local database');
    const books = await getLocalBooks();
    res.json(books);
  } catch (error) {
    console.error('Get ebooks error:', error);
    res.status(500).json({ error: '服务器错误' });
  }
});

// 从本地数据库获取电子书列表
const getLocalBooks = async (): Promise<any[]> => {
  return new Promise((resolve, reject) => {
    db.all(
      `SELECT e.id, e.filename, e.originalName, e.fileSize, e.uploadedBy, 
              e.uploadedAt, e.b2Synced, e.b2Path, u.username as uploadedByUsername 
       FROM ebooks e 
       LEFT JOIN users u ON e.uploadedBy = u.id 
       ORDER BY e.uploadedAt DESC`,
      [],
      (err, rows) => {
        if (err) reject(err);
        else {
          console.log('Fetched ebooks from database:', rows?.length || 0);
          resolve(rows || []);
        }
      }
    );
  });
};

// 上传电子书（管理员）
router.post('/upload', authenticateToken, requireAdmin, upload.single('file'), async (req: AuthRequest, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: '没有上传文件' });
    }

    const file = req.file;
    const userId = req.user!.userId;

    // 确保原始文件名使用 UTF-8 编码
    const originalName = Buffer.from(file.originalname, 'latin1').toString('utf8');

    // 1. 保存文件信息到数据库
    const insertId = await new Promise<number>((resolve, reject) => {
      db.run(
        'INSERT INTO ebooks (filename, originalName, fileSize, uploadedBy) VALUES (?, ?, ?, ?)',
        [file.filename, originalName, file.size, userId],
        function (err) {
          if (err) reject(err);
          else resolve(this.lastID);
        }
      );
    });

    // 2. 尝试同步到 Backblaze B2
    let b2Synced = false;
    let b2Path = '';
    let syncError: string | null = null;

    try {
      // 检查环境变量
      const b2Bucket = process.env.B2_BUCKET_NAME;

      // 只有明确配置了 B2 存储桶时才尝试同步（跳过默认值 'robotlib'）
      if (b2Bucket && b2Bucket !== 'robotlib' && b2Bucket.trim() !== '') {
        // 构建安全的命令
        const localPath = file.path;
        const remoteFileName = originalName; // 使用正确编码的文件名

        console.log(`Uploading to B2: ${localPath} -> ${b2Bucket}/${remoteFileName}`);

        // 使用 b2 upload-file 命令（而不是 sync，因为 sync 用于目录）
        // 注意：这需要先运行 b2 authorize-account
        const { stdout, stderr } = await execAsync(
          `b2 upload-file "${b2Bucket}" "${localPath}" "${remoteFileName}"`,
          { timeout: 600000 } // 600秒超时（10分钟），支持大文件上传
        );

        console.log('B2 upload stdout:', stdout);
        if (stderr) console.log('B2 upload stderr:', stderr);

        b2Synced = true;
        b2Path = `b2://${b2Bucket}/${remoteFileName}`;

        // 更新数据库
        await new Promise<void>((resolve, reject) => {
          db.run(
            'UPDATE ebooks SET b2Synced = 1, b2Path = ? WHERE id = ?',
            [b2Path, insertId],
            (err) => {
              if (err) reject(err);
              else resolve();
            }
          );
        });

        // 保留本地文件（用于预览和下载，B2只作为备份）
        console.log('File uploaded to B2 successfully. Local file retained for serving.');
      } else {
        console.log('B2_BUCKET_NAME not configured or set to default, skipping B2 upload. Files will be stored locally.');
        // 不设置 syncError，因为这是预期行为（本地存储模式）
      }
    } catch (error: any) {
      console.error('B2 sync error:', error);
      syncError = error.message || 'B2同步失败';
      // 保留本地文件以便排查
    }

    res.status(201).json({
      message: '文件上传成功',
      id: insertId,
      filename: file.filename,
      originalName: originalName, // 使用正确编码的文件名
      fileSize: file.size,
      b2Synced,
      b2Path,
      syncError,
      needsB2Sync: !b2Synced && !syncError // 是否需要B2同步
    });
  } catch (error) {
    console.error('Upload ebook error:', error);
    // 清理上传的文件
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    res.status(500).json({ error: '上传失败' });
  }
});

// 清理孤儿文件（管理员）- 删除文件系统中存在但数据库中没有记录的文件
router.post('/cleanup-orphans', authenticateToken, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const uploadsDir = path.join(process.cwd(), 'uploads', 'ebooks');
    
    // 确保目录存在
    if (!fs.existsSync(uploadsDir)) {
      return res.json({ message: '上传目录不存在', deletedCount: 0, deletedFiles: [] });
    }

    // 获取数据库中所有的文件名
    const dbFiles = await new Promise<any[]>((resolve, reject) => {
      db.all('SELECT filename FROM ebooks', [], (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });

    const dbFilenames = new Set(dbFiles.map(f => f.filename));

    // 获取文件系统中的所有文件
    const fsFiles = fs.readdirSync(uploadsDir);

    // 找出孤儿文件（在文件系统中但不在数据库中）
    const orphanFiles = fsFiles.filter(file => !dbFilenames.has(file));

    // 删除孤儿文件
    const deletedFiles: string[] = [];
    for (const file of orphanFiles) {
      try {
        const filePath = path.join(uploadsDir, file);
        fs.unlinkSync(filePath);
        deletedFiles.push(file);
        console.log('Deleted orphan file:', file);
      } catch (error) {
        console.error('Failed to delete orphan file:', file, error);
      }
    }

    res.json({
      message: `清理完成，删除了 ${deletedFiles.length} 个孤儿文件`,
      deletedCount: deletedFiles.length,
      deletedFiles: deletedFiles
    });
  } catch (error) {
    console.error('Cleanup orphans error:', error);
    res.status(500).json({ error: '清理失败' });
  }
});

// 删除电子书（管理员）
router.delete('/:id', authenticateToken, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    // 获取电子书信息
    const ebook = await new Promise<any>((resolve, reject) => {
      db.get('SELECT * FROM ebooks WHERE id = ?', [id], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });

    if (!ebook) {
      return res.status(404).json({ error: '电子书不存在' });
    }

    // 删除本地文件（如果存在）
    const localPath = path.join(process.cwd(), 'uploads', 'ebooks', ebook.filename);
    if (fs.existsSync(localPath)) {
      fs.unlinkSync(localPath);
    }

    // 从数据库删除
    await new Promise<void>((resolve, reject) => {
      db.run('DELETE FROM ebooks WHERE id = ?', [id], (err) => {
        if (err) reject(err);
        else resolve();
      });
    });

    res.json({ message: '删除成功' });
  } catch (error) {
    console.error('Delete ebook error:', error);
    res.status(500).json({ error: '删除失败' });
  }
});

// 生成下载链接（已废弃，直接使用 /file/:id 或 /preview/:id）
router.get('/download/:filename', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { filename } = req.params;
    const cfWorkerUrl = process.env.CF_WORKER_URL;
    const b2Bucket = process.env.B2_BUCKET_NAME;
    
    // 如果配置了 Worker（云存储模式），返回 Worker 链接
    if (cfWorkerUrl && b2Bucket && b2Bucket !== 'robotlib' && b2Bucket.trim() !== '') {
      const encodedFilename = encodeURIComponent(decodeURIComponent(filename));
      const downloadUrl = `${cfWorkerUrl}/${encodedFilename}`;
      
      res.json({
        downloadUrl,
        filename: decodeURIComponent(filename)
      });
    } else {
      // 本地存储模式：返回本地下载链接
      // 首先从数据库查找文件信息
      const ebook = await new Promise<any>((resolve, reject) => {
        db.get(
          'SELECT * FROM ebooks WHERE originalName = ? OR filename = ?',
          [decodeURIComponent(filename), decodeURIComponent(filename)],
          (err, row) => {
            if (err) reject(err);
            else resolve(row);
          }
        );
      });
      
      if (!ebook) {
        return res.status(404).json({ error: '文件不存在' });
      }
      
      // 返回本地下载链接（使用文件 ID）
      const downloadUrl = `/api/ebooks/file/${ebook.id}`;
      
      res.json({
        downloadUrl,
        filename: ebook.originalName
      });
    }
  } catch (error) {
    console.error('Get download URL error:', error);
    res.status(500).json({ error: '服务器错误' });
  }
});

// 预览文件（在浏览器中打开，不下载）
router.get('/preview/:id', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    
    // 从数据库获取文件信息
    const ebook = await new Promise<any>((resolve, reject) => {
      db.get('SELECT * FROM ebooks WHERE id = ?', [id], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
    
    if (!ebook) {
      return res.status(404).json({ error: '文件不存在' });
    }
    
    // 构建文件路径
    const filePath = path.join(process.cwd(), 'uploads', 'ebooks', ebook.filename);
    
    // 检查文件是否存在
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: '文件不存在' });
    }
    
    // 根据文件扩展名设置 Content-Type
    const ext = path.extname(ebook.originalName).toLowerCase();
    const contentTypes: { [key: string]: string } = {
      '.pdf': 'application/pdf',
      '.epub': 'application/epub+zip',
      '.mobi': 'application/x-mobipocket-ebook',
      '.azw3': 'application/vnd.amazon.ebook',
      '.txt': 'text/plain; charset=utf-8',
      '.doc': 'application/msword',
      '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    };
    
    const contentType = contentTypes[ext] || 'application/octet-stream';
    
    // 设置响应头（inline 表示在浏览器中打开，而不是下载）
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(ebook.originalName)}"`);
    res.setHeader('Accept-Ranges', 'bytes');
    
    // 流式传输文件
    const fileStream = fs.createReadStream(filePath);
    fileStream.pipe(res);
  } catch (error) {
    console.error('Preview file error:', error);
    res.status(500).json({ error: '预览失败' });
  }
});

// 直接下载本地文件
router.get('/file/:id', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    
    // 从数据库获取文件信息
    const ebook = await new Promise<any>((resolve, reject) => {
      db.get('SELECT * FROM ebooks WHERE id = ?', [id], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
    
    if (!ebook) {
      return res.status(404).json({ error: '文件不存在' });
    }
    
    // 构建文件路径
    const filePath = path.join(process.cwd(), 'uploads', 'ebooks', ebook.filename);
    
    // 检查文件是否存在
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: '文件不存在' });
    }
    
    // 设置响应头并发送文件（attachment 表示下载）
    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(ebook.originalName)}"`);
    
    // 流式传输文件
    const fileStream = fs.createReadStream(filePath);
    fileStream.pipe(res);
  } catch (error) {
    console.error('Download file error:', error);
    res.status(500).json({ error: '下载失败' });
  }
});

export default router;

