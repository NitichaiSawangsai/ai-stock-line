require('dotenv').config();
const axios = require('axios');

async function testGemini() {
  try {
    console.log('Testing Gemini API...');
    const prompt = 'วิเคราะห์ความเสี่ยง';
    const response = await axios.post(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`, {
      contents: [{ parts: [{ text: prompt }] }]
    }, {
      headers: { 'Content-Type': 'application/json' }
    });
    
    console.log('Response data:', JSON.stringify(response.data, null, 2));
    
    const candidate = response.data.candidates[0];
    console.log('\nStructure check:');
    console.log('Has content:', !!candidate.content);
    console.log('Has parts:', !!candidate.content?.parts);
    if (candidate.content?.parts) {
      console.log('Parts length:', candidate.content.parts.length);
      console.log('First part text exists:', !!candidate.content.parts[0]?.text);
      if (candidate.content.parts[0]?.text) {
        console.log('Text preview:', candidate.content.parts[0].text.substring(0, 200));
      }
    }
    
  } catch (error) {
    console.log('ERROR:', error.message);
    if (error.response) {
      console.log('Response status:', error.response.status);
      console.log('Response data:', error.response.data);
    }
  }
}

testGemini();