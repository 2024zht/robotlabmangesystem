import { db } from './db';
import * as fs from 'fs';
import * as path from 'path';

// 清空书籍数据
async function clearEbooks() {
  try {
    // 删除数据库中的所有书籍记录
    await new Promise<void>((resolve, reject) => {
      db.run('DELETE FROM ebooks', (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
    
    console.log('✓ 已清空数据库中的书籍记录');
    
    // 删除上传的文件
    const uploadsDir = path.join(__dirname, '../../uploads/ebooks');
    if (fs.existsSync(uploadsDir)) {
      const files = fs.readdirSync(uploadsDir);
      for (const file of files) {
        fs.unlinkSync(path.join(uploadsDir, file));
      }
      console.log(`✓ 已删除 ${files.length} 个书籍文件`);
    }
    
    console.log('\n书籍数据已全部清空！');
    process.exit(0);
  } catch (error) {
    console.error('清空失败:', error);
    process.exit(1);
  }
}

clearEbooks();

