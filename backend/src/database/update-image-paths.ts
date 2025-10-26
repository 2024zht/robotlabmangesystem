import { db, runQuery, getAll } from './db';

/**
 * 更新数据库中的设备图片路径
 * 从 /assets/xxx.png 改为 /xxx.png
 */

async function updateImagePaths() {
  console.log('开始更新设备图片路径...\n');

  try {
    // 获取所有设备类型
    const types = await getAll<{ id: number; name: string; image: string | null }>('SELECT id, name, image FROM equipment_types');
    
    console.log(`找到 ${types.length} 个设备类型`);
    
    let updatedCount = 0;
    
    for (const type of types) {
      if (type.image && type.image.startsWith('/assets/')) {
        // 移除 /assets/ 前缀
        const newImage = type.image.replace('/assets/', '/');
        
        await runQuery(
          'UPDATE equipment_types SET image = ? WHERE id = ?',
          [newImage, type.id]
        );
        
        console.log(`✓ 更新 ${type.name}: ${type.image} -> ${newImage}`);
        updatedCount++;
      }
    }
    
    console.log(`\n✅ 完成！共更新 ${updatedCount} 个设备类型的图片路径`);
    
  } catch (error) {
    console.error('❌ 更新失败：', error);
    throw error;
  }
}

// 如果直接运行此脚本，则执行更新
if (require.main === module) {
  updateImagePaths()
    .then(() => {
      console.log('\n🎉 更新完成！');
      process.exit(0);
    })
    .catch((error) => {
      console.error('更新过程出错：', error);
      process.exit(1);
    });
}

export { updateImagePaths };

