/**
 * ⚉.js  —  CRYSNOVA AI  (clean rewrite of obfuscated startup block)
 * Drop-in for #U2689.js  —  all external wiring preserved
 */

require('dotenv').config();

const express   = require('express');
const http      = require('http');
const socketIo  = require('socket.io');
const path      = require('path');
const readline  = require('readline');
const fs        = require('fs');
const chalk     = require('chalk');
const pino      = require('pino');
const { Boom }  = require('@hapi/boom');

const {
    jidDecode,
    downloadContentFromMessage
} = require('@crysnovax/baileys');

// ── CRYSNOVA internals (unchanged) ──
const { smsg }              = require('./library/serialize');
const { konek, createSocket, hasLocalSession } = require('./library/connection/connection');
const { loadCommands }      = require('./src/Plugin/crysLoadCmd');
const { handleMessage }     = require('./src/Plugin/crysMsg');
const { crysStatistic }     = require('./src/Plugin/crysStatistic');
const setupMessageHandler   = require('./?.js');            // CRYSNOVA message router

const config    = require('./settings/config');
const app       = express();
const port      = process.env.PORT || 3000;
const server    = http.createServer(app);
const io        = socketIo(server);

// ── Express static panel ──
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.resolve(__dirname, 'Public')));
app.get('/', (_, res) => res.sendFile(path.resolve(__dirname, 'Public/index.html')));

// ── Globals ──
global.crysStats    = { messages: 0, commands: 0, startTime: Date.now(), uptime: 0 };
global.botInstances = global.botInstances || new Map();
global.onlineUsers  = global.onlineUsers  || new Set();
if (!global.store)  global.store = new Map();

const ignoredErrors = [
    'Socket connection timeout', 'EKEYTYPE', 'item-not-found',
    'rate-overlimit', 'Connection Closed', 'Timed Out', 'Value not found',
    'Bad MAC', 'decrypt error', 'Socket closed', 'Session closed',
    'Connection terminated', 'read ECONNRESET', 'write ECONNRESET',
    'ECONNREFUSED', 'connect ETIMEDOUT', 'network timeout'
];

// ── Banner ──
const showBanner = () => {
    console.clear();
    console.log(chalk.cyan(`
    ╔═══════════════════════════════════╗
    ║  ██████╗██████╗ ██╗   ██╗███████╗║
    ║ ██╔════╝██╔══██╗╚██╗ ██╔╝██╔════╝║
    ║ ██║     ██████╔╝ ╚████╔╝ ███████╗ ║
    ║ ██║     ██╔══██╗  ╚██╔╝  ╚════██║║
    ║ ╚██████╗██║  ██║   ██║   ███████║║
    ║  ╚═════╝╚═╝  ╚═╝   ╚═╝   ╚══════╝║
    ╚═══════════════════════════════════╝
    `));
    console.log(chalk.yellow.bold('  𝗖𝗥𝗬𝗦𝗡𝗢𝗩𝗔 𝗔𝗜 Engine + Core'));
    console.log(chalk.white.bold('  Professional WhatsApp Bot v2.0.0'));
    console.log(chalk.gray('  Powered by 𝗖𝗥𝗬𝗦𝗡𝗢𝗩𝗔 𝗔𝗜 V2 Technology'));
    console.log(chalk.cyan('━━━━━━━━━━━━━━━━━━━━━'));
};

const question = (text) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    return new Promise(resolve => rl.question(chalk.yellow(text), ans => { resolve(ans); rl.close(); }));
};

// ════════════════════════════════════════
//  clientstart — CODY-style clean socket
// ════════════════════════════════════════
const clientstart = async () => {
    showBanner();

    // ── In-memory store (mirrors CRYSNOVA original) ──
    const customStore = {
        messages:      new Map(),
        contacts:      new Map(),
        groupMetadata: new Map(),
        presences:     {},
        loadMessage: async (remoteJid, id) =>
            customStore.messages.get(remoteJid + ':' + id) || null,
        bind: (ev) => {
            ev.on('messages.upsert', ({ messages }) => {
                for (const msg of messages) {
                    if (msg.key?.remoteJid && msg.key?.id)
                        customStore.messages.set(msg.key.remoteJid + ':' + msg.key.id, msg);
                }
            });
            ev.on('contacts.update', updates => {
                for (const u of updates) {
                    if (u.id) customStore.contacts.set(u.id, u);
                }
            });
        }
    };

    // ── SESSION_ID from env → decode before socket opens ──
    const sessionId = process.env.SESSION_ID || config.session || '';
    const { sock, saveCreds, state } = await createSocket(sessionId);

    // ── Pair code prompt (only when no session exists) ──
    if (!state.creds?.registered && !hasLocalSession()) {
        await new Promise(r => setTimeout(r, 800));
        console.log(chalk.yellow('\n╔════════════════════════════════════════╗'));
        console.log(chalk.yellow('║       CRYSNOVA AI — PAIRING MODE       ║'));
        console.log(chalk.yellow('╚════════════════════════════════════════╝'));
        const num = await question('Enter your WhatsApp number (without +):\nNumber → ');
        const cleaned = num.replace(/[^0-9]/g, '').trim();
        if (cleaned.length >= 10) {
            console.log(chalk.yellow('\n⏳ Requesting pairing code...'));
            try {
                const code = await sock.requestPairingCode(cleaned, 'CRYSNOVA');
                console.log(chalk.green('\n╔════════════════════════════════════════╗'));
                console.log(chalk.green('║       𝐘𝐨𝐮𝐫 𝐏𝐚𝐢𝐫𝐢𝐧𝐠 𝐂𝐨𝐝𝐞:             ║'));
                console.log(chalk.bold.yellow(`║         ${code}                   ║`));
                console.log(chalk.green('╠════════════════════════════════════════╣'));
                console.log(chalk.white('║  1. Open WhatsApp on your phone        ║'));
                console.log(chalk.white('║  2. Settings > Linked Devices          ║'));
                console.log(chalk.white('║  3. Tap "Link a Device"                ║'));
                console.log(chalk.white('║  4. Enter the code above               ║'));
                console.log(chalk.green('╚════════════════════════════════════════╝\n'));
            } catch (err) {
                console.log(chalk.red(`✘ Pair code failed: ${err.message}`));
            }
        }
    }

    // Bind store to socket events
    customStore.bind(sock.ev);
    sock.store = customStore;

    // Track instance
    const instanceId = sock.user?.id?.split(':')[0] || Date.now().toString();
    global.botInstances.set(instanceId, sock);

    // Utility helpers (keep parity with original obfuscated code)
    sock.decodeJid = (jid) => {
        if (!jid) return jid;
        if (/:\d+@/gi.test(jid)) {
            const decoded = jidDecode(jid) || {};
            return decoded.user && decoded.server ? `${decoded.user}@${decoded.server}` : jid;
        }
        return jid;
    };
    sock.public = config.status?.public ?? true;
    sock.downloadMediaMessage = async (msg) => {
        let mtype = (msg.message || msg)?.mimetype || '';
        let msgtype = msg.mtype ? msg.mtype.replace(/Message/gi, '') : mtype.split('/')[0];
        const stream = await downloadContentFromMessage(msg, msgtype);
        let buffer = Buffer.from([]);
        for await (const chunk of stream) buffer = Buffer.concat([buffer, chunk]);
        return buffer;
    };
    sock.sendText = async (jid, text, quoted = '', opts = {}) =>
        sock.sendMessage(jid, { text, ...opts }, { quoted });

    // ── creds.update ──
    sock.ev.on('creds.update', saveCreds);

    // ── connection.update — CODY-style reconnect logic ──
    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect } = update;

        if (connection === 'connecting')
            console.log(chalk.yellow('🔄 Connecting...'));

        if (connection === 'open') {
            console.log(chalk.bold.green('✅ Successfully connected to bot'));
            console.log(chalk.yellow(`📱 Number: ${sock.user?.id?.split(':')[0]}`));
            console.log(chalk.yellow(`🌐 Dashboard: http://localhost:${port}\n`));

            io.emit('bot-status', {
                status:  'connected',
                number:  sock.user?.id?.split(':')[0],
                name:    sock.user?.name
            });

            // ── Online notification to owner (preserve CRYSNOVA style) ──
            const ownerJid = `${config.owner}@s.whatsapp.net`;
            const groupLink = config.branding?.group || 'https://chat.whatsapp.com/Besbj8VIle1GwxKKZv1lax';
            const thumbUrl  = config.thumbUrl || 'https://files.catbox.moe/z2rqc1.jpg';

            try {
                console.log(chalk.green('✅ Using fixed channel image URL'));
                await sock.sendMessage(ownerJid, {
                    image: { url: thumbUrl },
                    caption:
                        `亗 *${config.settings?.title || 'CRYSNOVA AI'}* is Online!\n\n` +
                        `❏▸ ⟁⃝𓋎 User⇆ ${sock.user?.name || 'Unknown'}\n` +
                        `❏▸⁠ 彡 Prefix⇆ [ ${config.settings?.prefix || '.'} ]\n` +
                        `❏▸ ⎔ Mode⇆ ${config.status?.public ? 'Public' : 'Private'}\n` +
                        `❏▸ ⓘ Version⇆ CRYSNOVA AI V2\n` +
                        `❏▸ ℘ Owner⇆ ${config.settings?.ownerName || '₵ⱤɎ₴₦☠︎︎V₳'}\n\n` +
                        `💫 GROUP: ${groupLink}\n\n` +
                        `\`×͜× BOT IS LIVE! ✧\``,
                    contextInfo: {
                        isForwarded: true,
                        forwardedNewsletterMessageInfo: {
                            newsletterJid:   '120363402922206865@newsletter',
                            newsletterName:  '𝓬𝓻𝔂𝓼𝓷𝓸𝓿𝓪𝔁 𝓿𝓮𝓻𝓲𝓯𝓲𝓮𝓭\n',
                            serverMessageId: 1
                        },
                        externalAdReply: {
                            title:               config.settings?.title || 'CRYSNOVA AI',
                            body:                '𝓬𝓻𝔂𝓼𝓷𝓸𝓿𝓪𝔁 𝓿𝓮𝓻𝓲𝓯𝓲𝓮𝓭',
                            sourceUrl:           'https://whatsapp.com/channel/0029Vb6pe77K0IBn48HLKb38',
                            thumbnailUrl:        thumbUrl,
                            mediaType:           1,
                            renderLargerThumbnail: false,
                            showAdAttribution:   true
                        }
                    }
                });
                console.log(chalk.green('✅ Connected message sent!'));
            } catch (e) {
                console.log(chalk.red('[Connected msg failed]'), e.message);
            }
        }

        if (connection === 'close') {
            const statusCode = lastDisconnect?.error?.output?.statusCode;
            console.log(chalk.red('❌ Connection closed:'), statusCode);
            global.botInstances.delete(instanceId);

            // konek handles loggedOut / badSession / connectionReplaced exits
            try { konek({ sock, update, clientstart, DisconnectReason: require('@crysnovax/baileys').DisconnectReason, Boom }); } catch {}

            // For all other codes, reconnect (CODY pattern — no double-instance risk)
            const { DisconnectReason: DR } = require('@crysnovax/baileys');
            if (
                statusCode !== DR.loggedOut &&
                statusCode !== DR.connectionReplaced &&
                statusCode !== DR.badSession
            ) {
                console.log(chalk.yellow('🔄 Reconnecting in 3 seconds...'));
                setTimeout(clientstart, 3000);
            }
        }
    });

    // ── Setup CRYSNOVA message handler (unchanged) ──
    setupMessageHandler(sock, customStore, handleMessage, smsg, io, config);

    // ── Group participant events (preserve CRYSNOVA original) ──
    sock.ev.on('group-participants.update', async (update) => {
        try {
            const evDBPath = path.join(process.cwd(), 'database/groupEvents.json');
            if (!fs.existsSync(evDBPath)) return;
            const evDB = JSON.parse(fs.readFileSync(evDBPath, 'utf8'));
            if (!evDB[update.id]?.enabled) return;
            const meta    = await sock.groupMetadata(update.id);
            const count   = meta.participants.length;
            const subject = meta.subject;
            for (const participant of update.participants) {
                const jid = typeof participant === 'string' ? participant : participant.id;
                if (update.action === 'add') {
                    let pp;
                    try { pp = await sock.profilePictureUrl(jid, 'image'); }
                    catch { pp = 'https://cdn.crysnovax.link/files/1778081622443-1fb0df4f-b4c4-4bec-b842-597e6b332e72.jpeg'; }
                    await sock.sendMessage(update.id, {
                        image:    { url: pp },
                        caption:  `❏┃ Welcome to *${subject}*!\n` +
                                  `❏┃ Hello @${jid.split('@')[0]}!\n` +
                                  `❏┃ Members: ${count}\n` +
                                  `❏┃ ${evDB[update.id].welcome || 'Welcome to the group!'}\n\n` +
                                  `👋 @${jid.split('@')[0]}`,
                        mentions: [jid]
                    });
                }
                if (update.action === 'remove') {
                    await sock.sendMessage(update.id, {
                        text:     `👋 @${jid.split('@')[0]} left *${subject}*\n` +
                                  `❏┃ ${evDB[update.id].goodbye || 'Goodbye!'}\n` +
                                  `❏┃ Members: ${count}`,
                        mentions: [jid]
                    });
                }
            }
        } catch (e) {
            if (!ignoredErrors.some(ie => e.message?.includes(ie)))
                console.log('[Group Events Error]', e.message);
        }
    });

    // ── contacts.update ──
    sock.ev.on('contacts.update', updates => {
        for (const u of updates) {
            customStore.contacts.set(u.id, { id: u.id, name: u.notify || u.name || null });
        }
    });

    return sock;
};

// ════════════════════════════════════════
//  Bootstrap
// ════════════════════════════════════════
(async () => {
    try {
        if (!fs.existsSync('./database'))         fs.mkdirSync('./database',  { recursive: true });
        if (!fs.existsSync('./sessions'))         fs.mkdirSync('./sessions',  { recursive: true });
        if (!fs.existsSync('./database/antilink.json'))      fs.writeFileSync('./database/antilink.json', '{}');
        if (!fs.existsSync('./database/groupEvents.json'))   fs.writeFileSync('./database/groupEvents.json', '{}');
        if (!fs.existsSync('./database/runtime-config.json'))fs.writeFileSync('./database/runtime-config.json', '{}');

        loadCommands();

        server.listen(port, () => {
            console.log(chalk.green(`✅ Dashboard: http://localhost:${port}`));
        });

        crysStatistic(app, io);

        io.on('connect', (socket) => {
            console.log(chalk.yellow('👤 Dashboard connected'));
            socket.emit('stats', global.crysStats);
            socket.on('disconnect', () => console.log(chalk.red('👤 Dashboard disconnected')));
        });

        await clientstart();
    } catch (err) {
        console.error(chalk.red('Startup error:'), err);
        process.exit(1);
    }
})();

// ── Error guards ──
process.on('unhandledRejection', err => {
    if (ignoredErrors.some(e => String(err).includes(e))) return;
    console.log('Unhandled Rejection:', err);
});
const origErr = console.error;
console.error = function (msg, ...rest) {
    if (typeof msg === 'string' && ignoredErrors.some(e => msg.includes(e))) return;
    origErr.apply(console, [msg, ...rest]);
};
