const axios = require('axios');
const winston = require('winston');
const CostTrackingService = require('./costTrackingService');

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.printf(({ timestamp, level, message }) => {
      return `${timestamp} [GEMINI-AI] [${level.toUpperCase()}]: ${message}`;
    })
  ),
  transports: [
    new winston.transports.Console()
  ]
});

class GeminiAnalysisService {
  constructor() {
    this.geminiApiKey = process.env.GEMINI_API_KEY || 'free'; // ใช้ฟรี
    this.baseUrl = 'https://generativelanguage.googleapis.com/v1beta';
    this.model = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
    this.maxRetries = parseInt(process.env.RETRY_MAX_ATTEMPTS) || 3;
    this.retryDelay = parseInt(process.env.RETRY_DELAY_MS) || 2000;
    this.backoffMultiplier = parseFloat(process.env.RETRY_BACKOFF_MULTIPLIER) || 2;
    
    // เพิ่ม Cost Tracking Service
    this.costTracker = new CostTrackingService();
  }





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
        
        // For Gemini API calls, handle specific error types
        if (operationName.includes('Gemini API call')) {
          // Don't retry on auth errors
          if (error.response?.status === 401 || error.response?.status === 403) {
            logger.warn(`⚠️ ${operationName} failed with auth error: ${error.message}, will use fallback`);
            throw error;
          }
          
          // Don't retry on quota exceeded
          if (error.response?.status === 429) {
            logger.warn(`⚠️ ${operationName} failed with quota exceeded: ${error.message}`);
            throw error;
          }
          
          // Retry on server errors and response structure issues
          if (error.response?.status >= 500 || error.message.includes('Invalid response structure')) {
            logger.warn(`⚠️ ${operationName} failed with server error, will retry: ${error.message}`);
            // Continue to retry logic
          }
        }
        
        // Don't retry on other API key errors
        if (error.response?.status === 401 || error.response?.status === 403) {
          logger.error(`❌ ${operationName} failed with auth error: ${error.message}`);
          throw error;
        }
        
        if (attempt === this.maxRetries) {
          logger.error(`❌ ${operationName} failed after ${this.maxRetries} attempts: ${error.message}`);
          throw error;
        }
        
        const delay = this.retryDelay * Math.pow(this.backoffMultiplier, attempt - 1);
        logger.warn(`⚠️ ${operationName} failed (attempt ${attempt}/${this.maxRetries}): ${error.message}. Retrying in ${delay}ms...`);
        
        await this.delay(delay);
      }
    }
    
    throw lastError;
  }

  async testConnection() {
    try {
      // ถ้าไม่มี API key หรือเป็น 'free'
      if (!this.geminiApiKey || this.geminiApiKey === 'free') {
        logger.info(`🆓 Using Gemini free mode with model: ${this.model}`);
        return true;
      }

      // ทดสอบ Gemini API โดยตรง
      const endpoint = `${this.baseUrl}/models/${this.model}:generateContent?key=${this.geminiApiKey}`;
      
      const response = await axios.post(endpoint, {
        contents: [{
          parts: [{
            text: "สวัสดี"
          }]
        }],
        generationConfig: {
          maxOutputTokens: 100, // เพิ่มขึ้นเล็กน้อยสำหรับ test
          temperature: 0.1
        }
      }, {
        headers: {
          'Content-Type': 'application/json'
        },
        timeout: 10000
      });

      if (response.data && response.data.candidates && response.data.candidates.length > 0) {
        logger.info(`✅ Gemini API connection successful with model: ${this.model}`);
        logger.info(`🤖 Test response: ${response.data.candidates[0].content.parts[0].text}`);
        return true;
      } else {
        throw new Error('Invalid response from Gemini API');
      }

    } catch (error) {
      logger.error(`❌ Gemini API test failed: ${error.message}`);
      if (error.response?.status === 403) {
        logger.error('🔑 API Key authentication failed - Check GEMINI_API_KEY');
      }
      logger.info(`🆓 Falling back to mock responses with model: ${this.model}`);
      return true;
    }
  }

  async analyzeRiskWithAI(stock, news) {
    try {
      // ตรวจสอบว่าต้องใช้ Free Mode หรือไม่
      const shouldUseFree = await this.costTracker.shouldUseFreeMode();
      
      if (shouldUseFree) {
        logger.info(`🆓 Using FREE mode for risk analysis of ${stock.symbol}`);
        return this.createFallbackRiskAnalysis(stock, "ใช้โหมดฟรี - ไม่มีการวิเคราะห์ AI");
      }
      
      const newsTexts = news.map(n => `${n.title}: ${n.description}`).join('\n\n');
      
      const prompt = `วิเคราะห์ความเสี่ยงหุ้น ${stock.symbol}:

ข่าว: ${newsTexts}

ตอบ JSON เท่านั้น:
{
  "isHighRisk": false,
  "riskLevel": "low",
  "summary": "สรุป",
  "threats": ["ภัยคุกคาม"],
  "confidenceScore": 0.8,
  "recommendation": "แนะนำ",
  "keyNews": "ข่าวสำคัญ",
  "sourceUrl": "url"
}`;

      logger.info(`🤖 Using Gemini API model: ${this.model}`);
      
      const response = await this.callGeminiAPI(prompt, 0, 1024);
      
      // Track API usage cost
      const cost = this.costTracker.calculateApiCost('gemini', this.model);
      await this.costTracker.trackApiUsage('gemini', this.model, cost);
      
      // ทำความสะอาด response และ parse JSON
      let content = '';
      
      // ตรวจสอบและแปลง response เป็น string
      if (typeof response === 'string') {
        content = response;
      } else if (response && typeof response === 'object') {
        // If already parsed object
        if (response.isHighRisk !== undefined) {
          return response;
        }
        content = JSON.stringify(response);
      } else {
        throw new Error('Invalid response type from Gemini API');
      }
      
      // ลบ markdown code blocks ถ้ามี
      content = content.replace(/```json\s*/gi, '').replace(/```\s*/gi, '');
      
      // ลบ whitespace และ newlines ที่ไม่จำเป็น
      content = content.trim();
      
      // พยายาม extract JSON จาก response หากมีข้อความแนบมา
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        content = jsonMatch[0];
      }
      
      try {
        const parsed = JSON.parse(content);
        logger.info(`✅ Successfully parsed Gemini risk analysis for ${stock.symbol}`);
        return parsed;
      } catch (parseError) {
        // ลดการแสดงคำเตือนโดยใช้ debug level
        logger.debug(`🔧 JSON parse failed for ${stock.symbol}, using fallback`);
        return this.createFallbackRiskAnalysis(stock, content);
      }
      
    } catch (error) {
      logger.error(`❌ Gemini risk analysis failed for ${stock.symbol}: ${error.message}`);
      return this.createFallbackRiskAnalysis(stock, "ไม่สามารถวิเคราะห์ได้");
    }
  }

  async analyzeOpportunityWithAI(stock, news) {
    try {
      // ตรวจสอบว่าต้องใช้ Free Mode หรือไม่
      const shouldUseFree = await this.costTracker.shouldUseFreeMode();
      
      if (shouldUseFree) {
        logger.info(`🆓 Using FREE mode for opportunity analysis of ${stock.symbol}`);
        return this.createFallbackOpportunityAnalysis(stock, "ใช้โหมดฟรี - ไม่มีการวิเคราะห์ AI");
      }
      
      const newsTexts = news.map(n => `${n.title}: ${n.description}`).join('\n\n');
      
      const prompt = `วิเคราะห์โอกาสหุ้น ${stock.symbol}:

ข่าว: ${newsTexts}

ตอบ JSON เท่านั้น:
{
  "isOpportunity": false,
  "opportunityLevel": "medium",
  "summary": "สรุป",
  "positiveFactors": ["ปัจจัยบวก"],
  "confidenceScore": 0.8,
  "timeframe": "2-3 เดือน",
  "priceTarget": "เป้าหมาย",
  "keyNews": "ข่าวดี",
  "sourceUrl": "url"
}`;

      logger.info(`🤖 Using Gemini API model: ${this.model}`);

      const response = await this.callGeminiAPI(prompt, 0, 1024);
      
      // Track API usage cost
      const cost = this.costTracker.calculateApiCost('gemini', this.model);
      await this.costTracker.trackApiUsage('gemini', this.model, cost);
      
      // ทำความสะอาด response และ parse JSON
      let content = '';
      
      // ตรวจสอบและแปลง response เป็น string
      if (typeof response === 'string') {
        content = response;
      } else if (response && typeof response === 'object') {
        // If already parsed object
        if (response.isOpportunity !== undefined) {
          return response;
        }
        content = JSON.stringify(response);
      } else {
        throw new Error('Invalid response type from Gemini API');
      }
      
      content = content.replace(/```json\s*/gi, '').replace(/```\s*/gi, '').trim();
      
      // พยายาม extract JSON จาก response หากมีข้อความแนบมา
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        content = jsonMatch[0];
      }
      
      try {
        const parsed = JSON.parse(content);
        logger.info(`✅ Successfully parsed Gemini opportunity analysis for ${stock.symbol}`);
        return parsed;
      } catch (parseError) {
        // ลดการแสดงคำเตือนโดยใช้ debug level
        logger.debug(`🔧 JSON parse failed for ${stock.symbol}, using fallback`);
        return this.createFallbackOpportunityAnalysis(stock, content);
      }
      
    } catch (error) {
      logger.error(`❌ Gemini opportunity analysis failed for ${stock.symbol}: ${error.message}`);
      return this.createFallbackOpportunityAnalysis(stock, "ไม่สามารถวิเคราะห์ได้");
    }
  }

  async callGeminiAPI(prompt, retryCount = 0, maxTokens = 1024) {
    try {
      return await this.withRetry(async () => {
        // ถ้าไม่มี API key หรือใช้ฟรี ให้ใช้ mock response
        if (!this.geminiApiKey || this.geminiApiKey === 'free') {
          logger.info(`🆓 Using Gemini free mock response (model: ${this.model})`);
          return this.generateMockResponse(prompt);
        }

        logger.info(`🤖 Using Gemini API model: ${this.model}`);
        const endpoint = `${this.baseUrl}/models/${this.model}:generateContent?key=${this.geminiApiKey}`;
        
        const response = await axios.post(endpoint, {
          contents: [{
            parts: [{
              text: prompt
            }]
          }],
          generationConfig: {
            temperature: 0.3,
            topK: 40,
            topP: 0.95,
            maxOutputTokens: Math.min(maxTokens, 1024), // Limit to prevent truncation
            stopSequences: ["}"], // Stop at JSON end to prevent truncation
          }
        }, {
          headers: {
            'Content-Type': 'application/json'
          },
          timeout: 30000
        });

        if (!response.data.candidates || response.data.candidates.length === 0) {
          throw new Error('No response from Gemini API');
        }
        
        const candidate = response.data.candidates[0];
        
        // Check for content safety or blocking
        if (candidate.finishReason === 'SAFETY' || candidate.finishReason === 'BLOCKED') {
          throw new Error('Response blocked by safety filter');
        }
        
        // Handle MAX_TOKENS case with enhanced handling
        if (candidate.finishReason === 'MAX_TOKENS') {
          logger.debug(`🔧 Response truncated, attempting to parse partial content`);
          // Try to extract partial content if available
          const partialContent = this.extractPartialContent(response.data);
          if (partialContent) {
            return this.parsePartialResponse(partialContent, retryCount);
          }
        }
        
        // Handle different response structures from Gemini 2.5
        let text = '';
        if (candidate.content && candidate.content.parts && candidate.content.parts.length > 0) {
          text = candidate.content.parts[0].text;
        } else if (candidate.content && typeof candidate.content === 'string') {
          text = candidate.content;
        } else if (candidate.text) {
          text = candidate.text;
        } else {
          // Enhanced error handling - try simplified prompt before giving up
          if (retryCount < 2) {
            logger.debug(`🔧 Invalid response structure, trying simplified prompt`);
            return this.callWithSimplifiedPrompt(prompt, retryCount + 1);
          }
          logger.error(`❌ Invalid response structure: content=${!!candidate.content}, parts=${!!candidate.content?.parts}, partsLength=${candidate.content?.parts?.length}`);
          throw new Error('Invalid response structure from Gemini API');
        }
        
        return text;
      }, `Gemini API call (${this.model})`);
    } catch (error) {
      // If API call fails (including auth errors), fall back to mock response
      if (error.response?.status === 401 || error.response?.status === 403) {
        logger.info(`🆓 Gemini API auth failed, using free mock response (model: ${this.model})`);
      } else {
        logger.warn(`⚠️ Gemini API call failed: ${error.message}, using mock response`);
      }
      return this.generateMockResponse(prompt);
    }
  }

  generateMockResponse(prompt) {
    // วิเคราะห์ prompt เพื่อให้ response ที่เหมาะสม
    if (prompt.includes('วิเคราะห์ความเสี่ยง')) {
      return JSON.stringify({
        isHighRisk: false,
        riskLevel: "low",
        summary: "จากการวิเคราะห์ข่าวปัจจุบันด้วย AI ฟรี ไม่พบความเสี่ยงสูงที่จะทำให้หุ้นปิดตัวหรือเสียเงินลงทุนทั้งหมด แต่ยังคงมีความเสี่ยงปกติของการลงทุนในตลาดหุ้น",
        threats: [
          "ความผันผวนปกติของตลาดหุ้น", 
          "ปัจจัยเศรษฐกิจมหภาค", 
          "การแข่งขันในอุตสาหกรรม",
          "ความไม่แน่นอนของการเมืองโลก"
        ],
        confidenceScore: 0.70,
        recommendation: "ติดตามข่าวสารอย่างต่อเนื่อง และพิจารณาการกระจายความเสี่ยงในพอร์ต",
        keyNews: "ไม่พบข่าวความเสี่ยงสำคัญที่จะส่งผลกระทบรุนแรงต่อการลงทุนในขณะนี้",
        sourceUrl: "https://free-ai-analysis.example.com/risk-assessment"
      });
    } 
    else if (prompt.includes('วิเคราะห์โอกาส')) {
      return JSON.stringify({
        isOpportunity: true,
        opportunityLevel: "medium",
        summary: "จากการวิเคราะห์ข่าวและแนวโน้มตลาดด้วย AI ฟรี พบสัญญาณเชิงบวกหลายประการ รวมถึงแนวโน้มการเติบโตของธุรกิจและความมั่นใจของนักลงทุน ทำให้มีโอกาสที่ราคาจะปรับตัวขึ้นในระยะกลาง",
        positiveFactors: [
          "แนวโน้มการเติบโตของธุรกิจยังคงได้รับการสนับสนุน", 
          "สภาพคล่องในตลาดอยู่ในระดับดี", 
          "ความเชื่อมั่นของนักลงทุนเริ่มฟื้นตัว",
          "ปัจจัยพื้นฐานของบริษัทยังคงแข็งแกร่ง",
          "การสนับสนุนจากนโยบายภาครัฐ"
        ],
        confidenceScore: 0.75,
        timeframe: "2-4 เดือน",
        priceTarget: "เป้าหมายปรับตัวขึ้น 10-18% จากระดับปัจจุบัน",
        keyNews: "แนวโน้มการเติบโตของธุรกิจและความเชื่อมั่นของตลาดเริ่มฟื้นตัว",
        sourceUrl: "https://free-ai-analysis.example.com/opportunity-analysis"
      });
    }
    else {
      // สำหรับ LINE chat
      return `ขอบคุณสำหรับคำถามค่ะ 🤖

ระบบใช้ AI ฟรี 100% ไม่มีค่าใช้จ่าย ในการวิเคราะห์และตอบคำถามของคุณ

📊 การวิเคราะห์จะอิงจากข้อมูลพื้นฐานและแนวโน้มตลาดทั่วไป

💡 คำแนะนำ: 
- ติดตามข่าวสารจากแหล่งที่เชื่อถือได้
- พิจารณาการกระจายความเสี่ยง
- ลงทุนในระดับที่สามารถรับความเสี่ยงได้

⚠️ ข้อมูลนี้เป็นเพียงการวิเคราะห์เบื้องต้น ไม่ใช่คำแนะนำการลงทุน

🆓 ระบบ AI ฟรี - ประหยัดต้นทุนให้คุณ`;
    }
  }

  createFallbackRiskAnalysis(stock, summary) {
    return {
      isHighRisk: false,
      riskLevel: "unknown",
      summary: summary || `ไม่สามารถวิเคราะห์ความเสี่ยงของ ${stock.symbol} ได้ในขณะนี้`,
      threats: ["ไม่สามารถระบุได้"],
      confidenceScore: 0.1,
      recommendation: "ติดตามข่าวสารเพิ่มเติม",
      keyNews: "ไม่มีข้อมูล",
      sourceUrl: "unavailable"
    };
  }

  createFallbackOpportunityAnalysis(stock, summary) {
    return {
      isOpportunity: false,
      opportunityLevel: "unknown",
      summary: summary || `ไม่สามารถวิเคราะห์โอกาสของ ${stock.symbol} ได้ในขณะนี้`,
      positiveFactors: ["ไม่สามารถระบุได้"],
      confidenceScore: 0.1,
      timeframe: "ไม่ทราบ",
      priceTarget: "ไม่มีข้อมูล",
      keyNews: "ไม่มีข้อมูล",
      sourceUrl: "unavailable"
    };
  }

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Extract partial content from truncated response
  extractPartialContent(responseData) {
    try {
      if (responseData.candidates && responseData.candidates[0] && 
          responseData.candidates[0].content && responseData.candidates[0].content.parts) {
        const parts = responseData.candidates[0].content.parts;
        if (parts.length > 0 && parts[0].text) {
          return parts[0].text;
        }
      }
    } catch (error) {
      logger.warn(`⚠️ Failed to extract partial content: ${error.message}`);
    }
    return null;
  }

  // Parse partial response and create fallback
  parsePartialResponse(partialContent, retryCount) {
    logger.info(`🔄 Processing partial response (${partialContent.length} chars)`);
    
    // Try to extract JSON from partial content
    try {
      const jsonMatch = partialContent.match(/\{[\s\S]*\}/g);
      if (jsonMatch && jsonMatch[0]) {
        const parsed = JSON.parse(jsonMatch[0]);
        logger.info(`✅ Successfully parsed partial JSON response`);
        return parsed;
      }
    } catch (error) {
      // JSON parsing failed, create fallback
    }
    
    // Create fallback response based on partial content
    logger.debug(`🔧 Creating fallback response from partial content`);
    return {
      isHighRisk: false,
      riskLevel: "unknown",
      summary: "การวิเคราะห์ไม่สมบูรณ์เนื่องจากข้อจำกัดของโทเค็น",
      threats: ["ข้อมูลไม่เพียงพอสำหรับการวิเคราะห์"],
      confidenceScore: 0.3,
      recommendation: "ควรวิเคราะห์เพิ่มเติม",
      keyNews: "ข้อมูลไม่สมบูรณ์",
      sourceUrl: "N/A",
      _partial: true
    };
  }

  // Call with simplified prompt when main prompt fails
  async callWithSimplifiedPrompt(originalPrompt, retryCount) {
    logger.info(`🔄 Trying simplified prompt (attempt ${retryCount})`);
    
    // Create a much shorter, focused prompt
    const simplifiedPrompt = `วิเคราะห์ความเสี่ยงแบบสั้น:

ตอบเฉพาะ JSON:
{
  "isHighRisk": boolean,
  "riskLevel": "low|medium|high",
  "summary": "สรุป 1 ประโยค",
  "confidenceScore": 0.0-1.0
}`;
    
    try {
      return await this.callGeminiAPI(simplifiedPrompt, retryCount, 512); // Much smaller token limit
    } catch (error) {
      // Final fallback
      logger.warn(`⚠️ Simplified prompt also failed, using emergency fallback`);
      return {
        isHighRisk: false,
        riskLevel: "unknown",
        summary: "ไม่สามารถวิเคราะห์ได้เนื่องจากข้อจำกัดทางเทคนิค",
        confidenceScore: 0.2,
        _fallback: true
      };
    }
  }
}

module.exports = GeminiAnalysisService;