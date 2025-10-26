require('dotenv').config();
const LineOfficialAccountService = require('./../services/lineOfficialAccountService');

async function testLineConnection() {
  console.log('🧪 เริ่มทดสอบ LINE Official Account...');
  console.log('====================================');
  
  try {
    // สร้าง instance ของ LINE service
    const lineService = new LineOfficialAccountService();
    
    // ตรวจสอบการตั้งค่า
    console.log('📋 ตรวจสอบการตั้งค่า:');
    console.log(`Channel Access Token: ${lineService.channelAccessToken ? '✅ มี' : '❌ ไม่มี'}`);
    console.log(`Channel Secret: ${lineService.channelSecret ? '✅ มี' : '❌ ไม่มี'}`);
    console.log(`User ID: ${lineService.userId ? '✅ มี' : '❌ ไม่มี'}`);
    console.log('');
    
    // ทดสอบการเชื่อมต่อ
    console.log('🔗 ทดสอบการเชื่อมต่อกับ LINE API...');
    await lineService.testConnection();
    console.log('✅ การเชื่อมต่อสำเร็จ!');
    console.log('');
    
    // ทดสอบส่งข้อความ
    console.log('💬 ทดสอบส่งข้อความ...');
    const testMessage = `🤖 ทดสอบ LINE Official Account

✅ ระบบ AOM Stock Notification ทำงานได้ปกติแล้ว!

📅 วันที่ทดสอบ: ${new Date().toLocaleString('th-TH', { timeZone: 'Asia/Bangkok' })}

🚀 ระบบพร้อมส่งการแจ้งเตือนหุ้นให้คุณแล้ว

---
กรุณาตอบกลับข้อความนี้เพื่อทดสอบการรับข้อความ`;

    await lineService.sendPushMessage(testMessage);
    console.log('✅ ส่งข้อความทดสอบสำเร็จ!');
    console.log('');
    
    // ทดสอบการส่งแจ้งเตือนต่างๆ
    console.log('📊 ทดสอบการส่งแจ้งเตือนตัวอย่าง...');
    
    // ทดสอบ Risk Alert
    const mockRiskStock = {
      symbol: 'TEST',
      riskAnalysis: {
        riskLevel: 'high',
        keyNews: 'ข่าวทดสอบ: บริษัททดสอบมีความเสี่ยงในการดำเนินธุรกิจ',
        summary: 'นี่เป็นการทดสอบระบบแจ้งเตือนความเสี่ยง',
        confidenceScore: 0.85,
        recommendation: 'พิจารณาขายหรือลดน้ำหนักการลงทุน'
      },
      news: [{
        source: 'ระบบทดสอบ',
        url: 'https://example.com/test-news'
      }]
    };
    
    await lineService.sendRiskAlert([mockRiskStock]);
    console.log('✅ ส่งแจ้งเตือนความเสี่ยงสำเร็จ!');
    
    // รอสักครู่
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // ทดสอบ Opportunity Alert
    const mockOpportunityStock = {
      symbol: 'TEST2',
      opportunityAnalysis: {
        opportunityLevel: 'high',
        keyNews: 'ข่าวทดสอบ: บริษัททดสอบ 2 มีโอกาสเติบโตดี',
        summary: 'นี่เป็นการทดสอบระบบแจ้งเตือนโอกาส',
        confidenceScore: 0.90,
        timeframe: '1-3 เดือน',
        priceTarget: '฿150-180'
      },
      news: [{
        source: 'ระบบทดสอบ',
        url: 'https://example.com/test-opportunity'
      }]
    };
    
    await lineService.sendOpportunityAlert([mockOpportunityStock]);
    console.log('✅ ส่งแจ้งเตือนโอกาสสำเร็จ!');
    
    // รอสักครู่
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // ทดสอบ Error Notification
    const mockError = new Error('นี่เป็นการทดสอบระบบแจ้งเตือนข้อผิดพลาด');
    await lineService.sendErrorNotification(mockError);
    console.log('✅ ส่งแจ้งเตือนข้อผิดพลาดสำเร็จ!');
    
    console.log('');
    console.log('🎉 การทดสอบทั้งหมดสำเร็จ!');
    console.log('====================================');
    console.log('📱 กรุณาตรวจสอบข้อความใน LINE ของคุณ');
    console.log('💡 ลองตอบกลับข้อความเพื่อทดสอบ AI Chat');
    
  } catch (error) {
    console.error('❌ เกิดข้อผิดพลาดในการทดสอบ:');
    console.error(`Error: ${error.message}`);
    console.error('Stack:', error.stack);
    
    // ตรวจสอบข้อผิดพลาดทั่วไป
    if (error.message.includes('Channel Access Token not configured')) {
      console.log('\n💡 แนะนำ: กรุณาตรวจสอบ LINE_CHANNEL_ACCESS_TOKEN ในไฟล์ .env');
    }
    
    if (error.message.includes('User ID not configured')) {
      console.log('\n💡 แนะนำ: กรุณาตรวจสอบ LINE_USER_ID ในไฟล์ .env');
    }
    
    if (error.response) {
      console.log('\n📡 Response from LINE API:');
      console.log('Status:', error.response.status);
      console.log('Data:', JSON.stringify(error.response.data, null, 2));
    }
  }
}

// เรียกใช้ฟังก์ชันทดสอบ
testLineConnection();