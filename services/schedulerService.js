const cron = require('node-cron');
const moment = require('moment-timezone');
const winston = require('winston');

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.printf(({ timestamp, level, message }) => {
      return `${timestamp} [SCHEDULER] [${level.toUpperCase()}]: ${message}`;
    })
  ),
  transports: [
    new winston.transports.Console()
  ]
});

class SchedulerService {
  constructor() {
    this.jobs = new Map();
    this.timezone = 'Asia/Bangkok';
  }

  // Schedule high-risk check every hour
  scheduleRiskCheck(callback) {
    const cronExpression = '0 * * * *'; // Every hour at minute 0
    
    const job = cron.schedule(cronExpression, async () => {
      const now = moment().tz(this.timezone);
      logger.info(`🕐 Executing hourly risk check at ${now.format('YYYY-MM-DD HH:mm:ss')}`);
      
      try {
        await callback('risk');
      } catch (error) {
        logger.error(`❌ Risk check failed: ${error.message}`);
      }
    }, {
      scheduled: false,
      timezone: this.timezone
    });

    this.jobs.set('riskCheck', job);
    return job;
  }

  // Schedule opportunity check at 6:10 AM Bangkok time
  scheduleOpportunityCheck(callback) {
    const cronExpression = '10 6 * * *'; // 6:10 AM every day
    
    const job = cron.schedule(cronExpression, async () => {
      const now = moment().tz(this.timezone);
      logger.info(`🌅 Executing morning opportunity check at ${now.format('YYYY-MM-DD HH:mm:ss')}`);
      
      try {
        await callback('opportunity');
      } catch (error) {
        logger.error(`❌ Opportunity check failed: ${error.message}`);
      }
    }, {
      scheduled: false,
      timezone: this.timezone
    });

    this.jobs.set('opportunityCheck', job);
    return job;
  }

  // Schedule daily system health check
  scheduleHealthCheck(callback) {
    const cronExpression = '0 8 * * *'; // 8:00 AM every day
    
    const job = cron.schedule(cronExpression, async () => {
      const now = moment().tz(this.timezone);
      logger.info(`🏥 Executing daily health check at ${now.format('YYYY-MM-DD HH:mm:ss')}`);
      
      try {
        await callback('health');
      } catch (error) {
        logger.error(`❌ Health check failed: ${error.message}`);
      }
    }, {
      scheduled: false,
      timezone: this.timezone
    });

    this.jobs.set('healthCheck', job);
    return job;
  }

  // Start all scheduled jobs
  startAll() {
    logger.info('🚀 Starting all scheduled jobs...');
    
    this.jobs.forEach((job, name) => {
      job.start();
      logger.info(`✅ Started job: ${name}`);
    });

    this.logNextExecution();
  }

  // Stop all scheduled jobs
  stopAll() {
    logger.info('🛑 Stopping all scheduled jobs...');
    
    this.jobs.forEach((job, name) => {
      job.stop();
      logger.info(`⏹️ Stopped job: ${name}`);
    });
  }

  // Stop a specific job
  stopJob(jobName) {
    const job = this.jobs.get(jobName);
    if (job) {
      job.stop();
      logger.info(`⏹️ Stopped job: ${jobName}`);
      return true;
    }
    return false;
  }

  // Start a specific job
  startJob(jobName) {
    const job = this.jobs.get(jobName);
    if (job) {
      job.start();
      logger.info(`▶️ Started job: ${jobName}`);
      return true;
    }
    return false;
  }

  // Get job status
  getJobStatus(jobName) {
    const job = this.jobs.get(jobName);
    if (job) {
      return {
        name: jobName,
        running: job.running,
        lastExecution: job.lastExecution || null,
        nextExecution: this.getNextExecution(jobName)
      };
    }
    return null;
  }

  // Get all job statuses
  getAllJobStatuses() {
    const statuses = {};
    this.jobs.forEach((job, name) => {
      statuses[name] = this.getJobStatus(name);
    });
    return statuses;
  }

  // Get next execution time for a job
  getNextExecution(jobName) {
    try {
      const job = this.jobs.get(jobName);
      if (!job) return null;

      const now = moment().tz(this.timezone);
      let nextRun = null;

      switch (jobName) {
        case 'riskCheck':
          // Next hour
          nextRun = now.clone().add(1, 'hour').startOf('hour');
          break;
        case 'opportunityCheck':
          // Next 6:10 AM
          nextRun = now.clone().add(1, 'day').hour(6).minute(10).second(0);
          if (now.hour() < 6 || (now.hour() === 6 && now.minute() < 10)) {
            nextRun = now.clone().hour(6).minute(10).second(0);
          }
          break;
        case 'healthCheck':
          // Next 8:00 AM
          nextRun = now.clone().add(1, 'day').hour(8).minute(0).second(0);
          if (now.hour() < 8) {
            nextRun = now.clone().hour(8).minute(0).second(0);
          }
          break;
      }

      return nextRun ? nextRun.format('YYYY-MM-DD HH:mm:ss') : null;
    } catch (error) {
      logger.error(`❌ Error calculating next execution for ${jobName}: ${error.message}`);
      return null;
    }
  }

  // Log next execution times for all jobs
  logNextExecution() {
    logger.info('📅 Next scheduled executions:');
    this.jobs.forEach((job, name) => {
      const nextRun = this.getNextExecution(name);
      if (nextRun) {
        logger.info(`   ${name}: ${nextRun}`);
      }
    });
  }

  // Check if we should run opportunity check (during market hours)
  shouldRunOpportunityCheck() {
    const now = moment().tz(this.timezone);
    const hour = now.hour();
    
    // Run opportunity checks between 5:00 AM and 7:00 AM Bangkok time
    return hour >= 5 && hour <= 7;
  }

  // Check if we should run risk check (anytime)
  shouldRunRiskCheck() {
    // Risk checks can run 24/7
    return true;
  }

  // Get current Bangkok time
  getCurrentTime() {
    return moment().tz(this.timezone).format('YYYY-MM-DD HH:mm:ss');
  }

  // Create a one-time delayed task
  scheduleOneTime(delay, callback, taskName = 'oneTime') {
    const executeAt = moment().add(delay, 'milliseconds');
    logger.info(`⏰ Scheduling one-time task '${taskName}' to run at ${executeAt.format('YYYY-MM-DD HH:mm:ss')}`);
    
    const timeout = setTimeout(async () => {
      logger.info(`🏃 Executing one-time task: ${taskName}`);
      try {
        await callback();
      } catch (error) {
        logger.error(`❌ One-time task '${taskName}' failed: ${error.message}`);
      }
    }, delay);

    return {
      cancel: () => {
        clearTimeout(timeout);
        logger.info(`❌ Cancelled one-time task: ${taskName}`);
      },
      executeAt: executeAt.format('YYYY-MM-DD HH:mm:ss')
    };
  }

  // Validate cron expressions
  validateCronExpression(expression) {
    try {
      cron.validate(expression);
      return true;
    } catch (error) {
      logger.error(`❌ Invalid cron expression: ${expression}`);
      return false;
    }
  }

  // Destroy all jobs and clean up
  destroy() {
    logger.info('🧹 Cleaning up scheduler...');
    this.stopAll();
    this.jobs.clear();
  }
}

module.exports = SchedulerService;