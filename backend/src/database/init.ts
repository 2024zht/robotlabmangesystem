import { db } from './db';
import bcrypt from 'bcryptjs';

const initDatabase = async () => {
  try {
    // 创建用户表
    await new Promise<void>((resolve, reject) => {
      db.run(`
        CREATE TABLE IF NOT EXISTS users (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          username TEXT UNIQUE NOT NULL,
          name TEXT NOT NULL,
          studentId TEXT UNIQUE NOT NULL,
          className TEXT NOT NULL,
          email TEXT UNIQUE NOT NULL,
          password TEXT NOT NULL,
          isAdmin INTEGER DEFAULT 0,
          points INTEGER DEFAULT 0,
          createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });

    // 创建规则表
    await new Promise<void>((resolve, reject) => {
      db.run(`
        CREATE TABLE IF NOT EXISTS rules (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          points INTEGER NOT NULL,
          description TEXT,
          createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });

    // 创建积分日志表
    await new Promise<void>((resolve, reject) => {
      db.run(`
        CREATE TABLE IF NOT EXISTS point_logs (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          userId INTEGER NOT NULL,
          points INTEGER NOT NULL,
          reason TEXT,
          createdBy INTEGER NOT NULL,
          createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (userId) REFERENCES users(id),
          FOREIGN KEY (createdBy) REFERENCES users(id)
        )
      `, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });

    console.log('Database tables created successfully');

    // 检查是否已有管理员
    const adminExists = await new Promise<boolean>((resolve) => {
      db.get('SELECT id FROM users WHERE isAdmin = 1', (err, row) => {
        if (err || !row) resolve(false);
        else resolve(true);
      });
    });

    // 如果没有管理员，创建默认管理员账户
    if (!adminExists) {
      const hashedPassword = await bcrypt.hash('admin123', 10);
      await new Promise<void>((resolve, reject) => {
        db.run(
          'INSERT INTO users (username, name, studentId, className, email, password, isAdmin, points) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
          ['admin', '系统管理员', 'ADMIN001', '管理员', 'admin@robotlab.com', hashedPassword, 1, 0],
          (err) => {
            if (err) reject(err);
            else resolve();
          }
        );
      });
      console.log('Default admin user created (username: admin, password: admin123)');
    }

    // 创建积分申诉表
    await new Promise<void>((resolve, reject) => {
      db.run(`
        CREATE TABLE IF NOT EXISTS point_requests (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          userId INTEGER NOT NULL,
          points INTEGER NOT NULL,
          reason TEXT NOT NULL,
          status TEXT DEFAULT 'pending',
          createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
          respondedAt DATETIME,
          respondedBy INTEGER,
          adminComment TEXT,
          FOREIGN KEY (userId) REFERENCES users(id),
          FOREIGN KEY (respondedBy) REFERENCES users(id)
        )
      `, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
    console.log('Point requests table created');

    // 创建请假表
    await new Promise<void>((resolve, reject) => {
      db.run(`
        CREATE TABLE IF NOT EXISTS leaves (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          userId INTEGER NOT NULL,
          leaveType TEXT NOT NULL,
          startTime DATETIME NOT NULL,
          endTime DATETIME NOT NULL,
          duration TEXT NOT NULL,
          reason TEXT NOT NULL,
          status TEXT DEFAULT 'pending',
          createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
          respondedAt DATETIME,
          respondedBy INTEGER,
          rejectReason TEXT,
          FOREIGN KEY (userId) REFERENCES users(id),
          FOREIGN KEY (respondedBy) REFERENCES users(id)
        )
      `, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
    console.log('Leaves table created');

    // 创建电子书表
    await new Promise<void>((resolve, reject) => {
      db.run(`
        CREATE TABLE IF NOT EXISTS ebooks (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          filename TEXT NOT NULL,
          originalName TEXT NOT NULL,
          fileSize INTEGER NOT NULL,
          uploadedBy INTEGER NOT NULL,
          uploadedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
          b2Synced INTEGER DEFAULT 0,
          b2Path TEXT,
          FOREIGN KEY (uploadedBy) REFERENCES users(id)
        )
      `, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
    console.log('Ebooks table created');

    // 创建点名任务表（支持日期范围，每天晚上9:15-9:25随机时间触发）
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
    console.log('Attendances table created');

    // 创建每日点名触发记录表
    await new Promise<void>((resolve, reject) => {
      db.run(`
        CREATE TABLE IF NOT EXISTS daily_attendance_triggers (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          attendanceId INTEGER NOT NULL,
          triggerDate TEXT NOT NULL,
          triggerTime TEXT NOT NULL,
          notificationSent INTEGER DEFAULT 0,
          completed INTEGER DEFAULT 0,
          isManual INTEGER DEFAULT 0,
          createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (attendanceId) REFERENCES attendances(id),
          UNIQUE(attendanceId, triggerDate)
        )
      `, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
    console.log('Daily attendance triggers table created');

    // 创建签到记录表
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
    console.log('Attendance records table created');

    // 检查是否已有规则
    const rulesExist = await new Promise<boolean>((resolve) => {
      db.get('SELECT id FROM rules LIMIT 1', (err, row) => {
        if (err || !row) resolve(false);
        else resolve(true);
      });
    });

    // 如果没有规则，创建一些示例规则
    if (!rulesExist) {
      const defaultRules = [
        { name: '完成实验报告', points: 10, description: '按时提交实验报告' },
        { name: '参加组会', points: 5, description: '参加每周组会' },
        { name: '发表论文', points: 100, description: '在会议或期刊发表论文' },
        { name: '协助实验室建设', points: 15, description: '参与实验室设备维护和建设' },
        { name: '迟到', points: -5, description: '组会或活动迟到' },
        { name: '未完成任务', points: -10, description: '未按时完成分配的任务' }
      ];

      for (const rule of defaultRules) {
        await new Promise<void>((resolve, reject) => {
          db.run(
            'INSERT INTO rules (name, points, description) VALUES (?, ?, ?)',
            [rule.name, rule.points, rule.description],
            (err) => {
              if (err) reject(err);
              else resolve();
            }
          );
        });
      }
      console.log('Default rules created');
    }

    console.log('Database initialization completed');
    process.exit(0);
  } catch (error) {
    console.error('Database initialization error:', error);
    process.exit(1);
  }
};

initDatabase();

