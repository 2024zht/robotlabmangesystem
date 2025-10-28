import { db } from './db';

const addMemberField = async () => {
  try {
    console.log('开始添加isMember字段...');

    // 检查列是否已存在
    const tableInfo = await new Promise<any[]>((resolve, reject) => {
      db.all('PRAGMA table_info(users)', (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });

    const columnExists = tableInfo.some((col: any) => col.name === 'isMember');

    if (columnExists) {
      console.log('isMember字段已存在，跳过添加');
    } else {
      // 添加isMember字段，默认值为1（是实验室成员）
      await new Promise<void>((resolve, reject) => {
        db.run('ALTER TABLE users ADD COLUMN isMember INTEGER DEFAULT 1', (err) => {
          if (err) reject(err);
          else resolve();
        });
      });
      console.log('isMember字段添加成功');
    }

    // 更新现有管理员账户为实验室成员
    await new Promise<void>((resolve, reject) => {
      db.run('UPDATE users SET isMember = 1 WHERE isAdmin = 1', (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
    console.log('已将所有管理员设置为实验室成员');

    console.log('数据库迁移完成');
    process.exit(0);
  } catch (error) {
    console.error('数据库迁移失败:', error);
    process.exit(1);
  }
};

addMemberField();

