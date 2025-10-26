const axios = require('axios');
const fs = require('fs');
const path = require('path');

async function downloadGoogleDriveFile() {
  try {
    const fileId = '1o3hhOB_Ftw0EKpddpi8Rko0SflabyzUB';
    
    // Try different download URL formats
    const downloadUrls = [
      `https://drive.google.com/uc?id=${fileId}&export=download`,
      `https://docs.google.com/document/d/${fileId}/export?format=txt`,
      `https://drive.google.com/file/d/${fileId}/view`
    ];

    console.log('🔍 Attempting to download file from Google Drive...');
    
    for (let i = 0; i < downloadUrls.length; i++) {
      const url = downloadUrls[i];
      console.log(`📡 Trying URL ${i + 1}: ${url}`);
      
      try {
        const response = await axios.get(url, {
          timeout: 15000,
          headers: {
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
          }
        });
        
        console.log(`✅ Response status: ${response.status}`);
        console.log(`📝 Content type: ${response.headers['content-type']}`);
        console.log(`📏 Content length: ${response.data.length} characters`);
        
        if (response.data && typeof response.data === 'string' && response.data.length > 10) {
          console.log('📄 File content preview:');
          console.log('=' .repeat(50));
          console.log(response.data.substring(0, 500));
          console.log('=' .repeat(50));
          
          // Save to local file
          const localPath = path.join(__dirname, 'data', 'downloaded-stocks.txt');
          
          // Create data directory if it doesn't exist
          const dataDir = path.join(__dirname, 'data');
          if (!fs.existsSync(dataDir)) {
            fs.mkdirSync(dataDir, { recursive: true });
          }
          
          fs.writeFileSync(localPath, response.data, 'utf8');
          console.log(`💾 File saved to: ${localPath}`);
          
          // Parse the content
          console.log('\n🔍 Parsing stock data...');
          const lines = response.data.split('\n').filter(line => line.trim() !== '');
          const stocks = [];
          
          for (let j = 0; j < lines.length; j++) {
            const line = lines[j].trim();
            
            // Skip header or empty lines
            if (line.includes('ประเภท') || line.includes('ชื่อ') || !line) {
              continue;
            }
            
            // Parse stock data
            const parts = line.split(/\s+/);
            
            if (parts.length >= 3) {
              const stock = {
                type: parts[0],
                symbol: parts[1],
                amount: parseFloat(parts[2]) || 0,
                unit: parts.length > 3 ? parts.slice(3).join(' ') : '',
                originalLine: line
              };
              
              if (stock.symbol && stock.symbol !== '-') {
                stocks.push(stock);
              }
            }
          }
          
          console.log(`📊 Found ${stocks.length} stocks:`);
          stocks.forEach((stock, index) => {
            console.log(`${index + 1}. ${stock.type} - ${stock.symbol} (${stock.amount} ${stock.unit})`);
          });
          
          return response.data;
        }
        
      } catch (error) {
        console.log(`❌ URL ${i + 1} failed: ${error.message}`);
      }
    }
    
    console.log('❌ All download attempts failed');
    return null;
    
  } catch (error) {
    console.error('💥 Download error:', error.message);
    return null;
  }
}

// Run the download
downloadGoogleDriveFile();