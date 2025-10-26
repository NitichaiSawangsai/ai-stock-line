# Retry System Documentation | เอกสารระบบลองใหม่

## Overview | ภาพรวม

The AI Stock Notification System now includes a comprehensive retry mechanism to handle temporary failures gracefully. The system will automatically retry failed operations with exponential backoff, ensuring reliability while avoiding unnecessary API calls.

ระบบแจ้งเตือนหุ้น AI ตอนนี้มีกลไกการลองใหม่ที่ครอบคลุมเพื่อจัดการกับความล้มเหลวชั่วคราวอย่างสง่างาม ระบบจะลองใหม่โดยอัตโนมัติสำหรับการดำเนินการที่ล้มเหลวพร้อมกับการหน่วงเวลาแบบทวีคูณ เพื่อให้มั่นใจในความน่าเชื่อถือและหลีกเลี่ยงการเรียก API ที่ไม่จำเป็น

## Configuration | การตั้งค่า

Add these settings to your `.env` file:

เพิ่มการตั้งค่าเหล่านี้ในไฟล์ `.env`:

```env
# Retry Configuration (การตั้งค่าลองใหม่)
RETRY_MAX_ATTEMPTS=3        # Maximum retry attempts | จำนวนครั้งสูงสุดในการลองใหม่
RETRY_DELAY_MS=2000        # Initial delay in milliseconds | หน่วงเวลาเริ่มต้นเป็นมิลลิวินาที
RETRY_BACKOFF_MULTIPLIER=2  # Exponential backoff multiplier | ตัวคูณการหน่วงเวลาแบบทวีคูณ
```

## Retry Logic | ตรรกะการลองใหม่

### When Retries Occur | เมื่อไหร่ที่จะลองใหม่

**✅ Will Retry | จะลองใหม่:**
- Network timeouts (ECONNABORTED, ETIMEDOUT)
- Connection refused (ECONNREFUSED) 
- DNS resolution failures (ENOTFOUND)
- HTTP 500, 502, 503, 504 server errors
- Rate limiting (HTTP 429)
- Temporary API unavailability

**❌ Will NOT Retry | จะไม่ลองใหม่:**
- Authentication errors (HTTP 401, 403)
- Bad requests (HTTP 400)
- Not found errors (HTTP 404) 
- Invalid API keys
- Malformed requests

### Exponential Backoff | การหน่วงเวลาแบบทวีคูณ

The retry system uses exponential backoff to avoid overwhelming servers:

ระบบลองใหม่ใช้การหน่วงเวลาแบบทวีคูณเพื่อหลีกเลี่ยงการทำให้เซิร์ฟเวอร์ล้น:

```
Attempt 1: Immediate | ทันที
Attempt 2: RETRY_DELAY_MS × 1 = 2000ms
Attempt 3: RETRY_DELAY_MS × 2 = 4000ms  
Attempt 4: RETRY_DELAY_MS × 4 = 8000ms
```

## Services with Retry Support | บริการที่รองรับการลองใหม่

### 1. Stock Data Service | บริการข้อมูลหุ้น

**Operations | การดำเนินการ:**
- `testConnection()` - Connection testing | ทดสอบการเชื่อมต่อ
- `downloadFileFromUrl()` - File downloads | ดาวน์โหลดไฟล์

**Example Log Output:**
```
⚠️ Download from https://drive.google.com failed (attempt 1/3): Network timeout. Retrying in 2000ms...
⚠️ Download from https://drive.google.com failed (attempt 2/3): Network timeout. Retrying in 4000ms...
✅ Download from https://drive.google.com succeeded on attempt 3
```

### 2. LINE Official Account Service | บริการ LINE Official Account

**Operations | การดำเนินการ:**
- `testConnection()` - API connection testing | ทดสอบการเชื่อมต่อ API
- `sendPushMessage()` - Sending notifications | ส่งการแจ้งเตือน
- `replyToUser()` - Replying to user messages | ตอบกลับข้อความผู้ใช้

**Example Log Output:**
```
⚠️ LINE push message failed (attempt 1/3): Rate limit exceeded. Retrying in 2000ms...
✅ LINE push message succeeded on attempt 2
```

### 3. Google Gemini AI Service | บริการ Google Gemini AI

**Operations | การดำเนินการ:**
- `callGeminiAPI()` - AI analysis requests | การร้องขอการวิเคราะห์ AI
- `testConnection()` - API availability testing | ทดสอบความพร้อมใช้งาน API

**Fallback Strategy | กลยุทธ์สำรอง:**
- Primary: Real Gemini API | หลัก: Gemini API จริง
- Fallback: Mock responses | สำรอง: การตอบสนองจำลอง

### 4. News Analysis Service | บริการวิเคราะห์ข่าว

**Operations | การดำเนินการ:**
- `getNewsFromNewsAPI()` - News data retrieval | ดึงข้อมูลข่าว
- `getNewsFromFreeAPI()` - Free RSS feeds | RSS feeds ฟรี

## Error Handling Strategy | กลยุทธ์การจัดการข้อผิดพลาด

### 1. Graceful Degradation | การลดคุณภาพอย่างสง่างาม

```
Real API → Retry → Alternative API → Mock Response
API จริง → ลองใหม่ → API ทางเลือก → การตอบสนองจำลอง
```

### 2. Circuit Breaker Pattern | รูปแบบการตัดวงจร

- Fast failure for auth errors | ล้มเหลวเร็วสำหรับ auth errors
- Gradual backoff for server errors | การหน่วงเวลาแบบค่อยเป็นค่อยไปสำหรับ server errors
- Immediate fallback to mock data | ใช้ข้อมูลจำลองทันทีเมื่อจำเป็น

### 3. Resource Protection | การป้องกันทรัพยากร

- Maximum retry limits prevent infinite loops | ขีดจำกัดการลองใหม่ป้องกัน infinite loops
- Exponential backoff prevents server overload | การหน่วงเวลาแบบทวีคูณป้องกันเซิร์ฟเวอร์ล้น
- Smart error classification saves API quota | การจำแนกข้อผิดพลาดอย่างชาญฉลาดประหยัด API quota

## Testing Retry System | ทดสอบระบบลองใหม่

### Manual Testing | การทดสอบด้วยตนเอง

```bash
# Test retry functionality | ทดสอบการทำงานของการลองใหม่
node test/test-retry-system.test-e2e.js

# Test full system with retries | ทดสอบระบบเต็มรูปแบบพร้อมการลองใหม่
npm run dev
```

### Monitoring Retry Behavior | ตรวจสอบพฤติกรรมการลองใหม่

Look for these log patterns:

มองหารูปแบบ log เหล่านี้:

```
⚠️ [Operation] failed (attempt X/3): [Error]. Retrying in [delay]ms...
✅ [Operation] succeeded on attempt X
❌ [Operation] failed after 3 attempts: [Final Error]
```

## Best Practices | แนวปฏิบัติที่ดี

### 1. Configuration Tuning | การปรับแต่งการตั้งค่า

**For High-Speed Networks | สำหรับเครือข่ายความเร็วสูง:**
```env
RETRY_MAX_ATTEMPTS=2
RETRY_DELAY_MS=1000
RETRY_BACKOFF_MULTIPLIER=1.5
```

**For Slow/Unreliable Networks | สำหรับเครือข่ายช้า/ไม่เสถียร:**
```env
RETRY_MAX_ATTEMPTS=5
RETRY_DELAY_MS=3000
RETRY_BACKOFF_MULTIPLIER=2.5
```

**For Production Environments | สำหรับสภาพแวดล้อม Production:**
```env
RETRY_MAX_ATTEMPTS=3
RETRY_DELAY_MS=2000
RETRY_BACKOFF_MULTIPLIER=2
```

### 2. Error Classification | การจำแนกข้อผิดพลาด

**Temporary Errors (Retry) | ข้อผิดพลาดชั่วคราว (ลองใหม่):**
- Network connectivity issues | ปัญหาการเชื่อมต่อเครือข่าย
- Server overload (5xx errors) | เซิร์ฟเวอร์ล้น (5xx errors)
- Rate limiting | การจำกัดอัตรา
- Timeout errors | ข้อผิดพลาด timeout

**Permanent Errors (Don't Retry) | ข้อผิดพลาดถาวร (ไม่ลองใหม่):**
- Invalid API keys | API keys ไม่ถูกต้อง
- Malformed requests | requests ที่มีรูปแบบผิด
- Access denied | การเข้าถึงถูกปฏิเสธ
- Resource not found | ไม่พบทรัพยากร

### 3. Monitoring and Alerting | การตรวจสอบและการแจ้งเตือน

**Success Metrics | เมตริกความสำเร็จ:**
- Retry success rate | อัตราความสำเร็จของการลองใหม่
- Average attempts per operation | จำนวนครั้งเฉลี่ยต่อการดำเนินการ
- Total recovery time | เวลาการกู้คืนรวม

**Alert Conditions | เงื่อนไขการแจ้งเตือน:**
- High retry rates (>50%) | อัตราการลองใหม่สูง (>50%)
- Frequent auth errors | auth errors บ่อย
- Service completely down | บริการหยุดทำงานสมบูรณ์

## Implementation Details | รายละเอียดการนำไปใช้

### Common withRetry Method | เมธอด withRetry ทั่วไป

All services use a standardized retry implementation:

บริการทั้งหมดใช้การนำไปใช้การลองใหม่ที่มาตรฐาน:

```javascript
async withRetry(operation, operationName) {
  let lastError;
  
  for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
    try {
      const result = await operation();
      if (attempt > 1) {
        logger.info(`✅ ${operationName} succeeded on attempt ${attempt}`);
      }
      return result;
    } catch (error) {
      lastError = error;
      
      // Don't retry auth errors
      if (error.response?.status === 401 || error.response?.status === 403) {
        throw error;
      }
      
      if (attempt === this.maxRetries) {
        logger.error(`❌ ${operationName} failed after ${this.maxRetries} attempts`);
        throw error;
      }
      
      const delay = this.retryDelay * Math.pow(this.backoffMultiplier, attempt - 1);
      logger.warn(`⚠️ ${operationName} failed (attempt ${attempt}/${this.maxRetries}). Retrying in ${delay}ms...`);
      
      await this.delay(delay);
    }
  }
  
  throw lastError;
}
```

## Cost Impact | ผลกระทบต่อต้นทุน

### API Usage Optimization | การเพิ่มประสิทธิภาพการใช้ API

**Before Retry System | ก่อนระบบลองใหม่:**
- Single failure = Complete operation failure | ความล้มเหลวครั้งเดียว = การดำเนินการล้มเหลวสมบูรณ์
- Manual intervention required | ต้องการการแทรกแซงด้วยตนเอง
- Data loss possible | อาจสูญเสียข้อมูล

**After Retry System | หลังระบบลองใหม่:**
- Automatic recovery from transient failures | การกู้คืนอัตโนมัติจากความล้มเหลวชั่วคราว
- Intelligent error classification | การจำแนกข้อผิดพลาดอย่างชาญฉลาด
- Zero additional cost for permanent errors | ไม่มีต้นทุนเพิ่มเติมสำหรับข้อผิดพลาดถาวร

### Free Tier Protection | การป้องกัน Free Tier

- Auth errors exit immediately (no retries) | Auth errors ออกทันที (ไม่ลองใหม่)
- Smart backoff prevents quota exhaustion | การหน่วงเวลาอย่างชาญฉลาดป้องกัน quota หมด
- Fallback to mock responses preserves functionality | การใช้การตอบสนองจำลองรักษาการทำงาน

## Troubleshooting | การแก้ไขปัญหา

### High Retry Rates | อัตราการลองใหม่สูง

**Symptoms | อาการ:**
```
⚠️ Multiple retry warnings in logs
⚠️ Increased response times
⚠️ API quota warnings
```

**Solutions | วิธีแก้ไข:**
1. Check network connectivity | ตรวจสอบการเชื่อมต่อเครือข่าย
2. Verify API endpoints are accessible | ตรวจสอบว่า API endpoints เข้าถึงได้
3. Review API rate limits | ตรวจสอบขีดจำกัดอัตรา API
4. Adjust retry configuration | ปรับการตั้งค่าการลองใหม่

### Auth Error Loops | วงการ Auth Error

**Symptoms | อาการ:**
```
❌ Repeated 401/403 errors
❌ No retry attempts (correct behavior)
❌ Service degradation
```

**Solutions | วิธีแก้ไข:**
1. Verify API keys in `.env` | ตรวจสอบ API keys ใน `.env`
2. Check API key permissions | ตรวจสอบสิทธิ์ API key
3. Confirm API key expiration | ยืนยันการหมดอายุ API key
4. Review service documentation | ตรวจสอบเอกสารบริการ

## Future Enhancements | การปรับปรุงในอนาคต

### Planned Features | ฟีเจอร์ที่วางแผนไว้

1. **Circuit Breaker Pattern | รูปแบบการตัดวงจร**
   - Auto-disable failing services | ปิดบริการที่ล้มเหลวอัตโนมัติ
   - Periodic health checks | การตรวจสอบสุขภาพเป็นระยะ
   - Gradual service re-enablement | การเปิดใช้บริการอีกครั้งแบบค่อยเป็นค่อยไป

2. **Adaptive Retry Logic | ตรรกะการลองใหม่แบบปรับตัว**
   - Dynamic timeout adjustment | การปรับ timeout แบบไดนามิก
   - Service-specific retry policies | นโยบายการลองใหม่เฉพาะบริการ
   - Historical performance learning | การเรียนรู้ประสิทธิภาพในอดีต

3. **Enhanced Monitoring | การตรวจสอบที่ปรับปรุง**
   - Retry metrics collection | การรวบรวมเมตริกการลองใหม่
   - Performance dashboards | แดชบอร์ดประสิทธิภาพ
   - Automated alerting | การแจ้งเตือนอัตโนมัติ

---

## Summary | สรุป

The retry system provides robust error handling while maintaining cost efficiency. It automatically recovers from temporary failures, protects against permanent errors, and ensures the AI Stock Notification System remains reliable even under adverse conditions.

ระบบลองใหม่ให้การจัดการข้อผิดพลาดที่แข็งแกร่งในขณะที่รักษาประสิทธิภาพด้านต้นทุน มันกู้คืนจากความล้มเหลวชั่วคราวโดยอัตโนมัติ ป้องกันข้อผิดพลาดถาวร และให้มั่นใจว่าระบบแจ้งเตือนหุ้น AI ยังคงน่าเชื่อถือแม้ในสภาวะที่ไม่เอื้ออำนวย

**Key Benefits | ประโยชน์หลัก:**
- ✅ Automatic failure recovery | การกู้คืนความล้มเหลวอัตโนมัติ
- ✅ Cost-efficient retry logic | ตรรกะการลองใหม่ที่ประหยัดต้นทุน  
- ✅ Intelligent error classification | การจำแนกข้อผิดพลาดอย่างชาญฉลาด
- ✅ Configurable retry policies | นโยบายการลองใหม่ที่กำหนดค่าได้
- ✅ Zero downtime for transient issues | ไม่มี downtime สำหรับปัญหาชั่วคราว