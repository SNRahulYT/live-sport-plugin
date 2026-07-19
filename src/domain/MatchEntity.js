class MatchEntity {
  constructor({ id, title, category, date, popular, sources, league, team1, team2, thumbnail_url }) {
    this.id = id || '';
    this.title = title || 'Unknown Match';
    this.category = category || 'other';
    
    // Normalize all dates to Unix milliseconds
if (date) {
  let ts;

  if (typeof date === "string" && /^\d+$/.test(date)) {
    ts = Number(date);

    // Convert seconds → milliseconds
    if (ts < 1000000000000) {
      ts *= 1000;
    }
  } else {
    ts = new Date(date).getTime();
  }

  this.date = !isNaN(ts) ? ts.toString() : "0";
} else {
  this.date = "0";
}
    
    this.popular = popular === '1' || popular === true ? '1' : '0';
    this.sources = Array.isArray(sources) ? sources : [];
    this.league = league || '';
    this.team1 = team1 || null;
    this.team2 = team2 || null;
    this.thumbnail_url = thumbnail_url || '';
  }
}

module.exports = MatchEntity;
