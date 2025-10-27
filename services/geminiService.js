const axios = require('axios');
const logger = require('./logger');

class GeminiService {
    constructor(apiKey, model) {
        this.apiKey = apiKey;
        this.model = model;
        this.baseUrl = 'https://generativelanguage.googleapis.com/v1beta';
        this.isEnabled = apiKey && apiKey !== 'free';
        this.isFree = apiKey === 'free';
    }

    async generateResponse(prompt, maxTokens = 4000) {
        if (this.isFree) {
            // Return mock response for free tier
            return this.generateMockResponse(prompt);
        }

        if (!this.isEnabled) {
            throw new Error('Gemini API key is not configured');
        }

        try {
            logger.api(`กำลังเรียกใช้ Gemini (${this.model})...`);
            
            const response = await axios.post(
                `${this.baseUrl}/models/${this.model}:generateContent?key=${this.apiKey}`,
                {
                    contents: [{
                        parts: [{
                            text: prompt
                        }]
                    }],
                    generationConfig: {
                        maxOutputTokens: 8000, // เพิ่มจาก 4000 เป็น 8000
                        temperature: 0.7,
                        candidateCount: 1
                    }
                },
                {
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    timeout: 120000 // 2 minutes
                }
            );

            const result = response.data;
            
            // Log raw response for debugging
            if (!result.candidates || result.candidates.length === 0) {
                logger.warn('Gemini API: ไม่มี candidates ในการตอบสนอง');
                logger.debug('Gemini Response:', JSON.stringify(result, null, 2));
                
                // Check for blocked content
                if (result.promptFeedback?.blockReason) {
                    throw new Error(`Gemini blocked content: ${result.promptFeedback.blockReason}`);
                }
                
                // Return empty response instead of throwing error
                return {
                    content: 'ขออภัย ระบบ AI ไม่สามารถสร้างเนื้อหาได้ในขณะนี้ กรุณาลองใหม่อีกครั้ง',
                    usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
                    model: this.model,
                    provider: 'gemini'
                };
            }

            const candidate = result.candidates[0];
            const content = candidate?.content?.parts?.[0]?.text;
            
            if (!content || content.trim().length === 0) {
                logger.warn('Gemini API: ไม่มีเนื้อหาในการตอบสนอง');
                
                // Check finish reason
                if (candidate?.finishReason) {
                    logger.warn(`Gemini finish reason: ${candidate.finishReason}`);
                    
                    if (candidate.finishReason === 'SAFETY') {
                        throw new Error('Content blocked by Gemini safety filters');
                    } else if (candidate.finishReason === 'MAX_TOKENS') {
                        throw new Error('Response truncated due to max tokens limit');
                    }
                }
                
                // Return fallback response
                return {
                    content: 'ขออภัย ระบบ AI ไม่สามารถสร้างเนื้อหาที่สมบูรณ์ได้ กรุณาลองใหม่อีกครั้ง',
                    usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
                    model: this.model,
                    provider: 'gemini'
                };
            }

            // Estimate token usage (Gemini doesn't always provide exact counts)
            const estimatedInputTokens = Math.ceil(prompt.length / 4);
            const estimatedOutputTokens = Math.ceil(content.length / 4);

            logger.api(`Gemini ตอบกลับสำเร็จ (ประมาณ Input: ${estimatedInputTokens}, Output: ${estimatedOutputTokens})`);
            
            return {
                content: content,
                usage: {
                    inputTokens: estimatedInputTokens,
                    outputTokens: estimatedOutputTokens,
                    totalTokens: estimatedInputTokens + estimatedOutputTokens
                },
                model: this.model,
                provider: 'gemini'
            };

        } catch (error) {
            logger.error('ข้อผิดพลาด Gemini', error.response?.data || error.message);
            throw new Error(`Gemini API Error: ${error.response?.data?.error?.message || error.message}`);
        }
    }

    generateMockResponse(prompt) {
        logger.info('ใช้ Gemini Free Tier (Mock Response)');
        
        const mockContent = `
📢 สรุปด่วน! วิเคราะห์พอร์ตลงทุนและข่าววันนี้ (27 ต.ค. 2568)

วันที่: 27/10/2568
ความมั่นใจ AI ในการวิเคราะห์: 7/10 (ข้อมูลจำลอง)

==================================================================
🌍 ส่วนที่ 1: สรุปข่าวสำคัญ (5 ข่าว/หัวข้อ)
==================================================================

📈 ข่าวเศรษฐกิจ (ไทยและต่างประเทศ)
--------------------------------------------------
1. **ตลาดหุ้นโลกปรับตัวในแนวโน้มบวก**
   * สรุป: ตลาดการเงินทั่วโลกมีแนวโน้มเชิงบวกจากความคาดหวังการฟื้นตัวทางเศรษฐกิจ
   * URL: [ข้อมูลจำลอง] | ความเชื่อถือ: 7/10

2. **เฟดสหรัฐฯ คาดการณ์นโยบายการเงิน**
   * สรุป: นักลงทุนจับตาการประชุมธนาคารกลางสหรัฐฯ เพื่อดูทิศทางอัตราดอกเบี้ย
   * URL: [ข้อมูลจำลอง] | ความเชื่อถือ: 8/10

⚔️ ข่าวสงคราม/ภูมิรัฐศาสตร์
--------------------------------------------------
1. **ความตึงเครียดทางการค้าระหว่างประเทศ**
   * สรุป: ภาวะความไม่แน่นอนทางการค้าส่งผลต่อตลาดสินค้าโภคภัณฑ์
   * URL: [ข้อมูลจำลอง] | ความเชื่อถือ: 7/10

🥇 ข่าวทองคำและราคา
--------------------------------------------------
* **ราคาทองคำแท่งขายออกวันนี้: 64,000 บาท (ประมาณ)**
* ราคาย้อนหลัง 3 วัน: ประมาณ 63,800 บาท

📈 ข่าวหุ้นไทย/สหรัฐฯ และราคา
--------------------------------------------------
* VOO ราคาปัจจุบัน: $620 (ประมาณ)
* NVDA ราคาปัจจุบัน: $185 (ประมาณ)

💎 ข่าวคริปโต และราคา
--------------------------------------------------
* BTC ราคาปัจจุบัน: $115,000 (ประมาณ)

💱 ข่าวสกุลเงิน และราคา
--------------------------------------------------
* THB ราคาปัจจุบัน: 32.70 บาท/ดอลลาร์ (ประมาณ)

==================================================================
🚀 ส่วนที่ 2: วิเคราะห์พอร์ตลงทุนของคุณ (เน้นการปฏิบัติ)
==================================================================

⚠️ หมายเหตุ: นี่เป็นข้อมูลจำลองสำหรับการทดสอบระบบ
กรุณาใช้ API key จริงเพื่อรับข้อมูลที่แม่นยำและล่าสุด

ความเสี่ยงและโอกาส (ข้อมูลจำลอง):
* หุ้นสหรัฐฯ: โอกาสกำไรปานกลาง (6/10)
* ทองคำ: ความเสี่ยงต่ำ (3/10)
* คริปโต: ความเสี่ยงสูง (8/10)

==================================================================
`;

        return {
            content: mockContent.trim(),
            usage: {
                inputTokens: Math.ceil(prompt.length / 4),
                outputTokens: Math.ceil(mockContent.length / 4),
                totalTokens: Math.ceil((prompt.length + mockContent.length) / 4)
            },
            model: this.model,
            provider: 'gemini'
        };
    }

    async generateResponseInChunks(prompt, chunkSize = 3000) {
        if (this.isFree) {
            return this.generateMockResponse(prompt);
        }

        // Split prompt into smaller chunks if too long
        const promptChunks = this.splitPrompt(prompt, chunkSize);
        const responses = [];
        
        for (let i = 0; i < promptChunks.length; i++) {
            logger.process(`ประมวลผลส่วนที่ ${i + 1}/${promptChunks.length}...`);
            const response = await this.generateResponse(promptChunks[i]);
            responses.push(response);
            
            // Small delay between requests
            if (i < promptChunks.length - 1) {
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        }
        
        return this.combineResponses(responses);
    }

    splitPrompt(prompt, chunkSize) {
        // Simple approach: split by sentences and group into chunks
        const sentences = prompt.split('\n').filter(s => s.trim());
        const chunks = [];
        let currentChunk = '';
        
        for (const sentence of sentences) {
            if ((currentChunk + sentence).length > chunkSize && currentChunk) {
                chunks.push(currentChunk.trim());
                currentChunk = sentence;
            } else {
                currentChunk += (currentChunk ? '\n' : '') + sentence;
            }
        }
        
        if (currentChunk) {
            chunks.push(currentChunk.trim());
        }
        
        return chunks.length > 0 ? chunks : [prompt];
    }

    combineResponses(responses) {
        const combinedContent = responses.map(r => r.content).join('\n\n');
        const totalUsage = responses.reduce((acc, r) => ({
            inputTokens: acc.inputTokens + r.usage.inputTokens,
            outputTokens: acc.outputTokens + r.usage.outputTokens,
            totalTokens: acc.totalTokens + r.usage.totalTokens
        }), { inputTokens: 0, outputTokens: 0, totalTokens: 0 });

        return {
            content: combinedContent,
            usage: totalUsage,
            model: responses[0]?.model || this.model,
            provider: 'gemini'
        };
    }
}

module.exports = GeminiService;