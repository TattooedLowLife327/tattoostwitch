#!/usr/bin/env node
/**
 * STREAMER SETUP SCRIPT
 *
 * This script configures all files for a new streamer based on config.js
 *
 * Usage:
 *   node setup-streamer.js
 *
 * What it does:
 *   1. Reads config.js
 *   2. Updates all HTML files with configured values
 *   3. Updates database schema with defaults
 *   4. Updates bot.js with special users
 *   5. Creates .env template files
 */

const fs = require('fs');
const path = require('path');

// Load configuration
const config = require('./config.js');

console.log('🚀 Setting up streamer configuration...\n');
console.log(`Streamer: ${config.streamer.name}`);
console.log(`Channel: ${config.streamer.channel}`);
console.log(`Brand: ${config.streamer.brandName}\n`);

// ============================================
// FILE REPLACEMENTS
// ============================================

const replacements = [
  // Main PWA - index.html
  {
    file: 'index.html',
    changes: [
      { find: /const CORRECT_PIN = '[^']*';/, replace: `const CORRECT_PIN = '${config.streamer.pin}';` },
      { find: /<title>.*?<\/title>/, replace: `<title>${config.streamer.name}'s Stream Control</title>` },
      { find: /placeholder="TATTOO"/g, replace: `placeholder="${config.scoreboard.player1Name}"` },
      { find: /value="TATTOO"/g, replace: `value="${config.scoreboard.player1Name}"` },
      { find: /'TATTOO'/g, replace: `'${config.scoreboard.player1Name}'` },
      { find: /'OPEN'/g, replace: `'${config.scoreboard.player2Name}'` }
    ]
  },

  // Admin Portal - admin/index.html
  {
    file: 'admin/index.html',
    changes: [
      { find: /const CORRECT_PIN = '[^']*';/, replace: `const CORRECT_PIN = '${config.streamer.pin}';` },
      { find: /<title>.*?<\/title>/, replace: `<title>${config.streamer.name} - Admin Portal</title>` },
      { find: /Player 1 \(TATTOO\)/, replace: `Player 1 (${config.scoreboard.player1Name})` }
    ]
  },

  // Spotify Queue Overlay
  {
    file: 'spotify-queue.html',
    changes: [
      { find: /<title>.*?<\/title>/, replace: `<title>${config.streamer.brandName} Spotify Queue</title>` }
    ]
  },

  // Scoreboard Overlay
  {
    file: 'scoreboard.html',
    changes: [
      { find: /<title>.*?<\/title>/, replace: `<title>${config.streamer.brandName} Scoreboard</title>` }
    ]
  },

  // Mode Display Overlay
  {
    file: 'mode-display.html',
    changes: [
      { find: /<title>.*?<\/title>/, replace: `<title>${config.streamer.brandName} Mode Display</title>` }
    ]
  },

  // Chat Overlay
  {
    file: 'chat-overlay.html',
    changes: [
      { find: /<title>.*?<\/title>/, replace: `<title>${config.streamer.brandName} Chat Overlay</title>` }
    ]
  },

  // Viewer Count Overlay
  {
    file: 'viewer-count.html',
    changes: [
      { find: /<title>.*?<\/title>/, replace: `<title>${config.streamer.brandName} Viewer Count</title>` }
    ]
  },

  // BRB Transition Overlay
  {
    file: 'transition-brb.html',
    changes: [
      { find: /<title>.*?<\/title>/, replace: `<title>${config.streamer.brandName} - Be Right Back</title>` }
    ]
  },

  // Database Schema
  {
    file: 'database-schema.sql',
    changes: [
      { find: /player1_name VARCHAR\(100\) DEFAULT '[^']*'/, replace: `player1_name VARCHAR(100) DEFAULT '${config.scoreboard.player1Name}'` },
      { find: /player2_name VARCHAR\(100\) DEFAULT '[^']*'/, replace: `player2_name VARCHAR(100) DEFAULT '${config.scoreboard.player2Name}'` }
    ]
  }
];

// ============================================
// APPLY REPLACEMENTS
// ============================================

let successCount = 0;
let errorCount = 0;

replacements.forEach(({ file, changes }) => {
  const filePath = path.join(__dirname, file);

  if (!fs.existsSync(filePath)) {
    console.log(`⚠️  Skipping ${file} (not found)`);
    return;
  }

  try {
    let content = fs.readFileSync(filePath, 'utf8');
    let modified = false;

    changes.forEach(({ find, replace }) => {
      if (content.match(find)) {
        content = content.replace(find, replace);
        modified = true;
      }
    });

    if (modified) {
      fs.writeFileSync(filePath, content, 'utf8');
      console.log(`✅ Updated ${file}`);
      successCount++;
    } else {
      console.log(`⏭️  No changes needed for ${file}`);
    }
  } catch (error) {
    console.log(`❌ Error updating ${file}: ${error.message}`);
    errorCount++;
  }
});

// ============================================
// UPDATE BOT.JS SPECIAL USERS
// ============================================

const botPath = path.join(__dirname, 'bot.js');
if (fs.existsSync(botPath)) {
  try {
    let botContent = fs.readFileSync(botPath, 'utf8');

    // Generate special users object
    const specialUsersCode = JSON.stringify(config.specialUsers, null, 2)
      .split('\n')
      .map((line, i) => i === 0 ? line : '  ' + line)
      .join('\n');

    // Find and replace the specialUserMessages object
    const specialUsersRegex = /const specialUserMessages = \{[^}]*\};/s;
    if (botContent.match(specialUsersRegex)) {
      botContent = botContent.replace(
        specialUsersRegex,
        `const specialUserMessages = ${specialUsersCode};`
      );
      fs.writeFileSync(botPath, botContent, 'utf8');
      console.log(`✅ Updated bot.js special users`);
      successCount++;
    }
  } catch (error) {
    console.log(`⚠️  Could not update bot.js special users: ${error.message}`);
  }
}

// ============================================
// CREATE ENV TEMPLATE FILES
// ============================================

const netlifyEnvTemplate = `# ============================================
# NETLIFY ENVIRONMENT VARIABLES
# ============================================
# Copy these to your Netlify dashboard:
# Site Settings → Environment Variables
# ============================================

# Database (Neon PostgreSQL)
DATABASE_URL=postgresql://user:password@host.region.neon.tech/dbname?sslmode=require

# Twitch API
TWITCH_CLIENT_ID=your_twitch_client_id_here
TWITCH_CLIENT_SECRET=your_twitch_client_secret_here

# Spotify API
SPOTIFY_CLIENT_ID=your_spotify_client_id_here
SPOTIFY_CLIENT_SECRET=your_spotify_client_secret_here
SPOTIFY_REFRESH_TOKEN=your_spotify_refresh_token_here

# Social Media (Optional - for viewer counts)
FACEBOOK_ACCESS_TOKEN=your_facebook_token_here
FACEBOOK_PAGE_ID=your_facebook_page_id_here
TIKTOK_ACCESS_TOKEN=your_tiktok_token_here
TIKTOK_USERNAME=${config.streamer.channel}
`;

const renderEnvTemplate = `# ============================================
# RENDER ENVIRONMENT VARIABLES
# ============================================
# Copy these to your Render dashboard:
# Service → Environment → Add Environment Variable
# ============================================

# Database (Neon PostgreSQL)
DATABASE_URL=postgresql://user:password@host.region.neon.tech/dbname?sslmode=require

# Twitch Bot Configuration
TWITCH_BOT_USERNAME=${config.streamer.channel}_bot
TWITCH_CHANNEL=${config.streamer.channel}
TWITCH_OAUTH_TOKEN=oauth:your_twitch_oauth_token_here
TWITCH_CLIENT_ID=your_twitch_client_id_here
TWITCH_CLIENT_SECRET=your_twitch_client_secret_here

# Spotify API
SPOTIFY_CLIENT_ID=your_spotify_client_id_here
SPOTIFY_CLIENT_SECRET=your_spotify_client_secret_here
SPOTIFY_REFRESH_TOKEN=your_spotify_refresh_token_here

# API Endpoint (Update after Netlify deployment)
NETLIFY_URL=${config.api.netlifyUrl}

# Special Users (comma-separated)
SPECIAL_USERS=${Object.keys(config.specialUsers).join(',')}

# Social Media (Optional)
FACEBOOK_ACCESS_TOKEN=your_facebook_token_here
FACEBOOK_PAGE_ID=your_facebook_page_id_here
TIKTOK_ACCESS_TOKEN=your_tiktok_token_here
TIKTOK_USERNAME=${config.streamer.channel}
`;

try {
  fs.writeFileSync(path.join(__dirname, '.env.netlify.template'), netlifyEnvTemplate);
  fs.writeFileSync(path.join(__dirname, '.env.render.template'), renderEnvTemplate);
  console.log(`✅ Created .env.netlify.template`);
  console.log(`✅ Created .env.render.template`);
  successCount += 2;
} catch (error) {
  console.log(`❌ Error creating env templates: ${error.message}`);
  errorCount++;
}

// ============================================
// SUMMARY
// ============================================

console.log('\n' + '='.repeat(50));
console.log('✨ SETUP COMPLETE!\n');
console.log(`✅ ${successCount} files updated successfully`);
if (errorCount > 0) {
  console.log(`❌ ${errorCount} errors occurred`);
}
console.log('\n📋 NEXT STEPS:');
console.log('1. Review config.js and make any final adjustments');
console.log('2. Create accounts: Neon, Netlify, Render');
console.log('3. Get API credentials: Twitch, Spotify');
console.log('4. Deploy to Netlify and Render');
console.log('5. Use .env.*.template files to set environment variables');
console.log('6. Run database-schema.sql in Neon');
console.log('7. Test everything!');
console.log('='.repeat(50) + '\n');
