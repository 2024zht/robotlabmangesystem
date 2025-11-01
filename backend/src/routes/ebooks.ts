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
              e.uploadedAt, e.b2Synced, e.b2Path, e.categoryId,
              u.username as uploadedByUsername,
              c.name as categoryName
       FROM ebooks e 
       LEFT JOIN users u ON e.uploadedBy = u.id 
       LEFT JOIN ebook_categories c ON e.categoryId = c.id
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

// 配置分块上传的 multer（使用统一的临时目录）
const chunkUpload = multer({
  storage: multer.diskStorage({
    destination: function (req: any, file: Express.Multer.File, cb: (error: Error | null, destination: string) => void) {
      // 使用统一的临时目录
      const tempDir = path.join(process.cwd(), 'uploads', 'temp_chunks');
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }
      cb(null, tempDir);
    },
    filename: function (req: any, file: Express.Multer.File, cb: (error: Error | null, filename: string) => void) {
      // 使用时间戳生成唯一文件名
      const uniqueName = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      cb(null, uniqueName);
    }
  }),
  limits: {
    fileSize: 60 * 1024 * 1024 // 60MB（给 50MB 分块留一些余量）
  }
});

// 上传单个分块（管理员）
router.post('/upload-chunk', authenticateToken, requireAdmin, chunkUpload.single('chunk'), async (req: AuthRequest, res: Response) => {
  try {
    const { chunkIndex, totalChunks, fileName, fileSize, uploadId } = req.body;
    
    if (!req.file) {
      return res.status(400).json({ error: '没有上传分块数据' });
    }

    // 验证参数
    if (chunkIndex === undefined || !totalChunks || !fileName || !uploadId) {
      return res.status(400).json({ error: '缺少必要参数' });
    }

    // 创建上传会话目录
    const sessionDir = path.join(process.cwd(), 'uploads', 'temp', uploadId);
    if (!fs.existsSync(sessionDir)) {
      fs.mkdirSync(sessionDir, { recursive: true });
    }

    // 将临时文件移动到会话目录，并按分块编号命名
    const chunkPath = path.join(sessionDir, `chunk_${chunkIndex}`);
    fs.renameSync(req.file.path, chunkPath);

    // 保存或更新元数据
    const metaPath = path.join(sessionDir, 'metadata.json');
    const metadata = {
      fileName,
      fileSize: parseInt(fileSize),
      totalChunks: parseInt(totalChunks),
      uploadedChunks: fs.readdirSync(sessionDir).filter(f => f.startsWith('chunk_')).length,
      uploadId,
      userId: req.user!.userId,
    };
    fs.writeFileSync(metaPath, JSON.stringify(metadata));

    console.log(`分块 ${parseInt(chunkIndex) + 1}/${totalChunks} 上传成功: ${req.file.size} bytes`);

    res.json({
      success: true,
      chunkIndex: parseInt(chunkIndex),
      uploadedChunks: metadata.uploadedChunks,
      totalChunks: parseInt(totalChunks),
    });
  } catch (error) {
    console.error('Upload chunk error:', error);
    res.status(500).json({ error: '分块上传失败' });
  }
});

// 合并分块并完成上传（管理员）
router.post('/merge-chunks', authenticateToken, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { uploadId, fileName, fileSize } = req.body;

    if (!uploadId || !fileName) {
      return res.status(400).json({ error: '缺少必要参数' });
    }

    const tempDir = path.join(process.cwd(), 'uploads', 'temp', uploadId);
    
    // 检查临时目录是否存在
    if (!fs.existsSync(tempDir)) {
      return res.status(400).json({ error: '上传会话不存在' });
    }

    // 读取元数据
    const metaPath = path.join(tempDir, 'metadata.json');
    if (!fs.existsSync(metaPath)) {
      return res.status(400).json({ error: '元数据不存在' });
    }

    const metadata = JSON.parse(fs.readFileSync(metaPath, 'utf8'));

    // 检查所有分块是否都已上传
    const uploadedChunks = fs.readdirSync(tempDir).filter(f => f.startsWith('chunk_'));
    if (uploadedChunks.length !== metadata.totalChunks) {
      return res.status(400).json({ 
        error: '分块未完全上传',
        uploaded: uploadedChunks.length,
        total: metadata.totalChunks,
      });
    }

    // 生成最终文件名
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const finalFileName = uniqueSuffix + '-' + fileName;
    const uploadsDir = path.join(process.cwd(), 'uploads', 'ebooks');
    
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }

    const finalPath = path.join(uploadsDir, finalFileName);

    // 合并所有分块
    const writeStream = fs.createWriteStream(finalPath);
    
    for (let i = 0; i < metadata.totalChunks; i++) {
      const chunkPath = path.join(tempDir, `chunk_${i}`);
      const chunkBuffer = fs.readFileSync(chunkPath);
      writeStream.write(chunkBuffer);
    }

    writeStream.end();

    // 等待写入完成
    await new Promise<void>((resolve, reject) => {
      writeStream.on('finish', resolve);
      writeStream.on('error', reject);
    });

    // 验证文件大小
    const finalFileSize = fs.statSync(finalPath).size;
    console.log(`合并完成: ${finalFileName}, 大小: ${finalFileSize} bytes (预期: ${fileSize} bytes)`);

    // 保存到数据库
    const userId = metadata.userId || req.user!.userId;
    const insertId = await new Promise<number>((resolve, reject) => {
      db.run(
        'INSERT INTO ebooks (filename, originalName, fileSize, uploadedBy, uploadedAt) VALUES (?, ?, ?, ?, datetime(\'now\', \'localtime\'))',
        [finalFileName, fileName, finalFileSize, userId],
        function (err) {
          if (err) reject(err);
          else resolve(this.lastID);
        }
      );
    });

    // 清理临时文件
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch (cleanupError) {
      console.error('清理临时文件失败:', cleanupError);
    }

    // 尝试同步到 B2（与原逻辑相同）
    let b2Synced = false;
    let b2Path = '';
    let syncError: string | null = null;

    try {
      const b2Bucket = process.env.B2_BUCKET_NAME;

      if (b2Bucket && b2Bucket !== 'robotlib' && b2Bucket.trim() !== '') {
        const localPath = finalPath;
        const remoteFileName = fileName;

        console.log(`Uploading to B2: ${localPath} -> ${b2Bucket}/${remoteFileName}`);

        const { stdout, stderr } = await execAsync(
          `b2 upload-file "${b2Bucket}" "${localPath}" "${remoteFileName}"`,
          { timeout: 600000 }
        );

        console.log('B2 upload stdout:', stdout);
        if (stderr) console.log('B2 upload stderr:', stderr);

        b2Synced = true;
        b2Path = `b2://${b2Bucket}/${remoteFileName}`;

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

        console.log('File uploaded to B2 successfully. Local file retained for serving.');
      } else {
        console.log('B2_BUCKET_NAME not configured, skipping B2 upload.');
      }
    } catch (error: any) {
      console.error('B2 sync error:', error);
      syncError = error.message || 'B2同步失败';
    }

    res.status(201).json({
      message: '文件上传成功',
      id: insertId,
      filename: finalFileName,
      originalName: fileName,
      fileSize: finalFileSize,
      b2Synced,
      b2Path,
      syncError,
      needsB2Sync: !b2Synced && !syncError,
    });
  } catch (error) {
    console.error('Merge chunks error:', error);
    res.status(500).json({ error: '合并文件失败' });
  }
});

// 取消分块上传（管理员）
router.delete('/cancel-upload/:uploadId', authenticateToken, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { uploadId } = req.params;
    const tempDir = path.join(process.cwd(), 'uploads', 'temp', uploadId);

    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
      res.json({ message: '上传已取消，临时文件已清理' });
    } else {
      res.status(404).json({ error: '上传会话不存在' });
    }
  } catch (error) {
    console.error('Cancel upload error:', error);
    res.status(500).json({ error: '取消上传失败' });
  }
});

// 上传电子书（管理员）- 保留原有的完整上传接口作为后备
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
        'INSERT INTO ebooks (filename, originalName, fileSize, uploadedBy, uploadedAt) VALUES (?, ?, ?, ?, datetime(\'now\', \'localtime\'))',
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

    // 获取文件大小
    const stat = fs.statSync(filePath);
    const fileSize = stat.size;
    
    // 设置响应头（包括 Content-Length 以支持进度显示）
    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(ebook.originalName)}"`);
    res.setHeader('Content-Length', fileSize.toString());
    res.setHeader('Accept-Ranges', 'bytes');
    
    // 流式传输文件
    const fileStream = fs.createReadStream(filePath);
    fileStream.pipe(res);
  } catch (error) {
    console.error('Download file error:', error);
    res.status(500).json({ error: '下载失败' });
  }
});

// ==================== 书籍分类管理 API ====================

// 获取所有分类
router.get('/categories', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const categories = await new Promise<any[]>((resolve, reject) => {
      db.all(
        `SELECT c.*, u.name as createdByName 
         FROM ebook_categories c 
         LEFT JOIN users u ON c.createdBy = u.id
         ORDER BY c.id ASC`,
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        }
      );
    });

    // 获取每个分类下的书籍数量
    const categoriesWithCount = await Promise.all(
      categories.map(async (category) => {
        const count = await new Promise<number>((resolve, reject) => {
          db.get(
            'SELECT COUNT(*) as count FROM ebooks WHERE categoryId = ?',
            [category.id],
            (err, row: any) => {
              if (err) reject(err);
              else resolve(row.count);
            }
          );
        });
        return { ...category, bookCount: count };
      })
    );

    res.json(categoriesWithCount);
  } catch (error) {
    console.error('Get categories error:', error);
    res.status(500).json({ error: '获取分类失败' });
  }
});

// 创建新分类（管理员）
router.post('/categories', authenticateToken, requireAdmin, async (req: AuthRequest, res: Response) => {
  const { name, description } = req.body;
  const userId = req.user!.userId;

  if (!name || !name.trim()) {
    return res.status(400).json({ error: '分类名称不能为空' });
  }

  try {
    // 检查分类名是否已存在
    const existing = await new Promise<any>((resolve, reject) => {
      db.get(
        'SELECT id FROM ebook_categories WHERE name = ?',
        [name],
        (err, row) => {
          if (err) reject(err);
          else resolve(row);
        }
      );
    });

    if (existing) {
      return res.status(400).json({ error: '该分类名称已存在' });
    }

    // 创建新分类
    const categoryId = await new Promise<number>((resolve, reject) => {
      db.run(
        'INSERT INTO ebook_categories (name, description, createdBy, createdAt) VALUES (?, ?, ?, datetime(\'now\', \'localtime\'))',
        [name, description || null, userId],
        function (err) {
          if (err) reject(err);
          else resolve(this.lastID);
        }
      );
    });

    res.status(201).json({
      message: '分类创建成功',
      categoryId
    });
  } catch (error) {
    console.error('Create category error:', error);
    res.status(500).json({ error: '创建分类失败' });
  }
});

// 更新分类（管理员）
router.put('/categories/:id', authenticateToken, requireAdmin, async (req: AuthRequest, res: Response) => {
  const categoryId = parseInt(req.params.id);
  const { name, description } = req.body;

  if (!name || !name.trim()) {
    return res.status(400).json({ error: '分类名称不能为空' });
  }

  try {
    // 检查分类是否存在
    const category = await new Promise<any>((resolve, reject) => {
      db.get(
        'SELECT * FROM ebook_categories WHERE id = ?',
        [categoryId],
        (err, row) => {
          if (err) reject(err);
          else resolve(row);
        }
      );
    });

    if (!category) {
      return res.status(404).json({ error: '分类不存在' });
    }

    // 检查新名称是否与其他分类冲突
    const existing = await new Promise<any>((resolve, reject) => {
      db.get(
        'SELECT id FROM ebook_categories WHERE name = ? AND id != ?',
        [name, categoryId],
        (err, row) => {
          if (err) reject(err);
          else resolve(row);
        }
      );
    });

    if (existing) {
      return res.status(400).json({ error: '该分类名称已存在' });
    }

    // 更新分类
    await new Promise<void>((resolve, reject) => {
      db.run(
        'UPDATE ebook_categories SET name = ?, description = ? WHERE id = ?',
        [name, description || null, categoryId],
        (err) => {
          if (err) reject(err);
          else resolve();
        }
      );
    });

    res.json({ message: '分类更新成功' });
  } catch (error) {
    console.error('Update category error:', error);
    res.status(500).json({ error: '更新分类失败' });
  }
});

// 删除分类（管理员）
router.delete('/categories/:id', authenticateToken, requireAdmin, async (req: AuthRequest, res: Response) => {
  const categoryId = parseInt(req.params.id);

  try {
    // 检查分类是否存在
    const category = await new Promise<any>((resolve, reject) => {
      db.get(
        'SELECT * FROM ebook_categories WHERE id = ?',
        [categoryId],
        (err, row) => {
          if (err) reject(err);
          else resolve(row);
        }
      );
    });

    if (!category) {
      return res.status(404).json({ error: '分类不存在' });
    }

    // 不允许删除"未分类"
    if (category.name === '未分类') {
      return res.status(400).json({ error: '不能删除"未分类"分类' });
    }

    // 获取"未分类"的ID
    const uncategorized = await new Promise<any>((resolve, reject) => {
      db.get(
        'SELECT id FROM ebook_categories WHERE name = ?',
        ['未分类'],
        (err, row) => {
          if (err) reject(err);
          else resolve(row);
        }
      );
    });

    // 将该分类下的所有书籍移动到"未分类"
    if (uncategorized) {
      await new Promise<void>((resolve, reject) => {
        db.run(
          'UPDATE ebooks SET categoryId = ? WHERE categoryId = ?',
          [uncategorized.id, categoryId],
          (err) => {
            if (err) reject(err);
            else resolve();
          }
        );
      });
    }

    // 删除分类
    await new Promise<void>((resolve, reject) => {
      db.run(
        'DELETE FROM ebook_categories WHERE id = ?',
        [categoryId],
        (err) => {
          if (err) reject(err);
          else resolve();
        }
      );
    });

    res.json({ message: '分类删除成功，原分类下的书籍已移至"未分类"' });
  } catch (error) {
    console.error('Delete category error:', error);
    res.status(500).json({ error: '删除分类失败' });
  }
});

// 更新书籍的分类（管理员）
router.patch('/:id/category', authenticateToken, requireAdmin, async (req: AuthRequest, res: Response) => {
  const bookId = parseInt(req.params.id);
  const { categoryId } = req.body;

  if (!categoryId) {
    return res.status(400).json({ error: '请选择分类' });
  }

  try {
    // 检查书籍是否存在
    const book = await new Promise<any>((resolve, reject) => {
      db.get(
        'SELECT * FROM ebooks WHERE id = ?',
        [bookId],
        (err, row) => {
          if (err) reject(err);
          else resolve(row);
        }
      );
    });

    if (!book) {
      return res.status(404).json({ error: '书籍不存在' });
    }

    // 检查分类是否存在
    const category = await new Promise<any>((resolve, reject) => {
      db.get(
        'SELECT * FROM ebook_categories WHERE id = ?',
        [categoryId],
        (err, row) => {
          if (err) reject(err);
          else resolve(row);
        }
      );
    });

    if (!category) {
      return res.status(404).json({ error: '分类不存在' });
    }

    // 更新书籍分类
    await new Promise<void>((resolve, reject) => {
      db.run(
        'UPDATE ebooks SET categoryId = ? WHERE id = ?',
        [categoryId, bookId],
        (err) => {
          if (err) reject(err);
          else resolve();
        }
      );
    });

    res.json({ message: '书籍分类更新成功' });
  } catch (error) {
    console.error('Update book category error:', error);
    res.status(500).json({ error: '更新书籍分类失败' });
  }
});

export default router;

