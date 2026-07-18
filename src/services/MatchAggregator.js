class MatchAggregator {
  constructor({ streamFreeProvider, streamedPkProvider, timStreamsProvider, binTvProvider, ntvProvider, sportyHunterProvider, streamSportsProvider, cacheService, yamlProviders }) {
    this.providers = [streamFreeProvider, streamedPkProvider, timStreamsProvider, binTvProvider, ntvProvider, sportyHunterProvider, streamSportsProvider, ...(yamlProviders || [])];
    this.cacheService = cacheService;
  }

  isSameEvent(e1, e2) {
    if (e1.category && e2.category && e1.category !== 'other' && e2.category !== 'other' && e1.category !== e2.category) {
      return false;
    }
    const d1 = parseInt(e1.date) || 0;
    const d2 = parseInt(e2.date) || 0;
    if (d1 && d2 && Math.abs(d1 - d2) > 86400000) return false;
    if (e1.id === e2.id) return true;

    const words1 = e1.title.toLowerCase().replace(/[^a-z0-9]/g, ' ').split(' ').filter(w => w.length > 2);
    const words2 = e2.title.toLowerCase().replace(/[^a-z0-9]/g, ' ').split(' ').filter(w => w.length > 2);
    
    let matches = 0;
    for (const w of words1) {
      if (words2.includes(w)) matches++;
    }
    const similarity = matches / Math.max(words1.length, words2.length, 1);
    return similarity >= 0.4;
  }

  async syncMatches() {
    console.log('[MatchAggregator] Fetching from all providers...');
    
    // Fetch all providers in parallel
    const results = await Promise.allSettled(this.providers.map(p => p.getMatches()));
    
    const mergedMap = new Map();

    // Map arrays into dictionaries for easier merging
    results.forEach((promiseResult, providerIndex) => {
      if (promiseResult.status === 'fulfilled') {
        const providerMatches = promiseResult.value;
        providerMatches.forEach(match => {
          if (!match.id || !match.title) return;
          const key = match.id || match.title.toLowerCase();
          
          if (!mergedMap.has(key)) {
            mergedMap.set(key, match);
          } else {
            const existing = mergedMap.get(key);
            // Merge sources
            match.sources.forEach(src => {
              if (!existing.sources.find(s => s.id === src.id && s.source === src.source)) {
                existing.sources.push(src);
              }
            });
            // Prefer popular = '1'
            if (match.popular === '1') {
              existing.popular = '1';
            }
          }
        });
      } else {
        console.error(`[MatchAggregator] Provider ${providerIndex} failed:`, promiseResult.reason);
      }
    });

    const finalMatches = Array.from(mergedMap.values());
    
    // Smart Trending Engine: Boost popular matches globally, but only if they are actually live or starting soon
    const TRENDING_KEYWORDS = ['real madrid', 'barcelona', 'manchester', 'arsenal', 'liverpool', 'chelsea', 'bayern', 'psg', 'lakers', 'warriors', 'mcgregor', 'super bowl', 'champions league', 'el clasico', 'f1', 'formula 1', 'grand prix'];
    const now = Date.now();
    
    finalMatches.forEach(match => {
      const titleLower = match.title.toLowerCase();
      if (TRENDING_KEYWORDS.some(kw => titleLower.includes(kw))) {
        // Parse kickoff date (default to 0 if none provided, assume live)
        const kickoff = parseInt(match.date) || 0;
        
        // Boost if there's no date (could be live), OR if the match is within a window of -3 hours to +3 hours from now.
        // This prevents flagging a match happening in 3 days as "🔴 Live Now".
        if (kickoff === 0 || (now >= kickoff - (3 * 3600 * 1000) && now <= kickoff + (3 * 3600 * 1000))) {
          match.popular = '1';
        }
      }
    });

    console.log(`[MatchAggregator] Sync complete. Merged ${finalMatches.length} events.`);
    this.cacheService.setMatches(finalMatches);
    return finalMatches;
  }
}

module.exports = MatchAggregator;
