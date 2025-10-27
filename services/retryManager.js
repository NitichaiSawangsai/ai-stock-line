class RetryManager {
    constructor(maxAttempts = 3, baseDelay = 1000) {
        this.maxAttempts = maxAttempts;
        this.baseDelay = baseDelay;
    }

    async executeWithRetry(asyncFunction, context = '', exponentialBackoff = true) {
        let lastError;
        
        for (let attempt = 1; attempt <= this.maxAttempts; attempt++) {
            try {
                console.log(`🔄 ความพยายามที่ ${attempt}/${this.maxAttempts}: ${context}`);
                
                const result = await asyncFunction();
                
                if (attempt > 1) {
                    console.log(`✅ สำเร็จในความพยายามที่ ${attempt}: ${context}`);
                }
                
                return result;
                
            } catch (error) {
                lastError = error;
                console.error(`❌ ความพยายามที่ ${attempt} ล้มเหลว: ${context}`, error.message);
                
                if (attempt < this.maxAttempts) {
                    const delay = exponentialBackoff 
                        ? this.baseDelay * Math.pow(2, attempt - 1)
                        : this.baseDelay;
                    
                    console.log(`⏳ รอ ${delay}ms ก่อนลองใหม่...`);
                    await new Promise(resolve => setTimeout(resolve, delay));
                } else {
                    console.error(`💀 ล้มเหลวทั้งหมด ${this.maxAttempts} ครั้ง: ${context}`);
                }
            }
        }
        
        throw new Error(`Failed after ${this.maxAttempts} attempts: ${lastError.message}`);
    }

    async executeWithTimeout(asyncFunction, timeoutMs, context = '') {
        return new Promise(async (resolve, reject) => {
            const timeoutId = setTimeout(() => {
                reject(new Error(`Operation timed out after ${timeoutMs}ms: ${context}`));
            }, timeoutMs);

            try {
                const result = await asyncFunction();
                clearTimeout(timeoutId);
                resolve(result);
            } catch (error) {
                clearTimeout(timeoutId);
                reject(error);
            }
        });
    }

    async executeWithRetryAndTimeout(asyncFunction, timeoutMs, context = '') {
        return this.executeWithRetry(
            () => this.executeWithTimeout(asyncFunction, timeoutMs, context),
            context
        );
    }
}

class TimeoutManager {
    constructor(timeoutMs) {
        this.timeoutMs = timeoutMs;
        this.startTime = Date.now();
        this.isExpired = false;
    }

    checkTimeout() {
        const elapsed = Date.now() - this.startTime;
        this.isExpired = elapsed >= this.timeoutMs;
        
        if (this.isExpired) {
            throw new Error(`Application timeout exceeded: ${elapsed}ms >= ${this.timeoutMs}ms`);
        }
        
        return {
            elapsed,
            remaining: this.timeoutMs - elapsed,
            isExpired: this.isExpired
        };
    }

    getRemainingTime() {
        const elapsed = Date.now() - this.startTime;
        return Math.max(0, this.timeoutMs - elapsed);
    }

    formatElapsedTime() {
        const elapsed = Date.now() - this.startTime;
        const minutes = Math.floor(elapsed / 60000);
        const seconds = Math.floor((elapsed % 60000) / 1000);
        return `${minutes}:${seconds.toString().padStart(2, '0')}`;
    }
}

module.exports = { RetryManager, TimeoutManager };