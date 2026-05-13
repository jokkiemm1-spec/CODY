/**
 * ╔══════════════════════════════════════════════════╗
 * ║   C2582.js — CODY AI Event Handlers              ║
 * ║   Connection Success Message & Group Events      ║
 * ║   Powered by CRYSNOVA AI                         ║
 * ╚══════════════════════════════════════════════════╝
 */

const fs = require('fs');
const path = require('path');
const chalk = require('chalk');

// Default images
const DEFAULT_WELCOME_IMG = 'https://cdn.crysnovax.link/files/1778081622443-1fb0df4f-b4c4-4bec-b842-597e6b332e72.jpeg';
const DEFAULT_GOODBYE_IMG = 'https://cdn.crysnovax.link/files/1778081622443-1fb0df4f-b4c4-4bec-b842-597e6b332e72.jpeg';

// ── Send Connected Message to Owner ──
const sendConnectedMessage = async (sock, config, port) => {
    const ownerJid = `${config.owner}@s.whatsapp.net`;
    const groupLink = config.branding?.group || 'https://chat.whatsapp.com/Besbj8VIle1GwxKKZv1lax';
    const thumbUrl = config.thumbUrl || 'https://files.catbox.moe/z2rqc1.jpg';

    try {
        await sock.sendMessage(ownerJid, {
            image: { url: thumbUrl },
            caption:
                `𓂋⃝⃟⃟⃝⃪⃔ *${config.settings?.title || 'CODY AI'}* ×͜×☠︎︎ ONLINE\n\n` +
                `❏▸ ⟁⃝𓋎 User ⇆ ${sock.user?.name || 'CODY AI'}\n` +
                `❏▸ 彡 Prefix ⇆ [ ${config.settings?.prefix || '.'} ]\n` +
                `❏▸ ⎔ Mode ⇆ ${config.status?.public ? 'Public' : 'Private'}\n` +
                `❏▸ ⓘ Version ⇆ CODY AI v2.0.0\n` +
                `❏▸ ℘ Owner ⇆ ${config.settings?.ownerName || 'CRYSNOVA'}\n` +
                `❏▸ 🌐 Dashboard ⇆ http://localhost:${port}\n\n` +
                `💫 JOIN GROUP: ${groupLink}\n\n` +
                `⃠⃝⃪⃔⃕ *BOT IS LIVE!* ✧\n` +
                `𓋴 Type *${config.settings?.prefix || '.'}menu* to get started`,
            contextInfo: {
                isForwarded: true,
                forwardingScore: 999,
                externalAdReply: {
                    title: config.settings?.title || 'CODY AI',
                    body: '⚡ Powered by CRYSNOVA AI',
                    sourceUrl: 'https://whatsapp.com/channel/0029Vb6pe77K0IBn48HLKb38',
                    thumbnailUrl: thumbUrl,
                    mediaType: 1,
                    renderLargerThumbnail: false,
                    showAdAttribution: true
                }
            }
        });
        console.log(chalk.green('✅ Connected message sent to owner'));
    } catch (e) {
        console.log(chalk.red('[Connected msg failed]'), e.message);
    }
};

// ── Get Group Profile Picture ──
const getGroupProfilePic = async (sock, groupId) => {
    try {
        const ppUrl = await sock.profilePictureUrl(groupId, 'image');
        return ppUrl;
    } catch (err) {
        return DEFAULT_WELCOME_IMG;
    }
};

// ── Get User Profile Picture ──
const getUserProfilePic = async (sock, userId) => {
    try {
        const ppUrl = await sock.profilePictureUrl(userId, 'image');
        return ppUrl;
    } catch (err) {
        return DEFAULT_WELCOME_IMG;
    }
};

// ── Setup Group Welcome/Goodbye Events ──
const setupGroupEvents = async (sock, ignoredErrors = []) => {
    sock.ev.on('group-participants.update', async (update) => {
        try {
            const evDBPath = path.join(process.cwd(), 'database/groupEvents.json');
            if (!fs.existsSync(evDBPath)) return;
            
            const evDB = JSON.parse(fs.readFileSync(evDBPath, 'utf8'));
            if (!evDB[update.id]?.enabled) return;
            
            const meta = await sock.groupMetadata(update.id);
            const count = meta.participants.length;
            const subject = meta.subject;
            
            // Get group profile picture for background
            const groupPic = await getGroupProfilePic(sock, update.id);
            
            for (const participant of update.participants) {
                const jid = typeof participant === 'string' ? participant : participant.id;
                const jidNum = jid.split('@')[0];
                
                // Get user profile picture
                const userPic = await getUserProfilePic(sock, jid);
                
                // ── WELCOME MESSAGE ──
                if (update.action === 'add') {
                    const welcomeMsg = evDB[update.id].welcome || 'Welcome to the group!';
                    
                    await sock.sendMessage(update.id, {
                        image: { url: userPic || groupPic },
                        caption: `┏━〔 ✦𓂋⃝⃟⃟⃝⃪⃔ *WELCOME* 〕━\n\n` +
                                 `❏┃ @${jidNum}\n` +
                                 `❏┃ ⓘ Joined *${subject}*\n` +
                                 `❏┃ ஃ𖠃 Members: ${count}\n` +
                                 `❏┃ 𓀀 ${welcomeMsg}\n\n` +
                                 ` Enjoy your stay! ✧‎\n` +
                                 `( ͡❛ ₃ ͡❛)\n` +
                                 `━━━━━━━━━━━━━━━━`,
                        mentions: [jid]
                    });
                }
                
                // ── GOODBYE MESSAGE (with your exact style) ──
                if (update.action === 'remove') {
                    const goodbyeMsg = evDB[update.id].goodbye || 'Goodbye!';
                    
                    await sock.sendMessage(update.id, {
                        image: { url: userPic || groupPic },
                        caption: `┏━〔 ✦⃠⃝⃪⃔⃕ *GOODBYE* 〕━\n\n` +
                                 `❏┃ @${jidNum}\n` +
                                 `❏┃ ⓘ Left *${subject}*\n` +
                                 `❏┃ ஃ𖠃 Members: ${count}\n` +
                                 `❏┃ 𓀀 ${goodbyeMsg}\n\n` +
                                 ` We'll miss you! ✧‎\n` +
                                 `( ͡❛ ₃ ͡❛)\n` +
                                 `━━━━━━━━━━━━━━━━`,
                        mentions: [jid]
                    });
                }
            }
        } catch (e) {
            if (!ignoredErrors.some(ie => e.message?.includes(ie)))
                console.log('[Group Events Error]', e.message);
        }
    });
    
    console.log(chalk.green('✅ Group welcome/goodbye events loaded (styled)'));
};

module.exports = { sendConnectedMessage, setupGroupEvents };
