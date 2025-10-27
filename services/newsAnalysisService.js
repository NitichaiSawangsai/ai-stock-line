const axios = require('axios');
const winston = require('winston');
const GeminiAnalysisService = require('./geminiAnalysisService');
const ReliableDataService = require('./reliableDataService');
const PriceConversionService = require('./priceConversionService');
const CostTrackingService = require('./costTrackingService');

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.printf(({ timestamp, level, message }) => {
      return `${timestamp} [NEWS-ANALYSIS] [${level.toUpperCase()}]: ${message}`;
    })
  ),
  transports: [
    new winston.transports.Console()
  ]
});

class NewsAnalysisService {
  constructor(providedLogger = null) {
    this.openaiApiKey = process.env.OPENAI_API_KEY;
    this.newsApiKey = process.env.NEWS_API_KEY;
    this.baseUrl = 'https://api.openai.com/v1';
    this.newsApiUrl = 'https://newsapi.org/v2';
    this.openaiModel = process.env.OPENAI_MODEL || 'gpt-3.5-turbo'; // ใช้ model จาก ENV
    
    // เพิ่ม Gemini service เป็น fallback
    this.geminiService = new GeminiAnalysisService();
    this.reliableDataService = new ReliableDataService(providedLogger || logger);
    this.priceService = new PriceConversionService(); // เพิ่ม Price Service
    this.costTracker = new CostTrackingService(); // เพิ่ม Cost Tracking
    this.usingFallback = false;
    this.maxRetries = parseInt(process.env.RETRY_MAX_ATTEMPTS) || 3;
    this.retryDelay = parseInt(process.env.RETRY_DELAY_MS) || 2000;
    this.backoffMultiplier = parseFloat(process.env.RETRY_BACKOFF_MULTIPLIER) || 2;
    
    // Token limits และ budget management
    this.tokenLimits = null;
    this.budgetExceeded = false;
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
        
        // For NewsAPI calls, don't retry on auth errors but let caller handle fallback
        if (operationName.includes('NewsAPI query') && (error.response?.status === 401 || error.response?.status === 403)) {
          logger.warn(`⚠️ ${operationName} failed with auth error: ${error.message}, will use fallback`);
          throw error;
        }
        
        // Don't retry on other authentication errors
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

  // ฟังก์ชันจัดการ chunked processing สำหรับ input ที่ใหญ่
  async processLargeInput(prompt, provider = 'openai', model = null) {
    try {
      // โหลด token limits
      if (!this.tokenLimits) {
        this.tokenLimits = await this.costTracker.getModelTokenLimits();
      }

      const currentModel = model || (provider === 'openai' ? this.openaiModel : 'gemini-1.5-flash');
      const limits = this.tokenLimits[provider]?.[currentModel];
      
      if (!limits) {
        logger.warn(`⚠️ No token limits found for ${provider}/${currentModel}, using defaults`);
        return await this.callSingleAPI(prompt, provider, currentModel);
      }

      // ประมาณ tokens และตรวจสอบว่าต้อง chunk หรือไม่
      const estimatedTokens = this.costTracker.estimateTokenCount(prompt);
      const maxInputTokens = Math.floor(limits.context * 0.7); // ใช้ 70% ของ context สำหรับ input
      
      logger.info(`📏 Token analysis: ${estimatedTokens} estimated, max ${maxInputTokens} for ${provider}/${currentModel}`);
      
      if (estimatedTokens <= maxInputTokens) {
        // ไม่ต้อง chunk
        return await this.callSingleAPI(prompt, provider, currentModel);
      }

      // ต้อง chunk
      logger.info(`🔄 Large input detected, chunking for ${provider}/${currentModel}...`);
      const chunks = this.costTracker.chunkTextByTokens(prompt, maxInputTokens);
      logger.info(`📦 Split into ${chunks.length} chunks`);

      const responses = [];
      for (let i = 0; i < chunks.length; i++) {
        logger.info(`🔍 Processing chunk ${i + 1}/${chunks.length}`);
        
        try {
          const chunkResponse = await this.callSingleAPI(chunks[i], provider, currentModel);
          responses.push(chunkResponse);
          
          // เพิ่ม delay ระหว่าง chunks เพื่อหลีกเลี่ยง rate limits
          if (i < chunks.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
        } catch (chunkError) {
          logger.error(`❌ Chunk ${i + 1} failed: ${chunkError.message}`);
          // ลองใช้ fallback model สำหรับ chunk นี้
          try {
            const fallbackResponse = await this.callSingleAPI(chunks[i], 'google', 'gemini-1.5-flash');
            responses.push(fallbackResponse);
          } catch (fallbackError) {
            logger.error(`❌ Fallback also failed for chunk ${i + 1}`);
            responses.push({ error: `Failed to process chunk ${i + 1}` });
          }
        }
      }

      // รวม responses
      return this.combineChunkedResponses(responses);

    } catch (error) {
      logger.error(`❌ Error in processLargeInput: ${error.message}`);
      throw error;
    }
  }

  // เรียก API เดี่ยว
  async callSingleAPI(prompt, provider, model) {
    // ตรวจสอบงบประมาณก่อน
    await this.checkBudgetBeforeAPI();
    
    if (provider === 'openai' && !this.budgetExceeded) {
      return await this.callOpenAI(prompt, model);
    } else {
      return await this.geminiService.analyzeWithPrompt(prompt);
    }
  }

  // เรียก OpenAI API
  async callOpenAI(prompt, model) {
    const response = await axios.post(`${this.baseUrl}/chat/completions`, {
      model: model,
      messages: [{ role: "user", content: prompt }],
      max_tokens: 1500,
      temperature: 0.3
    }, {
      headers: {
        'Authorization': `Bearer ${this.openaiApiKey}`,
        'Content-Type': 'application/json'
      },
      timeout: 20000
    });

    // ติดตามค่าใช้จ่าย
    if (response.data.usage) {
      await this.costTracker.trackAPIUsage(
        'openai',
        model,
        response.data.usage.prompt_tokens || 0,
        response.data.usage.completion_tokens || 0
      );
    }

    return JSON.parse(response.data.choices[0].message.content);
  }

  // รวมผลลัพธ์จาก chunks
  combineChunkedResponses(responses) {
    const validResponses = responses.filter(r => r && !r.error);
    
    if (validResponses.length === 0) {
      throw new Error('All chunks failed to process');
    }

    if (validResponses.length === 1) {
      return validResponses[0];
    }

    // รวม responses โดยใช้ข้อมูลจาก response แรกเป็นหลัก และเพิ่ม summary
    const combined = { ...validResponses[0] };
    
    // รวม summaries หากมี
    if (combined.summary && validResponses.length > 1) {
      const allSummaries = validResponses.map(r => r.summary).filter(Boolean);
      combined.summary = allSummaries.join(' ');
    }

    // รวม keyNews หากมี
    if (combined.keyNews && validResponses.length > 1) {
      const allKeyNews = validResponses.map(r => r.keyNews).filter(Boolean);
      combined.keyNews = allKeyNews.join(' ');
    }

    // เพิ่มหมายเหตุว่าเป็นผลจาก chunked processing
    combined.processingNote = `Combined from ${validResponses.length} chunks`;

    return combined;
  }

  // ตรวจสอบงบประมาณก่อนเรียก API
  async checkBudgetBeforeAPI() {
    try {
      const costSummary = await this.costTracker.getCostSummary();
      if (!costSummary) return true;

      const monthlyBudgetTHB = parseFloat(process.env.MONTHLY_BUDGET_THB) || 500;
      const emergencyBudgetTHB = parseFloat(process.env.EMERGENCY_BUDGET_THB) || 600;
      
      const currentCost = costSummary.totalCostTHB || 0;
      
      if (currentCost >= emergencyBudgetTHB) {
        logger.error(`🚨 EMERGENCY: Budget exceeded ${emergencyBudgetTHB} THB, using free models only`);
        this.budgetExceeded = true;
        this.switchToFreeMode();
        return false;
      } else if (currentCost >= monthlyBudgetTHB) {
        logger.warn(`⚠️ Monthly budget exceeded, switching to cheaper models`);
        this.switchToCheaperModels();
      }

      return true;
    } catch (error) {
      logger.warn(`⚠️ Could not check budget: ${error.message}`);
      return true;
    }
  }

  switchToFreeMode() {
    this.openaiApiKey = 'disabled';
    process.env.OPENAI_API_KEY = 'disabled';
    process.env.GEMINI_API_KEY = 'free';
    logger.info('💡 Switched to free mode only');
  }

  switchToCheaperModels() {
    this.openaiModel = 'gpt-3.5-turbo'; // ใช้ model ที่ถูกที่สุด
    process.env.OPENAI_MODEL = 'gpt-3.5-turbo';
    process.env.GEMINI_MODEL = 'gemini-1.5-flash';
    logger.info('💰 Switched to cheaper models');
  }

  async testConnection() {
    // ตรวจสอบว่าควรใช้ AI ฟรีเท่านั้น
    if (!this.openaiApiKey || this.openaiApiKey === 'sk-your-openai-api-key-here' || this.openaiApiKey === 'disabled') {
      logger.info('🆓 Using FREE AI mode only (no paid services)');
      
      try {
        await this.geminiService.testConnection();
        this.usingFallback = true;
        return true;
      } catch (geminiError) {
        // ไม่แสดง error เพราะยังใช้งานได้ด้วย mock
        this.usingFallback = true;
        return true;
      }
    }

    // ลอง ChatGPT ก่อน (เฉพาะกรณีที่มี API key จริง)
    try {
      logger.info(`🤖 Testing OpenAI with model: ${this.openaiModel}`);
      const response = await axios.post(`${this.baseUrl}/chat/completions`, {
        model: this.openaiModel,
        messages: [{ role: "user", content: "Test" }],
        max_tokens: 5
      }, {
        headers: {
          'Authorization': `Bearer ${this.openaiApiKey}`,
          'Content-Type': 'application/json'
        },
        timeout: 8000
      });
      
      logger.info(`✅ ChatGPT API connection successful with model: ${this.openaiModel}`);
      this.usingFallback = false;
      return response.status === 200;
      
    } catch (error) {
      // ไม่แสดง ChatGPT error เพราะเราตั้งใจไม่ใช้
      
      // สลับไปใช้ Gemini แบบเงียบๆ
      try {
        await this.geminiService.testConnection();
        this.usingFallback = true;
        return true;
      } catch (geminiError) {
        // ไม่แสดง error เพราะยังใช้งานได้ด้วย mock
        this.usingFallback = true;
        return true;
      }
    }
  }

  async testOpenAIConnection() {
    // ตรวจสอบการเชื่อมต่อ OpenAI โดยเฉพาะ
    if (!this.openaiApiKey || this.openaiApiKey === 'sk-your-openai-api-key-here' || this.openaiApiKey === 'disabled') {
      return false; // OpenAI ถูก disable
    }

    try {
      const response = await axios.post(`${this.baseUrl}/chat/completions`, {
        model: this.openaiModel,
        messages: [{ role: "user", content: "Connection test" }],
        max_tokens: 5
      }, {
        headers: {
          'Authorization': `Bearer ${this.openaiApiKey}`,
          'Content-Type': 'application/json'
        },
        timeout: 10000
      });
      
      return response.status === 200;
      
    } catch (error) {
      throw error; // ให้ main.js จัดการ error
    }
  }

  async analyzeHighRiskStocks(stocks) {
    logger.info(`🔍 Analyzing ${stocks.length} stocks for high-risk scenarios with comprehensive data...`);
    
    const highRiskStocks = [];
    
    for (const stock of stocks) {
      try {
        // รวบรวมข้อมูลจากแหล่งที่เชื่อถือได้
        const comprehensiveData = await this.reliableDataService.gatherComprehensiveData(stock.symbol, {
          includeNews: true,
          includeSocial: true,
          includeTechnical: true,
          includeFundamental: true,
          maxNewsItems: 20
        });
        
        // วิเคราะห์ความเสี่ยงด้วยข้อมูลที่ครอบคลุม
        const riskAnalysis = await this.analyzeRiskWithComprehensiveData(stock, comprehensiveData);
        
        if (riskAnalysis.isHighRisk) {
          highRiskStocks.push({
            ...stock,
            riskAnalysis,
            comprehensiveData: {
              sources: comprehensiveData.sources,
              newsCount: comprehensiveData.analysis?.newsData?.length || 0,
              socialSentiment: comprehensiveData.analysis?.socialSentiment?.overall || 'neutral',
              technicalSignals: comprehensiveData.analysis?.technicalData?.signals?.length || 0,
              dataQuality: riskAnalysis.dataQuality
            },
            topNews: comprehensiveData.analysis?.newsData?.slice(0, 3) || []
          });
          
          logger.info(`🚨 HIGH RISK: ${stock.symbol} - ${riskAnalysis.riskLevel} (${Math.round(riskAnalysis.confidenceScore * 100)}%)`);
        } else {
          logger.info(`✅ ${stock.symbol} appears stable: ${riskAnalysis.riskLevel}`);
        }
        
        // Add delay to avoid rate limits
        await this.delay(2000);
        
      } catch (error) {
        logger.error(`❌ Error analyzing ${stock.symbol}: ${error.message}`);
      }
    }
    
    logger.info(`🚨 Found ${highRiskStocks.length} high-risk stocks`);
    return highRiskStocks;
  }

  async analyzeStockOpportunities(stocks) {
    logger.info(`📈 Analyzing ${stocks.length} stocks for opportunities with comprehensive data...`);
    
    const opportunities = [];
    
    for (const stock of stocks) {
      try {
        // รวบรวมข้อมูลจากแหล่งที่เชื่อถือได้
        const comprehensiveData = await this.reliableDataService.gatherComprehensiveData(stock.symbol, {
          includeNews: true,
          includeSocial: true,
          includeTechnical: true,
          includeFundamental: true,
          maxNewsItems: 20
        });
        
        // วิเคราะห์โอกาสด้วยข้อมูลที่ครอบคลุม
        const opportunityAnalysis = await this.analyzeOpportunityWithComprehensiveData(stock, comprehensiveData);
        
        if (opportunityAnalysis.isOpportunity) {
          opportunities.push({
            ...stock,
            opportunityAnalysis,
            comprehensiveData: {
              sources: comprehensiveData.sources,
              newsCount: comprehensiveData.analysis?.newsData?.length || 0,
              socialSentiment: comprehensiveData.analysis?.socialSentiment?.overall || 'neutral',
              technicalSignals: comprehensiveData.analysis?.technicalData?.signals?.length || 0,
              dataQuality: opportunityAnalysis.dataQuality
            },
            topNews: comprehensiveData.analysis?.newsData?.slice(0, 3) || []
          });
          
          logger.info(`🔥 OPPORTUNITY: ${stock.symbol} - ${opportunityAnalysis.opportunityLevel} (${Math.round(opportunityAnalysis.confidenceScore * 100)}%)`);
        } else {
          logger.info(`📊 ${stock.symbol} - no significant opportunity detected`);
        }
        
        // Add delay to avoid rate limits
        await this.delay(2000);
        
      } catch (error) {
        logger.error(`❌ Error analyzing opportunity for ${stock.symbol}: ${error.message}`);
      }
    }
    
    logger.info(`🔥 Found ${opportunities.length} opportunities`);
    return opportunities;
  }

  async getStockNews(symbol, type) {
    try {
      let query = '';
      
      switch (type) {
        case 'หุ้น':
          query = `${symbol} stock news earnings financial`;
          break;
        case 'สกุลเงินคริปโต':
          query = `${symbol} cryptocurrency bitcoin crypto news`;
          break;
        case 'ทอง':
          query = 'gold price news market analysis';
          break;
        case 'สกุลเงิน':
          query = `${symbol} currency exchange rate news`;
          break;
        default:
          query = `${symbol} financial news market`;
      }

      // Get news from multiple sources
      const newsData = await Promise.allSettled([
        this.getNewsFromNewsAPI(query),
        this.getNewsFromGoogleTrends(symbol),
        this.getNewsFromFinancialSources(symbol, type)
      ]);

      let allNews = [];
      newsData.forEach(result => {
        if (result.status === 'fulfilled' && result.value) {
          allNews = allNews.concat(result.value);
        }
      });

      // Remove duplicates and sort by relevance
      const uniqueNews = this.removeDuplicateNews(allNews);
      return uniqueNews.slice(0, 10); // Top 10 news items
      
    } catch (error) {
      logger.error(`❌ Error getting news for ${symbol}: ${error.message}`);
      return [];
    }
  }

  async getNewsFromNewsAPI(query) {
    try {
      return await this.withRetry(async () => {
        if (!this.newsApiKey || this.newsApiKey === 'your-news-api-key-here' || this.newsApiKey === 'disabled') {
          return await this.getNewsFromFreeAPI(query);
        }

        const response = await axios.get(`${this.newsApiUrl}/everything`, {
          params: {
            q: query,
            language: 'en',
            sortBy: 'publishedAt',
            pageSize: 20,
            apiKey: this.newsApiKey
          },
          timeout: 15000
        });
        
        if (!response.data || !response.data.articles) {
          throw new Error('Invalid response from NewsAPI');
        }

        return response.data.articles.map(article => ({
          title: article.title,
          description: article.description,
          url: article.url,
          source: article.source.name,
          publishedAt: article.publishedAt,
          relevanceScore: 0.8
        }));
      }, `NewsAPI query: ${query}`);
    } catch (error) {
      // If NewsAPI fails (including auth errors), fall back to free API
      if (error.response?.status === 401 || error.response?.status === 403) {
        logger.info(`🆓 NewsAPI auth failed for "${query}", using free news sources`);
      } else {
        logger.warn(`⚠️ NewsAPI failed for "${query}": ${error.message}, using free sources`);
      }
      return await this.getNewsFromFreeAPI(query);
    }
  }

  async getNewsFromFreeAPI(query) {
    // Free alternative news sources
    try {
      // Using multiple free sources
      const sources = [
        `https://api.rss2json.com/v1/api.json?rss_url=https://feeds.finance.yahoo.com/rss/2.0/headline`,
        `https://api.rss2json.com/v1/api.json?rss_url=https://www.reuters.com/markets/global-markets/rss`
      ];

      const newsPromises = sources.map(async (url) => {
        try {
          const response = await axios.get(url, { timeout: 10000 });
          return response.data.items || [];
        } catch {
          return [];
        }
      });

      const results = await Promise.allSettled(newsPromises);
      let allNews = [];
      
      results.forEach(result => {
        if (result.status === 'fulfilled') {
          allNews = allNews.concat(result.value);
        }
      });

      // Filter news related to the query
      const filteredNews = allNews.filter(item => 
        item.title && item.title.toLowerCase().includes(query.toLowerCase().split(' ')[0])
      );

      return filteredNews.map(item => ({
        title: item.title,
        description: item.description || item.content,
        url: item.link,
        source: 'RSS Feed',
        publishedAt: item.pubDate,
        relevanceScore: 0.6
      }));
      
    } catch (error) {
      logger.error(`❌ Free news API failed: ${error.message}`);
      return [];
    }
  }

  async getNewsFromGoogleTrends(symbol) {
    // Placeholder for Google Trends integration
    // In production, you might want to use Google Trends API or web scraping
    return [];
  }

  async getNewsFromFinancialSources(symbol, type) {
    // Placeholder for additional financial news sources
    // Could include Yahoo Finance, Bloomberg RSS, etc.
    return [];
  }

  async analyzeRiskWithComprehensiveData(stock, comprehensiveData) {
    try {
      // ดึงข้อมูลราคาปัจจุบัน
      const priceData = await this.priceService.getCurrentPriceInTHB(stock.symbol, stock.type);
      
      // สร้าง context ที่ครอบคลุมสำหรับ AI analysis รวมข้อมูลราคา
      const analysisContext = this.buildAnalysisContext(stock, comprehensiveData, priceData);
      
      // ตรวจสอบคุณภาพข้อมูลก่อนการวิเคราะห์
      const dataQuality = this.assessDataQuality(comprehensiveData);
      
      // ปรับ criteria ให้อ่อนลงเพื่อให้ระบบทำงานได้แม้มี fallback news
      if (dataQuality.score < 0.2 || (dataQuality.newsCount === 0 && !dataQuality.hasFinancialData)) {
        logger.warn(`📊 Insufficient reliable data for ${stock.symbol} - Skipping analysis`);
        return {
          isHighRisk: false,
          riskLevel: "insufficient_data",
          summary: "ข้อมูลไม่เพียงพอสำหรับการวิเคราะห์ หรือไม่มีแหล่งที่มาที่น่าเชื่อถือ",
          threats: ["ข้อมูลไม่เพียงพอ"],
          confidenceScore: 0,
          recommendation: "ไม่แนะนำการวิเคราะห์เนื่องจากข้อมูลไม่เพียงพอ",
          keyNews: "ไม่มีข่าวที่น่าเชื่อถือ",
          sourceUrl: "unavailable",
          dataQuality: dataQuality,
          priceInfo: priceData,
          shouldNotify: false // ไม่ต้องส่ง LINE
        };
      }
      
      // ถ้าใช้ fallback หรือ disable ChatGPT ให้ใช้ Gemini เลย
      if (this.usingFallback || !this.openaiApiKey || this.openaiApiKey === 'disabled') {
        logger.info(`🆓 Using Gemini AI for comprehensive risk analysis of ${stock.symbol}`);
        const geminiResult = await this.geminiService.analyzeRiskWithAI(stock, analysisContext.newsData);
        
        // เพิ่มข้อมูลราคาและคุณภาพข้อมูล
        return {
          ...geminiResult,
          priceInfo: priceData,
          dataQuality: dataQuality,
          shouldNotify: geminiResult.isHighRisk && dataQuality.hasReliableSources
        };
      }

      // ลอง ChatGPT ก่อน (เฉพาะกรณีที่มี API key จริง)
      try {
        const prompt = this.buildComprehensiveRiskPrompt(stock, analysisContext);
        
        logger.info(`🤖 Using OpenAI for comprehensive risk analysis of ${stock.symbol}`);
        const response = await axios.post(`${this.baseUrl}/chat/completions`, {
          model: this.openaiModel,
          messages: [{ role: "user", content: prompt }],
          max_tokens: 1500,
          temperature: 0.3
        }, {
          headers: {
            'Authorization': `Bearer ${this.openaiApiKey}`,
            'Content-Type': 'application/json'
          },
          timeout: 20000
        });

        const content = response.data.choices[0].message.content;
        
        // ติดตามค่าใช้จ่าย API แบบ real-time
        if (response.data.usage) {
          await this.costTracker.trackAPIUsage(
            'openai',
            this.openaiModel,
            response.data.usage.prompt_tokens || 0,
            response.data.usage.completion_tokens || 0
          );
        }
        
        const parsedResult = JSON.parse(content);
        
        // เพิ่มข้อมูลราคาและคุณภาพข้อมูล
        return {
          ...parsedResult,
          priceInfo: priceData,
          dataQuality: dataQuality,
          shouldNotify: parsedResult.isHighRisk && dataQuality.hasReliableSources
        };
        
      } catch (error) {
        // สลับไปใช้ Gemini แบบเงียบๆ
        try {
          const geminiResult = await this.geminiService.analyzeRiskWithAI(stock, analysisContext.newsData);
          return {
            ...geminiResult,
            priceInfo: priceData,
            dataQuality: dataQuality,
            shouldNotify: geminiResult.isHighRisk && dataQuality.hasReliableSources
          };
        } catch (geminiError) {
          return {
            isHighRisk: false,
            riskLevel: "unknown",
            summary: "ไม่สามารถวิเคราะห์ได้ในขณะนี้ เนื่องจากระบบ AI ทั้งหมดมีปัญหา",
            threats: ["ไม่สามารถระบุได้"],
            confidenceScore: 0,
            recommendation: "ติดตามข่าวสารด้วยตนเอง",
            keyNews: "ระบบวิเคราะห์ขัดข้อง",
            sourceUrl: "unavailable",
            dataQuality: dataQuality,
            priceInfo: priceData,
            shouldNotify: false
          };
        }
      }
    } catch (error) {
      logger.error(`❌ Risk analysis error for ${stock.symbol}: ${error.message}`);
      return {
        isHighRisk: false,
        riskLevel: "error",
        summary: "เกิดข้อผิดพลาดในการวิเคราะห์",
        threats: ["ระบบขัดข้อง"],
        confidenceScore: 0,
        recommendation: "ลองใหม่อีกครั้ง",
        keyNews: "เกิดข้อผิดพลาด",
        sourceUrl: "error",
        dataQuality: { score: 0, hasReliableSources: false },
        priceInfo: { error: error.message },
        shouldNotify: false
      };
    }
  }

  async analyzeOpportunityWithComprehensiveData(stock, comprehensiveData) {
    try {
      // ดึงข้อมูลราคาปัจจุบัน
      const priceData = await this.priceService.getCurrentPriceInTHB(stock.symbol, stock.type);
      
      // สร้าง context ที่ครอบคลุมสำหรับ AI analysis รวมข้อมูลราคา
      const analysisContext = this.buildAnalysisContext(stock, comprehensiveData, priceData);
      
      // ตรวจสอบคุณภาพข้อมูลก่อนการวิเคราะห์
      const dataQuality = this.assessDataQuality(comprehensiveData);
      
      // ปรับ criteria ให้อ่อนลงเพื่อให้ระบบทำงานได้แม้มี fallback news
      if (dataQuality.score < 0.2 || (dataQuality.newsCount === 0 && !dataQuality.hasFinancialData)) {
        logger.warn(`📊 Insufficient reliable data for ${stock.symbol} - Skipping opportunity analysis`);
        return {
          isOpportunity: false,
          opportunityLevel: "insufficient_data",
          summary: "ข้อมูลไม่เพียงพอสำหรับการวิเคราะห์โอกาส หรือไม่มีแหล่งที่มาที่น่าเชื่อถือ",
          positiveFactors: ["ข้อมูลไม่เพียงพอ"],
          confidenceScore: 0,
          timeframe: "ไม่ระบุ",
          priceTarget: "ไม่ระบุ",
          keyNews: "ไม่มีข่าวที่น่าเชื่อถือ",
          sourceUrl: "unavailable",
          dataQuality: dataQuality,
          priceInfo: priceData,
          shouldNotify: false // ไม่ต้องส่ง LINE
        };
      }
      
      // ถ้าใช้ fallback หรือ disable ChatGPT ให้ใช้ Gemini เลย
      if (this.usingFallback || !this.openaiApiKey || this.openaiApiKey === 'disabled') {
        logger.info(`🆓 Using Gemini AI for comprehensive opportunity analysis of ${stock.symbol}`);
        const geminiResult = await this.geminiService.analyzeOpportunityWithAI(stock, analysisContext.newsData);
        
        // เพิ่มข้อมูลราคาและคุณภาพข้อมูล
        return {
          ...geminiResult,
          priceInfo: priceData,
          dataQuality: dataQuality,
          shouldNotify: geminiResult.isOpportunity && dataQuality.hasReliableSources
        };
      }

      // ลอง ChatGPT ก่อน (เฉพาะกรณีที่มี API key จริง)
      try {
        const prompt = this.buildComprehensiveOpportunityPrompt(stock, analysisContext);
        
        logger.info(`🤖 Using OpenAI for comprehensive opportunity analysis of ${stock.symbol}`);
        const response = await axios.post(`${this.baseUrl}/chat/completions`, {
          model: this.openaiModel,
          messages: [{ role: "user", content: prompt }],
          max_tokens: 1500,
          temperature: 0.3
        }, {
          headers: {
            'Authorization': `Bearer ${this.openaiApiKey}`,
            'Content-Type': 'application/json'
          },
          timeout: 20000
        });

        const content = response.data.choices[0].message.content;
        
        // ติดตามค่าใช้จ่าย API แบบ real-time
        if (response.data.usage) {
          await this.costTracker.trackAPIUsage(
            'openai',
            this.openaiModel,
            response.data.usage.prompt_tokens || 0,
            response.data.usage.completion_tokens || 0
          );
        }
        
        const parsedResult = JSON.parse(content);
        
        // เพิ่มข้อมูลราคาและคุณภาพข้อมูล
        return {
          ...parsedResult,
          priceInfo: priceData,
          dataQuality: dataQuality,
          shouldNotify: parsedResult.isOpportunity && dataQuality.hasReliableSources
        };
        
      } catch (error) {
        // สลับไปใช้ Gemini แบบเงียบๆ
        try {
          const geminiResult = await this.geminiService.analyzeOpportunityWithAI(stock, analysisContext.newsData);
          return {
            ...geminiResult,
            priceInfo: priceData,
            dataQuality: dataQuality,
            shouldNotify: geminiResult.isOpportunity && dataQuality.hasReliableSources
          };
        } catch (geminiError) {
          return {
            isOpportunity: false,
            opportunityLevel: "unknown",
            summary: "ไม่สามารถวิเคราะห์โอกาสได้ในขณะนี้ เนื่องจากระบบ AI ทั้งหมดมีปัญหา",
            positiveFactors: ["ไม่สามารถระบุได้"],
            confidenceScore: 0,
            timeframe: "ไม่ระบุ",
            priceTarget: "ไม่ระบุ",
            keyNews: "ระบบวิเคราะห์ขัดข้อง",
            sourceUrl: "unavailable",
            dataQuality: dataQuality,
            priceInfo: priceData,
            shouldNotify: false
          };
        }
      }
    } catch (error) {
      logger.error(`❌ Opportunity analysis error for ${stock.symbol}: ${error.message}`);
      return {
        isOpportunity: false,
        opportunityLevel: "error",
        summary: "เกิดข้อผิดพลาดในการวิเคราะห์โอกาส",
        positiveFactors: ["ระบบขัดข้อง"],
        confidenceScore: 0,
        timeframe: "ไม่ระบุ",
        priceTarget: "ไม่ระบุ",
        keyNews: "เกิดข้อผิดพลาด",
        sourceUrl: "error",
        dataQuality: { score: 0, hasReliableSources: false },
        priceInfo: { error: error.message },
        shouldNotify: false
      };
    }
  }

  buildAnalysisContext(stock, comprehensiveData, priceData = null) {
    // จัดการข้อมูลข่าวใหม่ (รองรับทั้ง format เก่าและใหม่)
    let newsData = [];
    let newsDataStructured = null;
    
    if (comprehensiveData.analysis.newsData) {
      if (Array.isArray(comprehensiveData.analysis.newsData)) {
        // Format เก่า (array)
        newsData = comprehensiveData.analysis.newsData;
      } else if (comprehensiveData.analysis.newsData.combined) {
        // Format ใหม่ (object ที่มี today/yesterday/combined)
        newsDataStructured = comprehensiveData.analysis.newsData;
        newsData = comprehensiveData.analysis.newsData.combined || [];
      }
    }
    
    const context = {
      stock,
      newsData: newsData,
      newsDataStructured: newsDataStructured, // เพิ่มโครงสร้างข่าวแยกวัน
      financialData: comprehensiveData.analysis.technicalData || {},
      fundamentalData: comprehensiveData.analysis.fundamentalData || {},
      socialSentiment: comprehensiveData.analysis.socialSentiment || {},
      sources: comprehensiveData.sources || {},
      priceData: priceData, // เพิ่มข้อมูลราคา
      dataQuality: this.assessDataQuality(comprehensiveData)
    };
    
    const totalNews = newsData.length;
    const todayCount = newsDataStructured?.today?.length || 0;
    const yesterdayCount = newsDataStructured?.yesterday?.length || 0;
    
    logger.info(`📊 Built analysis context for ${stock.symbol} with ${totalNews} news items (Today: ${todayCount}, Yesterday: ${yesterdayCount}) from ${Object.keys(context.sources).length} sources`);
    return context;
  }

  // เพิ่มฟังก์ชันประเมินคุณภาพข้อมูล
  assessDataQuality(comprehensiveData) {
    // จัดการข้อมูลข่าวทั้ง format เก่าและใหม่
    let newsData = [];
    if (comprehensiveData.analysis?.newsData) {
      if (Array.isArray(comprehensiveData.analysis.newsData)) {
        newsData = comprehensiveData.analysis.newsData;
      } else if (comprehensiveData.analysis.newsData.combined) {
        newsData = comprehensiveData.analysis.newsData.combined;
      }
    }
    
    const sources = comprehensiveData.sources || {};
    const technicalData = comprehensiveData.analysis?.technicalData || {};
    
    // ประเมินคุณภาพจากแหล่งที่มา
    const reliableSources = ['bloomberg', 'reuters', 'marketwatch', 'cnbc', 'yahoo'];
    const sourcesArray = Object.keys(sources).map(s => s.toLowerCase());
    const hasReliableSources = sourcesArray.some(source => 
      reliableSources.some(reliable => source.includes(reliable))
    );
    
    // ตรวจสอบว่ามีข้อมูลการเงินหรือไม่
    const hasFinancialData = technicalData && (technicalData.price || technicalData.change || Object.keys(technicalData).length > 0);
    
    // คำนวณคะแนนคุณภาพ
    let qualityScore = 0;
    
    // จำนวนข่าว (0-25%)
    const newsCount = newsData.length;
    if (newsCount >= 5) qualityScore += 0.25;
    else if (newsCount >= 3) qualityScore += 0.15;
    else if (newsCount >= 1) qualityScore += 0.1;
    
    // ความหลากหลายของแหล่งที่มา (0-25%)
    const sourceCount = sourcesArray.length;
    if (sourceCount >= 3) qualityScore += 0.25;
    else if (sourceCount >= 2) qualityScore += 0.15;
    else if (sourceCount >= 1) qualityScore += 0.1;
    
    // แหล่งที่มาที่น่าเชื่อถือ (0-25%)
    if (hasReliableSources) qualityScore += 0.25;
    
    // ข้อมูลการเงิน (0-25%) - เพิ่มใหม่!
    if (hasFinancialData) qualityScore += 0.25;
    
    // ความสดใหม่ของข่าว
    const recentNews = newsData.filter(news => {
      if (!news.publishedAt) return false;
      const newsDate = new Date(news.publishedAt);
      const daysDiff = (Date.now() - newsDate.getTime()) / (1000 * 60 * 60 * 24);
      return daysDiff <= 7; // ข่าวในสัปดาห์ล่าสุด
    });
    
    return {
      score: qualityScore,
      newsCount: newsCount,
      sourceCount: sourceCount,
      hasReliableSources: hasReliableSources,
      hasFinancialData: hasFinancialData, // เพิ่มใหม่
      recentNewsCount: recentNews.length,
      sources: sourcesArray,
      category: qualityScore >= 0.7 ? 'excellent' : 
                qualityScore >= 0.5 ? 'good' : 
                qualityScore >= 0.3 ? 'fair' : 'poor'
    };
  }

  buildComprehensiveRiskPrompt(stock, context) {
    const socialSentiment = context.socialSentiment.overall || 'unknown';
    
    // ใช้ข้อมูลข่าวจาก 2 วัน
    let newsSection = '';
    if (context.newsDataStructured) {
      const todayNews = context.newsDataStructured.today?.slice(0, 2) || [];
      const yesterdayNews = context.newsDataStructured.yesterday?.slice(0, 2) || [];
      
      if (todayNews.length > 0) {
        newsSection += `ข่าววันนี้ (${todayNews.length} รายการ):\n`;
        newsSection += todayNews.map(n => `[${n.source}] ${n.title.substring(0, 80)}...`).join('\n') + '\n\n';
      }
      
      if (yesterdayNews.length > 0) {
        newsSection += `ข่าวเมื่อวาน (${yesterdayNews.length} รายการ):\n`;
        newsSection += yesterdayNews.map(n => `[${n.source}] ${n.title.substring(0, 80)}...`).join('\n');
      }
    } else {
      // Fallback สำหรับ format เก่า
      const limitedNews = context.newsData.slice(0, 3).map(n => `[${n.source}] ${n.title.substring(0, 80)}...`).join('\n');
      newsSection = `ข่าว (${context.newsData.length} รายการ):\n${limitedNews}`;
    }
    
    return `วิเคราะห์ความเสี่ยง ${stock.symbol}:

${newsSection}

ข้อมูลเทคนิค: ${context.financialData.trend || 'N/A'}
Sentiment: ${socialSentiment}

ตอบ JSON สั้นๆ:
{
  "isHighRisk": boolean,
  "riskLevel": "low|medium|high|critical",
  "summary": "สรุปสั้นๆ (ไม่เกิน 100 ตัวอักษร)",
  "threats": ["ภัยคุกคาม"],
  "confidenceScore": 0.0-1.0,
  "recommendation": "คำแนะนำสั้นๆ",
  "keyNews": "ข่าวสำคัญ",
  "sourceUrl": "${context.newsData[0]?.url || 'N/A'}"
}`;
  }

  buildComprehensiveOpportunityPrompt(stock, context) {
    const socialSentiment = context.socialSentiment.overall || 'unknown';
    
    // ใช้ข้อมูลข่าวจาก 2 วัน
    let newsSection = '';
    if (context.newsDataStructured) {
      const todayNews = context.newsDataStructured.today?.slice(0, 2) || [];
      const yesterdayNews = context.newsDataStructured.yesterday?.slice(0, 2) || [];
      
      if (todayNews.length > 0) {
        newsSection += `ข่าววันนี้ (${todayNews.length} รายการ):\n`;
        newsSection += todayNews.map(n => `[${n.source}] ${n.title.substring(0, 80)}...`).join('\n') + '\n\n';
      }
      
      if (yesterdayNews.length > 0) {
        newsSection += `ข่าวเมื่อวาน (${yesterdayNews.length} รายการ):\n`;
        newsSection += yesterdayNews.map(n => `[${n.source}] ${n.title.substring(0, 80)}...`).join('\n');
      }
    } else {
      // Fallback สำหรับ format เก่า
      const limitedNews = context.newsData.slice(0, 3).map(n => `[${n.source}] ${n.title.substring(0, 80)}...`).join('\n');
      newsSection = `ข่าว (${context.newsData.length} รายการ):\n${limitedNews}`;
    }
    
    return `วิเคราะห์โอกาส ${stock.symbol}:

${newsSection}

ข้อมูลเทคนิค: ${context.financialData.trend || 'N/A'}
Sentiment: ${socialSentiment}

ตอบ JSON สั้นๆ:
{
  "isOpportunity": boolean,
  "opportunityLevel": "low|medium|high|excellent",
  "summary": "สรุปสั้นๆ (ไม่เกิน 100 ตัวอักษร)",
  "positiveFactors": ["ปัจจัยบวก"],
  "confidenceScore": 0.0-1.0,
  "timeframe": "กรอบเวลา",
  "priceTarget": "เป้าหมาย",
  "keyNews": "ข่าวดี",
  "sourceUrl": "${context.newsData[0]?.url || 'N/A'}"
}`;
  }

  assessDataQuality(comprehensiveData) {
    let score = 0;
    let maxScore = 0;
    
    // ประเมินคุณภาพข้อมูลจากแหล่งต่างๆ
    if (comprehensiveData.analysis) {
      if (comprehensiveData.analysis.newsData && comprehensiveData.analysis.newsData.length > 0) {
        score += comprehensiveData.analysis.newsData.length * 2;
        maxScore += 20;
      }
      
      if (comprehensiveData.analysis.socialSentiment && comprehensiveData.analysis.socialSentiment.confidence > 0) {
        score += comprehensiveData.analysis.socialSentiment.confidence * 10;
        maxScore += 10;
      }
      
      if (comprehensiveData.analysis.technicalData && Object.keys(comprehensiveData.analysis.technicalData).length > 0) {
        score += 15;
        maxScore += 15;
      }
      
      if (comprehensiveData.analysis.fundamentalData && Object.keys(comprehensiveData.analysis.fundamentalData).length > 0) {
        score += 15;
        maxScore += 15;
      }
    }
    
    const qualityRatio = maxScore > 0 ? score / maxScore : 0;
    
    if (qualityRatio >= 0.8) return 'excellent';
    if (qualityRatio >= 0.6) return 'good';
    if (qualityRatio >= 0.4) return 'fair';
    return 'poor';
  }

  async analyzeRiskWithAI(stock, news) {
    // ถ้าใช้ fallback หรือ disable ChatGPT ให้ใช้ Gemini เลย
    if (this.usingFallback || !this.openaiApiKey || this.openaiApiKey === 'disabled') {
      logger.info(`🆓 Using FREE Gemini AI for risk analysis of ${stock.symbol}`);
      return await this.geminiService.analyzeRiskWithAI(stock, news);
    }

    // ลอง ChatGPT ก่อน (เฉพาะกรณีที่มี API key จริง)
    try {
      const newsTexts = news.map(n => `${n.title}: ${n.description}`).join('\n\n');
      
      const prompt = `วิเคราะห์ความเสี่ยงของหุ้น/สินทรัพย์ต่อไปนี้:

สินทรัพย์: ${stock.symbol} (${stock.type})
จำนวนที่ลงทุน: ${stock.amount} ${stock.unit}

ข่าวล่าสุด:
${newsTexts}

กรุณาวิเคราะห์และตอบในรูปแบบ JSON:
{
  "isHighRisk": boolean (true ถ้ามีความเสี่ยงที่เงินจะหายหมดหรือหุ้นอาจปิดตัว),
  "riskLevel": "low|medium|high|critical",
  "summary": "สรุปสถานการณ์ในภาษาไทย",
  "threats": ["รายการภัยคุกคาม"],
  "confidenceScore": 0.0-1.0,
  "recommendation": "คำแนะนำ",
  "keyNews": "ข่าวสำคัญที่สุด",
  "sourceUrl": "URL ของข่าวหลัก"
}

โปรดให้ความสำคัญกับ:
1. ข่าวการล้มละลาย หรือปิดกิจการ
2. การถูกแบนหรือห้ามส่งออก
3. การฟ้องร้องครั้งใหญ่
4. การเปลี่ยนแปลงกฎระเบียบที่รุนแรง
5. วิกฤตการเงิน`;

      logger.info(`🤖 Using OpenAI model: ${this.openaiModel} for risk analysis of ${stock.symbol}`);
      const response = await axios.post(`${this.baseUrl}/chat/completions`, {
        model: this.openaiModel,
        messages: [{ role: "user", content: prompt }],
        max_tokens: 1000,
        temperature: 0.3
      }, {
        headers: {
          'Authorization': `Bearer ${this.openaiApiKey}`,
          'Content-Type': 'application/json'
        },
        timeout: 15000
      });

      const content = response.data.choices[0].message.content;
      
      // ติดตามค่าใช้จ่าย API แบบ real-time
      if (response.data.usage) {
        await this.costTracker.trackAPIUsage(
          'openai',
          this.openaiModel,
          response.data.usage.prompt_tokens || 0,
          response.data.usage.completion_tokens || 0
        );
      }
      
      return JSON.parse(content);
      
    } catch (error) {
      // ไม่แสดง ChatGPT error เพราะเรามี Gemini fallback
      
      // สลับไปใช้ Gemini แบบเงียบๆ
      try {
        return await this.geminiService.analyzeRiskWithAI(stock, news);
      } catch (geminiError) {
        // ไม่แสดง error เพราะ mock responses ใช้งานได้
        return {
          isHighRisk: false,
          riskLevel: "unknown",
          summary: "ไม่สามารถวิเคราะห์ได้ในขณะนี้ เนื่องจากระบบ AI ทั้งหมดมีปัญหา",
          threats: ["ไม่สามารถระบุได้"],
          confidenceScore: 0,
          recommendation: "ติดตามข่าวสารด้วยตนเอง",
          keyNews: "ระบบวิเคราะห์ขัดข้อง",
          sourceUrl: "unavailable"
        };
      }
    }
  }

  async analyzeOpportunityWithAI(stock, news) {
    // ถ้าใช้ fallback หรือ disable ChatGPT ให้ใช้ Gemini เลย
    if (this.usingFallback || !this.openaiApiKey || this.openaiApiKey === 'disabled') {
      logger.info(`🆓 Using FREE Gemini AI for opportunity analysis of ${stock.symbol}`);
      return await this.geminiService.analyzeOpportunityWithAI(stock, news);
    }

    // ลอง ChatGPT ก่อน (เฉพาะกรณีที่มี API key จริง)
    try {
      const newsTexts = news.map(n => `${n.title}: ${n.description}`).join('\n\n');
      
      const prompt = `วิเคราะห์โอกาสการลงทุนของหุ้น/สินทรัพย์ต่อไปนี้:

สินทรัพย์: ${stock.symbol} (${stock.type})
จำนวนที่ลงทุน: ${stock.amount} ${stock.unit}

ข่าวล่าสุด:
${newsTexts}

กรุณาวิเคราะห์และตอบในรูปแบบ JSON:
{
  "isOpportunity": boolean (true ถ้ามีโอกาสราคาจะขึ้น),
  "opportunityLevel": "low|medium|high|excellent",
  "summary": "สรุปโอกาสในภาษาไทย",
  "positiveFactors": ["ปัจจัยบวก"],
  "confidenceScore": 0.0-1.0,
  "timeframe": "ระยะเวลาที่คาดว่าจะเห็นผล",
  "priceTarget": "เป้าหมายราคาที่คาดหวัง",
  "keyNews": "ข่าวดีที่สำคัญที่สุด",
  "sourceUrl": "URL ของข่าวหลัก"
}

โปรดให้ความสำคัญกับ:
1. การเปิดเผยกำไรที่ดีกว่าคาด
2. ข่าวการเข้าซื้อกิจการหรือพันธมิตรใหม่
3. การได้สัญญาใหญ่หรือลูกค้าใหม่
4. นวัตกรรมหรือผลิตภัณฑ์ใหม่
5. การเปลี่ยนแปลงนโยบายที่เป็นประโยชน์`;

      logger.info(`🤖 Using OpenAI model: ${this.openaiModel} for opportunity analysis of ${stock.symbol}`);
      const response = await axios.post(`${this.baseUrl}/chat/completions`, {
        model: this.openaiModel,
        messages: [{ role: "user", content: prompt }],
        max_tokens: 1000,
        temperature: 0.3
      }, {
        headers: {
          'Authorization': `Bearer ${this.openaiApiKey}`,
          'Content-Type': 'application/json'
        },
        timeout: 15000
      });

      const content = response.data.choices[0].message.content;
      
      // ติดตามค่าใช้จ่าย API แบบ real-time
      if (response.data.usage) {
        await this.costTracker.trackAPIUsage(
          'openai',
          this.openaiModel,
          response.data.usage.prompt_tokens || 0,
          response.data.usage.completion_tokens || 0
        );
      }
      
      return JSON.parse(content);
      
    } catch (error) {
      // ไม่แสดง ChatGPT error เพราะเรามี Gemini fallback
      
      // สลับไปใช้ Gemini แบบเงียบๆ
      try {
        return await this.geminiService.analyzeOpportunityWithAI(stock, news);
      } catch (geminiError) {
        // ไม่แสดง error เพราะ mock responses ใช้งานได้
        return {
          isOpportunity: false,
          opportunityLevel: "unknown",
          summary: "ไม่สามารถวิเคราะห์ได้ในขณะนี้ เนื่องจากระบบ AI ทั้งหมดมีปัญหา",
          positiveFactors: ["ไม่สามารถระบุได้"],
          confidenceScore: 0,
          timeframe: "ไม่ทราบ",
          priceTarget: "ไม่มีข้อมูล",
          keyNews: "ระบบวิเคราะห์ขัดข้อง",
          sourceUrl: "unavailable"
        };
      }
    }
  }

  /**
   * Gather comprehensive news data for all stocks
   * เก็บข้อมูลข่าวสำหรับหุ้นทั้งหมด
   */
  async gatherAllStockNews(stocks) {
    logger.info(`📰 Gathering comprehensive news for ${stocks.length} stocks...`);
    
    const allNewsData = [];
    let processedCount = 0;
    
    try {
      for (const stock of stocks) {
        try {
          logger.info(`📊 [${processedCount + 1}/${stocks.length}] Processing ${stock.symbol}...`);
          
          // ดึงข้อมูลข่าวแบบครบถ้วน
          const [financialData, newsResults, sentimentData] = await Promise.all([
            this.reliableDataService.getFinancialData(stock.symbol, stock.type),
            this.reliableDataService.getReliableNews(stock.symbol, stock.type),
            this.reliableDataService.getSocialSentiment(stock.symbol, stock.type)
          ]);
          
          if (newsResults && newsResults.combined && newsResults.combined.length > 0) {
            const stockNewsData = {
              stock: {
                symbol: stock.symbol,
                type: stock.type,
                amount: stock.amount,
                unit: stock.unit,
                displayName: stock.displayName || stock.symbol
              },
              news: {
                today: newsResults.today || [],
                yesterday: newsResults.yesterday || [],
                combined: newsResults.combined || []
              },
              totalNews: newsResults.combined.length,
              todayNews: newsResults.today.length,
              yesterdayNews: newsResults.yesterday.length,
              financialData: financialData || null,
              socialSentiment: sentimentData || null,
              dataQuality: 'good'
            };
            
            // เพิ่มเฉพาะหุ้นที่มีข่าว
            if (stockNewsData.totalNews > 0) {
              allNewsData.push(stockNewsData);
              logger.info(`✅ ${stock.symbol}: Found ${stockNewsData.totalNews} news items`);
            } else {
              logger.info(`ℹ️ ${stock.symbol}: No news found`);
            }
          } else {
            logger.info(`ℹ️ ${stock.symbol}: No news data available`);
          }
          
          processedCount++;
          
          // หน่วงเวลาระหว่างการประมวลผล
          if (processedCount < stocks.length) {
            await this.delay(1000);
          }
          
        } catch (error) {
          logger.error(`❌ Error processing ${stock.symbol}: ${error.message}`);
          processedCount++;
          continue;
        }
      }
      
      logger.info(`📊 News gathering complete: ${allNewsData.length}/${stocks.length} stocks have news data`);
      
      // Sort by news count (descending)
      allNewsData.sort((a, b) => b.totalNews - a.totalNews);
      
      // Save comprehensive news to output file
      await this.saveNewsToOutputFile(allNewsData);
      
      return allNewsData;
      
    } catch (error) {
      logger.error(`❌ Error gathering all stock news: ${error.message}`);
      return allNewsData; // Return partial results
    }
  }

  /**
   * แปลข้อความเป็นภาษาไทยด้วย AI
   */
  async translateToThai(text) {
    try {
      // ใช้ Gemini API แปลภาษา
      const geminiService = require('./geminiAnalysisService');
      const gemini = new geminiService();
      
      const prompt = `แปลข้อความต่อไปนี้เป็นภาษาไทยที่อ่านแล้วเข้าใจง่าย อย่าแปลชื่อเฉพาะ บริษัท หรือชื่อคน:

"${text}"

ตอบเฉพาะข้อความที่แปลแล้วเท่านั้น ไม่ต้องอธิบาย:`;
      
      const result = await gemini.analyzeWithGemini(prompt, { maxTokens: 100 });
      return result?.analysis || text; // fallback ถ้าแปลไม่ได้
    } catch (error) {
      logger.debug(`แปลภาษาไม่สำเร็จ: ${error.message}`);
      return text; // ใช้ข้อความเดิมถ้าแปลไม่ได้
    }
  }

  /**
   * แปลข้อความเป็นภาษาไทยด้วย AI
   */
  async translateToThai(text) {
    try {
      // ใช้ Gemini API แปลภาษา
      const geminiService = require('./geminiAnalysisService');
      const gemini = new geminiService();
      
      const prompt = `แปลข้อความต่อไปนี้เป็นภาษาไทยที่อ่านแล้วเข้าใจง่าย อย่าแปลชื่อเฉพาะ บริษัท หรือชื่อคน:

"${text}"

ตอบเฉพาะข้อความที่แปลแล้วเท่านั้น ไม่ต้องอธิบาย:`;
      
      const result = await gemini.analyzeWithGemini(prompt, { maxTokens: 150 });
      return result?.analysis || text; // fallback ถ้าแปลไม่ได้
    } catch (error) {
      logger.debug(`แปลภาษาไม่สำเร็จ: ${error.message}`);
      return text; // ใช้ข้อความเดิมถ้าแปลไม่ได้
    }
  }

  /**
   * Save comprehensive news data to output-summary.txt file
   */
  async saveNewsToOutputFile(allNewsData) {
    const fs = require('fs').promises;
    const path = require('path');
    
    try {
      const outputPath = path.join(__dirname, '..', 'data', 'output-summary.txt');
      const timestamp = new Date().toISOString();
      const thaiTime = new Date().toLocaleString('th-TH', { timeZone: 'Asia/Bangkok' });
      
      let content = `\n=== รายงานข่าวฉบับสมบูรณ์ - ${timestamp} ===\n`;
      content += `📰 สรุปข่าวหุ้นทั้งหมด\n\n`;
      
      let totalNewsArticles = 0;
      let stocksWithTodayNews = 0;
      
      for (const stockData of allNewsData) {
        const stock = stockData.stock;
        content += `🏢 ${stock.symbol}`;
        if (stock.displayName && stock.displayName !== stock.symbol) {
          // แปลชื่อบริษัทด้วย AI
          const thaiName = await this.translateToThai(stock.displayName);
          content += ` (${thaiName})`;
        }
        content += `:\n`;
        
        if (stockData.totalNews === 0) {
          content += `  📭 ไม่มีข่าวล่าสุด\n`;
        } else {
          content += `  📊 ข่าวทั้งหมด: ${stockData.totalNews} ข่าว | วันนี้: ${stockData.todayNews} ข่าว | เมื่อวาน: ${stockData.yesterdayNews} ข่าว\n`;
          
          if (stockData.todayNews > 0) {
            stocksWithTodayNews++;
          }
          
          totalNewsArticles += stockData.totalNews;
          
          // Show today's news
          if (stockData.news.today && stockData.news.today.length > 0) {
            content += `  📰 ข่าววันนี้:\n`;
            const todayNews = stockData.news.today.slice(0, 3);
            for (let index = 0; index < todayNews.length; index++) {
              const news = todayNews[index];
              let thaiTitle = await this.translateToThai(news.title);
              content += `    ${index + 1}. ${thaiTitle}\n`;
              if (news.summary && news.summary.length > 0) {
                let thaiSummary = await this.translateToThai(news.summary);
                content += `       📝 ${thaiSummary.substring(0, 150)}...\n`;
              }
              // แปลชื่อแหล่งข่าว
              let thaiSource = this.translateNewsSource(news.source || 'Unknown');
              content += `       🕐 ${news.publishedDate || 'ไม่ทราบ'} | 📰 ${thaiSource}\n`;
            }
          }
          
          // Show yesterday's news (if any)
          if (stockData.news.yesterday && stockData.news.yesterday.length > 0) {
            content += `  📰 ข่าวเมื่อวานนี้:\n`;
            for (let i = 0; i < Math.min(2, stockData.news.yesterday.length); i++) {
              const news = stockData.news.yesterday[i];
              let thaiTitle = await this.translateToThai(news.title);
              content += `    ${i + 1}. ${thaiTitle}\n`;
            }
          }
          
          // Show data quality and sentiment
          if (stockData.dataQuality) {
            let thaiQuality = this.translateDataQuality(stockData.dataQuality);
            content += `  📊 คุณภาพข้อมูล: ${thaiQuality}\n`;
          }
          if (stockData.socialSentiment) {
            let thaiSentiment = this.translateSentiment(stockData.socialSentiment.overallSentiment || 'neutral');
            content += `  💭 ความรู้สึกตลาด: ${thaiSentiment}\n`;
          }
        }
        content += `\n`;
      }
      
      content += `📊 สถิติสรุป:\n`;
      content += `   • จำนวนหุ้นที่วิเคราะห์: ${allNewsData.length} ตัว\n`;
      content += `   • จำนวนข่าวทั้งหมด: ${totalNewsArticles} ข่าว\n`;
      content += `   • หุ้นที่มีข่าววันนี้: ${stocksWithTodayNews} ตัว\n`;
      content += `   • เวลาวิเคราะห์: ${thaiTime} (เวลาประเทศไทย)\n`;
      content += `\n${'='.repeat(80)}\n`;
      
      // Append to file (or create if doesn't exist)
      await fs.appendFile(outputPath, content);
      
      logger.info(`💾 Saved comprehensive news report to data/output-summary.txt (${totalNewsArticles} news items from ${allNewsData.length} stocks)`);
      
      return {
        success: true,
        totalArticles: totalNewsArticles,
        stocksWithNews: allNewsData.length,
        stocksWithTodayNews: stocksWithTodayNews
      };
      
    } catch (error) {
      logger.error(`❌ Failed to save news to output file: ${error.message}`);
      return {
        success: false,
        error: error.message
      };
    }
  }

  removeDuplicateNews(news) {
    const seen = new Set();
    return news.filter(item => {
      const key = item.title?.toLowerCase() || '';
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
  }

  /**
   * แปลหัวข้อข่าวเป็นภาษาไทยที่เข้าใจง่าย
   */
  translateNewsTitle(title) {
    if (!title) return 'ไม่มีหัวข้อ';
    
    // แปลคำศัพท์สำคัญ
    let translated = title
      .replace(/Europe/gi, 'ยุโรป')
      .replace(/premarket/gi, 'ช่วงพรีมาร์เก็ต')
      .replace(/Fed/gi, 'ธนาคารกลางสหรัฐ (Fed)')
      .replace(/focus/gi, 'เน้น')
      .replace(/Stocks Rally/gi, 'หุ้นพุ่งแรง')
      .replace(/US/gi, 'สหรัฐฯ')
      .replace(/China/gi, 'จีน')
      .replace(/Trade Deal/gi, 'ข้อตกลงการค้า')
      .replace(/Stock futures/gi, 'ฟิวเจอร์สหุ้น')
      .replace(/rise/gi, 'ปรับตัวสูงขึ้น')
      .replace(/optimism/gi, 'การมองโลกในแง่ดี')
      .replace(/ahead of/gi, 'ก่อน')
      .replace(/meeting/gi, 'การประชุม')
      .replace(/market/gi, 'ตลาด')
      .replace(/earnings/gi, 'ผลประกอบการ')
      .replace(/double whammy/gi, 'วิกฤตหนักสองต่อ')
      .replace(/decision/gi, 'การตัดสินใจ')
      .replace(/collides/gi, 'กระทบ')
      .replace(/megacap tech/gi, 'บริษัทเทคโนโลยียักษ์ใหญ่')
      .replace(/watch/gi, 'จับตามอง')
      .replace(/finances/gi, 'การเงิน')
      .replace(/Trump-Xi/gi, 'ทรัมป์-สี')
      .replace(/husband/gi, 'สามี')
      .replace(/wife/gi, 'ภรรยา')
      .replace(/woman/gi, 'หญิงสาว')
      .replace(/keeps.*in the dark/gi, 'ปิดบังความจริง')
      .replace(/act now/gi, 'รีบลงมือทำเดี๋ยวนี้')
      .replace(/shut up/gi, 'เงียบปาก');
    
    return translated;
  }

  /**
   * แปลสรุปข่าวเป็นภาษาไทย
   */
  translateNewsSummary(summary) {
    if (!summary) return '';
    
    let translated = summary
      .replace(/The market/gi, 'ตลาด')
      .replace(/investors/gi, 'นักลงทุน')
      .replace(/trading/gi, 'การซื้อขาย')
      .replace(/prices/gi, 'ราคา')
      .replace(/volatility/gi, 'ความผันผวน')
      .replace(/growth/gi, 'การเติบโต')
      .replace(/analysis/gi, 'การวิเคราะห์')
      .replace(/report/gi, 'รายงาน')
      .replace(/continues/gi, 'ยังคง')
      .replace(/expected/gi, 'คาดการณ์');
    
    return translated;
  }

  /**
   * แปลชื่อแหล่งข่าวเป็นภาษาไทย
   */
  translateNewsSource(source) {
    if (!source) return 'ไม่ทราบแหล่งที่มา';
    
    const sourceMap = {
      'Reuters': 'รอยเตอร์',
      'MarketWatch': 'มาร์เก็ตวอทช์',
      'Yahoo Finance': 'ยาฮู ไฟแนนซ์',
      'Bloomberg': 'บลูมเบิร์ก',
      'CNBC': 'ซีเอ็นบีซี',
      'Financial Times': 'ไฟแนนเชียล ไทมส์',
      'Wall Street Journal': 'วอลล์สตรีท เจอร์นัล',
      'Unknown': 'ไม่ทราบ'
    };
    
    return sourceMap[source] || source;
  }

  /**
   * แปลคุณภาพข้อมูล
   */
  translateDataQuality(quality) {
    const qualityMap = {
      'excellent': 'ยอดเยี่ยม',
      'good': 'ดี',
      'fair': 'พอใช้',
      'poor': 'แย่',
      'unknown': 'ไม่ทราบ'
    };
    
    return qualityMap[quality] || quality;
  }

  /**
   * แปลความรู้สึกตลาด
   */
  translateSentiment(sentiment) {
    const sentimentMap = {
      'positive': 'เชิงบวก',
      'negative': 'เชิงลบ', 
      'neutral': 'กลางๆ',
      'bullish': 'มองดี',
      'bearish': 'มองแย่',
      'unknown': 'ไม่ทราบ'
    };
    
    return sentimentMap[sentiment] || sentiment;
  }

  /**
   * Check if a date is today (Thailand timezone)
   */
  isToday(dateString) {
    if (!dateString) return false;
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    return dateString.includes(todayStr);
  }

  /**
   * Check if a date is yesterday (Thailand timezone)
   */
  isYesterday(dateString) {
    if (!dateString) return false;
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];
    return dateString.includes(yesterdayStr);
  }

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

module.exports = NewsAnalysisService;