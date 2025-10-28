import { db } from './db';

const addPhoneField = async () => {
  try {
    console.log('开始添加phone字段...');

    // 检查列是否已存在
    const tableInfo = await new Promise<any[]>((resolve, reject) => {
      db.all('PRAGMA table_info(users)', (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });

    const columnExists = tableInfo.some((col: any) => col.name === 'phone');

    if (columnExists) {
      console.log('phone字段已存在，跳过添加');
    } else {
      // 添加phone字段，默认值为 '未设置'
      await new Promise<void>((resolve, reject) => {
        db.run('ALTER TABLE users ADD COLUMN phone TEXT DEFAULT "未设置"', (err) => {
          if (err) reject(err);
          else resolve();
        });
      });
      console.log('phone字段添加成功');
    }

    // 为现有用户设置默认电话
    await new Promise<void>((resolve, reject) => {
      db.run('UPDATE users SET phone = "未设置" WHERE phone IS NULL OR phone = ""', (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
    console.log('已为现有用户设置默认电话号码');

    console.log('数据库迁移完成');
    process.exit(0);
  } catch (error) {
    console.error('数据库迁移失败:', error);
    process.exit(1);
  }
};

addPhoneField();

