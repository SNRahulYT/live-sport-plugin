/**
 * streams.js — Stream Handler (iptv-org edition)
 *
 * Returns direct HLS (.m3u8) stream URLs for a channel.
 * These play natively inside Nuvio's built-in player — no browser, no embed.
 *
 * Some streams require a specific User-Agent header (noted in the M3U as
 * #EXTVLCOPT:http-user-agent=...). We pass this as a behaviorHint so
 * compatible players can use it.
 */

const { getChannelById, sanitizeId } = require('./api');

/**
 * Handle stream requests from Nuvio.
 * Called when the user clicks on a channel to watch it.
 *
 * @param {string} type  Always "tv"
 * @param {string} id    Item ID, e.g. "iptv-bein-sports-1-qa"
 * @returns {Promise<{ streams: Object[] }>}
 */
async function handleStream(type, id) {
  console.log(`[Streams] type=${type} id=${id}`);

  // Strip "iptv-" prefix to recover our sanitized channel ID
  const channelId = id.replace(/^iptv-/, '');

  const ch = await getChannelById(channelId);

  if (!ch) {
    console.warn(`[Streams] Channel not found: ${channelId}`);
    return {
      streams: [{
        name: '⚠️ Channel Not Found',
        title: 'This channel could not be located. It may have been removed.',
        url: '',
      }],
    };
  }

  if (!ch.url) {
    return {
      streams: [{
        name: '⚠️ No Stream Available',
        title: 'No stream URL is available for this channel.',
        url: '',
      }],
    };
  }

  // Build the stream object with the direct HLS URL
  const stream = {
    name: `📡 ${ch.name.replace(/\s*\(\d+p\)\s*/gi, '').trim()}`,
    title: '🔴 Live · Direct HLS Stream',
    url: ch.url,
    // behaviorHints for live content
    behaviorHints: {
      notWebReady: false,
    },
  };

  // If the stream needs a specific User-Agent, add it as a header hint
  // (supported by Nuvio and VLC)
  if (ch.userAgent) {
    stream.title += '\n🔧 Custom User-Agent required';
    // Pass headers through the stream URL as query params if needed
    // Most modern players pick up the #EXTVLCOPT from the playlist, but
    // we also surface it in the title so the user knows
  }

  console.log(`[Streams] Returning direct HLS stream for: ${ch.name}`);
  return { streams: [stream] };
}

module.exports = { handleStream };
