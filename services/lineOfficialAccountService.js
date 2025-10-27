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
    this.maxRetries = parseInt(process.env.RETRY_MAX_ATTEMPTS) || 3;
    this.retryDelay = parseInt(process.env.RETRY_DELAY_MS) || 2000;
    this.backoffMultiplier = parseFloat(process.env.RETRY_BACKOFF_MULTIPLIER) || 2;
  }

  async withRetry(operation, operationName) {
    const maxRetries = 2; // ลดจาก 3 เป็น 2
    let lastError;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const result = await operation();
        if (attempt > 1) {
          logger.info(`✅ ${operationName} succeeded on attempt ${attempt}`);
        }
        return result;
      } catch (error) {
        lastError = error;
        
        // Don't retry on authentication errors
        if (error.response?.status === 401 || error.response?.status === 403) {
          logger.error(`❌ ${operationName} failed with auth error: ${error.message}`);
          throw error;
        }
        
        // หยุด retry ทันทีถ้าเป็น rate limit
        if (error.response?.status === 429) {
          logger.error(`❌ ${operationName} failed due to rate limit: ${error.message}`);
          throw error;
        }
        
        if (attempt === maxRetries) {
          logger.error(`❌ ${operationName} failed after ${maxRetries} attempts: ${error.message}`);
          throw error;
        }
        
        const delay = this.retryDelay * Math.pow(this.backoffMultiplier, attempt - 1);
        logger.warn(`⚠️ ${operationName} failed (attempt ${attempt}/${maxRetries}): ${error.message}. Retrying in ${delay}ms...`);
        
        await this.delay(delay);
      }
    }
    
    throw lastError;
  }

  async testConnection() {
    if (!this.channelAccessToken || this.channelAccessToken === 'your-line-channel-access-token-here') {
      throw new Error('LINE Channel Access Token not configured');
    }
    
    return await this.withRetry(async () => {
      const response = await axios.get(`${this.messagingApiUrl}/info`, {
        headers: {
          'Authorization': `Bearer ${this.channelAccessToken}`
        },
        timeout: this.timeout
      });
      
      if (response.status !== 200) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      logger.info('✅ LINE Official Account connection successful');
      return true;
    }, 'LINE connection test');
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

  async sendAllNewsAlert(allNewsData) {
    logger.info(`📰 Sending comprehensive news for ${allNewsData.length} stocks with AI translation`);
    
    try {
      // ส่งข้อความหัวข้อรวม
      const headerMessage = `📰 สรุปข่าวการลงทุนประจำวัน
      
🕒 วันที่: ${new Date().toLocaleDateString('th-TH', { timeZone: 'Asia/Bangkok' })}
📊 จำนวนหุ้นที่มีข่าว: ${allNewsData.length} ตัว
⏰ เวลา: ${new Date().toLocaleTimeString('th-TH', { timeZone: 'Asia/Bangkok' })}

📚 รายละเอียดแต่ละหุ้น:`;

      await this.sendPushMessage(headerMessage);
      await this.delay(2000);
      
      // ส่งข่าวแต่ละหุ้น
      for (const stockData of allNewsData) {
        try {
          logger.info(`📤 Processing news for ${stockData.stock.symbol}...`);
          
          // แปลและสรุปข่าวด้วย AI
          const translatedNews = await this.translateAndSummarizeNews(stockData);
          
          if (translatedNews && translatedNews.length > 0) {
            // ส่งข้อความหลักของหุ้น
            const mainMessage = this.formatMainStockNewsMessage(stockData.stock, translatedNews);
            await this.sendPushMessage(mainMessage);
            await this.delay(2000);
            
            // ส่งรายละเอียดข่าวแต่ละข่าว (สูงสุด 3 ข่าว)
            const topNews = translatedNews.slice(0, 3);
            for (let i = 0; i < topNews.length; i++) {
              const newsMessage = this.formatDetailedNewsMessage(stockData.stock.symbol, topNews[i], i + 1);
              await this.sendPushMessage(newsMessage);
              await this.delay(2000);
            }
            
            logger.info(`✅ Sent ${topNews.length} news items for ${stockData.stock.symbol}`);
          } else {
            logger.info(`ℹ️ No translated news available for ${stockData.stock.symbol}`);
          }
          
        } catch (error) {
          logger.error(`❌ Failed to process news for ${stockData.stock.symbol}: ${error.message}`);
        }
      }
      
      // ส่งข้อความปิดท้าย
      const footerMessage = `✅ สรุปข่าวครบถ้วนแล้ว

⚠️ หมายเหตุ: 
- ข้อมูลนี้เป็นการสรุปข่าวเท่านั้น ไม่ใช่คำแนะนำการลงทุน
- กรุณาศึกษาข้อมูลเพิ่มเติมก่อนตัดสินใจลงทุน
- ผลตอบแทนในอดีตไม่ได้รับประกันผลตอบแทนในอนาคต

🤖 ระบบ AI Stock News by AOM`;

      await this.sendPushMessage(footerMessage);
      
    } catch (error) {
      logger.error(`❌ Error in sendAllNewsAlert: ${error.message}`);
      await this.sendPushMessage(`❌ เกิดข้อผิดพลาดในการส่งข่าว: ${error.message}`);
    }
  }

  async translateAndSummarizeNews(stockData) {
    try {
      const { stock, news } = stockData;
      const newsItems = news.combined || [];
      
      if (!newsItems || newsItems.length === 0) {
        return [];
      }

      logger.info(`🤖 Translating ${newsItems.length} news items for ${stock.symbol} with AI`);
      
      const translatedNews = [];
      
      // แปลข่าวแต่ละข่าว (สูงสุด 5 ข่าว)
      const newsToTranslate = newsItems.slice(0, 5);
      
      for (const newsItem of newsToTranslate) {
        try {
          const translatedItem = await this.translateSingleNews(newsItem, stock);
          if (translatedItem) {
            translatedNews.push(translatedItem);
          }
        } catch (error) {
          logger.error(`❌ Failed to translate news: ${error.message}`);
        }
      }
      
      return translatedNews;
      
    } catch (error) {
      logger.error(`❌ Error in translateAndSummarizeNews: ${error.message}`);
      return [];
    }
  }

  async translateSingleNews(newsItem, stock) {
    try {
      // สร้าง prompt สำหรับการแปลและสรุป
      const prompt = `สรุปข่าวนี้เป็นภาษาไทยให้กระชับและเข้าใจง่าย:

หัวข้อ: ${newsItem.title}
เนื้อหา: ${newsItem.description || newsItem.content || 'ไม่มีรายละเอียด'}
แหล่งที่มา: ${newsItem.source}

หุ้นที่เกี่ยวข้อง: ${stock.symbol} (${stock.type})

กรุณาตอบในรูปแบบ JSON:
{
  "headline": "หัวข้อภาษาไทยสั้นๆ (ไม่เกิน 50 ตัวอักษร)",
  "summary": "สรุปเนื้อหาภาษาไทย (ไม่เกิน 150 ตัวอักษร)",
  "impact": "ผลกระทบต่อหุ้น ${stock.symbol} (บวก/ลบ/เป็นกลาง)",
  "relevance": "ความเกี่ยวข้องกับ ${stock.symbol} (สูง/ปานกลาง/ต่ำ)"
}

ให้ความสำคัญกับ:
1. แปลให้เป็นภาษาไทยธรรมดา เข้าใจง่าย
2. ระบุผลกระทบต่อหุ้นอย่างชัดเจน
3. ใช้คำสั้นๆ กระชับ
4. หลีกเลี่ยงคำศัพท์เทคนิคที่ซับซ้อน`;

      // ตรวจสอบว่าควรใช้ ChatGPT หรือไม่
      const shouldUseChatGPT = process.env.OPENAI_API_KEY && 
                              process.env.OPENAI_API_KEY !== 'disabled' && 
                              process.env.OPENAI_API_KEY !== 'sk-your-openai-api-key-here';

      let aiResponse = '';

      if (!shouldUseChatGPT) {
        logger.info('🆓 Using FREE Gemini AI for news translation');
        
        // ใช้ Gemini ฟรีโดยตรง
        const GeminiAnalysisService = require('./geminiAnalysisService');
        const geminiService = new GeminiAnalysisService();
        
        aiResponse = await geminiService.callGeminiAPI(prompt, 0, 800);
        
      } else {
        // ลอง ChatGPT ก่อน
        try {
          const axios = require('axios');
          const response = await axios.post('https://api.openai.com/v1/chat/completions', {
            model: "gpt-3.5-turbo",
            messages: [{ role: "user", content: prompt }],
            max_tokens: 600,
            temperature: 0.3
          }, {
            headers: {
              'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
              'Content-Type': 'application/json'
            },
            timeout: 20000
          });

          aiResponse = response.data.choices[0].message.content;
          
        } catch (chatgptError) {
          logger.warn(`⚠️ ChatGPT failed, switching to FREE Gemini: ${chatgptError.message}`);
          
          // สลับไปใช้ Gemini ฟรี
          const GeminiAnalysisService = require('./geminiAnalysisService');
          const geminiService = new GeminiAnalysisService();
          
          aiResponse = await geminiService.callGeminiAPI(prompt, 0, 800);
        }
      }

      // ลองแปลง JSON
      try {
        // ลบ markdown formatting ถ้ามี
        const cleanResponse = aiResponse.replace(/```json\s*/g, '').replace(/```/g, '').trim();
        const parsed = JSON.parse(cleanResponse);
        
        return {
          headline: parsed.headline || 'ไม่สามารถสรุปหัวข้อได้',
          summary: parsed.summary || 'ไม่สามารถสรุปเนื้อหาได้',
          impact: parsed.impact || 'ไม่ทราบผลกระทบ',
          relevance: parsed.relevance || 'ไม่ทราบ',
          originalTitle: newsItem.title,
          url: newsItem.url || newsItem.link,
          source: newsItem.source,
          publishedAt: newsItem.publishedAt || newsItem.pubDate
        };
        
      } catch (parseError) {
        logger.warn(`⚠️ Failed to parse AI response as JSON, using fallback: ${parseError.message}`);
        
        // Fallback: ใช้ข้อความแปลธรรมดา
        return {
          headline: newsItem.title?.substring(0, 50) || 'ไม่มีหัวข้อ',
          summary: aiResponse.substring(0, 150) || 'ไม่สามารถสรุปได้',
          impact: 'ไม่ทราบ',
          relevance: 'ปานกลาง',
          originalTitle: newsItem.title,
          url: newsItem.url || newsItem.link,
          source: newsItem.source,
          publishedAt: newsItem.publishedAt || newsItem.pubDate
        };
      }
      
    } catch (error) {
      logger.error(`❌ Failed to translate news with AI: ${error.message}`);
      
      // Fallback: ใช้ข้อมูลต้นฉบับ
      return {
        headline: newsItem.title?.substring(0, 50) || 'ไม่มีหัวข้อ',
        summary: newsItem.description?.substring(0, 150) || 'ไม่มีรายละเอียด',
        impact: 'ไม่ทราบ',
        relevance: 'ปานกลาง',
        originalTitle: newsItem.title,
        url: newsItem.url || newsItem.link,
        source: newsItem.source,
        publishedAt: newsItem.publishedAt || newsItem.pubDate
      };
    }
  }

  formatMainStockNewsMessage(stock, translatedNews) {
    const impactEmoji = this.getImpactEmoji(translatedNews);
    const relevantNewsCount = translatedNews.filter(n => n.relevance === 'สูง').length;
    
    let message = `📈 ${stock.symbol} (${stock.type})

${impactEmoji} ข่าวประจำวัน: ${translatedNews.length} ข่าว
🎯 ข่าวที่เกี่ยวข้องสูง: ${relevantNewsCount} ข่าว

📊 แนวโน้มผลกระทบ:`;

    // นับผลกระทบ
    const impacts = { บวก: 0, ลบ: 0, เป็นกลาง: 0 };
    translatedNews.forEach(news => {
      if (news.impact.includes('บวก')) impacts.บวก++;
      else if (news.impact.includes('ลบ')) impacts.ลบ++;
      else impacts.เป็นกลาง++;
    });

    if (impacts.บวก > 0) message += `\n🟢 ผลกระทบบวก: ${impacts.บวก} ข่าว`;
    if (impacts.ลบ > 0) message += `\n🔴 ผลกระทบลบ: ${impacts.ลบ} ข่าว`;
    if (impacts.เป็นกลาง > 0) message += `\n🟡 เป็นกลาง: ${impacts.เป็นกลาง} ข่าว`;

    message += `\n\n📰 รายละเอียดข่าวต่อไปนี้...`;

    return message;
  }

  formatDetailedNewsMessage(stockSymbol, newsItem, index) {
    const impactEmoji = this.getSingleImpactEmoji(newsItem.impact);
    const relevanceEmoji = this.getRelevanceEmoji(newsItem.relevance);
    
    let message = `📰 ข่าวที่ ${index}: ${stockSymbol}

${impactEmoji} ${newsItem.headline}

📝 สรุป: ${newsItem.summary}

${relevanceEmoji} ความเกี่ยวข้อง: ${newsItem.relevance}
📊 ผลกระทบ: ${newsItem.impact}`;

    if (newsItem.source) {
      message += `\n📡 แหล่งที่มา: ${newsItem.source}`;
    }

    if (newsItem.url && newsItem.url !== 'undefined' && !newsItem.url.includes('mock')) {
      message += `\n🔗 อ่านต่อ: ${newsItem.url}`;
    }

    if (newsItem.publishedAt) {
      const publishDate = new Date(newsItem.publishedAt);
      if (!isNaN(publishDate.getTime())) {
        message += `\n🕒 เวลา: ${publishDate.toLocaleDateString('th-TH')} ${publishDate.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })}`;
      }
    }

    return message;
  }

  getImpactEmoji(translatedNews) {
    const positiveCount = translatedNews.filter(n => n.impact.includes('บวก')).length;
    const negativeCount = translatedNews.filter(n => n.impact.includes('ลบ')).length;
    
    if (positiveCount > negativeCount) return '📈';
    if (negativeCount > positiveCount) return '📉';
    return '📊';
  }

  getSingleImpactEmoji(impact) {
    if (impact.includes('บวก')) return '🟢';
    if (impact.includes('ลบ')) return '🔴';
    return '🟡';
  }

  getRelevanceEmoji(relevance) {
    if (relevance === 'สูง') return '🎯';
    if (relevance === 'ปานกลาง') return '📌';
    return '📍';
  }

  async sendAllNewsAlert(allNewsData) {
    logger.info(`📰 Sending all news alert for ${allNewsData.length} stocks with news`);
    
    try {
      // ส่งข้อความสรุปก่อน
      const summaryMessage = this.formatNewsalSummaryMessage(allNewsData);
      await this.sendPushMessage(summaryMessage);
      await this.delay(2000);
      
      // ส่งข่าวแต่ละหุ้นพร้อมแปลเป็นไทย
      for (const stockNews of allNewsData) {
        try {
          const message = await this.formatAllNewsMessage(stockNews);
          await this.sendPushMessage(message);
          
          // Add delay between messages
          await this.delay(3000);
          
        } catch (error) {
          logger.error(`❌ Failed to send news for ${stockNews.stock.symbol}: ${error.message}`);
        }
      }
      
      logger.info('✅ All news alerts sent successfully');
      
    } catch (error) {
      logger.error(`❌ Error sending all news alerts: ${error.message}`);
      throw error;
    }
  }

  async sendAllNewsAlert(allNewsData) {
    logger.info(`📰 Sending all news for ${allNewsData.length} stocks to LINE...`);
    
    try {
      // ส่งข้อมูลสรุปก่อน
      const summaryMessage = this.formatNewsSummary(allNewsData);
      await this.sendPushMessage(summaryMessage);
      
      // รอสักครู่แล้วส่งข่าวแต่ละหุ้น
      await this.delay(3000);
      
      for (const stockData of allNewsData) {
        try {
          // แปลและจัดรูปแบบข่าวแต่ละหุ้น
          const newsMessages = await this.formatStockNewsMessages(stockData);
          
          for (const message of newsMessages) {
            await this.sendPushMessage(message);
            await this.delay(2000); // หน่วงเวลาระหว่างข้อความ
          }
          
        } catch (error) {
          logger.error(`❌ Failed to send news for ${stockData.stock.symbol}: ${error.message}`);
        }
      }
      
      // ส่งข่าวสงครามและเหตุการณ์สำคัญแยกต่างหาก
      await this.sendGlobalNewsAlert();
      
    } catch (error) {
      logger.error(`❌ Failed to send all news alert: ${error.message}`);
      throw error;
    }
  }

  async sendGlobalNewsAlert() {
    try {
      logger.info('🌍 Collecting global news affecting markets...');
      
      const ReliableDataService = require('./services/reliableDataService');
      const reliableDataService = new ReliableDataService();
      
      // ค้นหาข่าวสงครามและเหตุการณ์สำคัญ
      const globalTopics = [
        'war ukraine russia', 'israel palestine conflict', 'china taiwan',
        'fed interest rate', 'inflation', 'oil price crisis',
        'bank collapse', 'recession economy', 'market crash'
      ];
      
      let globalNews = [];
      
      for (const topic of globalTopics) {
        try {
          const news = await reliableDataService.getReutersNews(topic);
          if (news && news.length > 0) {
            globalNews = globalNews.concat(news.slice(0, 2)); // เอาแค่ 2 ข่าวต่อหัวข้อ
          }
          await this.delay(1000);
        } catch (error) {
          logger.warn(`⚠️ Failed to get news for topic: ${topic}`);
        }
      }
      
      if (globalNews.length > 0) {
        logger.info(`🌍 Found ${globalNews.length} global news items`);
        
        // จัดรูปแบบและส่งข่าวโลก
        const globalMessage = await this.formatGlobalNewsMessage(globalNews);
        await this.sendPushMessage(globalMessage);
      }
      
    } catch (error) {
      logger.warn(`⚠️ Failed to send global news: ${error.message}`);
    }
  }

  formatNewsSummary(allNewsData) {
    const totalStocks = allNewsData.length;
    const totalNews = allNewsData.reduce((sum, data) => sum + data.totalNews, 0);
    const totalToday = allNewsData.reduce((sum, data) => sum + data.todayNews, 0);
    const totalYesterday = allNewsData.reduce((sum, data) => sum + data.yesterdayNews, 0);
    
    let message = `📊 [สรุปข่าวหุ้นวันนี้] ${new Date().toLocaleDateString('th-TH')}

🎯 หุ้นที่มีข่าว: ${totalStocks} ตัว
📰 ข่าวทั้งหมด: ${totalNews} ข่าว
📅 ข่าววันนี้: ${totalToday} ข่าว
📅 ข่าวเมื่อวาน: ${totalYesterday} ข่าว

📋 รายการหุ้นที่มีข่าว:`;

    allNewsData.forEach((data, index) => {
      message += `\n${index + 1}. ${data.stock.symbol} (${data.totalNews} ข่าว)`;
    });

    message += `\n\n📱 ข่าวแต่ละหุ้นจะส่งตามมาทีละข้อความ...`;
    
    return message;
  }

  async formatStockNewsMessages(stockData) {
    const messages = [];
    const { stock, news } = stockData;
    
    // แยกข่าวเป็นกลุม (ไม่เกิน 5 ข่าวต่อข้อความ)
    const newsGroups = [];
    const newsItems = news.combined || [];
    
    for (let i = 0; i < newsItems.length; i += 3) {
      newsGroups.push(newsItems.slice(i, i + 3));
    }
    
    for (let groupIndex = 0; groupIndex < newsGroups.length; groupIndex++) {
      const newsGroup = newsGroups[groupIndex];
      let message = `📈 [${stock.symbol}] ข่าวการลงทุน`;
      
      if (newsGroups.length > 1) {
        message += ` (${groupIndex + 1}/${newsGroups.length})`;
      }
      
      message += `\n`;
      
      for (let i = 0; i < newsGroup.length; i++) {
        const newsItem = newsGroup[i];
        
        // แปลหัวข้อข่าวเป็นไทย
        const translatedTitle = await this.translateToThai(newsItem.title);
        
        message += `\n📰 ข่าวที่ ${(groupIndex * 3) + i + 1}:`;
        message += `\n🏷️ ${translatedTitle}`;
        
        if (newsItem.description) {
          const translatedDesc = await this.translateToThai(newsItem.description.substring(0, 100));
          message += `\n📝 ${translatedDesc}${newsItem.description.length > 100 ? '...' : ''}`;
        }
        
        message += `\n🗓️ ${this.formatPublishDate(newsItem.publishedAt)}`;
        message += `\n📡 แหล่ง: ${newsItem.source}`;
        
        if (newsItem.url && !newsItem.url.includes('mock') && !newsItem.url.includes('example')) {
          message += `\n🔗 ${newsItem.url}`;
        }
        
        if (i < newsGroup.length - 1) {
          message += `\n${'─'.repeat(30)}`;
        }
      }
      
      message += `\n\n⏰ ${new Date().toLocaleString('th-TH', { timeZone: 'Asia/Bangkok' })}`;
      
      messages.push(message);
    }
    
    return messages;
  }

  formatNewsalSummaryMessage(allNewsData) {
    const totalStocks = allNewsData.length;
    const totalNews = allNewsData.reduce((sum, item) => sum + item.totalNews, 0);
    const totalToday = allNewsData.reduce((sum, item) => sum + item.todayNews, 0);
    const totalYesterday = allNewsData.reduce((sum, item) => sum + item.yesterdayNews, 0);
    
    let message = `📰 [สรุปข่าวสารประจำวัน]

🎯 หุ้นที่มีข่าว: ${totalStocks} ตัว
📊 ข่าวทั้งหมด: ${totalNews} ข่าว
📅 ข่าววันนี้: ${totalToday} ข่าว
📅 ข่าวเมื่อวาน: ${totalYesterday} ข่าว

📈 รายละเอียดหุ้นที่มีข่าว:`;

    allNewsData.forEach((item, index) => {
      message += `
${index + 1}. ${item.stock.symbol} (${item.totalNews} ข่าว)`;
    });

    message += `

⏰ เวลา: ${new Date().toLocaleString('th-TH', { timeZone: 'Asia/Bangkok' })}

📱 ข่าวรายละเอียดจะส่งตามมา...`;

    return message;
  }

  async formatAllNewsMessage(stockNewsData) {
    const { stock, news } = stockNewsData;
    const todayNews = news.today || [];
    const yesterdayNews = news.yesterday || [];
    
    let message = `📰 [ข่าว ${stock.symbol}]

📊 ข่าววันนี้: ${todayNews.length} ข่าว
📊 ข่าวเมื่อวาน: ${yesterdayNews.length} ข่าว`;

    // แสดงข่าววันนี้
    if (todayNews.length > 0) {
      message += `

📅 ข่าววันนี้:`;
      
      for (let i = 0; i < Math.min(3, todayNews.length); i++) {
        const newsItem = todayNews[i];
        const translatedTitle = await this.translateToThai(newsItem.title);
        const translatedDesc = await this.translateToThai(newsItem.description);
        
        message += `

🔸 ข่าวที่ ${i + 1}:
${translatedTitle}

📝 รายละเอียด:
${translatedDesc}`;

        if (newsItem.url && !newsItem.url.includes('mock') && !newsItem.url.includes('example')) {
          message += `

🔗 อ่านต่อ: ${newsItem.url}`;
        }
        
        if (newsItem.source) {
          message += `
📰 แหล่ง: ${newsItem.source}`;
        }
      }
    }

    // แสดงข่าวเมื่อวาน (แค่ 1-2 ข่าว)
    if (yesterdayNews.length > 0) {
      message += `

📅 ข่าวเมื่อวาน:`;
      
      for (let i = 0; i < Math.min(2, yesterdayNews.length); i++) {
        const newsItem = yesterdayNews[i];
        const translatedTitle = await this.translateToThai(newsItem.title);
        
        message += `

🔸 ${translatedTitle}`;
        
        if (newsItem.url && !newsItem.url.includes('mock') && !newsItem.url.includes('example')) {
          message += `
🔗 ${newsItem.url}`;
        }
      }
    }

    message += `

⏰ เวลา: ${new Date().toLocaleString('th-TH', { timeZone: 'Asia/Bangkok' })}`;

    return message;
  }

  async translateToThai(text) {
    try {
      if (!text) return 'ไม่มีข้อมูล';
      
      // ตรวจสอบว่าเป็นภาษาไทยอยู่แล้วหรือไม่
      const thaiRegex = /[\u0E00-\u0E7F]/;
      if (thaiRegex.test(text)) {
        return text; // ถ้าเป็นภาษาไทยแล้วก็ return เลย
      }
      
      // ใช้ AI แปลเป็นไทย (ใช้ Gemini ฟรี)
      const GeminiAnalysisService = require('./geminiAnalysisService');
      const geminiService = new GeminiAnalysisService();
      
      const prompt = `แปลข้อความต่อไปนี้เป็นภาษาไทยให้กระชับและเข้าใจง่าย (ไม่เกิน 100 ตัวอักษร):

"${text}"

กรุณาแปลเฉพาะเนื้อหาสำคัญ โดยใช้คำศัพท์การเงินและหุ้นที่เหมาะสม`;

      const translatedText = await geminiService.callGeminiAPI(prompt, 0, 150);
      
      // ลบ markdown หรือ formatting ที่ไม่ต้องการ
      return translatedText.replace(/```\w*\s*/g, '').replace(/```/g, '').trim();
      
    } catch (error) {
      logger.warn(`⚠️ Translation failed for "${text}": ${error.message}`);
      
      // ถ้าแปลไม่ได้ให้ใช้ข้อความต้นฉบับแต่ตัดให้สั้น
      return text.length > 80 ? text.substring(0, 80) + '...' : text;
    }
  }

  async formatGlobalNewsMessage(globalNews) {
    let message = `🌍 [ข่าวโลกที่อาจกระทบตลาด] ${new Date().toLocaleDateString('th-TH')}

⚠️ ข่าวสำคัญที่นักลงทุนควรติดตาม:`;

    // เอาแค่ 5 ข่าวแรกที่สำคัญที่สุด
    const importantNews = globalNews.slice(0, 5);
    
    for (let i = 0; i < importantNews.length; i++) {
      const newsItem = importantNews[i];
      
      // แปลหัวข้อข่าวเป็นไทย
      const translatedTitle = await this.translateToThai(newsItem.title);
      
      message += `\n\n🔥 ข่าวที่ ${i + 1}:`;
      message += `\n📢 ${translatedTitle}`;
      
      if (newsItem.description) {
        const translatedDesc = await this.translateToThai(newsItem.description.substring(0, 80));
        message += `\n💭 ${translatedDesc}${newsItem.description.length > 80 ? '...' : ''}`;
      }
      
      message += `\n📅 ${this.formatPublishDate(newsItem.publishedAt)}`;
      message += `\n📡 ${newsItem.source}`;
      
      if (newsItem.url && !newsItem.url.includes('mock')) {
        message += `\n🔗 ${newsItem.url}`;
      }
    }

    message += `\n\n💡 เหตุการณ์เหล่านี้อาจส่งผลต่อ:`;
    message += `\n• 📈 ตลาดหุ้นทั่วโลก`;
    message += `\n• 💱 อัตราแลกเปลี่ยน`;
    message += `\n• 🏅 ราคาทอง`;
    message += `\n• 🛢️ ราคาน้ำมัน`;
    
    return message;
  }

  async translateToThai(text) {
    try {
      // ใช้ AI ในการแปลข้อความเป็นไทยแบบเข้าใจง่าย
      const shouldUseChatGPT = process.env.OPENAI_API_KEY && 
                              process.env.OPENAI_API_KEY !== 'disabled' && 
                              process.env.OPENAI_API_KEY !== 'sk-your-openai-api-key-here';

      const prompt = `แปลข้อความนี้เป็นภาษาไทยให้เข้าใจง่าย กระชับ และเหมาะสำหรับนักลงทุน:

"${text}"

ตอบเป็นภาษาไทยเท่านั้น ไม่ต้องอธิบายเพิ่มเติม`;

      if (!shouldUseChatGPT) {
        // ใช้ Gemini ฟรี
        const GeminiAnalysisService = require('./services/geminiAnalysisService');
        const geminiService = new GeminiAnalysisService();
        
        const translation = await geminiService.callGeminiAPI(prompt, 0, 150);
        return translation.trim();
      }

      // ลอง ChatGPT ก่อน
      try {
        const response = await axios.post('https://api.openai.com/v1/chat/completions', {
          model: "gpt-3.5-turbo",
          messages: [{ role: "user", content: prompt }],
          max_tokens: 150,
          temperature: 0.3
        }, {
          headers: {
            'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
            'Content-Type': 'application/json'
          },
          timeout: 10000
        });

        return response.data.choices[0].message.content.trim();
        
      } catch (chatgptError) {
        // สลับไปใช้ Gemini ฟรี
        const GeminiAnalysisService = require('./services/geminiAnalysisService');
        const geminiService = new GeminiAnalysisService();
        
        const translation = await geminiService.callGeminiAPI(prompt, 0, 150);
        return translation.trim();
      }
      
    } catch (error) {
      logger.warn(`⚠️ Translation failed: ${error.message}, using original text`);
      // ถ้าแปลไม่ได้ให้ใช้ข้อความต้นฉบับ
      return text;
    }
  }

  formatPublishDate(dateString) {
    try {
      if (!dateString) return 'ไม่ระบุวันที่';
      
      const date = new Date(dateString);
      const now = new Date();
      const diffHours = Math.floor((now - date) / (1000 * 60 * 60));
      
      if (diffHours < 1) {
        return 'เมื่อสักครู่';
      } else if (diffHours < 24) {
        return `${diffHours} ชั่วโมงที่แล้ว`;
      } else if (diffHours < 48) {
        return 'เมื่อวาน';
      } else {
        return date.toLocaleDateString('th-TH', { 
          year: 'numeric', 
          month: 'short', 
          day: 'numeric' 
        });
      }
    } catch (error) {
      return 'ไม่ระบุวันที่';
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

    if (!this.channelAccessToken || this.channelAccessToken === 'your-line-channel-access-token-here') {
      throw new Error('LINE Channel Access Token not configured');
    }

    return await this.withRetry(async () => {
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
      
      if (response.status !== 200) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      logger.info(`✅ LINE message sent successfully`);
      return response.data;
    }, 'LINE push message');
  }

  async replyToUser(replyToken, message) {
    return await this.withRetry(async () => {
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
      
      if (response.status !== 200) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      logger.info(`✅ Reply sent successfully`);
      return response.data;
    }, 'LINE reply message');
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

  async sendAllNewsAlert(allNewsData) {
    logger.info(`📰 Sending comprehensive news alert for ${allNewsData.length} stocks with news`);
    
    try {
      // ส่งข่าวสรุปก่อน
      const totalNewsCount = allNewsData.reduce((sum, stockData) => sum + stockData.totalNews, 0);
      const summaryMessage = `📰 [สรุปข่าวรายวัน] ${new Date().toLocaleDateString('th-TH', { timeZone: 'Asia/Bangkok' })}

🔍 รวบรวมข่าวจาก ${allNewsData.length} หลักทรัพย์
📊 พบข่าวทั้งหมด ${totalNewsCount} รายการ

รายละเอียดข่าวแต่ละหลักทรัพย์จะส่งต่อไปทีละรายการ...`;

      await this.sendPushMessage(summaryMessage);
      await this.delay(5000); // เพิ่ม delay เป็น 5 วินาที
      
      // ส่งข่าวแต่ละหุ้นพร้อมสรุปภาษาไทย
      for (let i = 0; i < allNewsData.length; i++) {
        const stockData = allNewsData[i];
        
        try {
          const messages = await this.formatComprehensiveNewsMessage(stockData);
          
          // ส่งแต่ละข้อความ
          for (let j = 0; j < messages.length; j++) {
            const message = messages[j];
            await this.sendPushMessage(message);
            
            // เพิ่ม delay ระหว่างข้อความ
            if (j < messages.length - 1) {
              await this.delay(3000); // 3 วินาทีระหว่างข้อความ
            }
          }
          
          // เพิ่ม delay ระหว่างหุ้น
          if (i < allNewsData.length - 1) {
            await this.delay(5000); // 5 วินาทีระหว่างหุ้น
          }
          
        } catch (error) {
          logger.error(`❌ Failed to send news for ${stockData.stock.symbol}: ${error.message}`);
        }
      }
      
      // ส่งข้อความปิดท้าย
      const closingMessage = `✅ [เสร็จสิ้น] ส่งข่าวครบทั้ง ${allNewsData.length} หลักทรัพย์แล้ว

⏰ เวลา: ${new Date().toLocaleString('th-TH', { timeZone: 'Asia/Bangkok' })}

📱 ระบบจะอัพเดทข่าวใหม่อัตโนมัติตามกำหนดการ`;

      await this.delay(3000);
      await this.sendPushMessage(closingMessage);
      
    } catch (error) {
      logger.error(`❌ Failed to send comprehensive news alert: ${error.message}`);
      throw error;
    }
  }

  async formatComprehensiveNewsMessage(stockData) {
    const { stock, news, isGlobalNews } = stockData;
    const messages = [];
    
    try {
      // กรองข่าวที่อยู่ในช่วง 1 อาทิตย์
      const oneWeekAgo = new Date();
      oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
      
      const recentNews = news.combined?.filter(newsItem => {
        if (!newsItem.publishedAt) return false;
        const newsDate = new Date(newsItem.publishedAt);
        return newsDate >= oneWeekAgo;
      }) || [];
      
      if (recentNews.length === 0) {
        const noNewsMessage = isGlobalNews ? 
          `🌍 [${stock.displayName}]

ℹ️ ไม่พบข่าวใหม่ในช่วง 7 วันที่ผ่านมา

⏰ ตรวจสอบเมื่อ: ${new Date().toLocaleString('th-TH', { timeZone: 'Asia/Bangkok' })}` :
          `📰 [${stock.symbol}] ${stock.type}

ℹ️ ไม่พบข่าวใหม่ในช่วง 7 วันที่ผ่านมา

⏰ ตรวจสอบเมื่อ: ${new Date().toLocaleString('th-TH', { timeZone: 'Asia/Bangkok' })}`;
        
        messages.push(noNewsMessage);
        return messages;
      }
      
      // แบ่งข่าวเป็นกลุม (ไม่เกิน 3 ข่าวต่อข้อความ)
      const newsChunks = [];
      for (let i = 0; i < recentNews.length; i += 3) {
        newsChunks.push(recentNews.slice(i, i + 3));
      }
      
      for (let chunkIndex = 0; chunkIndex < newsChunks.length; chunkIndex++) {
        const newsChunk = newsChunks[chunkIndex];
        let message = `📰 [${stock.symbol}] ${stock.type} (${chunkIndex + 1}/${newsChunks.length})

💼 จำนวนลงทุน: ${stock.amount} ${stock.unit}
📅 ข่าวในช่วง 7 วัน: ${recentNews.length} รายการ\n\n`;

        // สรุปข่าวแต่ละรายการด้วย AI
        for (let newsIndex = 0; newsIndex < newsChunk.length; newsIndex++) {
          const newsItem = newsChunk[newsIndex];
          const newsNumber = (chunkIndex * 3) + newsIndex + 1;
          
          try {
            // สรุปข่าวด้วย AI
            const summary = await this.summarizeNewsWithAI(newsItem, stock);
            
            // ลบ HTML tags จากเนื้อหา
            const cleanContent = this.removeHtmlTags(summary.contentThai);
            
            message += `📰 ข่าวที่ ${newsNumber}: ${summary.titleThai}

📝 สรุป: ${cleanContent}

💡 ผลกระทบต่อ ${stock.symbol}: ${summary.impact}

💰 ทิศทางราคา: ${this.formatPriceDirection(summary.priceDirection)} ${this.formatPercentageWithSign(summary.priceChangePercent || '0.5')} (${this.getRiskDescription(summary.riskLevel || '5')})
⏱️ ระยะเวลา: ${summary.timeframe || '1 สัปดาห์'}
🎯 ความมั่นใจเรื่องหุ้นขึ้นลง: ${this.formatConfidenceScore(summary.confidence || 'ต่ำ')}/10
📊 ความน่าเชื่อถือของข่าว: ${summary.sourceReliability || '5'}/10

📅 วันที่: ${new Date(newsItem.publishedAt).toLocaleDateString('th-TH', { timeZone: 'Asia/Bangkok' })}
🏢 แหล่งข่าว: ${newsItem.source || 'ไม่ระบุ'}`;

            // เพิ่มลิงค์ถ้ามี และตรวจสอบว่าเป็น URL ที่ถูกต้อง
            if (newsItem.url && 
                newsItem.url !== 'undefined' && 
                !newsItem.url.includes('mock') && 
                newsItem.url.startsWith('http')) {
              message += `\n🔗 อ่านเพิ่มเติม: ${newsItem.url}`;
            }
            
            message += '\n\n';
            
          } catch (aiError) {
            logger.warn(`⚠️ AI summary failed for news ${newsNumber}: ${aiError.message}`);
            
            // Fallback โดยไม่ใช้ AI
            const cleanFallbackContent = this.removeHtmlTags((newsItem.description || newsItem.content || 'ไม่มีรายละเอียด').substring(0, 150));
            
            message += `📰 ข่าวที่ ${newsNumber}: ${newsItem.title || 'ไม่มีหัวข้อ'}

📝 รายละเอียด: ${cleanFallbackContent}...

💰 ทิศทางราคา: 📊🟡 คงที่ ±0.5% (เสี่ยงปานกลาง)
⏱️ ระยะเวลา: 1 สัปดาห์
🎯 ความมั่นใจเรื่องหุ้นขึ้นลง: 3/10
📊 ความน่าเชื่อถือของข่าว: 5/10

📅 วันที่: ${new Date(newsItem.publishedAt).toLocaleDateString('th-TH', { timeZone: 'Asia/Bangkok' })}
🏢 แหล่งข่าว: ${newsItem.source || 'ไม่ระบุ'}`;

            if (newsItem.url && 
                newsItem.url !== 'undefined' && 
                !newsItem.url.includes('mock') && 
                newsItem.url.startsWith('http')) {
              message += `\n🔗 อ่านเพิ่มเติม: ${newsItem.url}`;
            }
            
            message += '\n\n';
          }
        }
        
        message += `⏰ อัพเดท: ${new Date().toLocaleString('th-TH', { timeZone: 'Asia/Bangkok' })}`;
        messages.push(message);
      }
      
      return messages;
      
    } catch (error) {
      logger.error(`❌ Error formatting comprehensive news for ${stock.symbol}: ${error.message}`);
      
      // Fallback message
      const fallbackMessage = `📰 [${stock.symbol}] ${stock.type}

❌ เกิดข้อผิดพลาดในการประมวลผลข่าว: ${error.message}

⏰ เวลา: ${new Date().toLocaleString('th-TH', { timeZone: 'Asia/Bangkok' })}`;
      
      return [fallbackMessage];
    }
  }

  async summarizeNewsWithAI(newsItem, stock, isGlobalNews = false) {
    try {
      // รวมข้อมูลข่าวสำหรับการสรุป
      const newsText = `${newsItem.title || ''} ${newsItem.description || newsItem.content || ''}`;
      
      if (!newsText.trim()) {
        throw new Error('No news content to summarize');
      }
      
      // ประเมินความน่าเชื่อถือของแหล่งข่าว
      const sourceCredibility = this.evaluateSourceCredibility(newsItem.source);
      
      const prompt = `แปลและสรุปข่าวต่อไปนี้เป็นภาษาไทยให้ละเอียด ครบถ้วน และเข้าใจง่าย:

หุ้น/สินทรัพย์: ${stock.symbol} (${stock.type})
แหล่งข่าว: ${newsItem.source || 'ไม่ระบุ'} (ความน่าเชื่อถือ: ${sourceCredibility}/10)

ข่าวต้นฉบับ (ภาษาอังกฤษ): ${newsText}

กรุณาตอบในรูปแบบ JSON โดยแปลทุกอย่างเป็นภาษาไทย 100% เท่านั้น ห้ามใช้คำอังกฤษ:
{
  "titleThai": "หัวข้อข่าวภาษาไทยที่เข้าใจง่าย อธิบายเหตุการณ์สำคัญ (70-90 ตัวอักษร)",
  "contentThai": "สรุปเนื้อหาข่าวภาษาไทยแบบละเอียดครบถ้วน อธิบายสาเหตุ ผลกระทบ และความสำคัญของเหตุการณ์ให้เข้าใจได้ง่าย (180-250 ตัวอักษร)",
  "impact": "วิเคราะห์ผลกระทบต่อหุ้น ${stock.symbol} อย่างละเอียด อธิบายว่าทำไมข่าวนี้ส่งผลดีหรือไม่ดี รวมทั้งผลระยะสั้นและระยะยาว ประเมินโอกาสและความเสี่ยง (150-200 ตัวอักษร)",
  "priceDirection": "ทิศทางราคาที่คาดการณ์: ปรับขึ้น/ปรับลง/เคลื่อนไหวในแนวนอน/ผันผวนสูง",
  "priceChangePercent": "เปอร์เซ็นต์การเปลี่ยนแปลงที่คาดการณ์ (ตัวเลขเท่านั้น เช่น 5.2)",
  "timeframe": "ช่วงเวลาที่คาดว่าจะเห็นผลกระทบ เช่น 1 สัปดาห์, 2 สัปดาห์, 1 เดือน, 3 เดือน",
  "sourceReliability": "ความน่าเชื่อถือของแหล่งข่าว 1-10 (ตัวเลขเท่านั้น)",
  "riskLevel": "ระดับความเสี่ยงของหุ้นนี้ 1-10 จากข่าวนี้ (ตัวเลขเท่านั้น)",
  "explanation": "อธิบายเหตุผลการประเมินความเสี่ยงและทิศทางราคาเป็นภาษาไทยแบบละเอียด วิเคราะห์ปัจจัยที่สำคัญ เช่น ผลประกอบการ การแข่งขัน นโยบายรัฐบาล สภาพตลาด (200-280 ตัวอักษร)",
  "confidence": "ระดับความมั่นใจในการคาดการณ์: มั่นใจสูง/มั่นใจปานกลาง/มั่นใจต่ำ"
}

ข้อกำหนดสำคัญที่ต้องปฏิบัติ:
- แปลทุกคำเป็นภาษาไทย 100% ห้ามปนคำอังกฤษเด็ดขาด
- ใช้คำศัพท์การเงินและการลงทุนภาษาไทยที่ถูกต้อง
- อธิบายให้เข้าใจง่าย เหมือนกับการสื่อสารกับนักลงทุนทั่วไป
- ระบุเหตุผลของการประเมินแต่ละอย่างอย่างชัดเจนและเป็นเหตุเป็นผล
- หลีกเลี่ยงศัพท์เทคนิคที่ซับซ้อน ใช้คำง่ายๆ ที่เข้าใจได้
- ใช้คำไทยแทนชื่อบริษัท ตำแหน่ง และศัพท์เทคนิคทุกครั้ง
- อธิบายสาเหตุและผลที่ตามมาให้ชัดเจน เชื่อมโยงกันได้
- วิเคราะห์ผลกระทบทั้งระยะสั้นและระยะยาว
- ให้ข้อมูลที่เป็นประโยชน์ มีเหตุผล และสามารถนำไปใช้ประกอบการตัดสินใจได้
- ใช้ตัวอักษรให้ครบตามที่กำหนด เพื่อให้ข้อมูลละเอียดและครบถ้วน`;

      // ตรวจสอบว่าควรใช้ AI ไหน
      const shouldUseChatGPT = process.env.OPENAI_API_KEY && 
                              process.env.OPENAI_API_KEY !== 'disabled' && 
                              process.env.OPENAI_API_KEY !== 'sk-your-openai-api-key-here';

      if (!shouldUseChatGPT) {
        // ใช้ Gemini ฟรี
        const GeminiAnalysisService = require('./geminiAnalysisService');
        const geminiService = new GeminiAnalysisService();
        
        const geminiResponse = await geminiService.callGeminiAPI(prompt, 0, 400);
        const cleanedResponse = geminiResponse.replace(/```json\s*/g, '').replace(/```/g, '').trim();
        
        try {
          const parsed = JSON.parse(cleanedResponse);
          // เพิ่ม URL และ source จากข่าวต้นฉบับ
          return {
            ...parsed,
            url: newsItem.url || newsItem.link || null,
            source: newsItem.source || 'ไม่ระบุ'
          };
        } catch (parseError) {
          // Fallback parsing
          return this.parseAIResponseFallback(geminiResponse, newsItem, stock);
        }
      }

      // ลอง ChatGPT ก่อน
      try {
        const axios = require('axios');
        const response = await axios.post('https://api.openai.com/v1/chat/completions', {
          model: process.env.OPENAI_MODEL || "gpt-3.5-turbo",
          messages: [{ role: "user", content: prompt }],
          max_tokens: 500,
          temperature: 0.3
        }, {
          headers: {
            'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
            'Content-Type': 'application/json'
          },
          timeout: this.timeout
        });

        const content = response.data.choices[0].message.content;
        try {
          const parsed = JSON.parse(content);
          // เพิ่ม URL และ source จากข่าวต้นฉบับ
          return {
            ...parsed,
            url: newsItem.url || newsItem.link || null,
            source: newsItem.source || 'ไม่ระบุ'
          };
        } catch (parseError) {
          return this.parseAIResponseFallback(content, newsItem, stock);
        }
        
      } catch (chatgptError) {
        // สลับไปใช้ Gemini
        const GeminiAnalysisService = require('./geminiAnalysisService');
        const geminiService = new GeminiAnalysisService();
        
        const geminiResponse = await geminiService.callGeminiAPI(prompt, 0, 400);
        const cleanedResponse = geminiResponse.replace(/```json\s*/g, '').replace(/```/g, '').trim();
        
        try {
          const parsed = JSON.parse(cleanedResponse);
          // เพิ่ม URL และ source จากข่าวต้นฉบับ
          return {
            ...parsed,
            url: newsItem.url || newsItem.link || null,
            source: newsItem.source || 'ไม่ระบุ'
          };
        } catch (parseError) {
          return this.parseAIResponseFallback(geminiResponse, newsItem, stock);
        }
      }
      
    } catch (error) {
      logger.warn(`⚠️ AI summarization failed: ${error.message}`);
      
      // Manual fallback
      return {
        titleThai: this.translateToThai(newsItem.title || 'ข่าวไม่มีหัวข้อ'),
        contentThai: this.translateToThai((newsItem.description || newsItem.content || 'ไม่มีรายละเอียด').substring(0, 120)),
        impact: 'ไม่สามารถประเมินผลกระทบได้ในขณะนี้',
        priceDirection: 'ไม่เปลี่ยนแปลง',
        priceChangePercent: '0%',
        timeframe: 'ไม่ระบุ',
        confidence: 'ต่ำ'
      };
    }
  }

  parseAIResponseFallback(response, newsItem, stock) {
    // พยายามดึงข้อมูลจาก response ที่ไม่ใช่ JSON แล้วแปลเป็นไทยอย่างละเอียด
    const lines = response.split('\n').filter(line => line.trim());
    
    let titleThai = newsItem.title || 'ข่าวไม่มีหัวข้อ';
    let contentThai = (newsItem.description || newsItem.content || 'ไม่มีรายละเอียด');
    let impact = 'ไม่สามารถประเมินผลกระทบได้ในขณะนี้ เนื่องจากข้อมูลไม่เพียงพอ';
    
    // แปลหัวข้อและเนื้อหาเป็นไทยแบบละเอียด
    titleThai = this.translateToThai(titleThai);
    contentThai = this.translateToThai(contentThai);
    
    // ลบ HTML tags และ CDATA จากเนื้อหา
    contentThai = this.removeHtmlTags(contentThai);
    
    // สร้างเนื้อหาสรุปให้ครบตามความยาวที่ต้องการ (180-250 ตัวอักษร)
    if (contentThai.length < 180) {
      contentThai += ' ข่าวนี้เกี่ยวข้องกับหุ้น ' + stock.symbol + ' ซึ่งเป็น' + stock.type + ' ที่มีความสำคัญต่อตลาดการเงิน นักลงทุนควรติดตามการเปลี่ยนแปลงอย่างใกล้ชิด';
      
      // หากยังไม่พอ ให้เพิ่มข้อมูลทั่วไป
      if (contentThai.length < 180) {
        contentThai += ' เหตุการณ์นี้อาจส่งผลกระทบต่อราคาหุ้นและควรพิจารณาปัจจัยต่างๆ ประกอบการตัดสินใจลงทุน';
      }
    }
    
    // สร้างผลกระทบที่ละเอียดมากขึ้น (150-200 ตัวอักษร)
    impact = `ข่าวนี้อาจมีผลกระทบต่อหุ้น ${stock.symbol} แต่ต้องวิเคราะห์เพิ่มเติม โดยพิจารณาปัจจัยต่างๆ เช่น ผลประกอบการ สภาพตลาด และแนวโน้มเศรษฐกิจ เพื่อประเมินผลกระทบที่แท้จริง`;

    return {
      titleThai: titleThai.substring(0, 80), // เพิ่มจาก 60 เป็น 80 ตัวอักษร
      contentThai: contentThai.substring(0, 250), // เพิ่มจาก 120 เป็น 250 ตัวอักษร
      impact: impact.substring(0, 200), // เพิ่มจาก 80 เป็น 200 ตัวอักษร
      priceDirection: 'เคลื่อนไหวในแนวนอน',
      priceChangePercent: '0.5',
      timeframe: '1 สัปดาห์',
      sourceReliability: '5',
      riskLevel: '5',
      explanation: `การประเมินเบื้องต้นสำหรับ ${stock.symbol} โดยใช้ข้อมูลพื้นฐาน แนะนำให้ติดตามข้อมูลเพิ่มเติมก่อนตัดสินใจลงทุน เนื่องจากตลาดการเงินมีความผันผวนและมีปัจจัยหลายอย่างที่ส่งผล`,
      confidence: 'มั่นใจต่ำ',
      url: newsItem.url || newsItem.link || null,
      source: newsItem.source || 'ไม่ระบุ'
    };
  }

  formatPriceDirection(direction) {
    switch (direction?.toLowerCase()) {
      case 'ขึ้น':
      case 'เพิ่มขึ้น':
      case 'ปรับขึ้น':
      case 'up':
        return '📈🟢 ขึ้น';
      case 'ลง':
      case 'ลดลง':
      case 'ปรับลง':
      case 'down':
        return '📉🔴 ลง';
      case 'คงที่':
      case 'ไม่เปลี่ยนแปลง':
      case 'เคลื่อนไหวในแนวนอน':
      case 'stable':
      case 'no change':
        return '📊🟡 คงที่';
      case 'ผันผวน':
      case 'ผันผวนสูง':
      case 'volatile':
        return '📊🟠 ผันผวน';
      default:
        return '📊🟡 คงที่';
    }
  }

  formatPercentageWithSign(percentage) {
    const num = parseFloat(percentage.toString().replace('%', ''));
    if (num > 0) {
      return `+${num}%`;
    } else if (num < 0) {
      return `${num}%`;
    } else {
      return `±${Math.abs(num)}%`;
    }
  }

  formatConfidenceScore(confidence) {
    if (typeof confidence === 'string') {
      switch (confidence.toLowerCase()) {
        case 'มั่นใจสูง':
        case 'สูง':
          return '8';
        case 'มั่นใจปานกลาง':
        case 'ปานกลาง':
          return '5';
        case 'มั่นใจต่ำ':
        case 'ต่ำ':
        default:
          return '3';
      }
    }
    return confidence.toString();
  }

  getRiskDescription(riskLevel) {
    const risk = parseInt(riskLevel);
    if (risk >= 8) return 'เสี่ยงสูง';
    if (risk >= 6) return 'เสี่ยงปานกลาง';
    if (risk >= 4) return 'เสี่ยงปานกลาง';
    return 'เสี่ยงต่ำ';
  }

  removeHtmlTags(text) {
    if (!text) return '';
    
    return text
      // ลบ CDATA
      .replace(/<<!\[CDATA\[/g, '')
      .replace(/\]\]>/g, '')
      // ลบ HTML tags ทั้งหมด
      .replace(/<[^>]*>/g, '')
      // ลบ HTML entities
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      // ลบช่องว่างเกิน
      .replace(/\s+/g, ' ')
      .trim();
  }

  translateToThai(englishText) {
    // แปลคำศัพท์พื้นฐานเป็นไทยอย่างครอบคลุม
    if (!englishText) return 'ไม่มีข้อมูล';
    
    let translated = englishText;
    
    // แปลคำศัพท์การเงินและการลงทุนแบบครบถ้วน
    const financialTranslations = {
      // คำศัพท์พื้นฐาน
      'stock': 'หุ้น', 'stocks': 'หุ้น', 'shares': 'หุ้น', 'equity': 'หุ้น',
      'market': 'ตลาด', 'markets': 'ตลาด', 'trading': 'การซื้อขาย',
      'price': 'ราคา', 'prices': 'ราคา', 'pricing': 'การกำหนดราคา',
      'earnings': 'กำไร', 'profit': 'กำไร', 'profits': 'กำไร', 'revenue': 'รายได้',
      'loss': 'ขาดทุน', 'losses': 'ขาดทุน', 'deficit': 'ขาดดุล',
      
      // คำที่เจาะจงมากขึ้น
      'futures': 'ฟิวเจอร์ส', 'future': 'อนาคต', 'gained': 'เพิ่มขึ้น', 'gain': 'ได้รับ',
      'optimism': 'ความมองในแง่ดี', 'ahead': 'ข้างหน้า', 'meeting': 'การประชุม',
      'negotiators': 'ผู้เจรจา', 'top': 'ระดับสูง', 'expressed': 'แสดงออก',
      'reach': 'เข้าถึง', 'key': 'สำคัญ', 'later': 'ต่อมา', 'between': 'ระหว่าง',
      'could': 'สามารถ', 'play': 'เล่น', 'like': 'เหมือน', 'pro': 'มืออาชีพ',
      'surveyed': 'สำรวจ', 'favored': 'ที่ชื่นชอบ', 'picks': 'เลือก', 'heading': 'มุ่งหน้า',
      'into': 'เข้าสู่', 'identified': 'ระบุ', 'across': 'ทั่วทั้ง', 'sector': 'ภาคส่วน',
      'faces': 'เผชิญ', 'midweek': 'กลางสัปดาห์', 'double': 'สอง', 'whammy': 'เหตุร้าย',
      'decision': 'การตัดสินใจ', 'collides': 'ขัดแย้ง', 'with': 'กับ', 'flood': 'กระแส',
      'megacap': 'หุ้นขนาดใหญ่', 'record-setting': 'สถิติใหม่', 'rally': 'การขึ้น',
      'pivotal': 'สำคัญ', 'interest-rate': 'อัตราดอกเบี้ย',
      
      // เวลาและช่วงเวลา
      'quarter': 'ไตรมาส', 'quarterly': 'รายไตรมาส', 'Q1': 'ไตรมาส 1', 'Q2': 'ไตรมาส 2', 'Q3': 'ไตรมาส 3', 'Q4': 'ไตรมาส 4',
      'annual': 'ประจำปี', 'annually': 'ทุกปี', 'year': 'ปี', 'yearly': 'รายปี',
      'month': 'เดือน', 'monthly': 'รายเดือน', 'week': 'สัปดาห์', 'weekly': 'รายสัปดาห์',
      'day': 'วัน', 'daily': 'รายวัน', 'sunday': 'วันอาทิตย์', 'monday': 'วันจันทร์',
      'tuesday': 'วันอังคาร', 'wednesday': 'วันพุธ', 'thursday': 'วันพฤหัสบดี',
      'friday': 'วันศุกร์', 'saturday': 'วันเสาร์',
      
      // องค์กรและบริษัท
      'company': 'บริษัท', 'companies': 'บริษัท', 'corporation': 'บริษัท',
      'business': 'ธุรกิจ', 'businesses': 'ธุรกิจ', 'firm': 'บริษัท', 'firms': 'บริษัท',
      'enterprise': 'องค์กร', 'startup': 'บริษัทเริ่มต้น', 'organization': 'องค์กร',
      
      // การลงทุนและนักลงทุน
      'investment': 'การลงทุน', 'investments': 'การลงทุน', 'investor': 'นักลงทุน', 'investors': 'นักลงทุน',
      'portfolio': 'พอร์ตโฟลิโอ', 'fund': 'กองทุน', 'funds': 'กองทุน',
      'asset': 'สินทรัพย์', 'assets': 'สินทรัพย์', 'liability': 'หนี้สิน', 'liabilities': 'หนี้สิน',
      
      // เศรษฐกิจและการเงิน
      'financial': 'การเงิน', 'finance': 'การเงิน', 'economy': 'เศรษฐกิจ', 'economic': 'ทางเศรษฐกิจ',
      'inflation': 'อัตราเงินเฟ้อ', 'deflation': 'เงินฝืด', 'recession': 'เศรษฐกิจถดถอย',
      'gdp': 'ผลิตภัณฑ์มวลรวมในประเทศ', 'interest rate': 'อัตราดอกเบี้ย', 'interest rates': 'อัตราดอกเบี้ย',
      
      // การเปลี่ยนแปลง
      'growth': 'การเติบโต', 'growing': 'กำลังเติบโต', 'decline': 'ลดลง', 'declining': 'กำลังลดลง',
      'increase': 'เพิ่มขึ้น', 'increasing': 'กำลังเพิ่มขึ้น', 'decrease': 'ลดลง', 'decreasing': 'กำลังลดลง',
      'rise': 'ขึ้น', 'rising': 'กำลังขึ้น', 'fall': 'ลง', 'falling': 'กำลังลง', 'drop': 'ตก', 'dropping': 'กำลังตก',
      'surge': 'พุ่งขึ้น', 'surging': 'กำลังพุ่งขึ้น', 'plunge': 'ดิ่งลง', 'plunging': 'กำลังดิ่งลง',
      'soar': 'ทะยาน', 'soaring': 'กำลังทะยาน', 'crash': 'ล่มสลาย', 'crashing': 'กำลังล่มสลาย',
      'boom': 'บูม', 'bust': 'ถดถอย', 'bubble': 'ฟองสบู่', 'volatile': 'ผันผวน', 'volatility': 'ความผันผวน',
      
      // คำกริยาและคำคุณศัพท์ทั่วไป
      'over': 'เหนือ', 'under': 'ใต้', 'after': 'หลังจาก', 'before': 'ก่อน',
      'during': 'ระหว่าง', 'while': 'ขณะที่', 'when': 'เมื่อ', 'where': 'ที่ไหน',
      'what': 'อะไร', 'why': 'ทำไม', 'how': 'อย่างไร', 'who': 'ใครบ้าง',
      'new': 'ใหม่', 'old': 'เก่า', 'high': 'สูง', 'low': 'ต่ำ', 'big': 'ใหญ่', 'small': 'เล็ก',
      'good': 'ดี', 'bad': 'แย่', 'better': 'ดีกว่า', 'worse': 'แย่กว่า', 'best': 'ดีที่สุด', 'worst': 'แย่ที่สุด',
      'more': 'มากกว่า', 'less': 'น้อยกว่า', 'most': 'มากที่สุด', 'least': 'น้อยที่สุด',
      'up': 'ขึ้น', 'down': 'ลง', 'in': 'ใน', 'out': 'ออก', 'on': 'บน', 'off': 'ปิด',
      'this': 'นี้', 'that': 'นั้น', 'these': 'เหล่านี้', 'those': 'เหล่านั้น',
      'and': 'และ', 'or': 'หรือ', 'but': 'แต่', 'so': 'ดังนั้น', 'because': 'เพราะ',
      'if': 'หาก', 'then': 'แล้ว', 'now': 'ตอนนี้', 'soon': 'เร็วๆ นี้', 'never': 'ไม่เคย',
      'always': 'เสมอ', 'sometimes': 'บางครั้ง', 'often': 'บ่อยครั้ง', 'usually': 'โดยปกติ',
      
      // รายงานและเอกสาร
      'report': 'รายงาน', 'reports': 'รายงาน', 'announcement': 'ประกาศ', 'announcements': 'ประกาศ',
      'statement': 'คำแถลง', 'statements': 'คำแถลง', 'news': 'ข่าว', 'update': 'อัปเดต', 'updates': 'อัปเดต',
      'forecast': 'คาดการณ์', 'forecasts': 'คาดการณ์', 'outlook': 'แนวโน้ม', 'prediction': 'การทำนาย',
      
      // การดำเนินธุรกิจ
      'acquisition': 'การซื้อกิจการ', 'acquisitions': 'การซื้อกิจการ',
      'merger': 'การควบรวมกิจการ', 'mergers': 'การควบรวมกิจการ',
      'partnership': 'การเป็นพันธมิตร', 'partnerships': 'การเป็นพันธมิตร',
      'agreement': 'ข้อตกลง', 'agreements': 'ข้อตกลง', 'contract': 'สัญญา', 'contracts': 'สัญญา',
      'deal': 'ข้อตกลง', 'deals': 'ข้อตกลง', 'transaction': 'การทำธุรกรรม', 'transactions': 'การทำธุรกรรม',
      
      // เทคโนโลยี
      'technology': 'เทคโนโลยี', 'tech': 'เทค', 'digital': 'ดิจิทัล', 'AI': 'ปัญญาประดิษฐ์',
      'artificial intelligence': 'ปัญญาประดิษฐ์', 'software': 'ซอฟต์แวร์', 'hardware': 'ฮาร์ดแวร์',
      'internet': 'อินเทอร์เน็ต', 'online': 'ออนไลน์', 'platform': 'แพลตฟอร์ม', 'platforms': 'แพลตฟอร์ม',
      
      // ผู้คนและตำแหน่ง
      'CEO': 'ผู้อำนวยการบริหาร', 'CFO': 'ผู้อำนวยการฝ่ายการเงิน', 'CTO': 'ผู้อำนวยการฝ่ายเทคโนโลยี',
      'president': 'ประธาน', 'executive': 'ผู้บริหาร', 'executives': 'ผู้บริหาร',
      'analyst': 'นักวิเคราะห์', 'analysts': 'นักวิเคราะห์', 'expert': 'ผู้เชี่ยวชาญ', 'experts': 'ผู้เชี่ยวชาญ',
      'director': 'กรรมการ', 'board': 'คณะกรรมการ', 'chairman': 'ประธานกรรมการ',
      
      // ตลาดและการค้า
      'trading': 'การซื้อขาย', 'trade': 'การค้า', 'trader': 'นักซื้อขาย', 'traders': 'นักซื้อขาย',
      'exchange': 'ตลาดหลักทรัพย์', 'nasdaq': 'นาสแดก', 'nyse': 'นิวยอร์กสต็อกเอ็กซ์เชนจ์',
      'dow jones': 'ดาวโจนส์', 's&p 500': 'เอส แอนด์ พี 500',
      
      // สถานที่และประเทศ
      'U.S.': 'สหรัฐอเมริกา', 'US': 'สหรัฐอเมริกา', 'United States': 'สหรัฐอเมริกา', 'America': 'อเมริกา',
      'China': 'จีน', 'Japan': 'ญี่ปุ่น', 'Europe': 'ยุโรป', 'Asia': 'เอเชีย',
      'Wall Street': 'วอลล์สตรีท', 'Silicon Valley': 'ซิลิคอนแวลลีย์',
      
      // ชื่อบุคคลสำคัญ
      'Trump': 'ทรัมป์', 'Donald Trump': 'โดนัลด์ ทรัมป์', 'Xi Jinping': 'สี จิ้นผิง',
      
      // วลีและประโยคทั่วไป
      'trade deal': 'ข้อตกลงการค้า', 'trade war': 'สงครามการค้า',
      'Federal Reserve': 'ธนาคารกลางสหรัฐ', 'Fed': 'ธนาคารกลางสหรัฐ',
      'earnings season': 'ช่วงประกาศผลการดำเนินงาน', 'season': 'ช่วง',
      'market cap': 'มูลค่าตามราคาตลาด', 'market capitalization': 'มูลค่าตามราคาตลาด',
      'share price': 'ราคาหุ้น', 'stock price': 'ราคาหุ้น',
      'dividend': 'เงินปันผล', 'dividends': 'เงินปันผล',
      'we': 'เรา', 'they': 'พวกเขา', 'their': 'ของพวกเขา', 'our': 'ของเรา',
      'you': 'คุณ', 'your': 'ของคุณ', 'it': 'มัน', 'its': 'ของมัน',
      'he': 'เขา', 'she': 'เธอ', 'his': 'ของเขา', 'her': 'ของเธอ',
      'the': '', 'a': '', 'an': '', // ลบคำนำหน้าภาษาอังกฤษ
      'to': 'ไปยัง', 'for': 'สำหรับ', 'of': 'ของ', 'at': 'ที่', 'by': 'โดย',
      'from': 'จาก', 'as': 'เป็น', 'is': 'เป็น', 'are': 'เป็น', 'was': 'เป็น', 'were': 'เป็น'
    };
    
    // แทนที่วลียาวก่อน (เพื่อไม่ให้ชนกับคำเดี่ยว)
    const longPhrases = {
      'better than expected': 'ดีกว่าที่คาดไว้',
      'worse than expected': 'แย่กว่าที่คาดไว้',
      'as expected': 'ตามที่คาดไว้',
      'beat expectations': 'เกินความคาดหมาย',
      'missed expectations': 'ต่ำกว่าความคาดหมาย',
      'market share': 'ส่วนแบ่งตลาด',
      'supply chain': 'ห่วงโซ่อุปทาน',
      'cash flow': 'กระแสเงินสด',
      'balance sheet': 'งบดุล',
      'income statement': 'งบกำไรขาดทุน',
      'trade deal': 'ข้อตกลงการค้า',
      'trade war': 'สงครามการค้า',
      'Federal Reserve': 'ธนาคารกลางสหรัฐ',
      'earnings season': 'ช่วงประกาศผลการดำเนินงาน',
      'market cap': 'มูลค่าตามราคาตลาด',
      'market capitalization': 'มูลค่าตามราคาตลาด',
      'share price': 'ราคาหุ้น',
      'stock price': 'ราคาหุ้น',
      'interest rate': 'อัตราดอกเบี้ย',
      'interest rates': 'อัตราดอกเบี้ย',
      'artificial intelligence': 'ปัญญาประดิษฐ์',
      'United States': 'สหรัฐอเมริกา',
      'Donald Trump': 'โดนัลด์ ทรัมป์',
      'Xi Jinping': 'สี จิ้นผิง',
      'Wall Street': 'วอลล์สตรีท',
      'Silicon Valley': 'ซิลิคอนแวลลีย์',
      'dow jones': 'ดาวโจนส์',
      's&p 500': 'เอส แอนด์ พี 500',
      'double whammy': 'เหตุร้ายสองเท่า',
      'record-setting rally': 'การขึ้นสถิติใหม่',
      'midweek double whammy': 'เหตุร้ายสองเท่าในช่วงกลางสัปดาห์',
      'stock market': 'ตลาดหุ้น',
      'stock futures': 'ฟิวเจอร์สหุ้น',
      'tech stocks': 'หุ้นเทคโนโลยี',
      'tech earnings': 'ผลประกอบการเทค',
      'top negotiators': 'ผู้เจรจาระดับสูง',
      'key meeting': 'การประชุมสำคัญ',
      'new trade': 'การค้าใหม่',
      'is in reach': 'อยู่ใกล้แค่เอื้อม',
      'that a new': 'ว่าใหม่',
      'ahead of': 'ก่อน',
      'later this': 'ในสัปดาห์นี้',
      'expressed optimism': 'แสดงความมองในแง่ดี',
      'could let you': 'สามารถให้คุณ',
      'like a pro': 'เหมือนมืออาชีพ',
      'we surveyed': 'เราสำรวจ',
      'on their favored': 'เกี่ยวกับที่พวกเขาชื่นชอบ',
      'heading into': 'มุ่งหน้าสู่',
      'and identified': 'และระบุ',
      'across the': 'ทั่วทั้ง',
      'faces a': 'เผชิญกับ',
      'as a pivotal': 'เนื่องจากเป็นการตัดสินใจสำคัญ',
      'collides with': 'ขัดแย้งกับ',
      'a flood of': 'กระแสของ',
      'here\'s what to watch': 'นี่คือสิ่งที่ควรติดตาม'
    };
    
    Object.entries(longPhrases).forEach(([eng, thai]) => {
      const regex = new RegExp(eng, 'gi');
      translated = translated.replace(regex, thai);
    });
    
    // แทนที่คำต่อคำ (รักษา case-insensitive)
    Object.entries(financialTranslations).forEach(([eng, thai]) => {
      const regex = new RegExp(`\\b${eng}\\b`, 'gi');
      translated = translated.replace(regex, thai);
    });
    
    // ทำความสะอาดช่องว่างและเครื่องหมายที่เหลือ
    translated = translated
      .replace(/\s+/g, ' ') // ลดช่องว่างซ้อนกัน
      .replace(/\s*-\s*/g, '-') // ปรับเครื่องหมายขีด
      .replace(/\'\s+s/g, '\'s') // แก้ไข possessive
      .trim();
    
    return translated;
  }

  evaluateSourceCredibility(source) {
    if (!source) return 3; // ไม่ระบุแหล่งที่มา
    
    const sourceLower = source.toLowerCase();
    
    // แหล่งข่าวที่น่าเชื่อถือสูง (8-10)
    const highCredibility = [
      'reuters', 'bloomberg', 'cnbc', 'marketwatch', 'wsj', 'wall street journal',
      'financial times', 'ft.com', 'yahoo finance', 'ap news', 'associated press',
      'bbc', 'cnn business', 'nasdaq', 'investopedia'
    ];
    
    // แหล่งข่าวที่น่าเชื่อถือปานกลาง (5-7)
    const mediumCredibility = [
      'yahoo', 'google news', 'msn', 'cnn', 'fox business', 'seeking alpha',
      'the motley fool', 'zacks', 'morningstar', 'barrons', 'forbes',
      'business insider', 'techcrunch', 'venture beat'
    ];
    
    // แหล่งข่าวที่น่าเชื่อถือต่ำ (1-4)
    const lowCredibility = [
      'reddit', 'twitter', 'facebook', 'telegram', 'blog', 'unknown',
      'rss feed', 'social media', 'forum'
    ];
    
    // ตรวจสอบแหล่งข่าวระดับสูง
    for (const cred of highCredibility) {
      if (sourceLower.includes(cred)) {
        if (cred === 'reuters' || cred === 'bloomberg') return 10;
        if (cred === 'wsj' || cred === 'wall street journal') return 9;
        return 8;
      }
    }
    
    // ตรวจสอบแหล่งข่าวระดับกลาง
    for (const cred of mediumCredibility) {
      if (sourceLower.includes(cred)) {
        if (cred === 'yahoo finance' || cred === 'nasdaq') return 7;
        if (cred === 'forbes' || cred === 'barrons') return 6;
        return 5;
      }
    }
    
    // ตรวจสอบแหล่งข่าวระดับต่ำ
    for (const cred of lowCredibility) {
      if (sourceLower.includes(cred)) {
        return Math.max(1, 4 - lowCredibility.indexOf(cred));
      }
    }
    
    // แหล่งที่ไม่รู้จัก
    return 4;
  }
  
  getCredibilityDisplay(credibility) {
    const stars = '⭐'.repeat(Math.ceil(credibility / 2));
    let description = '';
    
    if (credibility >= 8) description = '(น่าเชื่อถือสูง)';
    else if (credibility >= 6) description = '(น่าเชื่อถือดี)';
    else if (credibility >= 4) description = '(น่าเชื่อถือปานกลาง)';
    else description = '(น่าเชื่อถือต่ำ)';
    
    return `${stars} ${credibility}/10 ${description}`;
  }
  
  getRiskDisplay(riskLevel) {
    const risk = parseInt(riskLevel) || 5;
    let riskEmoji = '';
    let riskText = '';
    
    if (risk >= 8) {
      riskEmoji = '🔴🔴🔴';
      riskText = 'เสี่ยงสูงมาก';
    } else if (risk >= 6) {
      riskEmoji = '🟠🟠';
      riskText = 'เสี่ยงสูง';
    } else if (risk >= 4) {
      riskEmoji = '🟡';
      riskText = 'เสี่ยงปานกลาง';
    } else {
      riskEmoji = '🟢';
      riskText = 'เสี่ยงต่ำ';
    }
    
    return `${riskEmoji} ${risk}/10 (${riskText})`;
  }
  
  formatPriceDirection(direction, changePercent) {
    let emoji = '';
    let directionText = '';
    
    if (direction === 'ขึ้น') {
      emoji = '📈🟢';
      directionText = 'แนวโน้มขึ้น';
    } else if (direction === 'ลง') {
      emoji = '📉🔴';
      directionText = 'แนวโน้มลง';
    } else {
      emoji = '📊🟡';
      directionText = 'คงที่';
    }
    
    return `💰 ทิศทางราคา: ${emoji} ${directionText} ${changePercent || ''}`;
  }

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // ฟังก์ชันหลักสำหรับส่งข้อความ พร้อม fallback อัตโนมัติ
  async sendMessage(data) {
    try {
      logger.info(`📤 Attempting to send message via LINE Official Account...`);
      
      // ลองส่งผ่าน LINE Official Account ก่อน
      await this.sendPushMessage(data);
      logger.info(`✅ Message sent successfully via LINE Official Account`);
      
      return { success: true, method: 'LINE_OFFICIAL_ACCOUNT' };
      
    } catch (lineError) {
      logger.warn(`⚠️ LINE Official Account failed: ${lineError.message}`);
      logger.info(`💾 Switching to file fallback...`);
      
      try {
        // ถ้า LINE ใช้ไม่ได้ ให้เขียนไฟล์แทน
        await this.saveToFallbackFile(data);
        logger.info(`✅ Message saved to fallback file successfully`);
        
        return { success: true, method: 'FILE_FALLBACK', error: lineError.message };
        
      } catch (fallbackError) {
        logger.error(`❌ Both LINE and file fallback failed: ${fallbackError.message}`);
        throw new Error(`Failed to send message: LINE (${lineError.message}), File (${fallbackError.message})`);
      }
    }
  }

  // ฟังก์ชันสำหรับบันทึกข้อมูลลงไฟล์เมื่อ LINE ใช้ไม่ได้
  async saveToFallbackFile(data) {
    const fs = require('fs').promises;
    const path = require('path');
    
    try {
      const fallbackFile = path.join(process.cwd(), 'data', 'output-summary.txt');
      
      // สร้างโฟลเดอร์ data หากไม่มี
      const dataDir = path.dirname(fallbackFile);
      await fs.mkdir(dataDir, { recursive: true });
      
      // จัดรูปแบบข้อมูลที่จะบันทึก
      const timestamp = new Date().toLocaleString('th-TH', { timeZone: 'Asia/Bangkok' });
      const formattedData = `
🚨 [LINE FALLBACK] ${timestamp}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

${data}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
💡 หมายเหตุ: ข้อความนี้ถูกบันทึกเพราะ LINE Official Account ไม่สามารถส่งได้
⏰ ระบบจะลองส่งผ่าน LINE อีกครั้งเมื่อ LINE กลับมาใช้งานได้

`;
      
      // เขียนต่อท้ายไฟล์ (append)
      await fs.appendFile(fallbackFile, formattedData, 'utf8');
      
      logger.info(`💾 Message appended to ${fallbackFile}`);
      
    } catch (error) {
      logger.error(`❌ Failed to save to fallback file: ${error.message}`);
      throw error;
    }
  }

  // ฟังก์ชันตรวจสอบสถานะ LINE Official Account
  async checkLineStatus() {
    try {
      await this.testConnection();
      return { isAvailable: true, error: null };
    } catch (error) {
      return { isAvailable: false, error: error.message };
    }
  }

  // ฟังก์ชันสำหรับส่งข้อความที่รอส่งในไฟล์ fallback เมื่อ LINE กลับมาใช้งานได้
  async processPendingMessages() {
    const fs = require('fs').promises;
    const path = require('path');
    
    try {
      const fallbackFile = path.join(process.cwd(), 'data', 'output-summary.txt');
      
      // ตรวจสอบว่าไฟล์มีอยู่หรือไม่
      try {
        await fs.access(fallbackFile);
      } catch (error) {
        logger.info(`📄 No pending messages found in fallback file`);
        return { processed: 0, errors: 0 };
      }
      
      // ตรวจสอบสถานะ LINE ก่อน
      const lineStatus = await this.checkLineStatus();
      if (!lineStatus.isAvailable) {
        logger.warn(`⚠️ LINE still not available: ${lineStatus.error}`);
        return { processed: 0, errors: 0, reason: 'LINE_UNAVAILABLE' };
      }
      
      // อ่านไฟล์และแยกข้อความที่ยังไม่ส่ง
      const content = await fs.readFile(fallbackFile, 'utf8');
      const messages = this.extractPendingMessages(content);
      
      if (messages.length === 0) {
        logger.info(`📄 No pending messages to process`);
        return { processed: 0, errors: 0 };
      }
      
      logger.info(`📤 Processing ${messages.length} pending messages...`);
      
      let processed = 0;
      let errors = 0;
      
      // ส่งข้อความทีละข้อความ
      for (const message of messages) {
        try {
          await this.sendPushMessage(message.content);
          processed++;
          await this.delay(2000); // หน่วงเวลาระหว่างการส่ง
        } catch (error) {
          logger.error(`❌ Failed to send pending message: ${error.message}`);
          errors++;
        }
      }
      
      // ล้างไฟล์หรือเก็บเฉพาะข้อความที่ส่งไม่ได้
      if (errors === 0) {
        // ส่งหมดแล้ว ล้างไฟล์
        await fs.writeFile(fallbackFile, '', 'utf8');
        logger.info(`🗑️ Cleared fallback file after processing all messages`);
      }
      
      logger.info(`✅ Processed ${processed} messages, ${errors} errors`);
      return { processed, errors };
      
    } catch (error) {
      logger.error(`❌ Error processing pending messages: ${error.message}`);
      throw error;
    }
  }

  // ฟังก์ชันแยกข้อความที่รอส่งจากไฟล์
  extractPendingMessages(fileContent) {
    const messages = [];
    const sections = fileContent.split('🚨 [LINE FALLBACK]');
    
    for (let i = 1; i < sections.length; i++) {
      const section = sections[i];
      const lines = section.split('\n');
      const timestamp = lines[0]?.trim();
      
      let content = '';
      let foundStart = false;
      let foundEnd = false;
      
      for (const line of lines) {
        if (line.includes('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━') && !foundStart) {
          foundStart = true;
          continue;
        }
        
        if (foundStart && line.includes('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')) {
          foundEnd = true;
          break;
        }
        
        if (foundStart && !foundEnd) {
          content += line + '\n';
        }
      }
      
      if (content.trim()) {
        messages.push({
          timestamp,
          content: content.trim()
        });
      }
    }
    
    return messages;
  }

  evaluateSourceCredibility(source) {
    if (!source) return 3; // ไม่ระบุแหล่งที่มา
    
    const sourceLower = source.toLowerCase();
    
    // แหล่งข่าวที่น่าเชื่อถือสูง (8-10)
    const highCredibility = [
      'reuters', 'bloomberg', 'cnbc', 'marketwatch', 'wsj', 'wall street journal',
      'financial times', 'ft.com', 'yahoo finance', 'ap news', 'associated press',
      'bbc', 'cnn business', 'nasdaq', 'investopedia'
    ];
    
    // แหล่งข่าวที่น่าเชื่อถือปานกลาง (5-7)
    const mediumCredibility = [
      'yahoo', 'google news', 'msn', 'cnn', 'fox business', 'seeking alpha',
      'the motley fool', 'zacks', 'morningstar', 'barrons', 'forbes',
      'business insider', 'techcrunch', 'venture beat'
    ];
    
    // แหล่งข่าวที่น่าเชื่อถือต่ำ (1-4)
    const lowCredibility = [
      'reddit', 'twitter', 'facebook', 'telegram', 'blog', 'unknown',
      'rss feed', 'social media', 'forum'
    ];
    
    // ตรวจสอบแหล่งข่าวระดับสูง
    for (const cred of highCredibility) {
      if (sourceLower.includes(cred)) {
        if (cred === 'reuters' || cred === 'bloomberg') return 10;
        if (cred === 'wsj' || cred === 'wall street journal') return 9;
        return 8;
      }
    }
    
    // ตรวจสอบแหล่งข่าวระดับกลาง
    for (const cred of mediumCredibility) {
      if (sourceLower.includes(cred)) {
        if (cred === 'yahoo finance' || cred === 'nasdaq') return 7;
        if (cred === 'forbes' || cred === 'barrons') return 6;
        return 5;
      }
    }
    
    // ตรวจสอบแหล่งข่าวระดับต่ำ
    for (const cred of lowCredibility) {
      if (sourceLower.includes(cred)) {
        return Math.max(1, 4 - lowCredibility.indexOf(cred));
      }
    }
    
    // แหล่งที่ไม่รู้จัก
    return 4;
  }
  
  getCredibilityDisplay(credibility) {
    const stars = '⭐'.repeat(Math.ceil(credibility / 2));
    let description = '';
    
    if (credibility >= 8) description = '(น่าเชื่อถือสูง)';
    else if (credibility >= 6) description = '(น่าเชื่อถือดี)';
    else if (credibility >= 4) description = '(น่าเชื่อถือปานกลาง)';
    else description = '(น่าเชื่อถือต่ำ)';
    
    return `${stars} ${credibility}/10 ${description}`;
  }
  
  getRiskDisplay(riskLevel) {
    const risk = parseInt(riskLevel) || 5;
    let riskEmoji = '';
    let riskText = '';
    
    if (risk >= 8) {
      riskEmoji = '🔴🔴🔴';
      riskText = 'เสี่ยงสูงมาก';
    } else if (risk >= 6) {
      riskEmoji = '🟠🟠';
      riskText = 'เสี่ยงสูง';
    } else if (risk >= 4) {
      riskEmoji = '🟡';
      riskText = 'เสี่ยงปานกลาง';
    } else {
      riskEmoji = '🟢';
      riskText = 'เสี่ยงต่ำ';
    }
    
    return `${riskEmoji} ${risk}/10 (${riskText})`;
  }
  
  formatPriceDirection(direction, changePercent) {
    let emoji = '';
    let directionText = '';
    
    if (direction === 'ขึ้น') {
      emoji = '📈🟢';
      directionText = 'แนวโน้มขึ้น';
    } else if (direction === 'ลง') {
      emoji = '📉🔴';
      directionText = 'แนวโน้มลง';
    } else {
      emoji = '📊🟡';
      directionText = 'คงที่';
    }
    
    return `💰 ทิศทางราคา: ${emoji} ${directionText} ${changePercent || ''}`;
  }
}

module.exports = LineOfficialAccountService;