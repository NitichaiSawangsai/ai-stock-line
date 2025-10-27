// ทดสอบฟังก์ชันลบไฟล์
const fs = require('fs').promises;
const path = require('path');

async function testClearFile() {
  try {
    const outputPath = path.join(__dirname, 'data', 'output-summary.txt');
    
    console.log('📄 ตรวจสอบไฟล์ก่อนลบ...');
    try {
      const stats = await fs.stat(outputPath);
      console.log(`✅ ไฟล์มีอยู่: ${stats.size} bytes`);
    } catch (error) {
      console.log('❌ ไม่มีไฟล์อยู่');
      return;
    }
    
    console.log('🗑️ กำลังลบไฟล์...');
    await fs.unlink(outputPath);
    console.log('✅ ลบไฟล์สำเร็จ');
    
    // ตรวจสอบอีกครั้ง
    try {
      await fs.stat(outputPath);
      console.log('❌ ไฟล์ยังคงมีอยู่!');
    } catch (error) {
      console.log('✅ ยืนยัน: ไฟล์ถูกลบแล้ว');
    }
    
  } catch (error) {
    console.error('❌ เกิดข้อผิดพลาด:', error.message);
  }
}

testClearFile();