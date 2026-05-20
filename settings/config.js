// © 2026 CODY AI | Powered by CRYSNOVA AI V2 Technology
// Config reads from .env (primary) → getVar runtime (secondary) → defaults
//

const fs   = require('fs');
const path = require('path');
const { getVar } = require('../src/Plugin/configManager');

/*
──────────────────────────────────────────
Load User Config (optional JSON override)
──────────────────────────────────────────
*/
const USER_CONFIG_PATH = path.join(__dirname, '../database/user-config.json');
let userConfig = {};
try {
    if (fs.existsSync(USER_CONFIG_PATH)) {
        userConfig = JSON.parse(fs.readFileSync(USER_CONFIG_PATH, 'utf8'));
    }
} catch {}

/*
──────────────────────────────────────────
Auto-detect number from session creds
Priority:
  1. process.env (from .env file)
  2. getVar() runtime override (setvar command)
  3. user-config.json
  4. sessions/creds.json  ← auto after pairing
  5. Hardcoded fallback
──────────────────────────────────────────
*/
const getSessionNumber = () => {
    try {
        const credsPath = path.join(__dirname, '../sessions/creds.json');
        if (fs.existsSync(credsPath)) {
            const creds = JSON.parse(fs.readFileSync(credsPath, 'utf8'));
            const rawId = creds?.me?.id;
            if (rawId) return rawId.split(':')[0].split('@')[0];
        }
    } catch {}
    return null;
};

const defaultNumber = process.env.OWNER_NUMBER || '2347043550282';

const resolvedOwner =
    process.env.OWNER_NUMBER        ||
    getVar('OWNER_NUMBER')          ||
    userConfig?.owner?.number       ||
    getSessionNumber()              ||
    defaultNumber;

/*
──────────────────────────────────────────
Config (CODY AI structure + CRYSNOVA V2 fields)
──────────────────────────────────────────
*/
const config = {

    // ════════════════════════════════════════════
    // CODY IDENTITY
    // ════════════════════════════════════════════
    owner: resolvedOwner,

    botNumber:
        process.env.BOT_NUMBER       ||
        getVar('BOT_NUMBER')         ||
        userConfig?.bot?.number      ||
        getSessionNumber()           ||
        defaultNumber,

    session:
        process.env.SESSION_NAME     ||
        getVar('SESSION_NAME')       ||
        userConfig?.session          ||
        'sessions',

    thumbUrl:
        process.env.THUMB_URL        ||
        getVar('THUMB_URL')          ||
        userConfig?.thumbUrl         ||
        'https://cdn.crysnovax.link/files/1778529162616-eca99707-7b11-453a-802a-e85a9d1c2395.jpeg',

    // ════════════════════════════════════════════
    // PANEL CONNECTOR API (CODY → Main Bot)
    // ════════════════════════════════════════════
    panelApiUrl:
        process.env.PANEL_API_URL    ||
        getVar('PANEL_API_URL')      ||
        userConfig?.panelApiUrl      ||
        'http://localhost:9000',

    // ════════════════════════════════════════════
    // GITHUB (CODY → Repos)
    // ════════════════════════════════════════════
    github: {
        token:
            process.env.GITHUB_TOKEN     ||
            getVar('GITHUB_TOKEN')       ||
            userConfig?.github?.token    ||
            '',
        username:
            process.env.GITHUB_USERNAME  ||
            getVar('GITHUB_USERNAME')    ||
            userConfig?.github?.username ||
            'crysnovax',
        repos: [
            'crysnovax/CODY',
            'crysnovax/CRYSNOVA_AI'
        ],
        memoryRepo: 'crysnovax/CODY',
        memoryPath: 'memory'
    },

    // ════════════════════════════════════════════
    // BOT STATUS / MODE
    // ════════════════════════════════════════════
    status: {
        public:   process.env.PUBLIC_MODE   !== undefined ? process.env.PUBLIC_MODE   === 'false'  : (getVar('PUBLIC_MODE')   ?? userConfig?.bot?.public   ?? true),
        terminal: process.env.TERMINAL_MODE !== undefined ? process.env.TERMINAL_MODE !== 'false' : (getVar('TERMINAL_MODE') ?? userConfig?.bot?.terminal ?? true),
        reactsw:  process.env.REACT_STATUS  !== undefined ? process.env.REACT_STATUS  !== 'false' : (getVar('REACT_STATUS')  ?? userConfig?.bot?.reactsw  ?? true)
    },

    // ════════════════════════════════════════════
    // BOT MODE FLAGS
    // ════════════════════════════════════════════
    mode: {
        autoRead:      process.env.AUTO_READ      !== 'false',
        autoTyping:    process.env.AUTO_TYPING    === 'false',
        autoRecording: process.env.AUTO_RECORDING === 'true',
        alwaysOnline:  process.env.ALWAYS_ONLINE  !== 'true',
        selfBot:       process.env.SELF_BOT       === 'true'
    },

    // ════════════════════════════════════════════
    // SETTINGS
    // ════════════════════════════════════════════
    settings: {
        title:
            process.env.BOT_NAME         ||
            getVar('BOT_NAME')           ||
            userConfig?.bot?.name        ||
            'CODY AI',

        packname:
            process.env.BOT_NAME         ||
            getVar('BOT_NAME')           ||
            userConfig?.bot?.name        ||
            'CODY AI',

        prefix: (() => {
            const envPrefix = process.env.PREFIX;
            if (envPrefix !== undefined) {
                return (envPrefix === 'null' || envPrefix === '') ? '' : envPrefix;
            }

            const runtimePrefix = getVar('PREFIX');
            if (runtimePrefix !== undefined && runtimePrefix !== null) {
                return (runtimePrefix === 'null' || runtimePrefix === '') ? '' : runtimePrefix;
            }

            const userPrefix = userConfig?.bot?.prefix;
            if (userPrefix !== undefined && userPrefix !== null) {
                return (userPrefix === 'null' || userPrefix === '') ? '' : userPrefix;
            }

            return '.';
        })(),

        description: 'CODY AI — Autonomous Developer Assistant powered by CRYSNOVA AI V2',
        author:      'https://github.com/crysnovax/CODY',
        footer:      '© CODY AI | Powered by CRYSNOVA AI',

        ownerJid:
            getVar('OWNER_JID')          ||
            userConfig?.owner?.jid       ||
            `${resolvedOwner}@s.whatsapp.net`,

        ownerName:
            process.env.OWNER_NAME       ||
            getVar('OWNER_NAME')         ||
            userConfig?.owner?.name      ||
            'CRYSNOVA'
    },

    // ════════════════════════════════════════════
    // PERMISSIONS
    // ════════════════════════════════════════════
    permissions: {
        owners: process.env.OWNER_NUMBERS
            ? process.env.OWNER_NUMBERS.split(',').map(n => n.trim() + '@s.whatsapp.net')
            : [`${resolvedOwner}@s.whatsapp.net`],
        premium: [],
        banned: []
    },

    // ════════════════════════════════════════════
    // MESSAGES
    // ════════════════════════════════════════════
    message: {
        owner:   '`ⓘ OWNER ONLY 彡`',
        group:   '`⟁⃝GROUP ONLY!℘`',
        admin:   '`⚠︎ ADMIN ONLY! 𓃼`',
        private: 'ಠ_ಠ_*USE THIS IN DM*_ 𓀀'
    },

    mess: {
        owner: '`☠︎︎ OWNER ONLY!`',
        done:  '`㋛ Mode changed!!`',
        error: 'Something went wrong! ✘',
        wait:  '_Please wait... ⚉_'
    },

    // ════════════════════════════════════════════
    // AUTO REPLY
    // ════════════════════════════════════════════
    autoReply: {
        enabled: process.env.AUTO_REPLY !== 'false',
        ai: {
            enabled:   true,
            apiUrl:    process.env.AI_API_URL   || 'https://all-in-1-ais.officialhectormanuel.workers.dev/',
            model:     process.env.AI_MODEL     || 'gpt-4.5-preview',
            maxMemory: 10
        },
        greetings: {
            enabled:  true,
            keywords: ['hi', 'hello', 'hey', 'morning', 'afternoon', 'evening'],
            response: 'Hello! 👋 How can CODY AI help you today?'
        }
    },

    // ════════════════════════════════════════════
    // NEWSLETTER
    // ════════════════════════════════════════════
    newsletter: {
        name:
            process.env.BOT_NAME ||
            getVar('BOT_NAME')   ||
            'CODY AI',
        id: '120363402922206865@newsletter'
    },

    // ════════════════════════════════════════════
    // API KEYS
    // ════════════════════════════════════════════
    api: {
        baseurl:
            process.env.API_BASEURL  ||
            getVar('API_BASEURL')    ||
            'https://hector-api.vercel.app/',
        apikey:
            process.env.API_KEY      ||
            getVar('API_KEY')        ||
            'hector',
        groq:
            process.env.GROQ_API_KEY ||
            getVar('GROQ_API_KEY')   ||
            '',
        openai:
            process.env.OPENAI_API_KEY  ||
            getVar('OPENAI_API_KEY')    ||
            '',
        weather:
            process.env.WEATHER_API_KEY ||
            getVar('WEATHER_API_KEY')   ||
            'e6926030169752d7e0d85377e489c415',
        
        gateway:
            process.env.GATEWAY_URL     ||
            getVar('GATEWAY_URL')       ||
            'https://api.crysnovax.link',
        gatewayToken:
            process.env.GATEWAY_TOKEN   ||
            getVar('GATEWAY_TOKEN')     ||
            'x',

        cdn:
            process.env.CDN_URL         ||
            getVar('CDN_URL')           ||
            'https://cdn.crysnovax.link',
        imageBase:
            process.env.IMAGE_API_BASE  ||
            getVar('IMAGE_API_BASE')    ||
            'https://apis.prexzyvilla.site/ai',
        removebg:
            process.env.REMOVE_BG_API_KEY ||
            getVar('REMOVE_BG_API_KEY')   ||
            'fy5Va5Qivw2BUQoojeSzzcHp'
    },

    // ════════════════════════════════════════════
    // STICKER
    // ════════════════════════════════════════════
    sticker: {
        packname:
            process.env.BOT_NAME         ||
            getVar('BOT_NAME')           ||
            'CODY AI',
        author:
            process.env.STICKER_AUTHOR   ||
            getVar('STICKER_AUTHOR')     ||
            'CODY AI'
    },

    // ════════════════════════════════════════════
    // BRANDING
    // ════════════════════════════════════════════
    branding: {
        footer:  '© CODY AI | Powered by CRYSNOVA AI',
        channel: 'https://whatsapp.com/channel/0029Vb6pe77K0IBn48HLKb38',
        group:   process.env.GROUP_LINK || 'https://chat.whatsapp.com/Besbj8VIle1GwxKKZv1lax',
        repo:    'https://github.com/crysnovax/CODY'
    },

    // ════════════════════════════════════════════
    // LOGGING
    // ════════════════════════════════════════════
    logging: {
        level:       process.env.LOG_LEVEL || 'silent',
        logCommands: true,
        logMessages: false
    },

    // ════════════════════════════════════════════
    // STATUS HANDLER SETTINGS
    // ════════════════════════════════════════════
    statusHandler: {
        autoView:
            process.env.AUTO_STATUS_VIEW !== undefined
                ? process.env.AUTO_STATUS_VIEW !== 'false'
                : (getVar('AUTO_STATUS_VIEW') ?? true),

        autoLike:
            process.env.AUTO_STATUS_LIKE !== undefined
                ? process.env.AUTO_STATUS_LIKE !== 'false'
                : (getVar('AUTO_STATUS_LIKE') ?? true),

        statusEmoji:
            process.env.STATUS_EMOJI     ||
            getVar('STATUS_EMOJI')       ||
            '❤️‍🔥',

        ghostMode:
            process.env.GHOST_MODE !== undefined
                ? process.env.GHOST_MODE !== 'false'
                : (getVar('GHOST_MODE') ?? false)
    }
};

module.exports = config;
