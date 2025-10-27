const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');
const logger = require('./logger');

class LineService {
    constructor(channelAccessToken, channelSecret, userId) {
        this.channelAccessToken = channelAccessToken;
        this.channelSecret = channelSecret;
        this.userId = userId;
        this.baseUrl = 'https://api.line.me/v2/bot';
        this.maxMessageLength = 5000; // LINE message limit
    }

    async sendMessage(message) {
        try {
            logger.api('กำลังส่งข้อความไปยัง LINE...');
            
            const response = await axios.post(
                `${this.baseUrl}/message/push`,
                {
                    to: this.userId,
                    messages: [{
                        type: 'text',
                        text: message
                    }]
                },
                {
                    headers: {
                        'Authorization': `Bearer ${this.channelAccessToken}`,
                        'Content-Type': 'application/json'
                    },
                    timeout: 30000
                }
            );

            logger.success('ส่งข้อความ LINE สำเร็จ');
            return true;

        } catch (error) {
            const errorData = error.response?.data;
            const statusCode = error.response?.status;
            
            if (statusCode === 429 || (errorData && errorData.message && errorData.message.includes('limit'))) {
                logger.warn('⚠️ LINE API: เกิน Rate Limit หรือ Monthly Limit - ข้ามการส่ง LINE');
                return false; // Return false แทน throw error
            } else if (statusCode === 401) {
                logger.error('❌ LINE API: Token ไม่ถูกต้อง');
                return false;
            } else if (statusCode === 403) {
                logger.error('❌ LINE API: ไม่มีสิทธิ์เข้าถึง');
                return false;
            } else {
                logger.error('❌ LINE API Error:', errorData || error.message);
                return false;
            }
        }
    }

    splitMessage(message) {
        // Split long message into chunks
        const chunks = [];
        let currentChunk = '';
        const lines = message.split('\n');

        for (const line of lines) {
            // Check if adding this line would exceed the limit
            if ((currentChunk + '\n' + line).length > this.maxMessageLength && currentChunk) {
                chunks.push(currentChunk.trim());
                currentChunk = line;
            } else {
                currentChunk += (currentChunk ? '\n' : '') + line;
            }
        }

        if (currentChunk) {
            chunks.push(currentChunk.trim());
        }

        return chunks.length > 0 ? chunks : [message];
    }

    async sendLongMessage(message) {
        try {
            const chunks = this.splitMessage(message);
            logger.process(`แบ่งข้อความเป็น ${chunks.length} ส่วน`);

            let successCount = 0;
            for (let i = 0; i < chunks.length; i++) {
                logger.process(`ส่งส่วนที่ ${i + 1}/${chunks.length}...`);
                
                // Add part indicator for multi-part messages
                let messageToSend = chunks[i];
                if (chunks.length > 1) {
                    messageToSend = `📄 ส่วนที่ ${i + 1}/${chunks.length}\n\n${chunks[i]}`;
                }

                const success = await this.sendMessage(messageToSend);
                if (success) {
                    successCount++;
                } else {
                    logger.warn(`⚠️ ส่วนที่ ${i + 1} ไม่สำเร็จ - ข้าม`);
                    break; // หยุดส่งส่วนถัดไปถ้าไม่สำเร็จ
                }
                
                // Delay between messages to avoid rate limiting
                if (i < chunks.length - 1) {
                    logger.info('รอสักครู่เพื่อหลีกเลี่ยง Rate Limit...');
                    await new Promise(resolve => setTimeout(resolve, 2000));
                }
            }

            if (successCount > 0) {
                logger.success(`✅ ส่งข้อความสำเร็จ ${successCount}/${chunks.length} ส่วน`);
                return true;
            } else {
                logger.warn('⚠️ ไม่สามารถส่งข้อความใดๆ ได้ - บันทึกลงไฟล์แทน');
                return false;
            }

        } catch (error) {
            logger.error('ข้อผิดพลาดในการส่งข้อความยาว', error.message);
            return false; // Return false แทน throw error
        }
    }
}

class FileBackupService {
    constructor() {
        this.dataDir = path.join(__dirname, '../data');
        this.backupFile = path.join(this.dataDir, 'text-sum.txt');
    }

    async saveToFile(content, isAppend = false) {
        try {
            logger.process('กำลังบันทึกข้อมูลลงไฟล์...');
            
            // Ensure data directory exists
            await fs.mkdir(this.dataDir, { recursive: true });

            const timestamp = new Date().toLocaleString('th-TH');
            const header = `\n${'='.repeat(80)}\n📅 บันทึกเมื่อ: ${timestamp}\n${'='.repeat(80)}\n\n`;
            
            const contentToSave = isAppend ? header + content : content;
            
            if (isAppend) {
                await fs.appendFile(this.backupFile, contentToSave, 'utf8');
            } else {
                await fs.writeFile(this.backupFile, contentToSave, 'utf8');
            }

            logger.file(`บันทึกไฟล์สำเร็จ: ${this.backupFile}`);
            return true;

        } catch (error) {
            logger.error('ข้อผิดพลาดในการบันทึกไฟล์', error.message);
            throw error;
        }
    }

    async clearFile() {
        try {
            await fs.writeFile(this.backupFile, '', 'utf8');
            logger.file('ล้างไฟล์ backup เรียบร้อย');
        } catch (error) {
            logger.warn('ไม่สามารถล้างไฟล์ backup', error.message);
        }
    }

    async getLastBackup() {
        try {
            const content = await fs.readFile(this.backupFile, 'utf8');
            return content;
        } catch (error) {
            console.log('📄 ไม่พบไฟล์ backup เก่า');
            return null;
        }
    }
}

class MessageService {
    constructor(lineConfig) {
        this.lineService = new LineService(
            lineConfig.channelAccessToken,
            lineConfig.channelSecret,
            lineConfig.userId
        );
        this.fileBackupService = new FileBackupService();
    }

    async sendAnalysisResult(analysisContent) {
        let success = false;
        let error = null;

        try {
            // Try sending to LINE first
            success = await this.lineService.sendLongMessage(analysisContent);
            if (success) {
                logger.success('✅ ส่งผลการวิเคราะห์ไปยัง LINE สำเร็จ');
            } else {
                logger.warn('⚠️ ไม่สามารถส่งไปยัง LINE ได้ - บันทึกลงไฟล์แทน');
            }

        } catch (err) {
            logger.warn(`⚠️ ไม่สามารถส่งไปยัง LINE ได้ ${err.message}`);
            success = false;
            error = err;
        }

        // Always save to file as backup
        try {
            await this.fileBackupService.saveToFile(analysisContent);
            logger.file(`บันทึกไฟล์สำเร็จ: ${this.fileBackupService.backupFile}`);
        } catch (fileError) {
            logger.error(`ข้อผิดพลาดในการบันทึกไฟล์: ${fileError.message}`);
        }

        return success;
    }

    async sendCostSummary(costSummary) {
        let success = false;
        let error = null;

        try {
            // Try sending to LINE first
            success = await this.lineService.sendMessage(costSummary);
            if (success) {
                logger.success('✅ ส่งสรุปค่าใช้จ่ายไปยัง LINE สำเร็จ');
            } else {
                logger.warn('⚠️ ไม่สามารถส่งสรุปค่าใช้จ่ายไปยัง LINE ได้ - บันทึกลงไฟล์แทน');
            }

        } catch (err) {
            logger.warn(`⚠️ ไม่สามารถส่งสรุปค่าใช้จ่ายไปยัง LINE ได้ ${err.message}`);
            success = false;
            error = err;
        }

        // Always save to file as backup
        try {
            await this.fileBackupService.saveToFile(costSummary, true);
            logger.file(`บันทึกไฟล์สำเร็จ: ${this.fileBackupService.backupFile}`);
        } catch (fileError) {
            logger.error(`ข้อผิดพลาดในการบันทึกไฟล์: ${fileError.message}`);
        }

        return success;
    }

    async clearPreviousResults() {
        try {
            await this.fileBackupService.clearFile();
        } catch (error) {
            logger.warn('ไม่สามารถล้างผลลัพธ์เก่าได้', error.message);
        }
    }
}

module.exports = { LineService, FileBackupService, MessageService };