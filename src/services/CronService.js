const cron = require('node-cron');

class CronService {
  constructor(container) {
    this.container = container;
  }

  start() {
    console.log('[CronService] Starting background jobs...');
    
    // Fetch and cache matches every 5 minutes
    cron.schedule('*/5 * * * *', async () => {
      console.log('[CronService] Running match sync job...');
      try {
        const aggregator = this.container.resolve('matchAggregator');
        await aggregator.syncMatches();
      } catch (err) {
        console.error('[CronService] Match sync failed:', err.message);
      }
    });

    // Run first sync immediately on boot
    setTimeout(async () => {
      try {
        console.log('[CronService] Running initial match sync...');
        const aggregator = this.container.resolve('matchAggregator');
        await aggregator.syncMatches();
      } catch(e) {}
    }, 1000);
  }
}

module.exports = CronService;
