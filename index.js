/**
 * JOMS AI – Entry Point
 */

// ── DATABASE REDIRECT ──
require('./redirect.js');

const fs = require('fs');
const path = require('path');
const chalk = require('chalk');

// -------------------------------------------------------------------
// 1. Check if auto-update is enabled
// -------------------------------------------------------------------
const CONFIG_PATH = path.join(process.cwd(), 'database', 'autoupdate.json');
let autoUpdateEnabled = false;

try {
    if (fs.existsSync(CONFIG_PATH)) {
        const config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
        autoUpdateEnabled = config.enabled === true;
    }
} catch (err) {
    console.error(chalk.red('[AUTO-UPDATE] Failed to read config:'), err.message);
}

// -------------------------------------------------------------------
// 2. Start Panel Connector API FIRST
// -------------------------------------------------------------------
try {
    require('./☁︎.js');
} catch (e) {
    console.error(chalk.red('🔌 [PANEL API] Failed:'), e.message);
}

// -------------------------------------------------------------------
// 3. Register with Worker (silent)
// -------------------------------------------------------------------
const CODY_API_KEY = process.env.CODY_API_KEY || '';
const BOT_URL = process.env.BOT_URL || process.env.RENDER_EXTERNAL_URL || '';

if (CODY_API_KEY && BOT_URL) {
    const axios = require('axios');
    axios.post('https://cody.crysnovax.link/register', {
        name: 'joms-ai',
        url: BOT_URL,
        api_key: CODY_API_KEY
    }).then(() => console.log(chalk.green('✅ Registered with Worker')))
      .catch(e => console.log(chalk.yellow('⚠️ Worker registration failed:'), e.message));
} else {
    console.log(chalk.gray('ℹ️ Worker registration skipped (no API key or URL)'));
}

// -------------------------------------------------------------------
// 4. Run update if enabled
// -------------------------------------------------------------------
(async () => {
    if (autoUpdateEnabled) {
        console.log(chalk.yellow('🤖 JOMS AI updating...'));
        console.log(chalk.cyan('🤖 [JOMS AI] Starting update...'));

        const { performUpdate } = require('./src/Plugin/updater.js');

        try {
            const result = await performUpdate({ notifyOwner: null });

            if (result.success) {
                console.log(chalk.green('✓ [JOMS AI] Update completed successfully.'));
                console.log(chalk.cyan('🤖 [JOMS AI] Changes applied.'));
            } else {
                console.log(chalk.red('✘ [JOMS AI] Update failed:'), result.error);
            }
        } catch (err) {
            console.error(chalk.red('✘ [JOMS AI] Update error:'), err);
        }
    } else {
        console.log(chalk.gray('ⓘ Auto-update is disabled. Skipping.'));
    }

    // -------------------------------------------------------------------
    // 5. Load and start bot
    // -------------------------------------------------------------------
    console.log(chalk.cyan('🤖 [JOMS AI] Loading main bot...'));
    require('./⚉.js');
})();
