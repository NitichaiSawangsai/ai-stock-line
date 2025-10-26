const fs = require('fs').promises;
const path = require('path');
const winston = require('winston');

// สร้าง logger สำหรับ Cost Tracking
const logger = winston.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.printf(({ timestamp, level, message }) => {
            return `${timestamp} [COST-TRACKER] [${level.toUpperCase()}]: ${message}`;
        })
    ),
    transports: [
        new winston.transports.Console()
    ]
});

class CostTrackingService {
    constructor() {
        this.costFile = process.env.COST_TRACKING_FILE || 'data/monthly-cost.json';
        this.monthlyLimit = parseFloat(process.env.MONTHLY_COST_LIMIT_THB) || 500;
        this.forceFreeModeEnv = process.env.FORCE_FREE_MODE === 'true';
        
        // ราคาการใช้งาน API (บาทต่อ request)
        this.apiCosts = {
            openai: {
                'gpt-3.5-turbo': 0.05,      // ~$0.0015/request ≈ 0.05 บาท
                'gpt-4': 0.80,              // ~$0.025/request ≈ 0.80 บาท
                'gpt-4-turbo': 0.20         // ~$0.006/request ≈ 0.20 บาท
            },
            gemini: {
                'gemini-2.5-flash': 0.001,  // ฟรีส่วนใหญ่
                'gemini-2.5-pro': 0.01      // ~$0.0003/request ≈ 0.01 บาท
            }
        };
    }

    /**
     * ตรวจสอบว่าต้องใช้ Free Mode หรือไม่
     */
    async shouldUseFreeMode() {
        try {
            // ถ้าใน ENV บังคับใช้ Free Mode
            if (this.forceFreeModeEnv) {
                logger.info('🆓 Force Free Mode enabled via environment');
                return true;
            }

            const monthlySpent = await this.getMonthlySpent();
            const shouldUseFree = monthlySpent >= this.monthlyLimit;
            
            if (shouldUseFree) {
                logger.warn(`💰 Monthly cost limit reached: ${monthlySpent}/${this.monthlyLimit} THB - Switching to FREE mode`);
            } else {
                logger.info(`💰 Monthly cost: ${monthlySpent}/${this.monthlyLimit} THB - Paid APIs available`);
            }
            
            return shouldUseFree;
        } catch (error) {
            logger.error(`❌ Error checking free mode status: ${error.message}`);
            return true; // Default to free mode on error
        }
    }

    /**
     * บันทึกค่าใช้จ่าย API
     */
    async trackApiUsage(provider, model, costTHB = 0) {
        try {
            const costData = await this.loadCostData();
            const currentMonth = this.getCurrentMonth();
            
            if (!costData[currentMonth]) {
                costData[currentMonth] = {
                    totalCost: 0,
                    apiUsage: {}
                };
            }
            
            if (!costData[currentMonth].apiUsage[provider]) {
                costData[currentMonth].apiUsage[provider] = {};
            }
            
            if (!costData[currentMonth].apiUsage[provider][model]) {
                costData[currentMonth].apiUsage[provider][model] = {
                    calls: 0,
                    cost: 0
                };
            }
            
            // เพิ่มการใช้งาน
            costData[currentMonth].apiUsage[provider][model].calls += 1;
            costData[currentMonth].apiUsage[provider][model].cost += costTHB;
            costData[currentMonth].totalCost += costTHB;
            
            await this.saveCostData(costData);
            
            logger.info(`💰 API Usage tracked: ${provider}/${model} - Cost: ${costTHB} THB (Total: ${costData[currentMonth].totalCost} THB)`);
            
            return costData[currentMonth];
        } catch (error) {
            logger.error(`❌ Error tracking API usage: ${error.message}`);
            throw error;
        }
    }

    /**
     * รับค่าใช้จ่ายของเดือนปัจจุบัน
     */
    async getMonthlySpent() {
        try {
            const costData = await this.loadCostData();
            const currentMonth = this.getCurrentMonth();
            return costData[currentMonth]?.totalCost || 0;
        } catch (error) {
            logger.error(`❌ Error getting monthly spent: ${error.message}`);
            return 0;
        }
    }

    /**
     * รับสถิติการใช้งาน
     */
    async getUsageStats() {
        try {
            const costData = await this.loadCostData();
            const currentMonth = this.getCurrentMonth();
            const monthData = costData[currentMonth] || { totalCost: 0, apiUsage: {} };
            
            return {
                currentMonth,
                totalCost: monthData.totalCost,
                remainingBudget: Math.max(0, this.monthlyLimit - monthData.totalCost),
                apiUsage: monthData.apiUsage,
                isOverBudget: monthData.totalCost >= this.monthlyLimit
            };
        } catch (error) {
            logger.error(`❌ Error getting usage stats: ${error.message}`);
            return {
                currentMonth: this.getCurrentMonth(),
                totalCost: 0,
                remainingBudget: this.monthlyLimit,
                apiUsage: {},
                isOverBudget: false
            };
        }
    }

    /**
     * คำนวณค่าใช้จ่าย API
     */
    calculateApiCost(provider, model) {
        try {
            if (this.apiCosts[provider] && this.apiCosts[provider][model]) {
                return this.apiCosts[provider][model];
            }
            return 0; // Free API or unknown
        } catch (error) {
            logger.error(`❌ Error calculating API cost: ${error.message}`);
            return 0;
        }
    }

    /**
     * รีเซ็ตข้อมูลเดือนใหม่ (เรียกใช้ในวันที่ 1 ของเดือน)
     */
    async resetMonthlyData() {
        try {
            const costData = await this.loadCostData();
            const currentMonth = this.getCurrentMonth();
            
            // ลบข้อมูลเก่าที่เก่ากว่า 12 เดือน
            const now = new Date();
            Object.keys(costData).forEach(month => {
                const monthDate = new Date(month + '-01');
                const monthsAgo = (now.getFullYear() - monthDate.getFullYear()) * 12 + 
                                  now.getMonth() - monthDate.getMonth();
                if (monthsAgo > 12) {
                    delete costData[month];
                }
            });
            
            await this.saveCostData(costData);
            logger.info(`🔄 Monthly cost data reset completed for ${currentMonth}`);
            
            return true;
        } catch (error) {
            logger.error(`❌ Error resetting monthly data: ${error.message}`);
            return false;
        }
    }

    // ===== Private Methods =====

    getCurrentMonth() {
        const now = new Date();
        return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    }

    async loadCostData() {
        try {
            // สร้าง directory ถ้ายังไม่มี
            const dir = path.dirname(this.costFile);
            await fs.mkdir(dir, { recursive: true });
            
            try {
                const data = await fs.readFile(this.costFile, 'utf8');
                return JSON.parse(data);
            } catch (readError) {
                if (readError.code === 'ENOENT') {
                    // ไฟล์ไม่มี - สร้างใหม่
                    return {};
                }
                throw readError;
            }
        } catch (error) {
            logger.error(`❌ Error loading cost data: ${error.message}`);
            return {};
        }
    }

    async saveCostData(data) {
        try {
            const dir = path.dirname(this.costFile);
            await fs.mkdir(dir, { recursive: true });
            
            await fs.writeFile(this.costFile, JSON.stringify(data, null, 2), 'utf8');
        } catch (error) {
            logger.error(`❌ Error saving cost data: ${error.message}`);
            throw error;
        }
    }
}

module.exports = CostTrackingService;