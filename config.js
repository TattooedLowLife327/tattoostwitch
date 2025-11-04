// ============================================
// STREAMER CONFIGURATION FILE
// ============================================
// Edit this file for each new streamer setup
// All HTML files will automatically use these values
// ============================================

const STREAMER_CONFIG = {
  // ============================================
  // BASIC INFO
  // ============================================
  streamer: {
    name: "TattooedLowLife327",           // Streamer display name
    channel: "tattoostwitch",              // Twitch channel name (lowercase)
    brandName: "LLoGB",                    // Short brand name for titles
    pin: "92522"                           // PWA access PIN (change this!)
  },

  // ============================================
  // SCOREBOARD
  // ============================================
  scoreboard: {
    player1Name: "TATTOO",                 // Default player 1 name
    player2Name: "OPEN"                    // Default player 2 name
  },

  // ============================================
  // SPECIAL USERS
  // ============================================
  // Users who get custom chat entrance messages
  specialUsers: {
    "chantheman814": "TheMan has arrived.",
    "coil666": "HI KEVIN!"
  },

  // ============================================
  // API ENDPOINTS
  // ============================================
  // These get set automatically after deployment
  // Update these after deploying to Netlify and Render
  api: {
    netlifyUrl: "https://tattoostwitch.netlify.app",  // Your Netlify URL
    renderUrl: "https://your-bot-name.onrender.com"   // Your Render URL (for chat SSE)
  },

  // ============================================
  // OVERLAY SETTINGS
  // ============================================
  overlays: {
    // Queue display settings
    queueMaxVisible: 5,                    // Max songs to show in queue
    queueRefreshInterval: 2000,            // Refresh every 2 seconds

    // Chat overlay settings
    chatMaxMessages: 10,                   // Max messages to show
    chatMessageDuration: 30000,            // Keep messages for 30 seconds

    // Scoreboard settings
    scoreboardRefreshInterval: 5000,       // Refresh every 5 seconds

    // Mode display settings
    modeRefreshInterval: 5000,             // Refresh every 5 seconds

    // Viewer count settings
    viewerCountRefreshInterval: 30000      // Refresh every 30 seconds
  },

  // ============================================
  // STYLING (Optional Customization)
  // ============================================
  theme: {
    primaryColor: "#00ff00",               // Main accent color
    backgroundColor: "#1a1a1a",            // Dark background
    textColor: "#ffffff"                   // Main text color
  }
};

// Export for use in other files
if (typeof module !== 'undefined' && module.exports) {
  module.exports = STREAMER_CONFIG;
}
