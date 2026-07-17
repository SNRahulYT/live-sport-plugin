const nock = require('nock');
const StreamFreeProvider = require('../src/providers/StreamFreeProvider');
const CircuitBreakerService = require('../src/services/CircuitBreakerService');

describe('StreamFreeProvider', () => {
  let provider;

  beforeEach(() => {
    nock.cleanAll();
    const circuitBreaker = new CircuitBreakerService();
    provider = new StreamFreeProvider({ circuitBreaker });
  });

  test('getMatches() handles valid JSON correctly', async () => {
    // Mock the HTTP response from streamfree.top
    nock('https://streamfree.top')
      .get('/streams')
      .reply(200, {
        streams: {
          football: [
            {
              id: "man_utd_vs_arsenal",
              name: "Manchester United vs Arsenal",
              match_timestamp: 1700000000,
              viewers: 500,
              league: "Premier League",
              team1: { name: "Man Utd" },
              team2: { name: "Arsenal" }
            }
          ]
        }
      });

    const matches = await provider.getMatches();
    
    expect(matches).toHaveLength(1);
    expect(matches[0].id).toBe('man_utd_vs_arsenal');
    expect(matches[0].title).toBe('Manchester United vs Arsenal');
    expect(matches[0].category).toBe('football');
    expect(matches[0].popular).toBe('1'); // Because viewers > 100
  });

  test('getMatches() handles empty/malformed responses without crashing', async () => {
    nock('https://streamfree.top')
      .get('/streams')
      .reply(500, "Internal Server Error");

    const matches = await provider.getMatches();
    
    // Should return empty array gracefully via circuit breaker / try-catch
    expect(matches).toHaveLength(0);
  });
});
