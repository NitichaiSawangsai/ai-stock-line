const axios = require('axios');
const winston = require('winston');

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.printf(({ timestamp, level, message }) => {
      return `${timestamp} [LINE-API] [${level.toUpperCase()}]: ${message}`;
    })
  ),
  transports: [
    new winston.transports.Console()
  ]
});

class LineOfficialAccountService {
  constructor() {
    this.channelAccessToken = process.env.LINE_CHANNEL_ACCESS_TOKEN;
    this.channelSecret = process.env.LINE_CHANNEL_SECRET;
    this.userId = process.env.LINE_USER_ID;
    this.messagingApiUrl = 'https://api.line.me/v2/bot';
    this.timeout = 30000; // 30 seconds timeout
  }

  async testConnection() {
    if (!this.channelAccessToken || this.channelAccessToken === 'your-line-channel-access-token-here') {
      throw new Error('LINE Channel Access Token not configured');
    }
    
    try {
      const response = await axios.get(`${this.messagingApiUrl}/info`, {
        headers: {
          'Authorization': `Bearer ${this.channelAccessToken}`
        },
        timeout: this.timeout
      });
      
      logger.info('✅ LINE Official Account connection successful');
      return response.status === 200;
    } catch (error) {
      logger.error(`❌ LINE connection test failed: ${error.message}`);
      throw error;
    }
  }

  async sendRiskAlert(highRiskStocks) {
    logger.info(`🚨 Sending risk alert for ${highRiskStocks.length} stocks`);
    
    for (const stock of highRiskStocks) {
      try {
        const message = this.formatRiskMessage(stock);
        await this.sendPushMessage(message);
        
        // Add delay between messages
        await this.delay(2000);
        
      } catch (error) {
        logger.error(`❌ Failed to send risk alert for ${stock.symbol}: ${error.message}`);
      }
    }
  }

  async sendOpportunityAlert(opportunities) {
    logger.info(`🔥 Sending opportunity alert for ${opportunities.length} stocks`);
    
    for (const stock of opportunities) {
      try {
        const message = this.formatOpportunityMessage(stock);
        await this.sendPushMessage(message);
        
        // Add delay between messages
        await this.delay(2000);
        
      } catch (error) {
        logger.error(`❌ Failed to send opportunity alert for ${stock.symbol}: ${error.message}`);
      }
    }
  }

  async sendErrorNotification(error) {
    try {
      const message = `🚨 [ระบบขัดข้อง] AOM Stock Notification

❌ เกิดข้อผิดพลาด: ${error.message}

เวลา: ${new Date().toLocaleString('th-TH', { timeZone: 'Asia/Bangkok' })}

กรุณาตรวจสอบระบบ`;

      await this.sendPushMessage(message);
      
    } catch (lineError) {
      logger.error(`❌ Failed to send error notification: ${lineError.message}`);
    }
  }

  async handleIncomingMessage(event) {
    try {
      if (event.type === 'message' && event.message.type === 'text') {
        const userMessage = event.message.text;
        const userId = event.source.userId;
        
        logger.info(`📨 Received message from ${userId}: ${userMessage}`);
        
        // Analyze user query with AI
        const response = await this.analyzeUserQuery(userMessage);
        
        // Send response back to user
        await this.replyToUser(event.replyToken, response);
      }
      
    } catch (error) {
      logger.error(`❌ Error handling incoming message: ${error.message}`);
    }
  }

  async analyzeUserQuery(userMessage) {
    try {
      // Get stock context from Stock Data Service
      const StockDataService = require('./stockDataService');
      const stockDataService = new StockDataService();
      const stockContext = await stockDataService.getStockContext();
      
      // ลองใช้ ChatGPT ก่อน
      const NewsAnalysisService = require('./newsAnalysisService');
      const newsAnalysis = new NewsAnalysisService();
      
      const prompt = `ผู้ใช้ถาม: "${userMessage}"

ข้อมูลหุ้นที่มี:
${stockContext}

กรุณาตอบคำถามของผู้ใช้เกี่ยวกับการลงทุนและหุ้นในรายการ โดย:
1. ให้คำแนะนำที่เป็นประโยชน์
2. วิเคราะห์ข้อมูลที่เกี่ยวข้อง
3. แนะนำการดำเนินการ (หากเหมาะสม)
4. ตอบเป็นภาษาไทยให้เข้าใจง่าย
5. ความยาวไม่เกิน 500 ตัวอักษร

หากคำถามไม่เกี่ยวกับการลงทุน ให้แจ้งว่าระบบนี้เฉพาะสำหรับการปรึกษาเรื่องหุ้นเท่านั้น`;

      // ตรวจสอบว่าควรใช้ ChatGPT หรือไม่
      const shouldUseChatGPT = process.env.OPENAI_API_KEY && 
                              process.env.OPENAI_API_KEY !== 'disabled' && 
                              process.env.OPENAI_API_KEY !== 'sk-your-openai-api-key-here';

      if (!shouldUseChatGPT) {
        logger.info('🆓 Using FREE Gemini AI for LINE chat response');
        
        // ใช้ Gemini ฟรีโดยตรง
        const GeminiAnalysisService = require('./geminiAnalysisService');
        const geminiService = new GeminiAnalysisService();
        
        const geminiResponse = await geminiService.callGeminiAPI(prompt);
        
        // ลบ markdown formatting ถ้ามี
        return geminiResponse.replace(/```\w*\s*/g, '').replace(/```/g, '').trim();
      }

      // ลอง ChatGPT ก่อน (เฉพาะกรณีที่มี API key จริง)
      try {
        const response = await axios.post('https://api.openai.com/v1/chat/completions', {
          model: "gpt-3.5-turbo",
          messages: [{ role: "user", content: prompt }],
          max_tokens: 800,
          temperature: 0.7
        }, {
          headers: {
            'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
            'Content-Type': 'application/json'
          },
          timeout: this.timeout
        });

        return response.data.choices[0].message.content;
        
      } catch (chatgptError) {
        logger.warn(`⚠️ ChatGPT failed, switching to FREE Gemini: ${chatgptError.message}`);
        
        // สลับไปใช้ Gemini ฟรี
        const GeminiAnalysisService = require('./geminiAnalysisService');
        const geminiService = new GeminiAnalysisService();
        
        const geminiResponse = await geminiService.callGeminiAPI(prompt);
        
        // ลบ markdown formatting ถ้ามี
        return geminiResponse.replace(/```\w*\s*/g, '').replace(/```/g, '').trim();
      }
      
    } catch (error) {
      logger.error(`❌ Failed to analyze user query with both AI services: ${error.message}`);
      return `ขออภัย ระบบ AI ทั้งหมดมีปัญหาในขณะนี้ กรุณาลองใหม่อีกครั้งค่ะ

📞 หากเป็นเรื่องด่วน กรุณาติดตามข่าวสารด้วยตนเอง

Error: ${error.message}`;
    }
  }

  formatRiskMessage(stock) {
    const risk = stock.riskAnalysis;
    const emoji = this.getRiskEmoji(risk.riskLevel);
    
    let message = `🚨 [ความเสี่ยงสูง] ${stock.symbol}

${emoji} ระดับความเสี่ยง: ${this.translateRiskLevel(risk.riskLevel)}

📰 ข่าว: "${risk.keyNews || 'ไม่มีข่าวเฉพาะ'}"

📝 สรุป: ${risk.summary}

📊 คะแนนความน่าเชื่อถือ: ${risk.confidenceScore.toFixed(2)}

📈 แนวโน้ม: 🔻 ${risk.recommendation}`;

    // แสดงภัยคุกคามถ้ามี
    if (risk.threats && risk.threats.length > 0) {
      message += `

⚠️ ภัยคุกคาม:`;
      risk.threats.slice(0, 3).forEach((threat, index) => {
        message += `
${index + 1}. ${threat}`;
      });
    }

    // แสดงแหล่งข่าวหลายอัน
    if (stock.news && stock.news.length > 0) {
      message += `

📰 แหล่งข่าวที่เกี่ยวข้อง:`;
      
      stock.news.slice(0, 3).forEach((newsItem, index) => {
        message += `

🔗 ข่าวที่ ${index + 1}: ${newsItem.source}`;
        if (newsItem.title) {
          message += `
หัวข้อ: ${newsItem.title.substring(0, 80)}${newsItem.title.length > 80 ? '...' : ''}`;
        }
        if (newsItem.url && newsItem.url !== 'undefined' && !newsItem.url.includes('mock') && !newsItem.url.includes('example')) {
          message += `
ลิงก์: ${newsItem.url}`;
        }
      });
    }

    message += `

⏰ เวลา: ${new Date().toLocaleString('th-TH', { timeZone: 'Asia/Bangkok' })}`;

    return message;
  }

  formatOpportunityMessage(stock) {
    const opportunity = stock.opportunityAnalysis;
    const emoji = this.getOpportunityEmoji(opportunity.opportunityLevel);
    
    let message = `🔥 [โอกาสขึ้น] ${stock.symbol}

${emoji} ระดับโอกาส: ${this.translateOpportunityLevel(opportunity.opportunityLevel)}

📰 ข่าว: "${opportunity.keyNews || 'ไม่มีข่าวเฉพาะ'}"

📝 สรุป: ${opportunity.summary}

📊 คะแนนความน่าเชื่อถือ: ${opportunity.confidenceScore.toFixed(2)}

📈 แนวโน้ม: 🔺 หุ้นมีโอกาสขึ้น

⏱️ ระยะเวลาคาดการณ์: ${opportunity.timeframe}`;

    if (opportunity.priceTarget) {
      message += `
🎯 เป้าหมายราคา: ${opportunity.priceTarget}`;
    }

    // แสดงปัจจัยบวกถ้ามี
    if (opportunity.positiveFactors && opportunity.positiveFactors.length > 0) {
      message += `

✅ ปัจจัยบวก:`;
      opportunity.positiveFactors.slice(0, 3).forEach((factor, index) => {
        message += `
${index + 1}. ${factor}`;
      });
    }

    // แสดงแหล่งข่าวหลายอัน
    if (stock.news && stock.news.length > 0) {
      message += `

📰 แหล่งข่าวที่เกี่ยวข้อง:`;
      
      stock.news.slice(0, 3).forEach((newsItem, index) => {
        message += `

🔗 ข่าวที่ ${index + 1}: ${newsItem.source}`;
        if (newsItem.title) {
          message += `
หัวข้อ: ${newsItem.title.substring(0, 80)}${newsItem.title.length > 80 ? '...' : ''}`;
        }
        if (newsItem.url && newsItem.url !== 'undefined' && !newsItem.url.includes('mock') && !newsItem.url.includes('example')) {
          message += `
ลิงก์: ${newsItem.url}`;
        }
      });
    }

    message += `

⏰ เวลา: ${new Date().toLocaleString('th-TH', { timeZone: 'Asia/Bangkok' })}`;

    return message;
  }

  async sendPushMessage(message) {
    if (!this.userId || this.userId === 'your-line-user-id-here') {
      throw new Error('LINE User ID not configured');
    }

    try {
      const response = await axios.post(`${this.messagingApiUrl}/message/push`, {
        to: this.userId,
        messages: [{
          type: 'text',
          text: message
        }]
      }, {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.channelAccessToken}`
        },
        timeout: this.timeout
      });
      
      logger.info(`✅ LINE message sent successfully`);
      return response.data;
      
    } catch (error) {
      logger.error(`❌ Failed to send LINE message: ${error.message}`);
      throw error;
    }
  }

  async replyToUser(replyToken, message) {
    try {
      const response = await axios.post(`${this.messagingApiUrl}/message/reply`, {
        replyToken: replyToken,
        messages: [{
          type: 'text',
          text: message
        }]
      }, {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.channelAccessToken}`
        },
        timeout: this.timeout
      });
      
      logger.info(`✅ Reply sent successfully`);
      return response.data;
      
    } catch (error) {
      logger.error(`❌ Failed to reply to user: ${error.message}`);
      throw error;
    }
  }

  getRiskEmoji(riskLevel) {
    switch (riskLevel) {
      case 'critical': return '💀';
      case 'high': return '🚨';
      case 'medium': return '⚠️';
      case 'low': return '⚡';
      default: return '❓';
    }
  }

  getOpportunityEmoji(opportunityLevel) {
    switch (opportunityLevel) {
      case 'excellent': return '🚀';
      case 'high': return '🔥';
      case 'medium': return '📈';
      case 'low': return '💡';
      default: return '❓';
    }
  }

  translateRiskLevel(level) {
    switch (level) {
      case 'critical': return 'วิกฤต';
      case 'high': return 'สูง';
      case 'medium': return 'ปานกลาง';
      case 'low': return 'ต่ำ';
      default: return 'ไม่ทราบ';
    }
  }

  translateOpportunityLevel(level) {
    switch (level) {
      case 'excellent': return 'ดีเยี่ยม';
      case 'high': return 'สูง';
      case 'medium': return 'ปานกลาง';
      case 'low': return 'ต่ำ';
      default: return 'ไม่ทราบ';
    }
  }

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

module.exports = LineOfficialAccountService;