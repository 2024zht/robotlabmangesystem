import { db } from './db';

const migrateAttendance = async () => {
  try {
    console.log('开始迁移点名表结构...');

    // 1. 删除旧的点名相关表
    await new Promise<void>((resolve, reject) => {
      db.run('DROP TABLE IF EXISTS attendance_records', (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
    console.log('已删除旧的 attendance_records 表');

    await new Promise<void>((resolve, reject) => {
      db.run('DROP TABLE IF EXISTS attendances', (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
    console.log('已删除旧的 attendances 表');

    // 2. 创建新的点名任务表（支持日期范围，每天晚上9:15-9:25随机时间触发）
    await new Promise<void>((resolve, reject) => {
      db.run(`
        CREATE TABLE IF NOT EXISTS attendances (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          description TEXT,
          dateStart TEXT NOT NULL,
          dateEnd TEXT NOT NULL,
          locationName TEXT NOT NULL,
          latitude REAL NOT NULL,
          longitude REAL NOT NULL,
          radius INTEGER NOT NULL,
          penaltyPoints INTEGER DEFAULT 5,
          createdBy INTEGER NOT NULL,
          createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
          completed INTEGER DEFAULT 0,
          FOREIGN KEY (createdBy) REFERENCES users(id)
        )
      `, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
    console.log('已创建新的 attendances 表');

    // 3. 创建每日点名触发记录表
    await new Promise<void>((resolve, reject) => {
      db.run(`
        CREATE TABLE IF NOT EXISTS daily_attendance_triggers (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          attendanceId INTEGER NOT NULL,
          triggerDate TEXT NOT NULL,
          triggerTime TEXT NOT NULL,
          notificationSent INTEGER DEFAULT 0,
          completed INTEGER DEFAULT 0,
          createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (attendanceId) REFERENCES attendances(id),
          UNIQUE(attendanceId, triggerDate)
        )
      `, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
    console.log('已创建 daily_attendance_triggers 表');

    // 4. 创建签到记录表
    await new Promise<void>((resolve, reject) => {
      db.run(`
        CREATE TABLE IF NOT EXISTS attendance_records (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          triggerId INTEGER NOT NULL,
          userId INTEGER NOT NULL,
          latitude REAL NOT NULL,
          longitude REAL NOT NULL,
          signedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (triggerId) REFERENCES daily_attendance_triggers(id),
          FOREIGN KEY (userId) REFERENCES users(id),
          UNIQUE(triggerId, userId)
        )
      `, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
    console.log('已创建新的 attendance_records 表');

    console.log('✅ 点名表结构迁移完成！');
    process.exit(0);
  } catch (error) {
    console.error('❌ 迁移失败:', error);
    process.exit(1);
  }
};

migrateAttendance();

