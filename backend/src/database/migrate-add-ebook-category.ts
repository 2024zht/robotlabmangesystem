import { db } from './db';

/**
 * 添加电子书分类功能的迁移脚本
 * 1. 创建 ebook_categories 表（书籍分类）
 * 2. 为 ebooks 表添加 categoryId 字段
 */

const migrateAddEbookCategory = async () => {
  try {
    console.log('开始添加电子书分类功能...');

    // 1. 创建分类表
    await new Promise<void>((resolve, reject) => {
      db.run(`
        CREATE TABLE IF NOT EXISTS ebook_categories (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT UNIQUE NOT NULL,
          description TEXT,
          createdAt DATETIME DEFAULT (datetime('now', 'localtime')),
          createdBy INTEGER NOT NULL,
          FOREIGN KEY (createdBy) REFERENCES users(id)
        )
      `, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
    console.log('✅ 分类表创建成功');

    // 2. 检查 ebooks 表是否已有 categoryId 列
    const columns = await new Promise<any[]>((resolve, reject) => {
      db.all('PRAGMA table_info(ebooks)', (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });

    const hasCategoryId = columns.some((col: any) => col.name === 'categoryId');

    if (!hasCategoryId) {
      // 添加 categoryId 列
      await new Promise<void>((resolve, reject) => {
        db.run(`
          ALTER TABLE ebooks ADD COLUMN categoryId INTEGER REFERENCES ebook_categories(id)
        `, (err) => {
          if (err) reject(err);
          else resolve();
        });
      });
      console.log('✅ ebooks 表添加 categoryId 列成功');
    } else {
      console.log('ℹ️  categoryId 列已存在，跳过');
    }

    // 3. 创建默认分类（如果不存在）
    const defaultCategories = [
      { name: '未分类', description: '尚未分类的书籍' },
      { name: '编程语言', description: 'C++、Python、Java等编程语言相关书籍' },
      { name: '机器人学', description: '机器人理论、控制、导航等相关书籍' },
      { name: '人工智能', description: '深度学习、机器学习、计算机视觉等' },
      { name: '数学与算法', description: '数学基础、算法设计与分析' },
      { name: '电子电路', description: '电子电路、嵌入式系统相关' },
      { name: '其他', description: '其他类别书籍' }
    ];

    // 获取第一个管理员作为创建者
    const admin = await new Promise<any>((resolve, reject) => {
      db.get('SELECT id FROM users WHERE isAdmin = 1 LIMIT 1', (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });

    if (admin) {
      for (const category of defaultCategories) {
        await new Promise<void>((resolve, reject) => {
          db.run(
            'INSERT OR IGNORE INTO ebook_categories (name, description, createdBy) VALUES (?, ?, ?)',
            [category.name, category.description, admin.id],
            (err) => {
              if (err) reject(err);
              else resolve();
            }
          );
        });
      }
      console.log('✅ 默认分类创建成功');
    }

    // 4. 将所有现有书籍设置为"未分类"
    const uncategorized = await new Promise<any>((resolve, reject) => {
      db.get('SELECT id FROM ebook_categories WHERE name = ?', ['未分类'], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });

    if (uncategorized) {
      await new Promise<void>((resolve, reject) => {
        db.run(
          'UPDATE ebooks SET categoryId = ? WHERE categoryId IS NULL',
          [uncategorized.id],
          (err) => {
            if (err) reject(err);
            else resolve();
          }
        );
      });
      console.log('✅ 现有书籍已设置为"未分类"');
    }

    console.log('\n✅ 电子书分类功能添加完成！');
    console.log('💡 提示：管理员可以在管理面板中管理分类和重新分类书籍');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ 迁移失败:', error);
    process.exit(1);
  }
};

migrateAddEbookCategory();


