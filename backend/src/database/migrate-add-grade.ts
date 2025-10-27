import { db } from './db';

const migrateAddGrade = async () => {
  try {
    console.log('开始添加年级字段...');

    // 1. 给users表添加grade字段
    await new Promise<void>((resolve, reject) => {
      db.run('ALTER TABLE users ADD COLUMN grade TEXT', (err) => {
        if (err) {
          // 如果字段已存在，忽略错误
          if (err.message.includes('duplicate column name')) {
            console.log('grade字段已存在，跳过');
            resolve();
          } else {
            reject(err);
          }
        } else {
          console.log('已添加grade字段到users表');
          resolve();
        }
      });
    });

    // 2. 将现有用户都设置为2023级
    await new Promise<void>((resolve, reject) => {
      db.run('UPDATE users SET grade = ? WHERE grade IS NULL', ['2023'], (err) => {
        if (err) reject(err);
        else {
          console.log('已将现有用户设置为2023级');
          resolve();
        }
      });
    });

    // 3. 给attendances表添加面向人群字段
    await new Promise<void>((resolve, reject) => {
      db.run('ALTER TABLE attendances ADD COLUMN targetGrades TEXT', (err) => {
        if (err) {
          if (err.message.includes('duplicate column name')) {
            console.log('targetGrades字段已存在，跳过');
            resolve();
          } else {
            reject(err);
          }
        } else {
          console.log('已添加targetGrades字段到attendances表');
          resolve();
        }
      });
    });

    await new Promise<void>((resolve, reject) => {
      db.run('ALTER TABLE attendances ADD COLUMN targetUserIds TEXT', (err) => {
        if (err) {
          if (err.message.includes('duplicate column name')) {
            console.log('targetUserIds字段已存在，跳过');
            resolve();
          } else {
            reject(err);
          }
        } else {
          console.log('已添加targetUserIds字段到attendances表');
          resolve();
        }
      });
    });

    // 4. 将现有点名任务设置默认面向人群为2024级和2025级
    await new Promise<void>((resolve, reject) => {
      db.run(
        'UPDATE attendances SET targetGrades = ? WHERE targetGrades IS NULL',
        [JSON.stringify(['2024', '2025'])],
        (err) => {
          if (err) reject(err);
          else {
            console.log('已将现有点名任务设置为面向2024级和2025级');
            resolve();
          }
        }
      );
    });

    console.log('✅ 年级和面向人群字段添加完成！');
    process.exit(0);
  } catch (error) {
    console.error('❌ 迁移失败:', error);
    process.exit(1);
  }
};

migrateAddGrade();

