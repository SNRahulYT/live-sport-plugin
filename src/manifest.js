/**
 * manifest.js — Stremio / Nuvio Addon Manifest
 *
 * Defines the addon's identity, supported content types, and catalog structure.
 * Nuvio is fully compatible with the Stremio addon format — this manifest is
 * served at GET /manifest.json and tells Nuvio what catalogs and resources
 * this addon provides.
 *
 * Content type "tv" is used for live/channel-style content in Stremio/Nuvio.
 */

const { addonBuilder } = require('stremio-addon-sdk');

// ─── Sport Catalog Definitions ───────────────────────────────────────────────
// Each entry creates a separate browsable category inside Nuvio.
// The "id" must match the Streamed.pk sport slug (used in /api/matches/{sport})
// or one of our special built-in catalog IDs (live, today, popular).

const SPORT_CATALOGS = [
  // Built-in / aggregated catalogs
  { id: 'live',         name: '🔴 Live Now'        },
  { id: 'today',        name: '📅 Today\'s Matches'  },
  { id: 'popular',      name: '⭐ Popular'           },
  // Sport-specific catalogs — IDs must match Streamed.pk sport slugs
  { id: 'football',     name: '⚽ Football'          },
  { id: 'basketball',   name: '🏀 Basketball'        },
  { id: 'american-football', name: '🏈 American Football' },
  { id: 'baseball',     name: '⚾ Baseball'          },
  { id: 'ice-hockey',   name: '🏒 Ice Hockey'        },
  { id: 'tennis',       name: '🎾 Tennis'            },
  { id: 'cricket',      name: '🏏 Cricket'           },
  { id: 'motor-sports', name: '🏎️ Motor Sports'      },
  { id: 'fight',        name: '🥊 Fighting / MMA'    },
  { id: 'golf',         name: '⛳ Golf'              },
  { id: 'rugby',        name: '🏉 Rugby'             },
];

// Build the catalogs array for the manifest.
// Each catalog supports optional "skip" for basic pagination.
const catalogs = SPORT_CATALOGS.map(sport => ({
  type: 'tv',
  id: sport.id,
  name: sport.name,
  extra: [
    { name: 'skip', isRequired: false },
  ],
}));

// ─── Manifest Definition ─────────────────────────────────────────────────────

const manifest = {
  id: 'community.nuvio.live-sports',
  version: '1.0.0',
  name: '🔴 Live Sports',
  description:
    'Watch live sports — football, basketball, tennis, cricket & more. ' +
    'Powered by Streamed.pk. Streams open in your browser or external player.',
  logo: 'https://streamed.pk/favicon.png',

  // Content types this addon handles
  types: ['tv'],

  // Resources this addon provides:
  // - catalog: browse lists of matches
  // - meta:    match detail (title, poster, description)
  // - stream:  the actual playable stream URLs
  resources: ['catalog', 'meta', 'stream'],

  catalogs,

  // All our item IDs are prefixed with "sports-" so Nuvio routes them here
  idPrefixes: ['sports-'],

  // Tell Nuvio not to cache our responses for too long (we handle our own cache)
  behaviorHints: {
    adult: false,
    p2p: false,
  },
};

// Export both the builder and the manifest object separately
const builder = new addonBuilder(manifest);

module.exports = { builder, manifest, SPORT_CATALOGS };
