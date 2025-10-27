const axios = require('axios');
const logger = require('./logger');
const fs = require('fs');
const path = require('path');
const CostTracker = require('./costTracker');

class WebSearchService {
    constructor(googleApiKey, searchEngineId, newsApiKey, dailyLimit = 200, freeDailyLimit = 100) {
        this.googleApiKey = googleApiKey;
        this.searchEngineId = searchEngineId;
        this.newsApiKey = newsApiKey;
        this.dailyLimit = parseInt(dailyLimit) || 200;
        this.freeDailyLimit = parseInt(freeDailyLimit) || 100;
        this.costPer1000 = 5; // $5 per 1,000 requests
        this.exchangeRate = 35; // Default fallback rate
        this.costTracker = new CostTracker();
        
        // Initialize exchange rate asynchronously
        this.initializeExchangeRate();
        this.isGoogleEnabled = googleApiKey && googleApiKey !== 'disabled' && searchEngineId && searchEngineId !== 'disabled';
        this.isNewsEnabled = newsApiKey && newsApiKey !== 'disabled';
        
        // ไฟล์บันทึกการใช้งาน quota และค่าใช้จ่าย
        this.quotaFile = path.join(__dirname, '../data/google_search_quota.json');
        this.costFile = path.join(__dirname, '../data/google_search_costs.json');
        this.todayUsage = this.loadTodayUsage();
        this.costData = this.loadCostData();
        
        // Log API status
        if (this.isGoogleEnabled) {
            const remaining = this.dailyLimit - this.todayUsage;
            logger.info(`✅ Google Search API เปิดใช้งาน (เหลือ ${remaining}/${this.dailyLimit} คำค้น)`);
            // Cost information will be logged after exchange rate is initialized
        } else {
            logger.warn('⚠️ Google Search API ปิดใช้งาน');
        }
        
        if (this.isNewsEnabled) {
            logger.info('✅ News API เปิดใช้งาน');
        } else {
            logger.warn('⚠️ News API ปิดใช้งาน');
        }
    }

    // Initialize exchange rate from CostTracker
    async initializeExchangeRate() {
        try {
            this.exchangeRate = await this.costTracker.getExchangeRate();
            logger.info(`💱 อัตราแลกเปลี่ยน Google Search: 1 USD = ${this.exchangeRate} THB`);
            
            // Log cost information after exchange rate is available
            if (this.isGoogleEnabled) {
                const { todayCost, monthlyCost } = await this.calculateCosts();
                logger.money(`ค่าใช้จ่ายวันนี้: ${todayCost.toFixed(2)} บาท, เดือนนี้: ${monthlyCost.toFixed(2)} บาท`);
            }
        } catch (error) {
            logger.warn(`⚠️ ไม่สามารถดึงอัตราแลกเปลี่ยนได้ ใช้อัตราเริ่มต้น ${this.exchangeRate} บาท`);
        }
    }

    // โหลดข้อมูลการใช้งานของวันนี้
    loadTodayUsage() {
        try {
            if (fs.existsSync(this.quotaFile)) {
                const data = JSON.parse(fs.readFileSync(this.quotaFile, 'utf8'));
                const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
                
                if (data.date === today) {
                    return data.usage || 0;
                }
            }
            
            // วันใหม่ หรือไฟล์ไม่มี - reset การใช้งาน
            return 0;
        } catch (error) {
            logger.warn(`ไม่สามารถโหลดข้อมูล quota: ${error.message}`);
            return 0;
        }
    }

    // โหลดข้อมูลค่าใช้จ่าย
    loadCostData() {
        try {
            if (fs.existsSync(this.costFile)) {
                const data = JSON.parse(fs.readFileSync(this.costFile, 'utf8'));
                return data;
            }
            
            // ไฟล์ไม่มี - สร้างข้อมูลเริ่มต้น
            return {
                daily: {},
                monthly: {},
                total: {
                    requests: 0,
                    costUSD: 0,
                    costTHB: 0
                }
            };
        } catch (error) {
            logger.warn(`ไม่สามารถโหลดข้อมูลค่าใช้จ่าย: ${error.message}`);
            return {
                daily: {},
                monthly: {},
                total: { requests: 0, costUSD: 0, costTHB: 0 }
            };
        }
    }

    // บันทึกข้อมูลค่าใช้จ่าย
    saveCostData() {
        try {
            const dataDir = path.dirname(this.costFile);
            if (!fs.existsSync(dataDir)) {
                fs.mkdirSync(dataDir, { recursive: true });
            }
            
            fs.writeFileSync(this.costFile, JSON.stringify(this.costData, null, 2));
        } catch (error) {
            logger.warn(`ไม่สามารถบันทึกข้อมูลค่าใช้จ่าย: ${error.message}`);
        }
    }

    // คำนวณค่าใช้จ่าย
    async calculateCosts() {
        // Update exchange rate only if it's still the default value
        if (this.exchangeRate === 35) {
            try {
                this.exchangeRate = await this.costTracker.getExchangeRate();
            } catch (error) {
                // Use existing rate if update fails
            }
        }
        
        const today = new Date().toISOString().split('T')[0];
        const thisMonth = today.substring(0, 7); // YYYY-MM
        
        // ค่าใช้จ่ายวันนี้
        const todayRequests = this.costData.daily[today]?.requests || 0;
        const freeToday = Math.min(todayRequests, this.freeDailyLimit);
        const paidToday = Math.max(0, todayRequests - this.freeDailyLimit);
        const todayCostUSD = (paidToday / 1000) * this.costPer1000;
        const todayCostTHB = todayCostUSD * this.exchangeRate;
        
        // ค่าใช้จ่ายเดือนนี้
        const monthlyData = this.costData.monthly[thisMonth];
        let monthlyCostUSD = 0;
        let monthlyCostTHB = 0;
        
        if (monthlyData) {
            monthlyCostUSD = monthlyData.costUSD || 0;
            monthlyCostTHB = monthlyData.costTHB || 0;
        }
        
        return {
            todayCost: todayCostTHB,
            monthlyCost: monthlyCostTHB,
            todayFree: freeToday,
            todayPaid: paidToday,
            todayCostUSD: todayCostUSD
        };
    }

    // อัปเดตข้อมูลค่าใช้จ่าย
    async updateCostTracking() {
        const today = new Date().toISOString().split('T')[0];
        const thisMonth = today.substring(0, 7);
        
        // อัปเดตข้อมูลรายวัน
        if (!this.costData.daily[today]) {
            this.costData.daily[today] = { requests: 0, costUSD: 0, costTHB: 0 };
        }
        this.costData.daily[today].requests = this.todayUsage;
        
        // คำนวณค่าใช้จ่ายใหม่
        const { todayCostUSD, todayCost } = await this.calculateCosts();
        this.costData.daily[today].costUSD = todayCostUSD;
        this.costData.daily[today].costTHB = todayCost;
        
        // อัปเดตข้อมูลรายเดือน
        if (!this.costData.monthly[thisMonth]) {
            this.costData.monthly[thisMonth] = { requests: 0, costUSD: 0, costTHB: 0 };
        }
        
        // คำนวณยอดรวมเดือน
        let monthlyRequests = 0;
        let monthlyCostUSD = 0;
        let monthlyCostTHB = 0;
        
        Object.keys(this.costData.daily).forEach(date => {
            if (date.startsWith(thisMonth)) {
                const dayData = this.costData.daily[date];
                monthlyRequests += dayData.requests;
                monthlyCostUSD += dayData.costUSD;
                monthlyCostTHB += dayData.costTHB;
            }
        });
        
        this.costData.monthly[thisMonth] = {
            requests: monthlyRequests,
            costUSD: monthlyCostUSD,
            costTHB: monthlyCostTHB
        };
        
        // อัปเดตยอดรวมทั้งหมด
        this.costData.total.requests += 1;
        this.costData.total.costUSD = Object.values(this.costData.monthly).reduce((sum, month) => sum + month.costUSD, 0);
        this.costData.total.costTHB = Object.values(this.costData.monthly).reduce((sum, month) => sum + month.costTHB, 0);
        
        this.saveCostData();
    }

    // บันทึกการใช้งาน
    saveTodayUsage() {
        try {
            const today = new Date().toISOString().split('T')[0];
            const data = {
                date: today,
                usage: this.todayUsage,
                limit: this.dailyLimit,
                lastUpdated: new Date().toISOString()
            };
            
            // สร้างโฟลเดอร์ data ถ้าไม่มี
            const dataDir = path.dirname(this.quotaFile);
            if (!fs.existsSync(dataDir)) {
                fs.mkdirSync(dataDir, { recursive: true });
            }
            
            fs.writeFileSync(this.quotaFile, JSON.stringify(data, null, 2));
        } catch (error) {
            logger.warn(`ไม่สามารถบันทึกข้อมูล quota: ${error.message}`);
        }
    }

    // ตรวจสอบว่าสามารถใช้งาน Google Search ได้หรือไม่
    canUseGoogleSearch() {
        if (!this.isGoogleEnabled) {
            return false;
        }
        
        if (this.todayUsage >= this.dailyLimit) {
            logger.warn(`⚠️ Google Search API เกิน quota วันนี้ (${this.todayUsage}/${this.dailyLimit}) - ข้ามการค้นหา`);
            return false;
        }
        
        return true;
    }

    // เพิ่มการนับการใช้งาน
    async incrementUsage() {
        this.todayUsage++;
        this.saveTodayUsage();
        await this.updateCostTracking();
        
        const remaining = this.dailyLimit - this.todayUsage;
        const { todayCost } = await this.calculateCosts();
        
        if (remaining <= 10) {
            logger.warn(`⚠️ Google Search API เหลือ ${remaining} คำค้น`);
        }
        
        if (this.todayUsage > this.freeDailyLimit) {
            logger.money(`💰 ค่าใช้จ่ายวันนี้: ${todayCost.toFixed(2)} บาท`);
        }
    }

    // ค้นหาข่าวทั่วไปด้วย Google Search API
    async searchGoogle(query, num = 3) { // ลดจาก 5 เป็น 3
        if (!this.canUseGoogleSearch()) {
            return [];
        }

        try {
            logger.api(`ค้นหาด้วย Google: "${query}"`);
            
            const response = await axios.get('https://www.googleapis.com/customsearch/v1', {
                params: {
                    key: this.googleApiKey,
                    cx: this.searchEngineId,
                    q: query,
                    num: num,
                    lr: 'lang_th|lang_en',
                    dateRestrict: 'd1' // ข่าวใน 1 วันล่าสุด
                },
                timeout: 8000
            });

            // นับการใช้งาน (เฉพาะเมื่อ API call สำเร็จ)
            await this.incrementUsage();

            if (response.data.items) {
                const results = response.data.items.map(item => ({
                    title: item.title,
                    snippet: item.snippet,
                    url: item.link,
                    source: item.displayLink
                }));
                
                logger.success(`พบผลการค้นหา ${results.length} รายการ`);
                return results;
            }
            
            return [];
        } catch (error) {
            if (error.response?.status === 400) {
                logger.warn(`Google Search: Query ไม่ถูกต้อง "${query}" - ${error.response?.data?.error?.message || 'Bad Request'}`);
            } else if (error.response?.status === 403) {
                logger.error('Google Search: API Key ไม่ถูกต้องหรือ quota หมด');
                // ปิดการใช้งาน Google Search ชั่วคราว
                this.isGoogleEnabled = false;
            } else if (error.response?.status === 429) {
                logger.warn('Google Search: Rate limit exceeded');
                // ปิดการใช้งาน Google Search ชั่วคราว
                this.isGoogleEnabled = false;
            } else {
                logger.error(`ข้อผิดพลาดในการค้นหา Google: ${error.message}`);
            }
            return [];
        }
    }

    // ค้นหาข่าวด้วย News API
    async searchNews(query, category = null) {
        if (!this.isNewsEnabled) {
            logger.warn('News API ไม่ได้เปิดใช้งาน');
            return [];
        }

        try {
            logger.api(`ค้นหาข่าวด้วย News API: "${query}"`);
            
            // ปรับ query ให้เหมาะสมกับ News API
            const cleanQuery = query.replace(/[^\w\s]/g, '').substring(0, 100);
            
            const params = {
                apiKey: this.newsApiKey,
                q: cleanQuery,
                language: 'en',
                sortBy: 'publishedAt',
                pageSize: 3, // ลดจำนวนลงเพื่อประหยัด quota
                from: new Date(Date.now() - 24*60*60*1000).toISOString() // ข่าว 24 ชั่วโมงล่าสุด
            };

            // ไม่ใส่ category เพราะ News API v2/everything ไม่รองรับ
            // if (category) {
            //     params.category = category;
            // }

            const response = await axios.get('https://newsapi.org/v2/everything', {
                params: params,
                timeout: 8000
            });

            if (response.data.articles) {
                const results = response.data.articles.map(article => ({
                    title: article.title,
                    snippet: article.description || article.content?.substring(0, 200) || '',
                    url: article.url,
                    source: article.source.name,
                    publishedAt: article.publishedAt
                }));
                
                logger.success(`พบข่าวสาร ${results.length} รายการ`);
                return results;
            }
            
            return [];
        } catch (error) {
            if (error.response?.status === 400) {
                logger.warn(`News API: Query ไม่ถูกต้อง "${query}" - ${error.response?.data?.message || 'Bad Request'}`);
            } else if (error.response?.status === 401) {
                logger.error('News API: API Key ไม่ถูกต้อง');
            } else if (error.response?.status === 429) {
                logger.warn('News API: Rate limit exceeded');
            } else {
                logger.error(`ข้อผิดพลาดในการค้นหาข่าว: ${error.message}`);
            }
            return [];
        }
    }

    // ค้นหาข่าวเศรษฐกิจ
    async searchEconomicNews() {
        const queries = [
            'Thailand economy GDP inflation',
            'US Federal Reserve interest rate'
        ];

        const allResults = [];
        for (const query of queries) {
            const googleResults = await this.searchGoogle(query);
            allResults.push(...googleResults);
            
            // ลองค้นหาด้วย News API เฉพาะ query แรก
            if (queries.indexOf(query) === 0) {
                const newsResults = await this.searchNews(query);
                allResults.push(...newsResults);
            }
        }

        return this.removeDuplicates(allResults);
    }

    // ค้นหาข่าวสงคราม/ภูมิรัฐศาสตร์
    async searchGeopoliticalNews() {
        const queries = [
            'Ukraine Russia war',
            'Middle East conflict'
        ];

        const allResults = [];
        for (const query of queries) {
            const googleResults = await this.searchGoogle(query);
            allResults.push(...googleResults);
            
            // ลองค้นหาด้วย News API เฉพาะ query แรก
            if (queries.indexOf(query) === 0) {
                const newsResults = await this.searchNews(query);
                allResults.push(...newsResults);
            }
        }

        return this.removeDuplicates(allResults);
    }

    // ค้นหาข่าวทองคำ
    async searchGoldNews() {
        const queries = [
            'gold price today'
        ];

        const allResults = [];
        for (const query of queries) {
            const googleResults = await this.searchGoogle(query);
            const newsResults = await this.searchNews(query);
            allResults.push(...googleResults, ...newsResults);
        }

        return this.removeDuplicates(allResults);
    }

    // ค้นหาข่าวหุ้น
    async searchStockNews() {
        const queries = [
            'Thailand stock market SET',
            'US stock market S&P 500'
        ];

        const allResults = [];
        for (const query of queries) {
            const googleResults = await this.searchGoogle(query);
            allResults.push(...googleResults);
            
            // ลองค้นหาด้วย News API เฉพาะ query แรก
            if (queries.indexOf(query) === 0) {
                const newsResults = await this.searchNews(query);
                allResults.push(...newsResults);
            }
        }

        return this.removeDuplicates(allResults);
    }

    // ค้นหาข่าวคริปโต
    async searchCryptoNews() {
        const queries = [
            'Bitcoin price today'
        ];

        const allResults = [];
        for (const query of queries) {
            const googleResults = await this.searchGoogle(query);
            const newsResults = await this.searchNews(query);
            allResults.push(...googleResults, ...newsResults);
        }

        return this.removeDuplicates(allResults);
    }

    // ค้นหาข่าวสกุลเงิน
    async searchCurrencyNews() {
        const queries = [
            'USD THB exchange rate'
        ];

        const allResults = [];
        for (const query of queries) {
            const googleResults = await this.searchGoogle(query);
            const newsResults = await this.searchNews(query);
            allResults.push(...googleResults, ...newsResults);
        }

        return this.removeDuplicates(allResults);
    }

    // ค้นหาข่าวทั้งหมด
    async searchAllNews() {
        logger.process('🔍 เริ่มค้นหาข่าวจากอินเทอร์เน็ต...');
        
        try {
            const [
                economicNews,
                geopoliticalNews,
                goldNews,
                stockNews,
                cryptoNews,
                currencyNews
            ] = await Promise.allSettled([
                this.searchEconomicNews(),
                this.searchGeopoliticalNews(),
                this.searchGoldNews(),
                this.searchStockNews(),
                this.searchCryptoNews(),
                this.searchCurrencyNews()
            ]);

            const newsData = {
                economic: this.getResults(economicNews).slice(0, 3),
                geopolitical: this.getResults(geopoliticalNews).slice(0, 3),
                gold: this.getResults(goldNews).slice(0, 2),
                stock: this.getResults(stockNews).slice(0, 3),
                crypto: this.getResults(cryptoNews).slice(0, 2),
                currency: this.getResults(currencyNews).slice(0, 2)
            };

            const totalNews = Object.values(newsData).reduce((sum, news) => sum + news.length, 0);
            
            if (totalNews > 0) {
                logger.success(`✅ ค้นหาข่าวเสร็จสิ้น: ${totalNews} รายการ`);
            } else {
                logger.warn('⚠️ ไม่สามารถค้นหาข่าวได้ - ปัญหา API หรือ network');
            }

            return newsData;
        } catch (error) {
            logger.error(`ข้อผิดพลาดในการค้นหาข่าว: ${error.message}`);
            return {
                economic: [],
                geopolitical: [],
                gold: [],
                stock: [],
                crypto: [],
                currency: []
            };
        }
    }

    // Helper method เพื่อจัดการ Promise.allSettled results
    getResults(promiseResult) {
        if (promiseResult.status === 'fulfilled') {
            return promiseResult.value || [];
        } else {
            logger.warn(`Promise rejected: ${promiseResult.reason?.message || 'Unknown error'}`);
            return [];
        }
    }

    // ลบข่าวที่ซ้ำ
    removeDuplicates(results) {
        const seen = new Set();
        return results.filter(item => {
            const key = item.url || item.title;
            if (seen.has(key)) {
                return false;
            }
            seen.add(key);
            return true;
        });
    }

    // ดึงสถานะการใช้งาน quota สำหรับแสดงผล
    async getQuotaStatus() {
        const remaining = this.dailyLimit - this.todayUsage;
        const usagePercent = Math.round((this.todayUsage / this.dailyLimit) * 100);
        const { todayCost, monthlyCost, todayFree, todayPaid } = await this.calculateCosts();
        
        return {
            used: this.todayUsage,
            limit: this.dailyLimit,
            remaining: remaining,
            percentage: usagePercent,
            canUse: this.canUseGoogleSearch(),
            resetTime: 'เที่ยงคืน (00:00)',
            freeUsed: Math.min(this.todayUsage, this.freeDailyLimit),
            freeLimit: this.freeDailyLimit,
            paidUsed: Math.max(0, this.todayUsage - this.freeDailyLimit),
            todayCost: todayCost,
            monthlyCost: monthlyCost,
            costPerRequest: this.todayUsage > this.freeDailyLimit ? (this.costPer1000 / 1000 * this.exchangeRate) : 0
        };
    }

    // ค้นหาข่าวและราคาเฉพาะแต่ละหุ้น
    async searchStockSpecificNews(stockList) {
        logger.process('🔍 ค้นหาข่าวและราคาเฉพาะแต่ละหุ้น...');
        
        const stockAnalysis = [];
        
        for (const stock of stockList) {
            if (!stock.symbol || stock.symbol === '-') continue;
            
            try {
                // ค้นหาข่าวเฉพาะหุ้น
                const newsQueries = [
                    `${stock.symbol} stock news today`,
                    `${stock.symbol} financial results earnings`,
                    `${stock.symbol} bankruptcy liquidation risk`,
                    `${stock.symbol} company news update`
                ];
                
                const stockNews = [];
                for (const query of newsQueries) {
                    const googleResults = await this.searchGoogle(query, 2); // ลดจำนวนเพื่อประหยัด quota
                    stockNews.push(...googleResults);
                    
                    // พักเล็กน้อยเพื่อป้องกัน rate limit
                    await new Promise(resolve => setTimeout(resolve, 500));
                }
                
                // ดึงราคาหุ้นปัจจุบันและย้อนหลัง
                const priceData = await this.getStockPriceHistory(stock.symbol);
                
                // วิเคราะห์ความเสี่ยงและโอกาสกำไร
                const analysis = await this.analyzeStockRiskAndOpportunity(stock, priceData, stockNews);
                
                stockAnalysis.push({
                    symbol: stock.symbol,
                    type: stock.type,
                    amount: stock.amount,
                    purchasePrice: stock.purchasePrice,
                    currentPrice: priceData.currentPrice,
                    priceHistory: priceData.history,
                    news: this.removeDuplicates(stockNews).slice(0, 5), // เก็บข่าวสำคัญ 5 ข่าว
                    analysis: analysis
                });
                
                logger.success(`วิเคราะห์ ${stock.symbol} เสร็จสิ้น`);
                
            } catch (error) {
                logger.warn(`ไม่สามารถวิเคราะห์ ${stock.symbol}: ${error.message}`);
                
                // เพิ่มข้อมูลพื้นฐานแม้ว่าจะไม่สามารถดึงข้อมูลได้
                stockAnalysis.push({
                    symbol: stock.symbol,
                    type: stock.type,
                    amount: stock.amount,
                    purchasePrice: stock.purchasePrice,
                    currentPrice: null,
                    priceHistory: [],
                    news: [],
                    analysis: {
                        riskLevel: 'N/A',
                        profitOpportunity: 'N/A',
                        bankruptcyRisk: 'ไม่สามารถตรวจสอบได้',
                        recommendation: 'ไม่มีข้อมูลเพียงพอ'
                    }
                });
            }
        }
        
        logger.success(`วิเคราะห์หุ้นเสร็จสิ้น: ${stockAnalysis.length} ตัว`);
        return stockAnalysis;
    }
    
    // ดึงข้อมูลราคาหุ้นปัจจุบันและประวัติราคา
    async getStockPriceHistory(symbol) {
        try {
            // ใช้ Yahoo Finance API หรือ Alpha Vantage API
            const response = await axios.get(`https://query1.finance.yahoo.com/v8/finance/chart/${symbol}`, {
                timeout: 10000,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                }
            });
            
            if (response.data.chart?.result?.[0]) {
                const result = response.data.chart.result[0];
                const meta = result.meta;
                const timestamps = result.timestamp || [];
                const prices = result.indicators?.quote?.[0]?.close || [];
                
                // สร้างประวัติราคา 3-4 วันล่าสุด
                const history = [];
                const last4Days = Math.min(4, timestamps.length);
                
                for (let i = timestamps.length - last4Days; i < timestamps.length; i++) {
                    if (timestamps[i] && prices[i]) {
                        const date = new Date(timestamps[i] * 1000);
                        history.push({
                            date: date.toLocaleDateString('th-TH'),
                            price: prices[i].toFixed(2),
                            change: i > 0 && prices[i-1] ? 
                                ((prices[i] - prices[i-1]) / prices[i-1] * 100).toFixed(2) : '0.00'
                        });
                    }
                }
                
                return {
                    currentPrice: meta.regularMarketPrice?.toFixed(2) || 'N/A',
                    previousClose: meta.previousClose?.toFixed(2) || 'N/A',
                    changePercent: meta.regularMarketPrice && meta.previousClose ? 
                        (((meta.regularMarketPrice - meta.previousClose) / meta.previousClose) * 100).toFixed(2) : '0.00',
                    currency: meta.currency || 'USD',
                    history: history
                };
            }
            
            return {
                currentPrice: 'N/A',
                previousClose: 'N/A', 
                changePercent: '0.00',
                currency: 'USD',
                history: []
            };
            
        } catch (error) {
            logger.warn(`ไม่สามารถดึงราคา ${symbol}: ${error.message}`);
            return {
                currentPrice: 'N/A',
                previousClose: 'N/A',
                changePercent: '0.00', 
                currency: 'USD',
                history: []
            };
        }
    }
    
    // วิเคราะห์ความเสี่ยงและโอกาสกำไรของหุ้น
    async analyzeStockRiskAndOpportunity(stock, priceData, news) {
        // วิเคราะห์ความเสี่ยงจากราคาและข่าว
        let riskLevel = 5; // เริ่มต้นที่ปานกลาง
        let profitOpportunity = 5;
        let bankruptcyRisk = 'ต่ำ'; // ต่ำ/ปานกลาง/สูง
        
        // วิเคราะห์จากการเปลี่ยนแปลงราคา
        if (priceData.history.length > 0) {
            const recentChanges = priceData.history.map(h => parseFloat(h.change));
            const avgChange = recentChanges.reduce((a, b) => a + b, 0) / recentChanges.length;
            
            if (avgChange < -5) {
                riskLevel += 2; // ราคาลดมาก = เสี่ยงสูง
                profitOpportunity -= 2;
            } else if (avgChange > 5) {
                riskLevel -= 1; // ราคาขึ้นมาก = โอกาสดี
                profitOpportunity += 2;
            }
        }
        
        // วิเคราะห์จากข่าว
        if (news.length > 0) {
            const newsText = news.map(n => `${n.title} ${n.snippet}`).join(' ').toLowerCase();
            
            // คำที่บ่งบอกควาัมเสี่ยง
            const riskKeywords = ['bankruptcy', 'liquidation', 'debt', 'loss', 'decline', 'lawsuit', 'investigation', 'ล้มละลาย', 'ขาดทุน', 'ปิดตัว'];
            const opportunityKeywords = ['profit', 'growth', 'expansion', 'acquisition', 'earnings beat', 'dividend', 'กำไร', 'ขยายตัว', 'เติบโต'];
            const bankruptcyKeywords = ['bankruptcy', 'liquidation', 'closure', 'shut down', 'insolvent', 'ล้มละลาย', 'ปิดตัว', 'เงินศูนย์'];
            
            // นับคำที่พบ
            const riskCount = riskKeywords.filter(keyword => newsText.includes(keyword)).length;
            const opportunityCount = opportunityKeywords.filter(keyword => newsText.includes(keyword)).length;
            const bankruptcyCount = bankruptcyKeywords.filter(keyword => newsText.includes(keyword)).length;
            
            riskLevel += riskCount * 2;
            profitOpportunity += opportunityCount * 2;
            profitOpportunity -= riskCount;
            
            if (bankruptcyCount > 0) {
                bankruptcyRisk = 'สูง';
                riskLevel = Math.min(10, riskLevel + 3);
            } else if (riskCount > 2) {
                bankruptcyRisk = 'ปานกลาง';
            }
        }
        
        // จำกัดค่าในช่วง 1-10
        riskLevel = Math.max(1, Math.min(10, riskLevel));
        profitOpportunity = Math.max(1, Math.min(10, profitOpportunity));
        
        // คำนวณกำไร/ขาดทุนจากราคาชื้อ
        let currentReturn = 'N/A';
        if (stock.purchasePrice && stock.purchasePrice !== '-' && priceData.currentPrice && priceData.currentPrice !== 'N/A') {
            const purchasePrice = parseFloat(stock.purchasePrice);
            const currentPrice = parseFloat(priceData.currentPrice);
            currentReturn = (((currentPrice - purchasePrice) / purchasePrice) * 100).toFixed(2) + '%';
        }
        
        return {
            riskLevel: riskLevel,
            profitOpportunity: profitOpportunity,
            bankruptcyRisk: bankruptcyRisk,
            currentReturn: currentReturn,
            recommendation: this.generateRecommendation(riskLevel, profitOpportunity, bankruptcyRisk)
        };
    }
    
    // สร้างคำแนะนำ
    generateRecommendation(riskLevel, profitOpportunity, bankruptcyRisk) {
        if (bankruptcyRisk === 'สูง') {
            return 'ขายทันที - ความเสี่ยงล้มละลายสูง';
        } else if (riskLevel >= 8) {
            return 'ไม่แนะนำให้ซื้อเพิ่ม - ความเสี่ยงสูงมาก';
        } else if (riskLevel <= 3 && profitOpportunity >= 7) {
            return 'แนะนำให้ซื้อเพิ่ม - โอกาสกำไรดี';
        } else if (profitOpportunity >= 6) {
            return 'พิจารณาซื้อเพิ่ม - โอกาสปานกลาง';
        } else {
            return 'ถือต่อไปก่อน - ความเสี่ยงและโอกาสปานกลาง';
        }
    }
    async getMarketData(symbol) {
        try {
            logger.api(`ดึงข้อมูลราคา: ${symbol}`);
            
            const response = await axios.get(`https://query1.finance.yahoo.com/v8/finance/chart/${symbol}`, {
                timeout: 5000
            });

            if (response.data.chart?.result?.[0]) {
                const result = response.data.chart.result[0];
                const meta = result.meta;
                const currentPrice = meta.regularMarketPrice;
                const previousClose = meta.previousClose;
                const change = ((currentPrice - previousClose) / previousClose * 100).toFixed(2);

                return {
                    symbol: symbol,
                    currentPrice: currentPrice,
                    previousClose: previousClose,
                    changePercent: change,
                    currency: meta.currency
                };
            }
            
            return null;
        } catch (error) {
            logger.warn(`ไม่สามารถดึงข้อมูลราคา ${symbol}: ${error.message}`);
            return null;
        }
    }
}

module.exports = WebSearchService;