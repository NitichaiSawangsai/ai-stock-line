require('dotenv').config();
const LineOfficialAccountService = require('./../services/lineOfficialAccountService');

async function testLineMessageFormat() {
  console.log('📱 ทดสอบการแสดงผลข้อความ LINE แบบใหม่...\n');
  
  try {
    const lineService = new LineOfficialAccountService();
    
    // สร้างข้อมูลทดสอบแบบที่ผู้ใช้ต้องการ
    const mockOpportunityStock = {
      symbol: 'ADVANC',
      opportunityAnalysis: {
        isOpportunity: true,
        opportunityLevel: 'high',
        summary: 'ADVANC มีศักยภาพในการเติบโตจากธุรกิจ 5G และ Digital Service ผลประกอบการไตรมาส 3 เติบโตเกินคาดหวัง และมีแผนขยายเครือข่าย 5G SA ครอบคลุม 95% ของประเทศ',
        confidenceScore: 0.92,
        timeframe: '3-6 เดือน',
        priceTarget: '220-230 บาท',
        keyNews: 'บริษัทประกาศผลประกอบการเติบโตเกินคาดหวัง',
        positiveFactors: [
          'ผลประกอบการไตรมาส 3 เติบโต 15% จากปีที่แล้ว',
          'การขยายเครือข่าย 5G SA ครอบคลุม 95% ของประเทศ',
          'นักวิเคราะห์ปรับเป้าหมายราคาขึ้นเป็น 240-250 บาท',
          'แนวโน้มธุรกิจดิจิทัลและ IoT เติบโตแข็งแกร่ง'
        ]
      },
      news: [
        {
          title: 'ADVANC ประกาศผลประกอบการไตรมาส 3 เติบโตเกินคาดหวัง กำไรสุทธิ 7,200 ล้านบาท',
          description: 'บริษัท แอดวานซ์ อินโฟร์ เซอร์วิส จำกัด (มหาชน) รายงานผลประกอบการไตรมาส 3/2568 กำไรสุทธิ 7,200 ล้านบาท เติบโต 15%',
          source: 'Settrade',
          url: 'https://settrade.com/news/advanc-q3-earnings-2025'
        },
        {
          title: 'AIS เปิดตัวบริการ 5G SA รุ่นใหม่ขยายครอบคลุม 95% ของประเทศ',
          description: 'บริการ 5G Standalone ใหม่จะช่วยเพิ่มประสิทธิภาพและรองรับ IoT, Smart City และ Industry 4.0',
          source: 'Thailand Business News',
          url: 'https://tbn.co.th/news/ais-5g-sa-expansion-2025'
        },
        {
          title: 'นักวิเคราะห์เชียร์ซื้อ ADVANC เป้าหมาย 250 บาท',
          description: 'หลายสำนักวิเคราะห์ปรับเป้าราคา ADVANC ขึ้นเป็น 240-250 บาท หลังผลงานโดดเด่น',
          source: 'Money Channel',
          url: 'https://moneychannel.co.th/news/advanc-target-250-baht'
        }
      ]
    };
    
    // ทดสอบการแสดงผลข้อความโอกาส
    console.log('🔥 ตัวอย่างข้อความแจ้งเตือนโอกาส:');
    console.log('═'.repeat(80));
    const opportunityMessage = lineService.formatOpportunityMessage(mockOpportunityStock);
    console.log(opportunityMessage);
    console.log('═'.repeat(80));
    
    // สร้างข้อมูลทดสอบสำหรับความเสี่ยง
    const mockRiskStock = {
      symbol: 'XYZ',
      riskAnalysis: {
        isHighRisk: true,
        riskLevel: 'high',
        summary: 'หุ้น XYZ มีความเสี่ยงสูงจากการที่บริษัทประกาศขาดทุนใหญ่ และมีข่าวเรื่องการสอบสวนทางการเงิน ทำให้นักลงทุนควรระวังและพิจารณาขาย',
        confidenceScore: 0.88,
        recommendation: 'พิจารณาขายหรือลดน้ำหนักการลงทุน',
        keyNews: 'บริษัทประกาศขาดทุนใหญ่และถูกสอบสวนทางการเงิน',
        threats: [
          'การขาดทุนใหญ่ในไตรมาส 3',
          'การสอบสวนทางการเงินจากหน่วยงานกำกับดูแล',
          'ความเสี่ยงในการปิดตัวหรือล้มละลาย',
          'ความไม่แน่นอนในการดำเนินธุรกิจต่อไป'
        ]
      },
      news: [
        {
          title: 'XYZ ประกาศขาดทุนใหญ่ 2.5 พันล้านบาท พร้อมถูกสอบสวนทางการเงิน',
          description: 'บริษัท XYZ รายงานผลการดำเนินงานขาดทุนสุทธิ 2.5 พันล้านบาท และถูกหน่วยงานกำกับดูแลสอบสวนการทำรายการผิดปกติ',
          source: 'Business Alert',
          url: 'https://business-alert.com/news/xyz-major-loss-investigation'
        },
        {
          title: 'ความเสี่ยงการปิดตัวของ XYZ เพิ่มขึ้นหลังขาดทุนต่อเนื่อง',
          description: 'นักวิเคราะห์ประเมินความเสี่ยงการปิดตัวของ XYZ เพิ่มขึ้นเป็น 60% หลังจากขาดทุนต่อเนื่อง 4 ไตรมาส',
          source: 'Risk Analysis Today',
          url: 'https://risk-analysis.com/news/xyz-closure-risk-60-percent'
        }
      ]
    };
    
    console.log('\n🚨 ตัวอย่างข้อความแจ้งเตือนความเสี่ยง:');
    console.log('═'.repeat(80));
    const riskMessage = lineService.formatRiskMessage(mockRiskStock);
    console.log(riskMessage);
    console.log('═'.repeat(80));
    
    console.log('\n✅ การทดสอบการแสดงผลข้อความ LINE เสร็จสิ้น!');
    console.log('\n💡 คุณสมบัติที่เพิ่มเข้ามา:');
    console.log('   ✓ แสดงปัจจัยบวก/ภัยคุกคามหลายรายการ');
    console.log('   ✓ แสดงข่าวหลายอันพร้อมหัวข้อและลิงก์');
    console.log('   ✓ จำกัดความยาวหัวข้อข่าวเพื่อไม่ให้ยาวเกินไป');
    console.log('   ✓ กรองลิงก์ mock/example ออก');
    console.log('   ✓ แสดงเวลาเป็นภาษาไทย');
    
  } catch (error) {
    console.error('❌ การทดสอบล้มเหลว:', error.message);
  }
}

// เรียกใช้ฟังก์ชันทดสอบ
testLineMessageFormat();