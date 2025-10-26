const { google } = require('googleapis');
const axios = require('axios');
const winston = require('winston');

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.printf(({ timestamp, level, message }) => {
      return `${timestamp} [GOOGLE-DRIVE] [${level.toUpperCase()}]: ${message}`;
    })
  ),
  transports: [
    new winston.transports.Console()
  ]
});

class GoogleDriveService {
  constructor() {
    this.serviceAccountEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
    this.serviceAccountKey = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
    this.stocksFileId = process.env.GOOGLE_DRIVE_STOCKS_FILE_ID;
    this.contextFileId = process.env.GOOGLE_DRIVE_CONTEXT_FILE_ID;
    this.drive = null;
    this.auth = null;
    
    this.initializeAuth();
  }

  async initializeAuth() {
    try {
      if (this.serviceAccountKey && this.serviceAccountEmail) {
        // Using service account authentication
        const credentials = JSON.parse(this.serviceAccountKey);
        
        this.auth = new google.auth.GoogleAuth({
          credentials,
          scopes: ['https://www.googleapis.com/auth/drive.readonly']
        });
        
        this.drive = google.drive({ version: 'v3', auth: this.auth });
      } else if (process.env.GOOGLE_DRIVE_API_KEY) {
        // Using API key for public files
        this.drive = google.drive({ 
          version: 'v3', 
          auth: process.env.GOOGLE_DRIVE_API_KEY 
        });
      } else {
        logger.warn('⚠️ No Google Drive credentials found, using fallback methods');
      }
      
    } catch (error) {
      logger.error(`❌ Failed to initialize Google Drive auth: ${error.message}`);
    }
  }

  async testConnection() {
    try {
      if (this.drive) {
        const response = await this.drive.about.get({
          fields: 'user'
        });
        logger.info('✅ Google Drive connection successful');
        return true;
      } else {
        // Test with direct HTTP request
        const testUrl = `https://drive.google.com/uc?id=${this.stocksFileId}&export=download`;
        const response = await axios.head(testUrl, { timeout: 10000 });
        return response.status === 200;
      }
    } catch (error) {
      logger.error(`❌ Google Drive connection test failed: ${error.message}`);
      throw error;
    }
  }

  async getStockList() {
    logger.info('📂 Reading stock list from Google Drive...');
    
    try {
      let content = '';
      
      if (this.drive && this.stocksFileId) {
        // Using Google Drive API
        const response = await this.drive.files.get({
          fileId: this.stocksFileId,
          alt: 'media'
        });
        content = response.data;
      } else {
        // Using direct download URL (for public files)
        content = await this.downloadFileByUrl(this.stocksFileId);
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
    logger.info('📂 Reading stock context from Google Drive...');
    
    try {
      let content = '';
      
      if (this.drive && this.contextFileId) {
        const response = await this.drive.files.get({
          fileId: this.contextFileId,
          alt: 'media'
        });
        content = response.data;
      } else {
        content = await this.downloadFileByUrl(this.contextFileId);
      }
      
      logger.info('✅ Successfully loaded stock context');
      return content;
      
    } catch (error) {
      logger.error(`❌ Failed to get stock context: ${error.message}`);
      return 'ไม่สามารถโหลดข้อมูลบริบทหุ้นได้';
    }
  }

  async downloadFileByUrl(fileId) {
    try {
      let downloadUrl;
      
      // Try different Google Drive download URL formats
      const urlFormats = [
        `https://drive.google.com/uc?id=${fileId}&export=download`,
        `https://docs.google.com/document/d/${fileId}/export?format=txt`,
        `https://drive.google.com/file/d/${fileId}/view`
      ];
      
      for (const url of urlFormats) {
        try {
          const response = await axios.get(url, {
            timeout: 15000,
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
          });
          
          if (response.data && typeof response.data === 'string') {
            return response.data;
          }
        } catch (urlError) {
          logger.warn(`⚠️ Failed to download from ${url}: ${urlError.message}`);
        }
      }
      
      throw new Error('All download methods failed');
      
    } catch (error) {
      logger.error(`❌ Failed to download file ${fileId}: ${error.message}`);
      throw error;
    }
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

  async updateStockFile(stocks) {
    // This would be used if we need to write back to Google Drive
    // For now, it's read-only
    logger.info('📝 Stock file update requested (read-only mode)');
    return false;
  }

  // Helper method to validate file access
  async validateFileAccess(fileId) {
    try {
      if (this.drive) {
        const response = await this.drive.files.get({
          fileId: fileId,
          fields: 'id,name,mimeType'
        });
        return response.data;
      } else {
        // Test direct access
        const testUrl = `https://drive.google.com/uc?id=${fileId}&export=download`;
        const response = await axios.head(testUrl, { timeout: 10000 });
        return response.status === 200;
      }
    } catch (error) {
      logger.error(`❌ File access validation failed for ${fileId}: ${error.message}`);
      return false;
    }
  }
}

module.exports = GoogleDriveService;