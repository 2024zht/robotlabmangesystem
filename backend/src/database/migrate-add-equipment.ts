import { db, runQuery } from './db';

/**
 * 数据库迁移脚本：添加设备借用管理功能
 * 运行方式：ts-node src/database/migrate-add-equipment.ts
 */

async function migrateAddEquipment() {
  console.log('开始迁移：添加设备借用管理表...');

  try {
    // 创建设备类型表
    await runQuery(`
      CREATE TABLE IF NOT EXISTS equipment_types (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        image TEXT,
        description TEXT,
        total_count INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✓ 创建设备类型表成功');

    // 创建设备实例表
    await runQuery(`
      CREATE TABLE IF NOT EXISTS equipment_instances (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        type_id INTEGER NOT NULL,
        code TEXT UNIQUE NOT NULL,
        status TEXT DEFAULT 'available',
        notes TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (type_id) REFERENCES equipment_types(id) ON DELETE CASCADE
      )
    `);
    console.log('✓ 创建设备实例表成功');

    // 创建设备借用申请表
    await runQuery(`
      CREATE TABLE IF NOT EXISTS equipment_requests (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        equipment_id INTEGER NOT NULL,
        borrow_date TEXT NOT NULL,
        return_date TEXT NOT NULL,
        reason TEXT NOT NULL,
        status TEXT DEFAULT 'pending',
        admin_comment TEXT,
        approved_by INTEGER,
        approved_at DATETIME,
        returned_at DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (equipment_id) REFERENCES equipment_instances(id) ON DELETE CASCADE,
        FOREIGN KEY (approved_by) REFERENCES users(id)
      )
    `);
    console.log('✓ 创建设备借用申请表成功');

    // 创建索引以提高查询性能
    await runQuery(`
      CREATE INDEX IF NOT EXISTS idx_equipment_instances_type_id 
      ON equipment_instances(type_id)
    `);
    
    await runQuery(`
      CREATE INDEX IF NOT EXISTS idx_equipment_instances_status 
      ON equipment_instances(status)
    `);
    
    await runQuery(`
      CREATE INDEX IF NOT EXISTS idx_equipment_requests_user_id 
      ON equipment_requests(user_id)
    `);
    
    await runQuery(`
      CREATE INDEX IF NOT EXISTS idx_equipment_requests_status 
      ON equipment_requests(status)
    `);
    
    await runQuery(`
      CREATE INDEX IF NOT EXISTS idx_equipment_requests_equipment_id 
      ON equipment_requests(equipment_id)
    `);
    console.log('✓ 创建索引成功');

    console.log('✅ 迁移完成！');
  } catch (error) {
    console.error('❌ 迁移失败：', error);
    throw error;
  }
}

// 如果直接运行此脚本，则执行迁移
if (require.main === module) {
  migrateAddEquipment()
    .then(() => {
      console.log('\n提示：迁移完成后，请运行初始化脚本添加初始设备数据');
      console.log('命令：ts-node src/database/init-equipment-data.ts');
      process.exit(0);
    })
    .catch((error) => {
      console.error('迁移过程出错：', error);
      process.exit(1);
    });
}

export { migrateAddEquipment };

