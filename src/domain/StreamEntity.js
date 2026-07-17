class StreamEntity {
  constructor({ name, title, url, externalUrl, resolution, bitrate, score }) {
    this.name = name || 'Unknown Proxy';
    this.title = title || 'Unknown Stream';
    
    // Either url or externalUrl must be provided for Stremio to play it
    if (url) {
      this.url = url;
    } else if (externalUrl) {
      this.externalUrl = externalUrl;
    }

    this.resolution = resolution || null;
    this.bitrate = bitrate || null;
    this.score = score || 0;
  }
}

module.exports = StreamEntity;
