import { db, runQuery, getOne, getAll } from './db';

/**
 * 初始化设备数据脚本
 * 运行方式：ts-node src/database/init-equipment-data.ts
 */

interface EquipmentType {
  name: string;
  image: string;
  description: string;
  count: number;
  prefix: string;
}

const initialEquipment: EquipmentType[] = [
  {
    name: 'NAO机器人 V6',
    image: '/nao.png',
    description: 'NAO是一款人形机器人，具有25个自由度，配备摄像头、麦克风和扬声器，适用于人机交互、机器人编程等研究和教学。',
    count: 11,
    prefix: 'NAO'
  },
  {
    name: '智能小车',
    image: '/smartcar.png',
    description: '配备多种传感器的智能小车，可用于机器人导航、路径规划、SLAM等实验，支持ROS系统。',
    count: 40,
    prefix: 'CAR'
  },
  {
    name: '树莓派开发套件',
    image: '/RaspberryPi.png',
    description: '树莓派4B开发板及配套传感器套件，适用于物联网、嵌入式系统开发、Linux学习等场景。',
    count: 40,
    prefix: 'RASP'
  }
];

async function initEquipmentData() {
  console.log('开始初始化设备数据...\n');

  try {
    // 检查是否已有数据
    const existingCount = await getOne<{ count: number }>('SELECT COUNT(*) as count FROM equipment_types');
    
    if (existingCount && existingCount.count > 0) {
      console.log('⚠️  数据库中已存在设备数据');
      console.log('如需重新初始化，请先清空 equipment_types 表');
      return;
    }

    // 插入设备类型和实例
    for (const equipment of initialEquipment) {
      // 插入设备类型
      const insertTypePromise = new Promise<number>((resolve, reject) => {
        db.run(
          `INSERT INTO equipment_types (name, image, description, total_count) VALUES (?, ?, ?, ?)`,
          [equipment.name, equipment.image, equipment.description, equipment.count],
          function(err) {
            if (err) reject(err);
            else resolve(this.lastID);
          }
        );
      });
      
      const typeId = await insertTypePromise;
      console.log(`✓ 创建设备类型：${equipment.name} (ID: ${typeId})`);

      // 批量插入设备实例
      for (let i = 1; i <= equipment.count; i++) {
        const code = `${equipment.prefix}-${String(i).padStart(3, '0')}`;
        await runQuery(
          `INSERT INTO equipment_instances (type_id, code, status) VALUES (?, ?, 'available')`,
          [typeId, code]
        );
      }
      console.log(`  └─ 创建 ${equipment.count} 个设备实例 (${equipment.prefix}-001 ~ ${equipment.prefix}-${String(equipment.count).padStart(3, '0')})`);
    }

    console.log('\n✅ 设备数据初始化完成！');
    console.log('\n📊 统计信息：');
    
    const typeCount = await getOne<{ count: number }>('SELECT COUNT(*) as count FROM equipment_types');
    const instanceCount = await getOne<{ count: number }>('SELECT COUNT(*) as count FROM equipment_instances');
    
    console.log(`  - 设备类型：${typeCount?.count || 0} 种`);
    console.log(`  - 设备实例：${instanceCount?.count || 0} 个`);
    
  } catch (error) {
    console.error('❌ 初始化失败：', error);
    throw error;
  }
}

// 如果直接运行此脚本，则执行初始化
if (require.main === module) {
  initEquipmentData()
    .then(() => {
      console.log('\n🎉 初始化完成！');
      process.exit(0);
    })
    .catch((error) => {
      console.error('初始化过程出错：', error);
      process.exit(1);
    });
}

export { initEquipmentData };

