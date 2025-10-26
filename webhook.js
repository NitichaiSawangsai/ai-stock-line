const express = require('express');
const crypto = require('crypto');
const LineOfficialAccountService = require('./services/lineOfficialAccountService');

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// LINE Bot webhook verification
function verifySignature(body, signature) {
  const channelSecret = process.env.LINE_CHANNEL_SECRET;
  if (!channelSecret) return false;
  
  const hash = crypto
    .createHmac('SHA256', channelSecret)
    .update(body, 'utf8')
    .digest('base64');
  
  return hash === signature;
}

// Initialize LINE service
const lineService = new LineOfficialAccountService();

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    service: 'AOM Stock Notification Webhook'
  });
});

// LINE Bot webhook endpoint
app.post('/webhook/line', async (req, res) => {
  try {
    const signature = req.headers['x-line-signature'];
    const body = JSON.stringify(req.body);
    
    // Verify signature
    if (!verifySignature(body, signature)) {
      console.log('❌ Invalid LINE signature');
      return res.status(400).send('Invalid signature');
    }
    
    const events = req.body.events;
    
    // Process each event
    for (const event of events) {
      await lineService.handleIncomingMessage(event);
    }
    
    res.status(200).send('OK');
    
  } catch (error) {
    console.error('❌ Webhook error:', error);
    res.status(500).send('Internal Server Error');
  }
});

// Test endpoint for sending notifications
app.post('/test/notification', async (req, res) => {
  try {
    const { type, message } = req.body;
    
    if (type === 'risk') {
      // Send test risk notification
      const testStock = {
        symbol: 'TEST',
        riskAnalysis: {
          riskLevel: 'high',
          summary: 'ทดสอบการแจ้งเตือนความเสี่ยง',
          confidenceScore: 0.95,
          recommendation: 'ระวังการลงทุน',
          keyNews: 'ข่าวทดสอบ'
        },
        news: [{
          source: 'Test Source',
          url: 'https://example.com'
        }]
      };
      
      await lineService.sendRiskAlert([testStock]);
    } else if (type === 'opportunity') {
      // Send test opportunity notification
      const testStock = {
        symbol: 'TEST',
        opportunityAnalysis: {
          opportunityLevel: 'high',
          summary: 'ทดสอบการแจ้งเตือนโอกาส',
          confidenceScore: 0.90,
          timeframe: '1-2 สัปดาห์',
          keyNews: 'ข่าวดีทดสอบ'
        },
        news: [{
          source: 'Test Source',
          url: 'https://example.com'
        }]
      };
      
      await lineService.sendOpportunityAlert([testStock]);
    } else {
      // Send custom message
      await lineService.sendPushMessage(message || 'ทดสอบการส่งข้อความ');
    }
    
    res.json({ status: 'sent', type, message: 'Notification sent successfully' });
    
  } catch (error) {
    console.error('❌ Test notification error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Start server only if this file is run directly
if (require.main === module) {
  app.listen(port, () => {
    console.log(`🚀 LINE webhook server running on port ${port}`);
    console.log(`📡 Webhook URL: http://localhost:${port}/webhook/line`);
    console.log(`🏥 Health check: http://localhost:${port}/health`);
    console.log(`🧪 Test endpoint: http://localhost:${port}/test/notification`);
  });
}

module.exports = app;