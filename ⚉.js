/**
 * ╔══════════════════════════════════════════════════╗
 * ║   CODY AI — Powered by CRYSNOVA AI               ║
 * ║   Professional WhatsApp Bot Engine               ║
 * ║   All rights reserved                            ║
 * ╚══════════════════════════════════════════════════╝
 */

require('dotenv').config();

const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const readline = require('readline');
const fs = require('fs');
const chalk = require('chalk');
const { Boom } = require('@hapi/boom');
const { jidDecode, downloadContentFromMessage } = require('@crysnovax/baileys');

// ── CRYSNOVA Internals ──
const { smsg } = require('./library/serialize');
const { konek, createSocket, hasLocalSession } = require('./library/connection/connection');
const { loadCommands } = require('./src/Plugin/crysLoadCmd');
const { handleMessage } = require('./src/Plugin/crysMsg');
const { crysStatistic } = require('./src/Plugin/crysStatistic');
const setupMessageHandler = require('./?.js');
const { sendConnectedMessage, setupGroupEvents } = require('./library/C2582');

const config = require('./settings/config');
const app = express();
const port = process.env.PORT || 3000;
const server = http.createServer(app);
const io = socketIo(server);

// ── Express Static Panel ──
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.resolve(__dirname, 'Public')));
app.get('/', (_, res) => res.sendFile(path.resolve(__dirname, 'Public/index.html')));

// ── Globals ──
global.crysStats = { messages: 0, commands: 0, startTime: Date.now(), uptime: 0 };
global.botInstances = global.botInstances || new Map();
global.onlineUsers = global.onlineUsers || new Set();
if (!global.store) global.store = new Map();

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
    console.log(chalk.green(`
  ██████╗ ██████╗ ██████╗ ██╗   ██╗     █████╗ ██╗
 ██╔════╝██╔═══██╗██╔══██╗╚██╗ ██╔╝    ██╔══██╗██║
 ██║     ██║   ██║██║  ██║ ╚████╔╝      ███████║██║
 ██║     ██║   ██║██║  ██║  ╚██╔╝      ██╔══██║██║
 ╚██████╗╚██████╔╝██████╔╝   ██║       ██║  ██║██║
  ╚═════╝ ╚═════╝ ╚═════╝    ╚═╝       ╚═╝  ╚═╝╚═╝
    `));
    console.log(chalk.yellow.bold('  𝗖𝗢𝗗𝗬 𝗔𝗜 — Powered by 𝗖𝗥𝗬𝗦𝗡𝗢𝗩𝗔 𝗔𝗜'));
    console.log(chalk.white.bold('  Professional WhatsApp Bot v2.0.0'));
    console.log(chalk.gray('  ⚡ Advanced Features | 24/7 Uptime | Multi-Device'));
    console.log(chalk.cyan('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n'));
};

const question = (text) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    return new Promise(resolve => rl.question(chalk.yellow(text), ans => { resolve(ans); rl.close(); }));
};

// ════════════════════════════════════════
//  clientstart — CODY AI Socket
// ════════════════════════════════════════
const clientstart = async () => {
    showBanner();

    // ── In-Memory Store ──
    const customStore = {
        messages: new Map(),
        contacts: new Map(),
        groupMetadata: new Map(),
        presences: {},
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

    // ── SESSION_ID from env ──
    const sessionId = process.env.SESSION_ID || config.session || '';
    const { sock, saveCreds, state } = await createSocket(sessionId);

    // ── Pair Code Prompt ──
    if (!state.creds?.registered && !hasLocalSession()) {
        await new Promise(r => setTimeout(r, 800));
        console.log(chalk.yellow('\n╔════════════════════════════════════════╗'));
        console.log(chalk.yellow('║        CODY AI — PAIRING MODE          ║'));
        console.log(chalk.yellow('╚════════════════════════════════════════╝\n'));
        
        const num = await question('Enter your WhatsApp number (without +):\n📱 Number → ');
        const cleaned = num.replace(/[^0-9]/g, '').trim();
        
        if (cleaned.length >= 10) {
            console.log(chalk.yellow('\n⏳ Requesting pairing code...'));
            try {
                const code = await sock.requestPairingCode(cleaned, 'CODY');
                console.log(chalk.green('\n╔════════════════════════════════════════╗'));
                console.log(chalk.green('║         🔐 YOUR PAIRING CODE           ║'));
                console.log(chalk.bold.yellow(`║           ${code}                      ║`));
                console.log(chalk.green('╠════════════════════════════════════════╣'));
                console.log(chalk.white('║  1. Open WhatsApp on your phone        ║'));
                console.log(chalk.white('║  2. Settings → Linked Devices          ║'));
                console.log(chalk.white('║  3. Tap "Link a Device"                ║'));
                console.log(chalk.white('║  4. Enter the code above               ║'));
                console.log(chalk.green('╚════════════════════════════════════════╝\n'));
            } catch (err) {
                console.log(chalk.red(`✘ Pair code failed: ${err.message}`));
            }
        }
    }

    // ── Bind Store ──
    customStore.bind(sock.ev);
    sock.store = customStore;

    // ── Track Instance ──
    const instanceId = sock.user?.id?.split(':')[0] || Date.now().toString();
    global.botInstances.set(instanceId, sock);

    // ── Utility Helpers ──
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

    // ── Creds Update ──
    sock.ev.on('creds.update', saveCreds);

    // ── Connection Update ──
    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect } = update;

        if (connection === 'connecting')
            console.log(chalk.yellow('🔄 Connecting to WhatsApp...'));

        if (connection === 'open') {
            console.log(chalk.bold.green('\n✅ Successfully connected!'));
            console.log(chalk.yellow(`📱 Bot Number: ${sock.user?.id?.split(':')[0]}`));
            console.log(chalk.yellow(`🌐 Dashboard: http://localhost:${port}\n`));

            io.emit('bot-status', {
                status: 'connected',
                number: sock.user?.id?.split(':')[0],
                name: sock.user?.name
            });

            // ── Send Connected Message to Owner ──
            await sendConnectedMessage(sock, config, port);
        }

        if (connection === 'close') {
            const statusCode = lastDisconnect?.error?.output?.statusCode;
            console.log(chalk.red(`❌ Connection closed [${statusCode}]`));
            global.botInstances.delete(instanceId);

            try { konek({ sock, update, clientstart, DisconnectReason: require('@crysnovax/baileys').DisconnectReason, Boom }); } catch {}

            const { DisconnectReason: DR } = require('@crysnovax/baileys');
            if (statusCode !== DR.loggedOut && statusCode !== DR.connectionReplaced && statusCode !== DR.badSession) {
                console.log(chalk.yellow('🔄 Reconnecting in 3 seconds...'));
                setTimeout(clientstart, 3000);
            }
        }
    });

    // ── Setup Message Handler ──
    setupMessageHandler(sock, customStore, handleMessage, smsg, io, config);

    // ── Setup Group Events (Welcome/Goodbye) ──
    await setupGroupEvents(sock, ignoredErrors);

    // ── Contacts Update ──
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
        // ── Ensure Directories ──
        if (!fs.existsSync('./database')) fs.mkdirSync('./database', { recursive: true });
        if (!fs.existsSync('./sessions')) fs.mkdirSync('./sessions', { recursive: true });
        if (!fs.existsSync('./database/antilink.json')) fs.writeFileSync('./database/antilink.json', '{}');
        if (!fs.existsSync('./database/groupEvents.json')) fs.writeFileSync('./database/groupEvents.json', '{}');
        if (!fs.existsSync('./database/runtime-config.json')) fs.writeFileSync('./database/runtime-config.json', '{}');

        // ── Load Commands ──
        loadCommands();

        // ── Start Server ──
        server.listen(port, () => {
            console.log(chalk.green(`✅ Dashboard: http://localhost:${port}`));
        });

        // ── Statistics ──
        crysStatistic(app, io);

        // ── Socket.IO ──
        io.on('connect', (socket) => {
            console.log(chalk.yellow('👤 Dashboard connected'));
            socket.emit('stats', global.crysStats);
            socket.on('disconnect', () => console.log(chalk.red('👤 Dashboard disconnected')));
        });

        // ── Start Bot ──
        await clientstart();
    } catch (err) {
        console.error(chalk.red('❌ Startup error:'), err);
        process.exit(1);
    }
})();

// ── Error Guards ──
process.on('unhandledRejection', err => {
    if (ignoredErrors.some(e => String(err).includes(e))) return;
    console.log('Unhandled Rejection:', err);
});

const origErr = console.error;
console.error = function (msg, ...rest) {
    if (typeof msg === 'string' && ignoredErrors.some(e => msg.includes(e))) return;
    origErr.apply(console, [msg, ...rest]);
};
