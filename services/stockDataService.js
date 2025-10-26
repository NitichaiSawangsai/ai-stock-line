const axios = require('axios');
const winston = require('winston');

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.printf(({ timestamp, level, message }) => {
      return `${timestamp} [STOCK-DATA] [${level.toUpperCase()}]: ${message}`;
    })
  ),
  transports: [
    new winston.transports.Console()
  ]
});

class StockDataService {
  constructor() {
    this.stocksFileUrl = process.env.STOCK_DATA_URL || process.env.STOCKS_FILE_URL;
    this.stocksContextUrl = process.env.STOCKS_CONTEXT_URL;
    this.maxRetries = parseInt(process.env.RETRY_MAX_ATTEMPTS) || 3;
    this.retryDelay = parseInt(process.env.RETRY_DELAY_MS) || 2000;
    this.backoffMultiplier = parseFloat(process.env.RETRY_BACKOFF_MULTIPLIER) || 2;
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
    return await this.withRetry(async () => {
      if (!this.stocksFileUrl) {
        throw new Error('STOCK_DATA_URL not configured');
      }

      const response = await axios.head(this.stocksFileUrl, { 
        timeout: 10000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });
      
      if (response.status !== 200) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      logger.info('✅ Stock data URL connection successful');
      return true;
    }, 'Stock data connection test');
  }

  async getStockList() {
    logger.info('📂 Downloading stock list from URL...');
    
    try {
      let content = '';
      
      if (this.stocksFileUrl) {
        content = await this.downloadFileFromUrl(this.stocksFileUrl);
      } else {
        throw new Error('No stock file URL configured');
      }
      
      const stocks = this.parseStockFile(content);
      logger.info(`✅ Successfully loaded ${stocks.length} stocks`);
      return stocks;
      
    } catch (error) {
      logger.error(`❌ Failed to get stock list: ${error.message}`);
      
      // Fallback to sample data
      return this.getSampleStockData();
    }
  }

  async getStockContext() {
    logger.info('📂 Downloading stock context from URL...');
    
    try {
      if (!this.stocksContextUrl || this.stocksContextUrl === 'your-context-file-url-here') {
        return this.getDefaultContext();
      }

      const content = await this.downloadFileFromUrl(this.stocksContextUrl);
      logger.info('✅ Successfully loaded stock context');
      return content;
      
    } catch (error) {
      logger.error(`❌ Failed to get stock context: ${error.message}`);
      return this.getDefaultContext();
    }
  }

  async downloadFileFromUrl(url) {
    return await this.withRetry(async () => {
      const timeout = 8000; // 8 seconds timeout
      
      logger.info(`📥 Downloading from: ${url}`);
      
      const response = await axios.get(url, {
        timeout: timeout,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
          'Accept': 'text/plain,text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
          'Connection': 'keep-alive',
          'Cache-Control': 'no-cache'
        },
        responseType: 'text',
        maxRedirects: 3
      });
      
      if (!response.data || typeof response.data !== 'string') {
        throw new Error('Invalid response data format');
      }
      
      if (response.data.length < 10) {
        throw new Error('Response data too short, likely empty file');
      }
      
      logger.info(`✅ Successfully downloaded ${response.data.length} characters`);
      return response.data;
    }, `Download from ${url}`);
  }

  async tryAlternativeGoogleDriveUrls(originalUrl) {
    const fileIdMatch = originalUrl.match(/[?&]id=([a-zA-Z0-9_-]+)/);
    if (!fileIdMatch) {
      throw new Error('Cannot extract file ID from Google Drive URL');
    }
    
    const fileId = fileIdMatch[1];
    const alternativeUrls = [
      `https://drive.google.com/uc?export=download&id=${fileId}`,
      `https://docs.google.com/document/d/${fileId}/export?format=txt`
    ];

    for (const url of alternativeUrls) {
      try {
        logger.info(`🔄 Trying alternative URL: ${url}`);
        
        const response = await axios.get(url, {
          timeout: 6000, // Shorter timeout for alternatives
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
          },
          responseType: 'text',
          maxRedirects: 2
        });
        
        if (response.data && typeof response.data === 'string' && response.data.trim().length > 0) {
          logger.info(`✅ Success with alternative URL`);
          return response.data;
        }
      } catch (urlError) {
        logger.warn(`⚠️ Alternative URL failed: ${urlError.message}`);
        // Continue to next URL
      }
    }
    
    throw new Error('All Google Drive URL formats failed');
  }

  parseStockFile(content) {
    try {
      const lines = content.split('\n').filter(line => line.trim() !== '');
      const stocks = [];
      
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        
        // Skip header or empty lines
        if (line.includes('ประเภท') || line.includes('ชื่อ') || !line) {
          continue;
        }
        
        // Parse stock data
        // Format: ประเภท ชื่อ หน่วยที่ลงทุน ชื่อหุ้น/ชื่อเหรียญคริปโต/ทอง/สกุลเงิน
        const parts = line.split(/\s+/);
        
        if (parts.length >= 3) {
          const stock = {
            type: parts[0], // ประเภท
            symbol: parts[1], // ชื่อ/สัญลักษณ์
            amount: this.parseAmount(parts[2]), // จำนวน
            unit: parts.length > 3 ? parts.slice(3).join(' ') : '', // หน่วย
            originalLine: line
          };
          
          // Validate stock data
          if (stock.symbol && stock.symbol !== '-') {
            stocks.push(stock);
          }
        }
      }
      
      return stocks;
      
    } catch (error) {
      logger.error(`❌ Failed to parse stock file: ${error.message}`);
      return this.getSampleStockData();
    }
  }

  parseAmount(amountStr) {
    try {
      // Remove commas and convert to number
      const cleaned = amountStr.replace(/,/g, '');
      const number = parseFloat(cleaned);
      return isNaN(number) ? 0 : number;
    } catch {
      return 0;
    }
  }

  getSampleStockData() {
    logger.info('📝 Using sample stock data as fallback');
    
    return [
      {
        type: 'หุ้น',
        symbol: 'VOO',
        amount: 0.00394415,
        unit: 'shares',
        originalLine: 'หุ้น VOO 0.00394415'
      },
      {
        type: 'ทอง',
        symbol: 'ทอง',
        amount: 1,
        unit: 'บาท',
        originalLine: 'ทอง ทอง 1 บาท'
      },
      {
        type: 'สกุลเงิน',
        symbol: 'USD',
        amount: 100,
        unit: 'usd',
        originalLine: 'สกุลเงิน USD 100 usd'
      },
      {
        type: 'สกุลเงินคริปโต',
        symbol: 'BTC',
        amount: 1,
        unit: 'btc',
        originalLine: 'สกุลเงินคริปโต BTC 1 btc'
      },
      {
        type: 'หุ้น',
        symbol: 'NVDA',
        amount: 0,
        unit: 'shares',
        originalLine: 'หุ้น NVDA -'
      }
    ];
  }

  getDefaultContext() {
    return `ข้อมูลหุ้นที่มีในระบบ:
- VOO: ETF ติดตาม S&P 500
- NVDA: NVIDIA Corporation (หุ้นเทคโนโลยี)
- ทอง: การลงทุนในทองคำ
- USD: สกุลเงินดอลลาร์สหรัฐ
- BTC: Bitcoin cryptocurrency

ระบบจะติดตามข่าวและวิเคราะห์ความเสี่ยงของสินทรัพย์เหล่านี้`;
  }

  // Validate file access
  async validateFileAccess(url) {
    try {
      const response = await axios.head(url, { 
        timeout: 10000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });
      return response.status === 200;
    } catch (error) {
      logger.error(`❌ File access validation failed for ${url}: ${error.message}`);
      return false;
    }
  }

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

module.exports = StockDataService;