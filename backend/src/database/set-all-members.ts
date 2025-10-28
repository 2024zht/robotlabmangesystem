import { db } from './db';

const setAllMembers = async () => {
  try {
    console.log('开始将所有用户设置为实验室成员...');

    // 将所有用户设置为实验室成员
    await new Promise<void>((resolve, reject) => {
      db.run('UPDATE users SET isMember = 1', (err) => {
        if (err) reject(err);
        else resolve();
      });
    });

    // 查询更新了多少用户
    const count = await new Promise<number>((resolve, reject) => {
      db.get('SELECT COUNT(*) as count FROM users WHERE isMember = 1', (err, row: any) => {
        if (err) reject(err);
        else resolve(row.count);
      });
    });

    console.log(`成功将 ${count} 个用户设置为实验室成员`);
    console.log('操作完成');
    process.exit(0);
  } catch (error) {
    console.error('设置失败:', error);
    process.exit(1);
  }
};

setAllMembers();

