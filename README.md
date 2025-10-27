# 🤖 AI Stock Analysis System / ระบบวิเคราะห์หุ้นด้วย AI

## 📊 คำอธิบาย / Description

**ภาษาไทย:**
ระบบวิเคราะห์หุ้นอัตโนมัติที่ใช้ AI เพื่อประเมินความเสี่ยงและโอกาสกำไรของพอร์ตการลงทุน โดยดึงข้อมูลข่าวสารจากอินเทอร์เน็ตแบบเรียลไทม์และส่งผลการวิเคราะห์ผ่าน LINE หรือบันทึกลงไฟล์

**English:**
An automated stock analysis system powered by AI to assess investment portfolio risks and opportunities. It fetches real-time news from the internet and delivers analysis results via LINE or saves to files.

---

## ✨ ความสามารถหลัก / Key Features

### 🔍 การวิเคราะห์ข้อมูล / Data Analysis
- **ดาวน์โหลดข้อมูลหุ้น** / Download stock data from Google Drive
- **ค้นหาข่าวแบบเรียลไทม์** / Real-time news search from Google & News API
- **การวิเคราะห์ด้วย AI** / AI-powered analysis using Google Gemini or OpenAI
- **ประเมินความเสี่ยง** / Risk assessment (1-10 scale)
- **คาดการณ์โอกาสกำไร** / Profit opportunity prediction (1-10 scale)

### 🌐 แหล่งข้อมูลข่าว / News Sources
- **เศรษฐกิจโลก** / Global economy (IMF, Fed)
- **ภูมิรัฐศาสตร์** / Geopolitics (Russia-Ukraine, Middle East)
- **ตลาดหุ้น** / Stock markets (SET, S&P 500)
- **สกุลเงิน** / Currencies (USD/THB, JPY)
- **คริปโต** / Cryptocurrency (Bitcoin)
- **ทองคำ** / Gold prices

### 💬 การส่งผลลัพธ์ / Result Delivery
- **LINE Messaging** / LINE notification system
- **File Backup** / Automatic file backup when LINE fails
- **Beautiful Logging** / Colorful console logs with timestamps
- **Cost Tracking** / API usage and cost monitoring

### 💰 การจัดการค่าใช้จ่าย / Cost Management
- **Google Search Quota** / 100 free searches/day, $5 per 1,000 additional
- **Gemini API** / Free tier available
- **Exchange Rate** / Real-time USD/THB conversion
- **Usage Tracking** / Daily and monthly cost tracking

---

## 🚀 การติดตั้ง / Installation

### ข้อกำหนดระบบ / Requirements
- **Node.js** >= 16.0.0
- **npm** or **yarn**
- Internet connection for news APIs

### 1. ดาวน์โหลดโปรเจ็กต์ / Download Project
```bash
git clone https://github.com/your-username/ai-stock-line.git
cd ai-stock-line
```

### 2. ติดตั้ง Dependencies / Install Dependencies
```bash
# Using npm
npm install

# Using yarn  
yarn install
```

### 3. ตั้งค่า Environment Variables / Setup Environment Variables
สร้างไฟล์ `.env` และใส่ค่าต่อไปนี้ / Create `.env` file with the following:

```env
# OpenAI ChatGPT API Configuration (DISABLED - ใช้เฉพาะฟรี)
OPENAI_API_KEY=disabled
# Alternative models: gpt-4, gpt-4-turbo, gpt-3.5-turbo-16k
OPENAI_MODEL={model}

# Get free API key from: https://makersuite.google.com/app/apikey
# GEMINI_API_KEY=free OR GEMINI_API_KEY={key}
GEMINI_API_KEY={key}
# Alternative models: gemini-2.5-pro, gemini-2.5-flash, gemini-flash-latest
GEMINI_MODEL=gemini-2.5-flash


# Google Custom Search API - Get free API key from: https://developers.google.com/custom-search/v1/introduction
GOOGLE_SEARCH_API_KEY={key}
# Get free API key from: https://programmablesearchengine.google.com/controlpanel/create/congrats?cx=0187433d021784ee8
GOOGLE_SEARCH_ENGINE_ID={key}
# Google Search API Quota Management
GOOGLE_SEARCH_DAILY_LIMIT=200
# News API - Get free API key from: https://newsapi.org/
NEWS_API_KEY={key}


# LINE Official Account Configuration
# Get free API key from: https://developers.line.biz/console/channel/2008360697/messaging-api
LINE_CHANNEL_ACCESS_TOKEN={key}
# https://developers.line.biz/console/channel/2008360697/basics
LINE_CHANNEL_SECRET={key}
LINE_USER_ID={key}

# Stock Data Configuration
# ได้จากการแชร์ลิงก์ Google Drive เช่น https://drive.google.com/file/d/16kznopNPffyk6jKC8P1tuH-l2hV/view?usp=drive_link
# ก็จะได้ https://drive.google.com/uc?id={id}&export=download เช่น https://drive.google.com/uc?id=16kznopNPffyk6jKC8P1tuH-l2hV&export=download
STOCK_DATA_URL={url}


# Application Configuration
NODE_ENV=production
LOG_LEVEL=info

# Cost Management Configuration
MONTHLY_COST_LIMIT_THB=100

# Retry Configuration (การตั้งค่าลองใหม่)
RETRY_MAX_ATTEMPTS=2
TIMEOUT_END_APP_MS=900000 # 15 minutes
```

### 4. ขั้นตอนการรับ API Keys / How to Get API Keys

#### 🔑 Google Gemini API (ฟรี / Free)
1. ไปที่ / Visit: https://makersuite.google.com/app/apikey
2. สร้าง API key ใหม่ / Create new API key
3. คัดลอกและใส่ใน `GEMINI_API_KEY`

#### 🔍 Google Search API (ฟรี 100 ครั้ง/วัน / Free 100 searches/day)
1. ไปที่ / Visit: https://developers.google.com/custom-search/v1/introduction
2. สร้าง Custom Search Engine: https://programmablesearchengine.google.com/
3. รับ API Key และ Engine ID

#### 📰 News API (ฟรี / Free tier)
1. ไปที่ / Visit: https://newsapi.org/register
2. สมัครสมาชิกฟรี / Sign up for free
3. รับ API key

#### 💬 LINE Official Account (ไม่บังคับ / Optional)
1. ไปที่ / Visit: https://developers.line.biz/
2. สร้าง Official Account
3. รับ Channel Access Token และ Channel Secret

---

## 🏃‍♂️ การใช้งาน / Usage

### เรียกใช้ระบบ / Run the System
```bash
# Using npm
npm start

# Using yarn
yarn start
```

### ผลลัพธ์ที่ได้ / Expected Output
```
============================== Stock Analysis App ==============================
[27/10/2568 17:27:09] ✅ Google Search API เปิดใช้งาน (เหลือ 182/200 คำค้น)
[27/10/2568 17:27:09] 💰 ค่าใช้จ่ายวันนี้: 0.00 บาท, เดือนนี้: 0.00 บาท
[27/10/2568 17:27:09] ✅ News API เปิดใช้งาน

🚀 เริ่มต้น: ดาวน์โหลดข้อมูลหุ้น
🔍 เริ่มค้นหาข่าวจากอินเทอร์เน็ต...
🤖 เลือกใช้: GeminiService (Gemini API พร้อมใช้งาน)
✅ การวิเคราะห์เสร็จสิ้น
```

---

## 📁 โครงสร้างโปรเจ็กต์ / Project Structure

```
ai-stock-line/
├── main.js                    # Entry point
├── package.json               # Dependencies
├── .env                       # Environment variables
├── README.md                  # Documentation
├── data/                      # Data storage
│   ├── text-sum.txt          # Analysis results
│   ├── google_search_quota.json    # Search quota tracking
│   ├── google_search_costs.json    # Cost tracking
│   └── cost-tracking.json    # AI API costs
├── services/                  # Core services
│   ├── aiAnalysisService.js  # AI analysis orchestration
│   ├── costTracker.js        # Cost management
│   ├── geminiService.js      # Google Gemini integration
│   ├── logger.js             # Beautiful logging
│   ├── messageService.js     # LINE messaging
│   ├── openaiService.js      # OpenAI integration
│   ├── retryManager.js       # Error handling
│   ├── stockDataService.js   # Stock data processing
│   └── webSearchService.js   # News search
├── logs/                     # Log files
└── test/                     # Test files
```

---

## 📊 ตัวอย่างผลลัพธ์ / Sample Output

```
📊 ข่าวสำคัญ:
• IMF World Economic Outlook, October 2025: "Global Economy in Flux"
• สงครามรัสเซีย-ยูเครนยังคงดำเนินอยู่

📈 ผลกระทบต่อหุ้น:
• ความเสี่ยง: 7/10 (ค่อนข้างสูง)
• โอกาสกำไร: 5/10 (ปานกลาง)

💡 คำแนะนำ:
• กระจายความเสี่ยง
• ติดตามข่าวสารอย่างใกล้ชิด
• พิจารณาทองคำเป็นสินทรัพย์ปลอดภัย

💰 สรุปค่าใช้จ่าย:
🔍 Google Search: 27/200 คำค้น (ฟรี 27/100)
💰 AI API: $0.0002 (0.01 บาท)
💱 อัตราแลกเปลี่ยน: 1 USD = 32.71 THB
```

---

## ⚙️ การกำหนดค่า / Configuration

### ปรับแต่งการค้นหาข่าว / Customize News Search
แก้ไขใน `services/webSearchService.js`:
```javascript
const queries = [
    'Thailand economy GDP inflation',
    'Your custom search terms'
];
```

### ปรับระดับความเสี่ยง / Adjust Risk Levels
แก้ไขใน `services/aiAnalysisService.js` prompt template

### จำกัด Cost / Cost Limits
แก้ไขใน `.env`:
```env
MONTHLY_COST_LIMIT_THB=100
GOOGLE_SEARCH_DAILY_LIMIT=200
```

---

## 🔧 การแก้ไขปัญหา / Troubleshooting

### ปัญหาทั่วไป / Common Issues

**1. API Key ไม่ทำงาน / API Key Not Working**
```bash
# ตรวจสอบ API key
echo $GEMINI_API_KEY
```

**2. ไม่สามารถดาวน์โหลดข้อมูลหุ้น / Cannot Download Stock Data**
- ตรวจสอบ `STOCK_DATA_URL` ใน `.env`
- ให้แน่ใจว่า Google Drive file เป็น public

**3. LINE ส่งข้อความไม่ได้ / LINE Cannot Send Messages**
- ระบบจะบันทึกลงไฟล์ `data/text-sum.txt` อัตโนมัติ
- ตรวจสอบ quota ของ LINE API

**4. Google Search เกิน Quota / Google Search Quota Exceeded**
- ระบบจะหยุดค้นหาอัตโนมัติเมื่อเกิน 200 คำค้น/วัน
- Quota จะ reset ในวันใหม่ (เที่ยงคืน)

---

## 🛡️ ความปลอดภัย / Security

### การปกป้อง API Keys / Protecting API Keys
- **ไม่แชร์ไฟล์ `.env`** / Never share `.env` file
- **ใช้ environment variables** / Use environment variables in production
- **จำกัด permissions** / Limit API key permissions

### การจัดการ Quota / Quota Management  
- **Google Search**: ฟรี 100 คำค้น/วัน / Free 100 searches/day
- **Gemini API**: ฟรี tier มีจำกัด / Free tier has limits
- **ระบบจะหยุดอัตโนมัติ** / System stops automatically when quota exceeded

---

## 📈 การพัฒนาต่อ / Future Development

### ฟีเจอร์ที่วางแผน / Planned Features
- [ ] Web dashboard interface
- [ ] Multiple portfolio support  
- [ ] Technical analysis integration
- [ ] Mobile app notifications
- [ ] Machine learning price prediction
- [ ] Real-time alerts
- [ ] Multi-language support

### การมีส่วนร่วม / Contributing
1. Fork the repository
2. Create feature branch: `git checkout -b feature/new-feature`
3. Commit changes: `git commit -m 'Add new feature'`
4. Push to branch: `git push origin feature/new-feature`
5. Submit Pull Request

---

## 📄 License

MIT License - ดูรายละเอียดใน LICENSE file

---

## 🙏 ขอบคุณ / Acknowledgments

- **Google Gemini** for free AI API
- **Google Custom Search** for news data
- **News API** for global news
- **LINE Developers** for messaging platform
- **OpenAI** for alternative AI option

---

## 📞 ติดต่อ / Contact

- **GitHub**: [Repository Issues](https://github.com/NitichaiSawangsai/ai-stock-line/issues)
- **Email**: NitichaiSawangsai@gmail.com

---

**⚠️ คำเตือน / Disclaimer:**
ระบบนี้เป็นเครื่องมือช่วยวิเคราะห์เท่านั้น ไม่ใช่คำแนะนำการลงทุน กรุณาศึกษาและประเมินความเสี่ยงด้วยตนเองก่อนตัดสินใจลงทุน

This system is for analysis purposes only and not financial advice. Please conduct your own research and risk assessment before making investment decisions.
