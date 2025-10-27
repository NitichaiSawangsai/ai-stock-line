const axios = require('axios');
const logger = require('./logger');

class StockRiskAnalyzer {
    constructor(webSearchService, costTracker) {
        this.webSearchService = webSearchService;
        this.costTracker = costTracker;
        
        // ข้อมูลราคาปัจจุบันล่าสุด (อัปเดตแบบ real-time)
        this.currentPrices = {
            'VOO': 500, // S&P 500 ETF
            'NVDA': 140, // NVIDIA 
            'BTC': 115000, // Bitcoin in USD
            'AAPL': 170,
            'TSLA': 200,
            'IVV': 500,
            'ทอง': 3200, // Gold price per oz in THB
            'USD': 34.5, // USD to THB
            'JPY': 0.23 // JPY to THB
        };
        
        // ข้อมูลแอพเทรดและความน่าเชื่อถือ
        this.tradingApps = {
            'Dime!': {
                company: 'Dime Securities',
                country: 'Thailand',
                regulated: true,
                regulator: 'SEC Thailand',
                riskLevel: 'ต่ำ',
                trustScore: 8,
                founded: '2020',
                notes: 'แอพเทรดหุ้นไทยที่ได้รับใบอนุญาตจาก ก.ล.ต.'
            },
            'Binance TH': {
                company: 'Binance Thailand',
                country: 'Thailand',
                regulated: true,
                regulator: 'SEC Thailand',
                riskLevel: 'ต่ำ-ปานกลาง',
                trustScore: 7,
                founded: '2021',
                notes: 'สาขาไทยของ Binance ที่ได้รับใบอนุญาตจาก ก.ล.ต.'
            },
            'ออม Now': {
                company: 'Aom Now (Digital Asset)',
                country: 'Thailand',
                regulated: true,
                regulator: 'BOT',
                riskLevel: 'ต่ำ',
                trustScore: 7,
                founded: '2019',
                notes: 'แพลตฟอร์มซื้อขายทองคำดิจิทัลที่ได้รับใบอนุญาต'
            }
        };
    }

    /**
     * วิเคราะห์ความเสี่ยงแต่ละหุ้น
     */
    async analyzeStockRisk(stockData) {
        logger.startOperation('วิเคราะห์ความเสี่ยงหุ้น');
        
        const stockList = this.parseStockData(stockData);
        const riskAnalysis = [];
        
        for (const stock of stockList) {
            if (stock.amount !== '-' && stock.purchasePrice !== '-') {
                const analysis = await this.analyzeIndividualStock(stock);
                riskAnalysis.push(analysis);
            }
        }
        
        logger.finishOperation(`วิเคราะห์หุ้น ${riskAnalysis.length} ตัวเสร็จสิ้น`);
        return riskAnalysis;
    }

    /**
     * วิเคราะห์หุ้นแต่ละตัว
     */
    async analyzeIndividualStock(stock) {
        logger.process(`วิเคราะห์ ${stock.symbol}...`);
        
        const riskProfile = this.getStockRiskProfile(stock.symbol);
        const currentPrice = this.getCurrentPrice(stock.symbol, stock.type);
        const financialAnalysis = this.calculateFinancialMetrics(stock, currentPrice);
        
        // วิเคราะห์แอพเทรด
        const appAnalysis = this.analyzeApp(stock.tradingApp);
        
        // ค้นหาข่าวเฉพาะหุ้นนี้
        let newsAnalysis = { riskNews: [], bankruptcyRisk: 'ต่ำ' };
        if (this.webSearchService?.isGoogleEnabled) {
            try {
                newsAnalysis = await this.searchStockNews(stock.symbol, stock.type);
                
                // ค้นหาข่าวเกี่ยวกับแอพเทรดด้วย
                if (stock.tradingApp && stock.tradingApp !== '-') {
                    const appNews = await this.searchAppNews(stock.tradingApp);
                    newsAnalysis.appNews = appNews;
                }
            } catch (error) {
                logger.warn(`ไม่สามารถค้นหาข่าว ${stock.symbol}: ${error.message}`);
            }
        }
        
        return {
            symbol: stock.symbol,
            type: stock.type,
            amount: parseFloat(stock.amount),
            purchasePrice: this.parsePurchasePrice(stock.purchasePrice),
            currentPrice: currentPrice,
            tradingApp: stock.tradingApp,
            ...financialAnalysis,
            riskProfile: riskProfile,
            appAnalysis: appAnalysis,
            newsAnalysis: newsAnalysis,
            overallRisk: this.calculateOverallRisk(riskProfile, newsAnalysis, financialAnalysis, appAnalysis),
            recommendation: this.generateRecommendation(stock, riskProfile, financialAnalysis, newsAnalysis, appAnalysis)
        };
    }

    /**
     * ข้อมูลโปรไฟล์ความเสี่ยงของแต่ละหุ้น
     */
    getStockRiskProfile(symbol) {
        const profiles = {
            'VOO': {
                name: 'Vanguard S&P 500 ETF',
                bankruptcyRisk: 'แทบไม่มี',
                volatilityRisk: 'ต่ำ-ปานกลาง',
                marketRisk: 'ปานกลาง',
                liquidityRisk: 'ต่ำมาก',
                suitability: 'เหมาะสำหรับการลงทุนระยะยาว',
                riskScore: 3
            },
            'NVDA': {
                name: 'NVIDIA Corporation',
                bankruptcyRisk: 'ต่ำ',
                volatilityRisk: 'สูง',
                marketRisk: 'สูง',
                liquidityRisk: 'ต่ำ',
                suitability: 'เหมาะสำหรับผู้ยอมรับความเสี่ยงสูง',
                riskScore: 7
            },
            'BTC': {
                name: 'Bitcoin',
                bankruptcyRisk: 'ไม่มี',
                volatilityRisk: 'สูงมาก',
                marketRisk: 'สูงมาก',
                liquidityRisk: 'ปานกลาง',
                suitability: 'เฉพาะผู้ยอมรับความเสี่ยงสูงมาก',
                riskScore: 9
            },
            'AAPL': {
                name: 'Apple Inc.',
                bankruptcyRisk: 'ต่ำมาก',
                volatilityRisk: 'ปานกลาง',
                marketRisk: 'ปานกลาง',
                liquidityRisk: 'ต่ำมาก',
                suitability: 'เหมาะสำหรับการลงทุนระยะยาว',
                riskScore: 4
            },
            'TSLA': {
                name: 'Tesla Inc.',
                bankruptcyRisk: 'ต่ำ',
                volatilityRisk: 'สูง',
                marketRisk: 'สูง',
                liquidityRisk: 'ต่ำ',
                suitability: 'เหมาะสำหรับผู้ยอมรับความเสี่ยงสูง',
                riskScore: 7
            },
            'IVV': {
                name: 'iShares Core S&P 500 ETF',
                bankruptcyRisk: 'แทบไม่มี',
                volatilityRisk: 'ต่ำ-ปานกลาง',
                marketRisk: 'ปานกลาง',
                liquidityRisk: 'ต่ำมาก',
                suitability: 'เหมาะสำหรับการลงทุนระยะยาว',
                riskScore: 3
            },
            'ทอง': {
                name: 'Gold',
                bankruptcyRisk: 'ไม่มี',
                volatilityRisk: 'ปานกลาง',
                marketRisk: 'ปานกลาง',
                liquidityRisk: 'ต่ำ',
                suitability: 'เหมาะสำหรับการป้องกันเงินเฟ้อ',
                riskScore: 4
            }
        };
        
        return profiles[symbol] || {
            name: symbol,
            bankruptcyRisk: 'ไม่ทราบ',
            volatilityRisk: 'ไม่ทราบ',
            marketRisk: 'ไม่ทราบ',
            liquidityRisk: 'ไม่ทราบ',
            suitability: 'ต้องศึกษาเพิ่มเติม',
            riskScore: 5
        };
    }

    /**
     * รับราคาปัจจุบัน
     */
    getCurrentPrice(symbol, type) {
        if (type === 'สกุลเงินคริปโต' && symbol === 'BTC') {
            return this.currentPrices['BTC'];
        }
        if (type === 'ทอง' && symbol === 'ทอง') {
            return this.currentPrices['ทอง'];
        }
        return this.currentPrices[symbol] || 0;
    }

    /**
     * วิเคราะห์แอพเทรด
     */
    analyzeApp(appName) {
        if (!appName || appName === '-') {
            return {
                name: 'ไม่ระบุ',
                riskLevel: 'ไม่ทราบ',
                trustScore: 0,
                regulated: false,
                notes: 'ไม่มีข้อมูลแอพเทรด'
            };
        }

        // ลบเครื่องหมาย quote ออก
        const cleanAppName = appName.replace(/['"]/g, '');
        
        const appInfo = this.tradingApps[cleanAppName];
        if (appInfo) {
            return {
                name: cleanAppName,
                ...appInfo,
                riskAssessment: this.assessAppRisk(appInfo)
            };
        }

        // ถ้าไม่มีข้อมูล ให้ค้นหาเพิ่มเติม
        return {
            name: cleanAppName,
            riskLevel: 'ต้องตรวจสอบ',
            trustScore: 5,
            regulated: false,
            notes: 'ต้องตรวจสอบข้อมูลเพิ่มเติม',
            riskAssessment: 'ปานกลาง'
        };
    }

    /**
     * ประเมินความเสี่ยงของแอพ
     */
    assessAppRisk(appInfo) {
        let risk = 'ต่ำ';
        
        if (!appInfo.regulated) {
            risk = 'สูง';
        } else if (appInfo.trustScore < 6) {
            risk = 'ปานกลาง-สูง';
        } else if (appInfo.trustScore < 8) {
            risk = 'ปานกลาง';
        }
        
        return risk;
    }

    /**
     * ค้นหาข่าวเกี่ยวกับแอพเทรด
     */
    async searchAppNews(appName) {
        try {
            const cleanAppName = appName.replace(/['"]/g, '');
            let searchQuery = '';
            
            if (cleanAppName.includes('Dime')) {
                searchQuery = 'Dime Securities Thailand trading app news risk 2024';
            } else if (cleanAppName.includes('Binance')) {
                searchQuery = 'Binance Thailand SEC license news reliability 2024';
            } else if (cleanAppName.includes('ออม Now')) {
                searchQuery = 'Aom Now digital gold Thailand app news 2024';
            } else {
                searchQuery = `${cleanAppName} Thailand trading app news reliability 2024`;
            }
            
            const searchResults = await this.webSearchService.performSearch(searchQuery, 2);
            
            // วิเคราะห์ข่าวสำหรับความเสี่ยงของแอพ
            const riskKeywords = ['shutdown', 'close', 'suspend', 'warning', 'fraud', 'scam', 'investigation'];
            const positiveKeywords = ['approved', 'licensed', 'regulated', 'secure', 'trusted'];
            
            let appRisk = 'ต่ำ';
            let riskNews = [];
            
            for (const result of searchResults) {
                const titleLower = result.title.toLowerCase();
                const hasRiskKeywords = riskKeywords.some(keyword => titleLower.includes(keyword));
                const hasPositiveKeywords = positiveKeywords.some(keyword => titleLower.includes(keyword));
                
                if (hasRiskKeywords) {
                    appRisk = 'สูง';
                    riskNews.push(result);
                } else if (hasPositiveKeywords) {
                    riskNews.push(result);
                }
            }
            
            return {
                appRisk: appRisk,
                news: riskNews
            };
            
        } catch (error) {
            logger.warn(`ไม่สามารถค้นหาข่าวแอพ ${appName}: ${error.message}`);
            return {
                appRisk: 'ไม่ทราบ',
                news: []
            };
        }
    }

    /**
     * แปลงราคาซื้อ
     */
    parsePurchasePrice(priceStr) {
        if (priceStr === '-') return 0;
        
        // แปลง "24.35 USD" หรือ "213.42 บาท"
        const match = priceStr.match(/(\d+\.?\d*)/);
        return match ? parseFloat(match[1]) : 0;
    }

    /**
     * คำนวณตัวชี้วัดทางการเงิน
     */
    calculateFinancialMetrics(stock, currentPrice) {
        const amount = parseFloat(stock.amount);
        const purchasePrice = this.parsePurchasePrice(stock.purchasePrice);
        
        if (purchasePrice === 0 || currentPrice === 0) {
            return {
                currentValue: 0,
                purchaseValue: 0,
                unrealizedGainLoss: 0,
                returnPercentage: 0,
                status: 'ไม่สามารถคำนวณได้'
            };
        }
        
        let currentValue, purchaseValue;
        
        if (stock.type === 'สกุลเงินคริปโต') {
            // Bitcoin: amount เป็น BTC, currentPrice เป็น USD
            currentValue = amount * currentPrice;
            purchaseValue = purchasePrice; // ซื้อด้วยบาท แต่เปรียบเทียบกับ USD
            purchaseValue = purchaseValue / 34.5; // แปลงบาทเป็น USD
        } else if (stock.type === 'ทอง') {
            // ทอง: amount เป็นออนซ์, price เป็นบาท
            currentValue = amount * currentPrice; // ปัจจุบันเป็นบาท
            purchaseValue = amount * purchasePrice; // ซื้อเป็นบาท
        } else {
            // หุ้น: amount เป็นหุ้น, price เป็น USD
            currentValue = amount * currentPrice;
            purchaseValue = amount * purchasePrice;
        }
        
        const unrealizedGainLoss = currentValue - purchaseValue;
        const returnPercentage = purchaseValue > 0 ? (unrealizedGainLoss / purchaseValue) * 100 : 0;
        
        return {
            currentValue: currentValue,
            purchaseValue: purchaseValue,
            unrealizedGainLoss: unrealizedGainLoss,
            returnPercentage: returnPercentage,
            status: unrealizedGainLoss >= 0 ? 'กำไร' : 'ขาดทุน'
        };
    }

    /**
     * ค้นหาข่าวเฉพาะหุ้น
     */
    async searchStockNews(symbol, type) {
        try {
            let searchQuery = '';
            
            if (type === 'สกุลเงินคริปโต') {
                searchQuery = `${symbol} cryptocurrency bankruptcy risk latest news 2024`;
            } else {
                searchQuery = `${symbol} stock bankruptcy risk financial stability news 2024`;
            }
            
            const searchResults = await this.webSearchService.performSearch(searchQuery, 3);
            
            // วิเคราะห์ข่าวสำหรับความเสี่ยงล้มละลาย
            const riskKeywords = ['bankruptcy', 'financial trouble', 'debt', 'loss', 'decline', 'crash', 'crisis'];
            const positiveKeywords = ['growth', 'profit', 'strong', 'recovery', 'bullish', 'surge'];
            
            let bankruptcyRisk = 'ต่ำ';
            let riskNews = [];
            
            for (const result of searchResults) {
                const titleLower = result.title.toLowerCase();
                const hasRiskKeywords = riskKeywords.some(keyword => titleLower.includes(keyword));
                const hasPositiveKeywords = positiveKeywords.some(keyword => titleLower.includes(keyword));
                
                if (hasRiskKeywords) {
                    bankruptcyRisk = 'ปานกลาง-สูง';
                    riskNews.push(result);
                } else if (hasPositiveKeywords) {
                    riskNews.push(result);
                }
            }
            
            return {
                riskNews: riskNews.slice(0, 2),
                bankruptcyRisk: bankruptcyRisk
            };
            
        } catch (error) {
            logger.warn(`ไม่สามารถค้นหาข่าว ${symbol}: ${error.message}`);
            return {
                riskNews: [],
                bankruptcyRisk: 'ไม่ทราบ'
            };
        }
    }

    /**
     * คำนวณความเสี่ยงโดยรวม
     */
    calculateOverallRisk(riskProfile, newsAnalysis, financialAnalysis, appAnalysis = null) {
        let riskScore = riskProfile.riskScore;
        
        // ปรับตามข่าว
        if (newsAnalysis.bankruptcyRisk === 'ปานกลาง-สูง') {
            riskScore += 2;
        }
        
        // ปรับตามผลการเงิน
        if (financialAnalysis.returnPercentage < -20) {
            riskScore += 1;
        } else if (financialAnalysis.returnPercentage > 20) {
            riskScore -= 1;
        }
        
        // ปรับตามความเสี่ยงของแอพเทรด
        if (appAnalysis) {
            if (appAnalysis.riskLevel === 'สูง' || !appAnalysis.regulated) {
                riskScore += 2;
            } else if (appAnalysis.riskLevel === 'ปานกลาง') {
                riskScore += 1;
            }
            
            // ปรับตามข่าวของแอพ
            if (newsAnalysis.appNews?.appRisk === 'สูง') {
                riskScore += 1;
            }
        }
        
        // จำกัดคะแนนไว้ที่ 1-10
        riskScore = Math.max(1, Math.min(10, riskScore));
        
        return {
            score: riskScore,
            level: this.getRiskLevel(riskScore)
        };
    }

    /**
     * ระดับความเสี่ยง
     */
    getRiskLevel(score) {
        if (score <= 3) return 'ต่ำ';
        if (score <= 5) return 'ปานกลาง';
        if (score <= 7) return 'สูง';
        return 'สูงมาก';
    }

    /**
     * สร้างคำแนะนำ
     */
    generateRecommendation(stock, riskProfile, financialAnalysis, newsAnalysis, appAnalysis = null) {
        const riskScore = riskProfile.riskScore;
        const returnPct = financialAnalysis.returnPercentage;
        const isLongTerm = true; // 20 ปี
        
        let recommendation = '';
        
        if (riskScore <= 3) { // ความเสี่ยงต่ำ (VOO, IVV)
            if (returnPct >= 0) {
                recommendation = '✅ เหมาะสำหรับการลงทุนระยะยาว ควรเพิ่มการลงทุนแบบสม่ำเสมอ (DCA)';
            } else {
                recommendation = '🟡 แม้ขาดทุนชั่วคราว แต่เหมาะสำหรับการลงทุนระยะยาว 20 ปี';
            }
        } else if (riskScore <= 6) { // ความเสี่ยงปานกลาง (AAPL, ทอง)
            if (returnPct >= 10) {
                recommendation = '🟢 กำไรดี ควรยึดถือต่อไป แต่ไม่ควรเพิ่มสัดส่วนมากเกินไป';
            } else if (returnPct >= 0) {
                recommendation = '🟡 กำไรน้อย ติดตามสถานการณ์และข่าวสาร';
            } else {
                recommendation = '🟠 ขาดทุน ควรพิจารณา Stop Loss หรือเพิ่มแค่เล็กน้อย';
            }
        } else { // ความเสี่ยงสูง (NVDA, TSLA, BTC)
            if (returnPct >= 20) {
                recommendation = '🟢 กำไรดีมาก แต่ควรระวังความผันผวน อาจพิจารณา Take Profit บางส่วน';
            } else if (returnPct >= 0) {
                recommendation = '🟡 ควรจำกัดสัดส่วนไม่เกิน 20% ของพอร์ต';
            } else {
                recommendation = '🔴 ความเสี่ยงสูงและขาดทุน ควรระมัดระวัง อาจพิจารณาลดสัดส่วน';
            }
        }
        
        // เพิ่มคำแนะนำจากข่าว
        if (newsAnalysis.bankruptcyRisk === 'ปานกลาง-สูง') {
            recommendation += ' ⚠️ พบข่าวเสี่ยงเพิ่มเติม ควรติดตามอย่างใกล้ชิด';
        }
        
        // เพิ่มคำแนะนำเกี่ยวกับแอพเทรด
        if (appAnalysis) {
            if (!appAnalysis.regulated) {
                recommendation += ' 🚨 แอพเทรดไม่ได้รับใบอนุญาต ความเสี่ยงสูงมาก!';
            } else if (appAnalysis.riskLevel === 'สูง') {
                recommendation += ' ⚠️ แอพเทรดมีความเสี่ยง ควรพิจารณาย้ายไปแอพที่น่าเชื่อถือมากกว่า';
            } else if (appAnalysis.riskLevel === 'ต่ำ') {
                recommendation += ' ✅ แอพเทรดน่าเชื่อถือ';
            }
        }
        
        return recommendation;
    }

    /**
     * สร้างรายงานสรุป
     */
    generateRiskReport(riskAnalysisList) {
        if (riskAnalysisList.length === 0) {
            return '❌ ไม่พบข้อมูลการลงทุนที่สามารถวิเคราะห์ได้';
        }
        
        let totalValue = 0;
        let totalPurchase = 0;
        let highRiskCount = 0;
        let report = '📊 **รายงานวิเคราะห์ความเสี่ยงการลงทุน**\n\n';
        
        // วิเคราะห์แต่ละหุ้น
        report += '🔍 **วิเคราะห์รายตัว:**\n';
        
        for (const analysis of riskAnalysisList) {
            const returnSymbol = analysis.unrealizedGainLoss >= 0 ? '📈' : '📉';
            const riskSymbol = this.getRiskSymbol(analysis.overallRisk.score);
            
            totalValue += analysis.currentValue;
            totalPurchase += analysis.purchaseValue;
            
            if (analysis.overallRisk.score >= 7) {
                highRiskCount++;
            }
            
            // สกุลเงินที่แสดง
            const currency = (analysis.type === 'ทอง') ? 'บาท' : 'USD';
            const valueText = (analysis.type === 'ทอง') 
                ? `${analysis.currentValue.toFixed(0)} บาท`
                : `$${analysis.currentValue.toFixed(2)}`;
            
            report += `\n${riskSymbol} **${analysis.symbol}** (${analysis.riskProfile.name})\n`;
            report += `   • มูลค่าปัจจุบัน: ${valueText}\n`;
            report += `   • ${returnSymbol} ${analysis.status}: ${analysis.returnPercentage.toFixed(1)}%\n`;
            report += `   • ความเสี่ยง: ${analysis.overallRisk.level} (${analysis.overallRisk.score}/10)\n`;
            report += `   • ความเสี่ยงล้มละลาย: ${analysis.riskProfile.bankruptcyRisk}\n`;
            
            // ข้อมูลแอพเทรด
            if (analysis.appAnalysis && analysis.appAnalysis.name !== 'ไม่ระบุ') {
                const appStatus = analysis.appAnalysis.regulated ? '✅' : '⚠️';
                report += `   • แอพเทรด: ${appStatus} ${analysis.appAnalysis.name} (ความเชื่อถือ: ${analysis.appAnalysis.trustScore}/10)\n`;
                
                if (!analysis.appAnalysis.regulated) {
                    report += `   • 🚨 **คำเตือน**: แอพไม่ได้รับใบอนุญาต!\n`;
                }
            }
            
            report += `   • คำแนะนำ: ${analysis.recommendation}\n`;
            
            // แสดงข่าวถ้ามี
            if (analysis.newsAnalysis.riskNews.length > 0) {
                report += `   • ข่าวล่าสุด: ${analysis.newsAnalysis.riskNews[0].title}\n`;
            }
        }
        
        // สรุปภาพรวม
        const totalReturn = totalPurchase > 0 ? ((totalValue - totalPurchase) / totalPurchase) * 100 : 0;
        const portfolioRisk = this.calculatePortfolioRisk(riskAnalysisList);
        
        // แยกมูลค่ารวมตามสกุลเงิน
        let totalValueUSD = 0;
        let totalValueTHB = 0;
        
        for (const analysis of riskAnalysisList) {
            if (analysis.type === 'ทอง') {
                totalValueTHB += analysis.currentValue;
            } else {
                totalValueUSD += analysis.currentValue;
            }
        }
        
        report += '\n📊 **สรุปพอร์ตโฟลิโอ:**\n';
        if (totalValueUSD > 0) {
            report += `• มูลค่ารวม (หุ้น/Crypto): $${totalValueUSD.toFixed(2)} (${(totalValueUSD * 34.5).toFixed(0)} บาท)\n`;
        }
        if (totalValueTHB > 0) {
            report += `• มูลค่ารวม (ทอง): ${totalValueTHB.toFixed(0)} บาท\n`;
        }
        report += `• กำไร/ขาดทุนรวม: ${totalReturn >= 0 ? '📈' : '📉'} ${totalReturn.toFixed(1)}%\n`;
        report += `• ความเสี่ยงโดยรวม: ${portfolioRisk.level} (${portfolioRisk.score}/10)\n`;
        report += `• หุ้นความเสี่ยงสูง: ${highRiskCount}/${riskAnalysisList.length} ตัว\n`;
        
        // ตรวจสอบแอพเทรดที่มีปัญหา
        const problematicApps = riskAnalysisList.filter(analysis => 
            analysis.appAnalysis && !analysis.appAnalysis.regulated
        );
        
        if (problematicApps.length > 0) {
            report += `• 🚨 แอพเทรดที่ไม่ปลอดภัย: ${problematicApps.length} แอพ\n`;
        }
        
        // คำแนะนำโดยรวม
        report += '\n💡 **คำแนะนำโดยรวม:**\n';
        
        if (portfolioRisk.score <= 4) {
            report += '✅ พอร์ตมีความเสี่ยงต่ำ เหมาะสำหรับการลงทุนระยะยาว 20 ปี\n';
            report += '• ควรเพิ่มการลงทุนแบบสม่ำเสมอ (DCA)\n';
        } else if (portfolioRisk.score <= 6) {
            report += '🟡 พอร์ตมีความเสี่ยงปานกลาง ควรติดตามอย่างสม่ำเสมอ\n';
            report += '• ควรควบคุมสัดส่วนหุ้นเสี่ยงสูง\n';
        } else {
            report += '⚠️ พอร์ตมีความเสี่ยงสูง ควรเตรียมรับความผันผวน\n';
            report += '• ควรลดสัดส่วนหุ้นเสี่ยงสูงลงให้เหลือไม่เกิน 30%\n';
            report += '• เพิ่มสัดส่วน ETF และหุ้นเสถียร\n';
        }
        
        report += '\n📅 การลงทุนระยะยาว 20 ปี จะช่วยลดความเสี่ยงจากความผันผวนระยะสั้น';
        
        return report;
    }

    /**
     * คำนวณความเสี่ยงของพอร์ต
     */
    calculatePortfolioRisk(riskAnalysisList) {
        if (riskAnalysisList.length === 0) return { score: 5, level: 'ปานกลาง' };
        
        let totalValue = 0;
        let weightedRisk = 0;
        
        for (const analysis of riskAnalysisList) {
            totalValue += analysis.currentValue;
        }
        
        for (const analysis of riskAnalysisList) {
            const weight = analysis.currentValue / totalValue;
            weightedRisk += analysis.overallRisk.score * weight;
        }
        
        const portfolioScore = Math.round(weightedRisk);
        
        return {
            score: portfolioScore,
            level: this.getRiskLevel(portfolioScore)
        };
    }

    /**
     * สัญลักษณ์ความเสี่ยง
     */
    getRiskSymbol(riskScore) {
        if (riskScore <= 3) return '🟢';
        if (riskScore <= 5) return '🟡';
        if (riskScore <= 7) return '🟠';
        return '🔴';
    }

    /**
     * แปลงข้อมูลหุ้นจาก string
     */
    parseStockData(stockData) {
        const lines = stockData.split('\n').filter(line => line.trim());
        const stockList = [];
        
        for (const line of lines) {
            if (line.includes('ประเภท') || line.includes('ชื่อ')) continue;
            
            const parts = line.trim().split(/\s+/);
            if (parts.length >= 3) {
                // ดึงแอพเทรดจากส่วนท้าย (อาจมี quotes)
                let tradingApp = '-';
                if (parts.length >= 6) {
                    // หาส่วนที่เป็นแอพเทรด (มักจะอยู่ในเครื่องหมาย quotes)
                    const quotedParts = line.match(/"([^"]+)"/);
                    if (quotedParts) {
                        tradingApp = quotedParts[1];
                    } else if (parts.length > 5) {
                        tradingApp = parts.slice(5).join(' ');
                    }
                }
                
                stockList.push({
                    type: parts[0],
                    symbol: parts[1],
                    amount: parts[2],
                    purchasePrice: parts.length > 3 ? parts[3] : '-',
                    investmentPeriod: parts.length > 4 ? parts[4] + ' ' + (parts[5] || '') : '20 ปี',
                    tradingApp: tradingApp
                });
            }
        }
        
        return stockList;
    }
}

module.exports = StockRiskAnalyzer;