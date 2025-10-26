require('dotenv').config();
const LineOfficialAccountService = require('./../services/lineOfficialAccountService');

class LineOfficialTester {
  constructor() {
    this.lineService = new LineOfficialAccountService();
  }

  async runAllTests() {
    console.log('🧪 เริ่มทดสอบ LINE Official Account Service...\n');

    try {
      // Test 1: ทดสอบการเชื่อมต่อ
      await this.testConnection();

      // Test 2: ทดสอบการส่งข้อความทั่วไป
      await this.testSimpleMessage();

      // Test 3: ทดสอบการส่งข้อความเตือนความเสี่ยง
      await this.testRiskAlert();

      // Test 4: ทดสอบการส่งข้อความโอกาสการลงทุน
      await this.testOpportunityAlert();

      // Test 5: ทดสอบการส่งข้อความแจ้งข้อผิดพลาด
      await this.testErrorNotification();

      console.log('\n✅ ทดสอบทั้งหมดเสร็จสิ้น!');

    } catch (error) {
      console.error('❌ เกิดข้อผิดพลาดในการทดสอบ:', error.message);
    }
  }

  async testConnection() {
    console.log('📡 ทดสอบการเชื่อมต่อ LINE API...');
    
    try {
      const isConnected = await this.lineService.testConnection();
      console.log('✅ การเชื่อมต่อสำเร็จ:', isConnected);
      
      // แสดงข้อมูล config
      console.log('📋 ข้อมูล Configuration:');
      console.log(`   - Channel Access Token: ${this.lineService.channelAccessToken ? '✅ มี' : '❌ ไม่มี'}`);
      console.log(`   - Channel Secret: ${this.lineService.channelSecret ? '✅ มี' : '❌ ไม่มี'}`);
      console.log(`   - User ID: ${this.lineService.userId ? '✅ มี' : '❌ ไม่มี'}`);
      
    } catch (error) {
      console.error('❌ การเชื่อมต่อล้มเหลว:', error.message);
      throw error;
    }
    
    console.log();
  }

  async testSimpleMessage() {
    console.log('📝 ทดสอบการส่งข้อความทั่วไป...');
    
    try {
      const testMessage = `🧪 [ทดสอบระบบ] AOM Stock Notification

✅ ระบบ LINE Official Account ทำงานปกติ

📅 วันที่: ${new Date().toLocaleDateString('th-TH')}
⏰ เวลา: ${new Date().toLocaleTimeString('th-TH')}

🤖 ข้อความนี้ถูกส่งจากการทดสอบระบบ`;

      await this.lineService.sendPushMessage(testMessage);
      console.log('✅ ส่งข้อความทั่วไปสำเร็จ');
      
    } catch (error) {
      console.error('❌ ส่งข้อความทั่วไปล้มเหลว:', error.message);
    }
    
    console.log();
  }

  async testRiskAlert() {
    console.log('🚨 ทดสอบการส่งข้อความเตือนความเสี่ยง...');
    
    try {
      const mockHighRiskStock = {
        symbol: 'PTT',
        riskAnalysis: {
          riskLevel: 'high',
          keyNews: 'ราคาน้ำมันดิบโลกปรับตัวลดลงอย่างรุนแรง',
          summary: 'หุ้น PTT อาจได้รับผลกระทบจากการลดลงของราคาน้ำมันดิบ ควรติดตามสถานการณ์อย่างใกล้ชิด',
          confidenceScore: 0.85,
          recommendation: 'ระวังการลงทุน พิจารณาขาย'
        },
        news: [{
          source: 'Thai PBS',
          url: 'https://thaipbs.or.th/news/example'
        }]
      };

      await this.lineService.sendRiskAlert([mockHighRiskStock]);
      console.log('✅ ส่งข้อความเตือนความเสี่ยงสำเร็จ');
      
    } catch (error) {
      console.error('❌ ส่งข้อความเตือนความเสี่ยงล้มเหลว:', error.message);
    }
    
    console.log();
  }

  async testOpportunityAlert() {
    console.log('🔥 ทดสอบการส่งข้อความโอกาสการลงทุน...');
    
    try {
      const mockOpportunityStock = {
        symbol: 'ADVANC',
        opportunityAnalysis: {
          opportunityLevel: 'high',
          keyNews: 'บริษัทประกาศผลประกอบการเติบโตเกินคาดหวัง',
          summary: 'ADVANC มีศักยภาพในการเติบโตจากธุรกิจ 5G และ Digital Service',
          confidenceScore: 0.92,
          timeframe: '3-6 เดือน',
          priceTarget: '220-230 บาท'
        },
        news: [{
          source: 'Settrade',
          url: 'https://settrade.com/news/example'
        }]
      };

      await this.lineService.sendOpportunityAlert([mockOpportunityStock]);
      console.log('✅ ส่งข้อความโอกาสการลงทุนสำเร็จ');
      
    } catch (error) {
      console.error('❌ ส่งข้อความโอกาสการลงทุนล้มเหลว:', error.message);
    }
    
    console.log();
  }

  async testErrorNotification() {
    console.log('🚨 ทดสอบการส่งข้อความแจ้งข้อผิดพลาด...');
    
    try {
      const mockError = new Error('ระบบดาวน์โหลดข้อมูลหุ้นล้มเหลว: Connection timeout');
      
      await this.lineService.sendErrorNotification(mockError);
      console.log('✅ ส่งข้อความแจ้งข้อผิดพลาดสำเร็จ');
      
    } catch (error) {
      console.error('❌ ส่งข้อความแจ้งข้อผิดพลาดล้มเหลว:', error.message);
    }
    
    console.log();
  }

  async testSpecificMessage(message) {
    console.log('📤 ทดสอบการส่งข้อความที่กำหนดเอง...');
    
    try {
      await this.lineService.sendPushMessage(message);
      console.log('✅ ส่งข้อความที่กำหนดเองสำเร็จ');
      
    } catch (error) {
      console.error('❌ ส่งข้อความที่กำหนดเองล้มเหลว:', error.message);
    }
  }

  // Test method สำหรับทดสอบเฉพาะการเชื่อมต่อ
  async testConnectionOnly() {
    console.log('🔍 ทดสอบการเชื่อมต่อเท่านั้น...\n');
    
    try {
      await this.testConnection();
      console.log('✅ ทดสอบการเชื่อมต่อเสร็จสิ้น!');
      
    } catch (error) {
      console.error('❌ การทดสอบการเชื่อมต่อล้มเหลว:', error.message);
    }
  }

  // Test method สำหรับทดสอบเฉพาะการส่งข้อความ
  async testMessageOnly() {
    console.log('💬 ทดสอบการส่งข้อความเท่านั้น...\n');
    
    try {
      await this.testSimpleMessage();
      console.log('✅ ทดสอบการส่งข้อความเสร็จสิ้น!');
      
    } catch (error) {
      console.error('❌ การทดสอบการส่งข้อความล้มเหลว:', error.message);
    }
  }

  // แสดงข้อมูล config ที่อ่านได้
  showConfig() {
    console.log('📋 ข้อมูล LINE Configuration:');
    console.log('================================');
    console.log(`Channel Access Token: ${this.lineService.channelAccessToken ? 'มี (' + this.lineService.channelAccessToken.substring(0, 20) + '...)' : 'ไม่มี'}`);
    console.log(`Channel Secret: ${this.lineService.channelSecret ? 'มี (' + this.lineService.channelSecret.substring(0, 10) + '...)' : 'ไม่มี'}`);
    console.log(`User ID: ${this.lineService.userId ? 'มี (' + this.lineService.userId + ')' : 'ไม่มี'}`);
    console.log(`API URL: ${this.lineService.messagingApiUrl}`);
    console.log(`Timeout: ${this.lineService.timeout}ms`);
    console.log('================================\n');
  }
}

// ฟังก์ชันสำหรับรันจาก command line
async function main() {
  const tester = new LineOfficialTester();
  
  // รับ argument จาก command line
  const args = process.argv.slice(2);
  const command = args[0] || 'all';
  
  switch (command) {
    case 'config':
      tester.showConfig();
      break;
      
    case 'connection':
      await tester.testConnectionOnly();
      break;
      
    case 'message':
      await tester.testMessageOnly();
      break;
      
    case 'custom':
      const customMessage = args.slice(1).join(' ') || 'ข้อความทดสอบจาก command line';
      await tester.testSpecificMessage(customMessage);
      break;
      
    case 'all':
    default:
      await tester.runAllTests();
      break;
  }
}

// เรียกใช้งานหากเป็นการรันไฟล์โดยตรง
if (require.main === module) {
  main().catch(console.error);
}

module.exports = LineOfficialTester;