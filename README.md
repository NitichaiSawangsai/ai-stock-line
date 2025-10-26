# AOM Stock Risk Notification System

ระบบแจ้งเตือนความเสี่ยงของหุ้นที่ใช้ AI ในการวิเคราะห์ข่าวและส่งแจ้งเตือนผ่าน LINE

## ✨ คุณสมบัติหลัก

### 🚨 การแจ้งเตือนความเสี่ยงสูง
- ตรวจสอบความเสี่ยงหุ้นทุก 1 ชั่วโมง
- วิเคราะห์ข่าวที่อาจทำให้เงินหายหมดหรือหุ้นปิดตัว
- แจ้งเตือนทันทีเมื่อพบความเสี่ยงสูง

### 🔥 การแจ้งเตือนโอกาสลงทุน
- ตรวจสอบโอกาสการลงทุนทุกเช้า 6:10 น.
- วิเคราะห์ข่าวที่อาจทำให้หุ้นขึ้น
- แนะนำจังหวะการซื้อที่เหมาะสม

### 🤖 AI Analysis with Automatic Fallback
- ใช้ ChatGPT เป็น AI หลักในการวิเคราะห์ข่าว
- **ระบบสำรองอัตโนมัติ**: เมื่อ ChatGPT มีปัญหา จะสลับไปใช้ Gemini AI ทันที
- รวบรวมข่าวจากหลายแหล่ง
- ให้คะแนนความน่าเชื่อถือ
- **Gemini AI ฟรี**: ไม่ต้องมี API key ก็ใช้งานได้

### 💬 LINE Official Account Integration
- รับแจ้งเตือนผ่าน LINE Official Account
- ตอบคำถามเกี่ยวกับหุ้นผ่าน LINE Bot
- ส่งสรุปข้อมูลในรูปแบบที่เข้าใจง่าย

## 📋 ข้อกำหนดระบบ

- Node.js 16+ 
- npm หรือ yarn
- บัญชี OpenAI (ChatGPT API)
- บัญชี LINE Developer
- Google Drive สำหรับเก็บรายการหุ้น

## 🚀 วิธีติดตั้ง

### 1. Clone โปรเจ็กต์
```bash
git clone <repository-url>
cd ai-stock-notification
```

### 2. ติดตั้ง Dependencies
```bash
npm install
# หรือ
yarn install
```

### 3. ตั้งค่า Environment Variables
```bash
cp .env.example .env
```

แก้ไขไฟล์ `.env` ตามความต้องการ:

#### OpenAI API (Primary AI)
1. ไปที่ https://platform.openai.com/api-keys
2. สร้าง API key ใหม่
3. ใส่ค่าใน `OPENAI_API_KEY`

#### Google Gemini API (Fallback AI - ฟรี!)
1. ไปที่ https://makersuite.google.com/app/apikey
2. สร้าง API key ฟรี (ไม่ต้องใส่บัตรเครดิต)
3. ใส่ค่าใน `GEMINI_API_KEY`
4. **หรือใส่ค่า `free` เพื่อใช้โหมดฟรีโดยไม่ต้องมี API key**

#### LINE Official Account
1. ไปที่ https://developers.line.biz/console/
2. สร้าง Provider และ Channel ใหม่ (Messaging API)
3. คัดลอก Channel Access Token และ Channel Secret
4. ใส่ค่าใน `LINE_CHANNEL_ACCESS_TOKEN` และ `LINE_CHANNEL_SECRET`
5. หา User ID ของคุณโดยเพิ่มเพื่อนกับ Bot และส่งข้อความ
6. ใส่ User ID ใน `LINE_USER_ID`

#### Google Drive
1. ไปที่ https://console.cloud.google.com/
2. สร้าง Service Account
3. Download JSON key file
4. ใส่ข้อมูลใน `GOOGLE_SERVICE_ACCOUNT_EMAIL` และ `GOOGLE_SERVICE_ACCOUNT_KEY`

### 4. สร้างไฟล์รายการหุ้นใน Google Drive

สร้างไฟล์ `stocks-use-api.txt` ใน Google Drive ด้วยรูปแบบ:
```
ประเภท ชื่อ หน่วยที่ลงทุน
หุ้น VOO 0.00394415
ทอง ทอง 1 บาท
สกุลเงิน USD 100 usd
สกุลเงินคริปโต BTC 1 btc
หุ้น NVDA -
```

### 5. ตั้งค่า File ID
1. เปิดไฟล์ใน Google Drive
2. คัดลอก File ID จาก URL
3. ใส่ค่าใน `GOOGLE_DRIVE_STOCKS_FILE_ID`

## 🎯 วิธีใช้งาน

### รันแบบ One-time
```bash
# ทดสอบระบบ AI Fallback
node test/test-ai-fallback.test-e2e.js

# ตรวจสอบความเสี่ยงทันที
yarn start --risk

# ตรวจสอบโอกาสลงทุนทันที  
yarn start --opportunity

# รันการตรวจสอบทั้งหมด
yarn start

# รันในโหมด development
yarn run dev
```

### ตั้งค่า Cronjob (สำหรับ Production)

เพิ่มใน crontab:
```bash
# ตรวจสอบความเสี่ยงทุกชั่วโมง
0 * * * * cd /path/to/ai-stock && /usr/bin/node main.js --risk >> logs/cron.log 2>&1

# ตรวจสอบโอกาสทุกเช้า 6:10 น.
10 6 * * * cd /path/to/ai-stock && /usr/bin/node main.js --opportunity >> logs/cron.log 2>&1
```

หรือใช้ PM2:
```bash
npm install -g pm2
pm2 start ecosystem.config.js
```

## 📊 ตัวอย่าง Output

### แจ้งเตือนความเสี่ยงสูง
```
🚨 [ความเสี่ยงสูง] NVDA

💀 ระดับความเสี่ยง: วิกฤต

📰 ข่าว: "NVIDIA faces major export ban from US regulators"

📝 สรุป: รัฐบาลสหรัฐประกาศจำกัดการส่งออกชิป AI เพิ่มเติม

📊 คะแนนความน่าเชื่อถือ: 0.93

📈 แนวโน้ม: 🔻 ราคามีโอกาสร่วง

🔗 แหล่งข่าว: Bloomberg
ลิงก์: https://www.bloomberg.com/news/articles/...

⏰ เวลา: 26/10/2025 14:30:15
```

### แจ้งเตือนโอกาสลงทุน
```
🔥 [โอกาสขึ้น] VOO

🚀 ระดับโอกาส: ดีเยี่ยม

📰 ข่าว: "S&P 500 rises as earnings beat expectations"

📝 สรุป: หุ้นบริษัทเทคฯ หลักรายงานกำไรเกินคาด ดันดัชนี S&P500 ขึ้น

📊 คะแนนความน่าเชื่อถือ: 0.89

📈 แนวโน้ม: 🔺 หุ้นมีโอกาสขึ้น

⏱️ ระยะเวลาคาดการณ์: 1-2 สัปดาห์

🔗 แหล่งข่าว: CNBC
ลิงก์: https://www.cnbc.com/id/100003114

⏰ เวลา: 26/10/2025 06:10:05
```

## 🔧 การแก้ไขปัญหา

### ปัญหาการเชื่อมต่อ AI
```bash
# ทดสอบการเชื่อมต่อทั้งหมด
yarn run dev

# ทดสอบระบบ AI Fallback โดยเฉพาะ
node test/test-ai-fallback.test-e2e.js
```

**ระบบ AI Fallback จะทำงานดังนี้:**
1. ลอง ChatGPT ก่อน (ถ้ามี API key)
2. หาก ChatGPT ล้มเหลว จะสลับไปใช้ Gemini AI ทันที
3. หาก Gemini ก็ล้มเหลว จะใช้ mock response
4. ระบบจะแจ้งเตือนเมื่อมีการสลับ AI service

### ปัญหา Google Drive
- ตรวจสอบว่าไฟล์เป็น public หรือ service account มีสิทธิ์เข้าถึง
- ตรวจสอบ File ID ใน URL

### ปัญหา LINE
- ตรวจสอบ Token ที่ LINE Notify
- ตรวจสอบการตั้งค่า Webhook สำหรับ LINE Bot

## 📝 Log Files

ระบบจะสร้าง log files ใน:
- `logs/app.log` - Application logs
- `logs/cron.log` - Cronjob logs

## ⚠️ ข้อควรระวัง

1. **Rate Limits**: OpenAI และ NEWS API มี rate limits
2. **Timeout**: กระบวนการจะหยุดอัตโนมัติหลัง 30 นาที
3. **Cost**: การใช้ OpenAI API มีค่าใช้จ่าย (Gemini ฟรี!)
4. **Security**: อย่าแชร์ API keys หรือ tokens
5. **AI Fallback**: ระบบจะสลับ AI อัตโนมัติเมื่อมีปัญหา

## 🤝 การสนับสนุน

หากพบปัญหาหรือต้องการคำแนะนำ:
1. ตรวจสอบ logs ใน `logs/app.log`
2. ตรวจสอบการตั้งค่าใน `.env`
3. ทดสอบการเชื่อมต่อด้วย `yarn run dev`

## 📄 License

MIT License - ดูรายละเอียดใน LICENSE file