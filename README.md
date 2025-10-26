# AI Stock Risk Notification System | ระบบแจ้งเตือนความเสี่ยงหุ้นด้วย AI

<p align="center">
  <img src="https://img.shields.io/badge/AI-Free%20100%25-green" alt="Free AI"/>
  <img src="https://img.shields.io/badge/Node.js-v16+-blue" alt="Node.js"/>
  <img src="https://img.shields.io/badge/LINE-Official%20Account-00c300" alt="LINE"/>
  <img src="https://img.shields.io/badge/Google-Gemini%20AI-orange" alt="Gemini AI"/>
</p>

## 📋 Overview | ภาพรวม

**English:** An intelligent stock portfolio monitoring system that uses free AI services to analyze market risks and opportunities, sending real-time notifications through LINE Official Account. The system supports automatic fallback between multiple AI providers and operates with zero ongoing AI costs.

**ไทย:** ระบบตรวจสอบพอร์ตการลงทุนอัจฉริยะที่ใช้บริการ AI ฟรี 100% ในการวิเคราะห์ความเสี่ยงและโอกาสทางการตลาด พร้อมส่งการแจ้งเตือนแบบเรียลไทม์ผ่าน LINE Official Account ระบบรองรับการสลับ AI อัตโนมัติและไม่มีค่าใช้จ่าย AI

## ✨ Features | ฟีเจอร์

### 🤖 AI-Powered Analysis | การวิเคราะห์ด้วย AI
- **Free AI Services** | **บริการ AI ฟรี**: Google Gemini AI + Mock responses
- **Automatic Fallback** | **สลับอัตโนมัติ**: ChatGPT → Gemini → Mock responses
- **Risk Assessment** | **ประเมินความเสี่ยง**: High-risk stock detection with detailed analysis
- **Opportunity Detection** | **ตรวจหาโอกาส**: Market opportunities identification

### 📱 LINE Integration | การเชื่อมต่อ LINE
- **Real-time Notifications** | **แจ้งเตือนแบบเรียลไทม์**: Instant risk and opportunity alerts
- **Rich Message Format** | **รูปแบบข้อความสมบูรณ์**: Multiple news sources with clickable links
- **Interactive Chat** | **แชทโต้ตอบ**: AI-powered chat responses about your portfolio

### 📊 Multi-Asset Support | รองรับหลายประเภทสินทรัพย์
- **Stocks** | **หุ้น**: Individual stock analysis
- **Cryptocurrency** | **สกุลเงินดิจิทัล**: Crypto market monitoring
- **Gold** | **ทอง**: Precious metals tracking
- **Forex** | **สกุลเงิน**: Currency exchange analysis

### 📈 Data Sources | แหล่งข้อมูล
- **Google Drive Integration** | **เชื่อมต่อ Google Drive**: Portfolio data from spreadsheets
- **Multiple News APIs** | **API ข่าวหลากหลาย**: RSS feeds, financial news aggregation
- **Free Data Sources** | **แหล่งข้อมูลฟรี**: Yahoo Finance, Reuters RSS feeds

## 🚀 Installation | การติดตั้ง

### Prerequisites | ข้อกำหนดเบื้องต้น

**English:**
- Node.js v16 or higher
- LINE Official Account
- Google Drive account (for portfolio data)
- Google Gemini API key (optional, free tier available)

**ไทย:**
- Node.js เวอร์ชัน 16 ขึ้นไป
- LINE Official Account
- บัญชี Google Drive (สำหรับข้อมูลพอร์ต)
- Google Gemini API key (ไม่บังคับ มีแผนฟรี)

### Quick Start | เริ่มต้นใช้งาน

```bash
# Clone repository | โคลนโปรเจค
git clone https://github.com/NitichaiSawangsai/ai-stock-line.git
cd ai-stock-line

# Install dependencies | ติดตั้ง dependencies
npm install
# or | หรือ
yarn install

# Copy environment template | คัดลอกไฟล์ environment
cp .env.example .env

# Edit configuration | แก้ไขการตั้งค่า
nano .env

# Run development mode | รันโหมดพัฒนา
npm run dev
# or | หรือ
yarn run dev

# Run production | รันแบบ production
npm start
# or | หรือ
yarn start
```

## ⚙️ Configuration | การตั้งค่า

### Environment Variables | ตัวแปรสภาพแวดล้อม

Create a `.env` file in the root directory with the following configuration:

สร้างไฟล์ `.env` ในโฟลเดอร์หลักพร้อมการตั้งค่าดังนี้:

```env
# OpenAI ChatGPT API (Optional - ไม่บังคับ)
OPENAI_API_KEY=disabled  # Set to 'disabled' for free mode | ตั้งเป็น 'disabled' สำหรับโหมดฟรี

# Google Gemini AI (Free - ฟรี)
GEMINI_API_KEY=your-gemini-api-key-here  # Or 'free' for mock responses | หรือ 'free' สำหรับ mock

# LINE Official Account (Required - จำเป็น)
LINE_CHANNEL_ACCESS_TOKEN=your-line-access-token
LINE_CHANNEL_SECRET=your-line-channel-secret
LINE_USER_ID=your-line-user-id

# Stock Data Source (Required - จำเป็น)
STOCKS_FILE_URL=https://drive.google.com/uc?id=YOUR-GOOGLE-DRIVE-FILE-ID&export=download
STOCKS_CONTEXT_URL=your-additional-context-url

# News API (Optional - ไม่บังคับ)
NEWS_API_KEY=your-news-api-key  # Or 'free' for RSS feeds | หรือ 'free' สำหรับ RSS feeds

# Application Settings (การตั้งค่าแอป)
NODE_ENV=production
LOG_LEVEL=info
```

### Getting API Keys | การขอ API Keys

#### 1. LINE Official Account | บัญชี LINE Official

**English:**
1. Visit [LINE Developers Console](https://developers.line.biz/)
2. Create a new channel (Messaging API)
3. Get Channel Access Token and Channel Secret
4. Add your LINE User ID (can be found in LINE app settings)

**ไทย:**
1. เข้าไปที่ [LINE Developers Console](https://developers.line.biz/)
2. สร้าง channel ใหม่ (Messaging API)
3. รับ Channel Access Token และ Channel Secret
4. เพิ่ม LINE User ID ของคุณ (หาได้ในการตั้งค่าแอป LINE)

#### 2. Google Gemini AI (Free) | Google Gemini AI (ฟรี)

**English:**
1. Visit [Google AI Studio](https://makersuite.google.com/app/apikey)
2. Sign in with Google account
3. Create new API key
4. Copy the key to your `.env` file

**ไทย:**
1. เข้าไปที่ [Google AI Studio](https://makersuite.google.com/app/apikey)
2. เข้าสู่ระบบด้วยบัญชี Google
3. สร้าง API key ใหม่
4. คัดลอก key ไปใส่ในไฟล์ `.env`

#### 3. Google Drive Portfolio File | ไฟล์พอร์ตใน Google Drive

**English:**
1. Create a Google Sheets file with your portfolio
2. Format: Symbol, Type, Amount, Unit (e.g., "AAPL,หุ้น,100,หุ้น")
3. Share the file publicly or get the file ID
4. Use the direct download URL format

**ไทย:**
1. สร้างไฟล์ Google Sheets ที่มีข้อมูลพอร์ตของคุณ
2. รูปแบบ: Symbol, Type, Amount, Unit (เช่น "AAPL,หุ้น,100,หุ้น")
3. แชร์ไฟล์แบบสาธารณะ หรือเอา file ID
4. ใช้ URL ดาวน์โหลดตรง

**Example Portfolio Format | ตัวอย่างรูปแบบพอร์ต:**
```csv
ประเภท ชื่อ หน่วยที่ลงทุน
หุ้น VOO 0.00394415
ทอง ทอง 1 บาท
สกุลเงิน USD 100 usb
สกุลเงินคริปโต BTC 1 btc
หุ้น NVDA -
```

## 🧪 Testing | การทดสอบ

### Available Tests | การทดสอบที่มี

```bash
# Run all tests | รันการทดสอบทั้งหมด
npm test
# or | หรือ
yarn test

# Individual test files | ไฟล์ทดสอบแยก
node test/quick-test.test-e2e.js          # Quick system test | ทดสอบระบบอย่างรวดเร็ว
node test/test-download.test-e2e.js       # Data download test | ทดสอบการดาวน์โหลดข้อมูล
node test/test-line.test-e2e.js           # LINE API test | ทดสอบ LINE API
node test/test-line-official.test-e2e.js  # LINE Official Account test | ทดสอบ LINE Official Account
node test/test-openai.test-e2e.js         # OpenAI API test | ทดสอบ OpenAI API
node test/test-ai-fallback.test-e2e.js    # AI fallback system test | ทดสอบระบบสำรอง AI
node test/test-gemini-real.test-e2e.js    # Real Gemini API test | ทดสอบ Gemini API จริง
node test/test-line-format.test-e2e.js    # LINE message format test | ทดสอบรูปแบบข้อความ LINE
```

### Test Descriptions | คำอธิบายการทดสอบ

| Test File | Purpose (EN) | วัตถุประสงค์ (TH) |
|-----------|--------------|-------------------|
| `quick-test` | Fast system health check | ตรวจสุขภาพระบบอย่างรวดเร็ว |
| `test-download` | Portfolio data retrieval | การดึงข้อมูลพอร์ต |
| `test-line` | Basic LINE API functionality | ฟังก์ชัน LINE API พื้นฐาน |
| `test-line-official` | Official account features | ฟีเจอร์บัญชีทางการ |
| `test-openai` | ChatGPT integration | การเชื่อมต่อ ChatGPT |
| `test-ai-fallback` | AI service switching | การสลับบริการ AI |
| `test-gemini-real` | Real Gemini API calls | การเรียก Gemini API จริง |
| `test-line-format` | Message formatting | การจัดรูปแบบข้อความ |

### Test Requirements | ข้อกำหนดการทดสอบ

**English:**
- All environment variables must be properly configured
- Internet connection required for API tests
- LINE Official Account must be properly set up
- Google Drive file must be accessible

**ไทย:**
- ตัวแปรสภาพแวดล้อมทั้งหมดต้องตั้งค่าให้ถูกต้อง
- ต้องมีอินเทอร์เน็ตสำหรับทดสอบ API
- LINE Official Account ต้องตั้งค่าให้เรียบร้อย
- ไฟล์ Google Drive ต้องเข้าถึงได้

## 🔄 Running Modes | โหมดการทำงาน

### Development Mode | โหมดพัฒนา
```bash
npm run dev
# Features: Test all services, detailed logging, one-time execution
# ฟีเจอร์: ทดสอบบริการทั้งหมด, log รายละเอียด, รันครั้งเดียว
```

### Production Mode | โหมด Production
```bash
npm start
# Features: Scheduled execution, optimized logging, continuous monitoring
# ฟีเจอร์: รันตามตาราง, log ที่เพิ่มประสิทธิภาพ, ตรวจสอบต่อเนื่อง
```

### Webhook Mode | โหมด Webhook
```bash
npm run webhook
# Features: LINE webhook server for interactive chat
# ฟีเจอร์: เซิร์ฟเวอร์ webhook ของ LINE สำหรับแชทโต้ตอบ
```

### Cron Setup | ตั้งค่า Cron
```bash
npm run setup-cron
# Features: Automatic cron job installation
# ฟีเจอร์: ติดตั้งงาน cron อัตโนมัติ
```

## 📁 Project Structure | โครงสร้างโปรเจค

```
ai-stock-line/
├── main.js                 # Main application entry point | จุดเริ่มต้นแอปหลัก
├── webhook.js              # LINE webhook server | เซิร์ฟเวอร์ webhook ของ LINE
├── test-runner.js          # Test automation runner | ตัวรันการทดสอบอัตโนมัติ
├── ecosystem.config.js     # PM2 configuration | การตั้งค่า PM2
├── package.json            # Dependencies and scripts | Dependencies และ scripts
├── .env                    # Environment variables | ตัวแปรสภาพแวดล้อม
├── crontab.example         # Cron job example | ตัวอย่างงาน cron
├── services/               # Core business logic | ตรรกะธุรกิจหลัก
│   ├── stockDataService.js        # Portfolio data management | การจัดการข้อมูลพอร์ต
│   ├── newsAnalysisService.js     # News analysis & AI orchestration | การวิเคราะห์ข่าวและ AI
│   ├── geminiAnalysisService.js   # Google Gemini AI integration | การเชื่อมต่อ Google Gemini AI
│   ├── lineNotificationService.js # Basic LINE messaging | การส่งข้อความ LINE พื้นฐาน
│   ├── lineOfficialAccountService.js # Advanced LINE features | ฟีเจอร์ LINE ขั้นสูง
│   ├── googleDriveService.js      # Google Drive integration | การเชื่อมต่อ Google Drive
│   └── schedulerService.js        # Task scheduling | การกำหนดตารางงาน
├── test/                   # Test files | ไฟล์ทดสอบ
│   ├── quick-test.test-e2e.js           # Quick system test | ทดสอบระบบอย่างรวดเร็ว
│   ├── test-download.test-e2e.js        # Data download test | ทดสอบการดาวน์โหลด
│   ├── test-line.test-e2e.js            # LINE API test | ทดสอบ LINE API
│   ├── test-line-official.test-e2e.js   # LINE Official test | ทดสอบ LINE Official
│   ├── test-openai.test-e2e.js          # OpenAI test | ทดสอบ OpenAI
│   ├── test-ai-fallback.test-e2e.js     # AI fallback test | ทดสอบสำรอง AI
│   ├── test-gemini-real.test-e2e.js     # Real Gemini test | ทดสอบ Gemini จริง
│   ├── test-line-format.test-e2e.js     # LINE format test | ทดสอบรูปแบบ LINE
│   └── data/                            # Test data files | ไฟล์ข้อมูลทดสอบ
└── logs/                   # Application logs | ล็อกแอปพลิเคชัน
    └── (auto-generated)    # Automatically created log files | ไฟล์ล็อกที่สร้างอัตโนมัติ
```

## 🔧 Troubleshooting | การแก้ไขปัญหา

### Common Issues | ปัญหาที่พบบ่อย

#### 1. LINE Connection Failed | การเชื่อมต่อ LINE ล้มเหลว

**English:**
- Verify LINE_CHANNEL_ACCESS_TOKEN is correct
- Check LINE_CHANNEL_SECRET matches your channel
- Ensure LINE_USER_ID is your actual user ID
- Test with `node test/test-line-official.test-e2e.js`

**ไทย:**
- ตรวจสอบ LINE_CHANNEL_ACCESS_TOKEN ให้ถูกต้อง
- เช็ค LINE_CHANNEL_SECRET ให้ตรงกับ channel ของคุณ
- ตรวจสอบ LINE_USER_ID ให้เป็น user ID จริงของคุณ
- ทดสอบด้วย `node test/test-line-official.test-e2e.js`

#### 2. Portfolio Data Not Loading | ข้อมูลพอร์ตโหลดไม่ได้

**English:**
- Check STOCKS_FILE_URL is accessible
- Verify Google Drive file permissions (public read access)
- Test with `node test/test-download.test-e2e.js`
- Ensure CSV format is correct

**ไทย:**
- ตรวจสอบ STOCKS_FILE_URL เข้าถึงได้
- ตรวจสอบสิทธิ์ไฟล์ Google Drive (อ่านได้แบบสาธารณะ)
- ทดสอบด้วย `node test/test-download.test-e2e.js`
- ตรวจสอบรูปแบบ CSV ให้ถูกต้อง

#### 3. AI Services Not Working | บริการ AI ไม่ทำงาน

**English:**
- For Gemini: Check API key at [Google AI Studio](https://makersuite.google.com/app/apikey)
- Set GEMINI_API_KEY=free for mock responses
- Test with `node test/test-ai-fallback.test-e2e.js`
- All AI services have automatic fallbacks

**ไทย:**
- สำหรับ Gemini: ตรวจสอบ API key ที่ [Google AI Studio](https://makersuite.google.com/app/apikey)
- ตั้ง GEMINI_API_KEY=free สำหรับ mock responses
- ทดสอบด้วย `node test/test-ai-fallback.test-e2e.js`
- บริการ AI ทั้งหมดมีระบบสำรองอัตโนมัติ

### Debug Mode | โหมดแก้ไขจุดบกพร่อง

```bash
# Enable detailed logging | เปิดใช้งาน log รายละเอียด
LOG_LEVEL=debug npm run dev

# Test specific component | ทดสอบส่วนประกอบเฉพาะ
node test/quick-test.test-e2e.js

# Check system health | ตรวจสอบสุขภาพระบบ
npm run dev
```

## 🔒 Security Notes | หมายเหตุความปลอดภัย

**English:**
- Keep API keys secure and never commit them to version control
- Use environment variables for all sensitive data
- Regularly rotate API keys
- Monitor API usage and costs
- Set up proper firewall rules for webhook endpoints

**ไทย:**
- เก็บ API keys ให้ปลอดภัยและไม่เคย commit ลง version control
- ใช้ตัวแปรสภาพแวดล้อมสำหรับข้อมูลที่ละเอียดอ่อนทั้งหมด
- หมุนเวียน API keys เป็นประจำ
- ตรวจสอบการใช้งาน API และค่าใช้จ่าย
- ตั้งค่า firewall ให้ถูกต้องสำหรับ webhook endpoints

## 💰 Cost Information | ข้อมูลค่าใช้จ่าย

### Free Tier Usage | การใช้งานแผนฟรี

| Service | Free Limit | Cost After Limit |
|---------|------------|------------------|
| Google Gemini | 15 RPM, 100 RPD | $0.00025/1K tokens |
| LINE Official | 1,000 messages/month | $0.003/message |
| News APIs | RSS feeds (unlimited) | N/A |

**Note:** This system is designed to operate within free tiers. Monitor usage to avoid unexpected charges.

**หมายเหตุ:** ระบบนี้ออกแบบให้ทำงานในแผนฟรี ตรวจสอบการใช้งานเพื่อหลีกเลี่ยงค่าใช้จ่ายที่ไม่คาดคิด

## 🤝 Contributing | การมีส่วนร่วม

**English:**
1. Fork the repository
2. Create a feature branch
3. Add tests for new functionality
4. Ensure all tests pass
5. Submit a pull request

**ไทย:**
1. Fork repository
2. สร้าง feature branch
3. เพิ่มการทดสอบสำหรับฟังก์ชันใหม่
4. ตรวจสอบให้การทดสอบทั้งหมดผ่าน
5. ส่ง pull request

## 📄 License | ลิขสิทธิ์

MIT License - feel free to use this project for personal or commercial purposes.

MIT License - สามารถใช้โปรเจคนี้เพื่อการใช้งานส่วนตัวหรือเชิงพาณิชย์ได้

## 📞 Support | การสนับสนุน

**English:**
- Create an issue on GitHub for bugs or feature requests
- Check the test files for usage examples
- Review the troubleshooting section above

**ไทย:**
- สร้าง issue บน GitHub สำหรับบั๊กหรือการขอฟีเจอร์
- ดูไฟล์ทดสอบสำหรับตัวอย่างการใช้งาน
- อ่านส่วนการแก้ไขปัญหาข้างต้น

---

## 🚀 Quick Start Example | ตัวอย่างการเริ่มต้นอย่างรวดเร็ว

```bash
# 1. Clone and install | โคลนและติดตั้ง
git clone https://github.com/NitichaiSawangsai/ai-stock-line.git
cd ai-stock-line
npm install

# 2. Copy environment file | คัดลอกไฟล์ environment
cp .env.example .env

# 3. Edit .env with your keys | แก้ไข .env ด้วย keys ของคุณ
# LINE_CHANNEL_ACCESS_TOKEN=your-token
# LINE_CHANNEL_SECRET=your-secret
# LINE_USER_ID=your-user-id
# STOCKS_FILE_URL=your-google-drive-url

# 4. Test the system | ทดสอบระบบ
npm test

# 5. Run development mode | รันโหมดพัฒนา
npm run dev

# 6. Check LINE for notifications! | ตรวจสอบ LINE สำหรับการแจ้งเตือน!
```

**Success! Your AI stock monitoring system is now running with zero ongoing costs! 🎉**

**สำเร็จ! ระบบตรวจสอบหุ้น AI ของคุณกำลังทำงานโดยไม่มีค่าใช้จ่ายต่อเนื่อง! 🎉**
