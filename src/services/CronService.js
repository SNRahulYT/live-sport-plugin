const cron = require('node-cron');

class CronService {
  constructor({ matchAggregator }) {
    this.matchAggregator = matchAggregator;
  }

  start() {
    console.log('[CronService] Starting background jobs...');
    
    // Fetch and cache matches every 5 minutes
    cron.schedule('*/5 * * * *', async () => {
      console.log('[CronService] Running match sync job...');
      try {
        await this.matchAggregator.syncMatches();
      } catch (err) {
        console.error('[CronService] Match sync failed:', err.message);
      }
    });

    // Run first sync immediately on boot
    setTimeout(async () => {
      try {
        console.log('[CronService] Running initial match sync...');
        await this.matchAggregator.syncMatches();
      } catch(e) {
        console.error('[CronService] Match sync failed:', e.message);
      }
    }, 1000);
  }
}

module.exports = CronService;
