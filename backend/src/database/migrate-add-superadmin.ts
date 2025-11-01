import { db } from './db';

/**
 * 添加超级管理员功能的迁移脚本
 * 1. 为 users 表添加 isSuperAdmin 字段
 * 2. 将第一个管理员设置为超级管理员
 */

const migrateAddSuperAdmin = async () => {
  try {
    console.log('开始添加超级管理员功能...');

    // 1. 检查 users 表是否已有 isSuperAdmin 列
    const columns = await new Promise<any[]>((resolve, reject) => {
      db.all('PRAGMA table_info(users)', (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });

    const hasSuperAdmin = columns.some((col: any) => col.name === 'isSuperAdmin');

    if (!hasSuperAdmin) {
      // 添加 isSuperAdmin 列
      await new Promise<void>((resolve, reject) => {
        db.run(`
          ALTER TABLE users ADD COLUMN isSuperAdmin INTEGER DEFAULT 0
        `, (err) => {
          if (err) reject(err);
          else resolve();
        });
      });
      console.log('✅ users 表添加 isSuperAdmin 列成功');
    } else {
      console.log('ℹ️  isSuperAdmin 列已存在，跳过');
    }

    // 2. 将第一个管理员设置为超级管理员
    const firstAdmin = await new Promise<any>((resolve, reject) => {
      db.get(
        'SELECT id, username FROM users WHERE isAdmin = 1 ORDER BY id ASC LIMIT 1',
        (err, row) => {
          if (err) reject(err);
          else resolve(row);
        }
      );
    });

    if (firstAdmin) {
      await new Promise<void>((resolve, reject) => {
        db.run(
          'UPDATE users SET isSuperAdmin = 1 WHERE id = ?',
          [firstAdmin.id],
          (err) => {
            if (err) reject(err);
            else resolve();
          }
        );
      });
      console.log(`✅ 用户 ${firstAdmin.username} (ID: ${firstAdmin.id}) 已设置为超级管理员`);
    } else {
      console.log('⚠️  未找到管理员用户，无法设置超级管理员');
    }

    console.log('\n✅ 超级管理员功能添加完成！');
    console.log('💡 提示：');
    console.log('   - 超级管理员拥有所有权限');
    console.log('   - 普通管理员之间无法互相修改权限和积分');
    console.log('   - 只有超级管理员可以修改其他管理员的权限和积分');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ 迁移失败:', error);
    process.exit(1);
  }
};

migrateAddSuperAdmin();


