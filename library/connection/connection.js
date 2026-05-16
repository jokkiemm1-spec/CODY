/**
 * CODY AI — Connection Manager
 * Supports Mega session storage
 */

import {
    default as makeWASocket,
    useMultiFileAuthState,
    fetchLatestBaileysVersion,
    Browsers,
    DisconnectReason
} from '@crysnovax/baileys';
import { Boom } from '@hapi/boom';
import pino from 'pino';
import fs from 'fs-extra';
import path from 'path';
import zlib from 'zlib';
import { downloadSession } from './mega.js';

const SESSION_PATH = './sessions';

async function getAuthState() {
    if (!fs.existsSync(SESSION_PATH)) {
        fs.mkdirSync(SESSION_PATH, { recursive: true });
    }
    return await useMultiFileAuthState(SESSION_PATH);
}

/**
 * Decode SESSION_ID — supports:
 * - Plain base64
 * - Gzip-compressed
 * - Mega short ID (CODY_AI!M:xxxx)
 */
async function decodeSession(sessionId) {
    if (!sessionId || typeof sessionId !== 'string') return false;

    // ── MEGA SHORT ID ──
    if (sessionId.startsWith('CODY_AI!M:')) {
        const shortId = sessionId.replace('CODY_AI!M:', '');
        console.log('📦 Fetching session from Mega using ID:', shortId);
        try {
            const sessionJson = await downloadSession(shortId);
            const creds = JSON.parse(sessionJson);
            
            if (!fs.existsSync(SESSION_PATH)) {
                fs.mkdirSync(SESSION_PATH, { recursive: true });
            }
            
            fs.writeFileSync(
                path.join(SESSION_PATH, 'creds.json'),
                JSON.stringify(creds, null, 2)
            );
            
            console.log('✅ Session restored from Mega');
            return true;
        } catch (err) {
            console.log('❌ Failed to fetch from Mega:', err.message);
            return false;
        }
    }

    // ── BASE64 / COMPRESSED SESSION ──
    let base64 = sessionId.trim();
    if (base64.includes('!')) {
        base64 = base64.split('!').pop();
    }

    try {
        let decoded;
        const buffer = Buffer.from(base64, 'base64');

        if (buffer[0] === 0x1f && buffer[1] === 0x8b) {
            decoded = zlib.gunzipSync(buffer).toString('utf8');
            console.log('📦 Detected gzip-compressed session');
        } else {
            decoded = buffer.toString('utf8');
        }

        const creds = JSON.parse(decoded);
        if (!creds.noiseKey && !creds.me) {
            throw new Error('Invalid creds format');
        }

        if (!fs.existsSync(SESSION_PATH)) {
            fs.mkdirSync(SESSION_PATH, { recursive: true });
        }

        fs.writeFileSync(
            path.join(SESSION_PATH, 'creds.json'),
            JSON.stringify(creds, null, 2)
        );

        console.log('🔐 Session restored successfully');
        return true;
    } catch (err) {
        console.log('❌ Failed to decode session:', err.message);
        return false;
    }
}

function encodeSession() {
    try {
        const credsPath = path.join(SESSION_PATH, 'creds.json');
        if (!fs.existsSync(credsPath)) return null;
        const creds = fs.readFileSync(credsPath, 'utf8');
        return `CODY_AI!${Buffer.from(creds).toString('base64')}`;
    } catch (err) {
        console.log('❌ Failed to encode session:', err.message);
        return null;
    }
}

function hasLocalSession() {
    return fs.existsSync(path.join(SESSION_PATH, 'creds.json'));
}

async function createSocket(sessionId) {
    if (sessionId && !hasLocalSession()) {
        console.log('🔑 No local session. Attempting SESSION_ID restore...');
        const restored = await decodeSession(sessionId);
        if (!restored) {
            console.log('⚠️ SESSION_ID invalid. Requesting fresh pair code / QR.');
        }
    }

    const { state, saveCreds } = await getAuthState();
    const { version, isLatest } = await fetchLatestBaileysVersion();

    console.log(`📦 Baileys v${version.join('.')} (latest: ${isLatest})`);

    const sock = makeWASocket({
        version,
        logger: pino({ level: 'silent' }),
        printQRInTerminal: !hasLocalSession(),
        auth: state,
        browser: Browsers.macOS('Chrome'),
        generateHighQualityLinkPreview: true,
        syncFullHistory: false,
        markOnlineOnConnect: true,
        keepAliveIntervalMs: 30000,
        connectTimeoutMs: 60000,
        defaultQueryTimeoutMs: 60000,
        shouldSyncHistoryMessage: () => false,
        getMessage: null // Removed fallback to prevent "CRYSNOVA AI" spam
    });

    return { sock, saveCreds, state };
}

async function clearSession() {
    try {
        await fs.remove(SESSION_PATH);
        console.log('🗑️ Session cleared.');
    } catch (err) {
        console.log('❌ Failed to clear session:', err.message);
    }
}

const konek = async ({ sock, update, clientstart, DisconnectReason, Boom }) => {
    const { connection, lastDisconnect } = update;
    if (connection === 'close') {
        const reason = new Boom(lastDisconnect?.error)?.output.statusCode;

        if (reason === DisconnectReason.loggedOut) {
            console.log('🚫 Logged out. Delete sessions folder and restart.');
            process.exit(1);
        }
        if (reason === DisconnectReason.connectionReplaced) {
            console.log('⚠️ Connection replaced. Exiting...');
            process.exit(1);
        }
        if (reason === DisconnectReason.badSession) {
            console.log('❌ Bad session. Delete sessions folder and re-pair.');
            process.exit(1);
        }
        console.log(`🔄 Disconnected (code: ${reason}) — reconnecting in 3s...`);
    } else if (connection === 'open') {
        console.log('✓ Bot connected successfully');
    }
};

export {
    createSocket,
    getAuthState,
    decodeSession,
    encodeSession,
    hasLocalSession,
    clearSession,
    konek,
    SESSION_PATH
};
