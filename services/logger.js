const fs = require('fs').promises;
const path = require('path');

class Logger {
    constructor() {
        this.logDir = path.join(__dirname, '../logs');
        this.logFile = path.join(this.logDir, `app-${this.getDateString()}.log`);
        this.colors = {
            reset: '\x1b[0m',
            bright: '\x1b[1m',
            dim: '\x1b[2m',
            red: '\x1b[31m',
            green: '\x1b[32m',
            yellow: '\x1b[33m',
            blue: '\x1b[34m',
            magenta: '\x1b[35m',
            cyan: '\x1b[36m',
            white: '\x1b[37m',
            bgRed: '\x1b[41m',
            bgGreen: '\x1b[42m',
            bgYellow: '\x1b[43m',
            bgBlue: '\x1b[44m'
        };
        
        this.levels = {
            error: { level: 0, color: this.colors.red, icon: '❌', bg: this.colors.bgRed },
            warn: { level: 1, color: this.colors.yellow, icon: '⚠️ ', bg: this.colors.bgYellow },
            info: { level: 2, color: this.colors.blue, icon: 'ℹ️ ', bg: this.colors.bgBlue },
            success: { level: 3, color: this.colors.green, icon: '✅', bg: this.colors.bgGreen },
            debug: { level: 4, color: this.colors.cyan, icon: '🔍', bg: this.colors.bgBlue },
            process: { level: 2, color: this.colors.magenta, icon: '⚙️ ', bg: this.colors.bgBlue },
            api: { level: 2, color: this.colors.cyan, icon: '🔗', bg: this.colors.bgBlue },
            file: { level: 2, color: this.colors.green, icon: '📁', bg: this.colors.bgGreen },
            money: { level: 2, color: this.colors.yellow, icon: '💰', bg: this.colors.bgYellow },
            time: { level: 2, color: this.colors.magenta, icon: '⏱️ ', bg: this.colors.bgBlue }
        };
        
        this.currentLogLevel = process.env.LOG_LEVEL || 'info';
        this.sessionId = this.generateSessionId();
        this.startTime = Date.now();
        
        this.initializeLogDir();
    }

    generateSessionId() {
        return Math.random().toString(36).substr(2, 9);
    }

    getDateString() {
        const now = new Date();
        return now.toISOString().split('T')[0];
    }

    getTimestamp() {
        const now = new Date();
        return now.toLocaleString('th-TH', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            timeZone: 'Asia/Bangkok'
        });
    }

    getElapsedTime() {
        const elapsed = Date.now() - this.startTime;
        const minutes = Math.floor(elapsed / 60000);
        const seconds = Math.floor((elapsed % 60000) / 1000);
        return `${minutes}:${seconds.toString().padStart(2, '0')}`;
    }

    async initializeLogDir() {
        try {
            await fs.mkdir(this.logDir, { recursive: true });
        } catch (error) {
            // Ignore if directory already exists
        }
    }

    shouldLog(level) {
        const currentLevel = this.levels[this.currentLogLevel]?.level ?? 2;
        const messageLevel = this.levels[level]?.level ?? 2;
        return messageLevel <= currentLevel;
    }

    formatMessage(level, message, data = null) {
        const timestamp = this.getTimestamp();
        const elapsed = this.getElapsedTime();
        const levelInfo = this.levels[level] || this.levels.info;
        
        // Console message with colors
        const coloredLevel = `${levelInfo.color}${levelInfo.icon} ${level.toUpperCase()}${this.colors.reset}`;
        const timeInfo = `${this.colors.dim}[${timestamp}] [+${elapsed}]${this.colors.reset}`;
        
        let consoleMessage = `${timeInfo} ${coloredLevel} ${message}`;
        
        // Add data if provided
        if (data !== null && data !== undefined) {
            if (typeof data === 'object') {
                consoleMessage += `\n${this.colors.dim}${JSON.stringify(data, null, 2)}${this.colors.reset}`;
            } else {
                consoleMessage += ` ${this.colors.dim}${data}${this.colors.reset}`;
            }
        }

        // File message without colors
        const fileMessage = `[${timestamp}] [+${elapsed}] [${this.sessionId}] ${level.toUpperCase()}: ${message}${data ? ' ' + JSON.stringify(data) : ''}`;
        
        return { consoleMessage, fileMessage };
    }

    async writeToFile(message) {
        try {
            await fs.appendFile(this.logFile, message + '\n', 'utf8');
        } catch (error) {
            // Silently fail to avoid recursion
        }
    }

    log(level, message, data = null) {
        if (!this.shouldLog(level)) return;

        const { consoleMessage, fileMessage } = this.formatMessage(level, message, data);
        
        console.log(consoleMessage);
        this.writeToFile(fileMessage);
    }

    // Convenience methods
    error(message, data = null) {
        this.log('error', message, data);
    }

    warn(message, data = null) {
        this.log('warn', message, data);
    }

    info(message, data = null) {
        this.log('info', message, data);
    }

    success(message, data = null) {
        this.log('success', message, data);
    }

    debug(message, data = null) {
        this.log('debug', message, data);
    }

    process(message, data = null) {
        this.log('process', message, data);
    }

    api(message, data = null) {
        this.log('api', message, data);
    }

    file(message, data = null) {
        this.log('file', message, data);
    }

    money(message, data = null) {
        this.log('money', message, data);
    }

    time(message, data = null) {
        this.log('time', message, data);
    }

    // Special methods for specific use cases
    startOperation(operation) {
        this.process(`🚀 เริ่มต้น: ${operation}`);
    }

    finishOperation(operation, duration = null) {
        const durationText = duration ? ` (${duration}ms)` : '';
        this.success(`🎉 เสร็จสิ้น: ${operation}${durationText}`);
    }

    apiCall(service, endpoint, status = 'เริ่มต้น') {
        this.api(`${service} API: ${endpoint} - ${status}`);
    }

    fileOperation(operation, filePath, status = 'สำเร็จ') {
        this.file(`${operation}: ${path.basename(filePath)} - ${status}`);
    }

    costTracking(tokens, costUSD, costTHB) {
        this.money(`Token: ${tokens.toLocaleString()}, Cost: $${costUSD.toFixed(4)} (${costTHB.toFixed(2)} บาท)`);
    }

    separator(title = '') {
        const line = '='.repeat(80);
        if (title) {
            const paddedTitle = ` ${title} `;
            const padding = Math.max(0, line.length - paddedTitle.length);
            const leftPad = '='.repeat(Math.floor(padding / 2));
            const rightPad = '='.repeat(Math.ceil(padding / 2));
            console.log(`${this.colors.bright}${this.colors.cyan}${leftPad}${paddedTitle}${rightPad}${this.colors.reset}`);
        } else {
            console.log(`${this.colors.dim}${line}${this.colors.reset}`);
        }
    }

    header(title) {
        console.log('');
        this.separator(title);
        console.log('');
    }

    progress(current, total, message = '') {
        const percentage = Math.round((current / total) * 100);
        const filled = Math.round(percentage / 5);
        const empty = 20 - filled;
        
        const progressBar = '█'.repeat(filled) + '░'.repeat(empty);
        const progressMessage = `${this.colors.cyan}[${progressBar}] ${percentage}%${this.colors.reset} ${message}`;
        
        process.stdout.write(`\r${progressMessage}`);
        
        if (current === total) {
            console.log(''); // New line when complete
        }
    }

    table(title, data) {
        this.info(title);
        console.table(data);
    }

    // Cleanup method
    async cleanup() {
        try {
            const summary = {
                sessionId: this.sessionId,
                duration: this.getElapsedTime(),
                endTime: this.getTimestamp()
            };
            
            await this.writeToFile(`SESSION END: ${JSON.stringify(summary)}`);
        } catch (error) {
            // Ignore cleanup errors
        }
    }
}

// Create singleton instance
const logger = new Logger();

// Graceful shutdown
process.on('exit', () => {
    logger.cleanup();
});

process.on('SIGINT', () => {
    logger.cleanup();
    process.exit(0);
});

module.exports = logger;