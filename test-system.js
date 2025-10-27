// ทดสอบฟังก์ชันการแปลภาษาไทยและลบไฟล์
const fs = require('fs').promises;
const path = require('path');

// สร้างไฟล์ทดสอบ
async function createTestFile() {
  const outputPath = path.join(__dirname, 'data', 'output-summary.txt');
  const testContent = 'ไฟล์ทดสอบ';
  
  try {
    await fs.writeFile(outputPath, testContent);
    console.log('✅ สร้างไฟล์ทดสอบสำเร็จ');
    
    // ตรวจสอบว่าไฟล์มีอยู่
    const exists = await fs.access(outputPath).then(() => true).catch(() => false);
    console.log('📄 ไฟล์มีอยู่:', exists);
    
    if (exists) {
      // ลบไฟล์
      await fs.unlink(outputPath);
      console.log('🗑️ ลบไฟล์สำเร็จ');
      
      // ตรวจสอบว่าไฟล์ถูกลบแล้ว
      const stillExists = await fs.access(outputPath).then(() => true).catch(() => false);
      console.log('📄 ไฟล์ยังมีอยู่หลังลบ:', stillExists);
    }
    
  } catch (error) {
    console.error('❌ เกิดข้อผิดพลาด:', error.message);
  }
}

// ทดสอบการแปลภาษาไทยแบบง่าย
async function testTranslation() {
  console.log('\n🔤 ทดสอบการแปลภาษาไทย:');
  
  // ใช้ dictionary แบบง่าย ๆ สำหรับทดสอบ
  const translations = {
    'Europe mostly up in premarket, Fed in focus': 'ยุโรปส่วนใหญ่อยู่ในช่วงพรีมาร์เก็ต โดยเน้นที่ธนาคารกลางสหรัฐ',
    'Stocks Rally as US, China Near Trade Deal': 'หุ้นพุ่งแรงเมื่อสหรัฐฯ และจีนใกล้ข้อตกลงการค้า',
    'Reuters': 'รอยเตอร์',
    'MarketWatch': 'มาร์เก็ตวอทช์',
    'Yahoo Finance': 'ยาฮูไฟแนนซ์'
  };
  
  for (const [english, thai] of Object.entries(translations)) {
    console.log(`🔸 "${english}" → "${thai}"`);
  }
}

// รันการทดสอบ
async function runTests() {
  console.log('🧪 เริ่มการทดสอบระบบ...\n');
  
  await createTestFile();
  await testTranslation();
  
  console.log('\n✅ การทดสอบเสร็จสิ้น!');
}

runTests();