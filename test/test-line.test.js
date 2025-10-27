require('dotenv').config();
const { MessageService } = require('../services/messageService');

async function testLINE() {
    console.log('🧪 กำลังทดสอบ LINE Service...');
    
    try {
        const messageService = new MessageService({
            channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
            channelSecret: process.env.LINE_CHANNEL_SECRET,
            userId: process.env.LINE_USER_ID
        });
        
        const testMessage = `📱 ทดสอบ LINE Service
วันที่: ${new Date().toLocaleString('th-TH')}

นี่เป็นการทดสอบการส่งข้อความไปยัง LINE
✅ หากคุณเห็นข้อความนี้แสดงว่าระบบทำงานปกติ

🔧 รายละเอียดการทดสอบ:
• การเชื่อมต่อ LINE API: สำเร็จ
• การส่งข้อความ: สำเร็จ
• การจัดรูปแบบข้อความ: สำเร็จ

🎉 ระบบพร้อมใช้งาน!`;

        console.log('📱 กำลังส่งข้อความทดสอบไปยัง LINE...');
        const result = await messageService.sendAnalysisResult(testMessage);
        
        if (result.success) {
            console.log(`✅ ส่งข้อความสำเร็จ! (วิธี: ${result.method})`);
            
            if (result.method === 'file') {
                console.log('📁 ข้อความถูกบันทึกในไฟล์เนื่องจาก LINE ไม่สามารถใช้งานได้');
            }
        } else {
            console.error('❌ ส่งข้อความล้มเหลว');
        }
        
        // Test cost summary sending
        console.log('\n💰 กำลังทดสอบการส่งสรุปค่าใช้จ่าย...');
        const costTestMessage = `💰 ทดสอบการส่งสรุปค่าใช้จ่าย

📊 ข้อมูลทดสอบ:
• Token ที่ใช้: 1,234 tokens
• ค่าใช้จ่าย: $0.0123 (0.43 บาท)
• โมเดล: gemini/gemini-2.5-flash

✅ การทดสอบเสร็จสิ้น`;

        const costResult = await messageService.sendCostSummary(costTestMessage);
        
        if (costResult.success) {
            console.log(`✅ ส่งสรุปค่าใช้จ่ายสำเร็จ! (วิธี: ${costResult.method})`);
        }
        
    } catch (error) {
        console.error('❌ การทดสอบ LINE ล้มเหลว:', error.message);
        console.log('\n💡 แนะนำ:');
        console.log('1. ตรวจสอบ LINE_CHANNEL_ACCESS_TOKEN ใน .env');
        console.log('2. ตรวจสอบ LINE_CHANNEL_SECRET ใน .env');
        console.log('3. ตรวจสอบ LINE_USER_ID ใน .env');
        console.log('4. ตรวจสอบการเชื่อมต่ออินเทอร์เน็ต');
        process.exit(1);
    }
}

testLINE();