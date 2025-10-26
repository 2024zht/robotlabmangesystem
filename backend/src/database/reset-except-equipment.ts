import { db, runQuery, getAll } from './db';

/**
 * 重置数据库，但保留 admin 账号和设备数据
 * 
 * 保留的数据：
 * - admin 账号（username = 'admin'）
 * - 设备类型（equipment_types）
 * - 设备实例（equipment_instances）
 * 
 * 删除的数据：
 * - 除 admin 外的所有用户账号（包括其他管理员）
 * - 积分日志
 * - 积分异议请求
 * - 规则数据
 * - 请假数据
 * - 电子书数据
 * - 点名数据及签到记录
 * - 设备借用申请
 */

// 辅助函数：检查表是否存在
async function tableExists(tableName: string): Promise<boolean> {
  try {
    const result = await getAll<{ count: number }>(
      `SELECT COUNT(*) as count FROM sqlite_master WHERE type='table' AND name=?`,
      [tableName]
    );
    return result[0].count > 0;
  } catch (error) {
    return false;
  }
}

// 辅助函数：安全删除表数据
async function safeDeleteTable(tableName: string, description: string): Promise<void> {
  const exists = await tableExists(tableName);
  if (exists) {
    await runQuery(`DELETE FROM ${tableName} WHERE 1=1`);
    console.log(`✓ 删除${description}`);
  } else {
    console.log(`⊘ 跳过${description}（表不存在）`);
  }
}

async function resetDatabase() {
  console.log('🔄 开始重置数据库...\n');

  try {
    // 1. 获取 admin 账号
    const admin = await getAll<{ id: number; username: string; name: string }>(
      'SELECT id, username, name FROM users WHERE username = ?',
      ['admin']
    );
    
    if (admin.length === 0) {
      throw new Error('未找到 admin 账号！');
    }
    
    console.log('📋 将保留以下账号：');
    console.log(`   - ${admin[0].username} (${admin[0].name})`);
    console.log('');

    // 2. 获取设备统计
    const equipmentTypes = await getAll<{ count: number }>('SELECT COUNT(*) as count FROM equipment_types');
    const equipmentInstances = await getAll<{ count: number }>('SELECT COUNT(*) as count FROM equipment_instances');
    console.log(`📦 设备数据（将被保留）：`);
    console.log(`   - 设备类型: ${equipmentTypes[0].count} 种`);
    console.log(`   - 设备实例: ${equipmentInstances[0].count} 个`);
    console.log('');

    // 确认操作
    console.log('⚠️  即将删除以下数据：');
    console.log('   - 除 admin 外的所有用户账号（包括其他管理员）');
    console.log('   - 所有积分日志');
    console.log('   - 所有积分异议请求');
    console.log('   - 所有规则');
    console.log('   - 所有请假记录');
    console.log('   - 所有电子书');
    console.log('   - 所有点名活动和签到记录');
    console.log('   - 所有设备借用申请');
    console.log('');

    // 3. 删除设备借用申请
    await safeDeleteTable('equipment_requests', '设备借用申请');

    // 4. 删除点名签到记录
    await safeDeleteTable('attendance_signs', '点名签到记录');

    // 5. 删除点名触发器
    await safeDeleteTable('attendance_triggers', '点名触发器');

    // 6. 删除点名活动
    await safeDeleteTable('attendances', '点名活动');

    // 7. 删除电子书
    await safeDeleteTable('ebooks', '电子书记录');

    // 8. 删除请假记录
    await safeDeleteTable('leaves', '请假记录');

    // 9. 删除规则
    await safeDeleteTable('rules', '规则');

    // 10. 删除积分异议请求
    await safeDeleteTable('point_requests', '积分异议请求');

    // 11. 删除积分日志
    await safeDeleteTable('point_logs', '积分日志');

    // 12. 删除除 admin 外的所有用户
    await runQuery('DELETE FROM users WHERE username != ?', ['admin']);
    console.log(`✓ 删除除 admin 外的所有用户账号`);

    // 13. 重置 admin 积分为0
    await runQuery('UPDATE users SET points = 0 WHERE username = ?', ['admin']);
    console.log(`✓ 重置 admin 积分为0`);

    console.log('\n✅ 数据库重置完成！');
    console.log('\n📊 保留的数据：');
    console.log(`   - 账号: admin (${admin[0].name})`);
    console.log(`   - 设备类型: ${equipmentTypes[0].count} 种`);
    console.log(`   - 设备实例: ${equipmentInstances[0].count} 个`);

  } catch (error) {
    console.error('❌ 重置失败：', error);
    throw error;
  }
}

// 如果直接运行此脚本，则执行重置
if (require.main === module) {
  console.log('═'.repeat(60));
  console.log('  数据库重置工具 - 仅保留 admin 账号和设备数据');
  console.log('═'.repeat(60));
  console.log('');

  resetDatabase()
    .then(() => {
      console.log('\n🎉 重置完成！');
      console.log('');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n重置过程出错：', error);
      process.exit(1);
    });
}

export { resetDatabase };

