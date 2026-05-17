const { 
    default: makeWASocket, 
    useMultiFileAuthState, 
    DisconnectReason 
} = require('@whiskeysockets/baileys');
const pino = require('pino');
const fs = require('fs');
const path = require('path');
const config = require('./config');
const { commands } = require('./command');

async function startBot() {
    // Plugins Load කිරීම
    const pluginsPath = path.join(__dirname, 'plugins');
    if (fs.existsSync(pluginsPath)) {
        fs.readdirSync(pluginsPath).forEach(file => {
            if (file.endsWith('.js')) require(path.join(pluginsPath, file));
        });
        console.log('සියලුම Plugins සාර්ථකව Load කරන ලදී! 📂');
    }

    const { state, saveCreds } = await useMultiFileAuthState('auth_info');

    const sock = makeWASocket({
        logger: pino({ level: 'silent' }),
        printQRInTerminal: true,
        auth: state
    });

    sock.ev.on('creds.update', saveCreds);

    // 1. Connection Update Logic (Start Message With Photo)
    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect } = update;
        
        if (connection === 'close') {
            const shouldReconnect = lastDisconnect.error?.output?.statusCode !== DisconnectReason.loggedOut;
            if (shouldReconnect) startBot();
        } 
        
        else if (connection === 'open') {
            console.log('බොට් සාර්ථකව WhatsApp සමඟ සම්බන්ධ වුණා! ✅🤖');

            // බොට් ස්ටාර්ට් වුණාම තමන්ගේම නම්බර් එකට ෆොටෝ එකක් සහ මැසේජ් එකක් යැවීම
            try {
                let myJid = sock.user.id.split(':')[0] + '@s.whatsapp.net';
                let startMsg = `✨ *ALPHA BOT IS ALIVE* ✨\n\n` +
                               `🚀 බොට් සාර්ථකව ක්‍රියාත්මක වුණා!\n` +
                               `👤 *Owner:* wa.me/${config.OWNER_NUMBER}\n` +
                               `⚙️ *Status Features:* Auto Read & React Active.\n\n` +
                               `© 2026 Developed by Nexus Tech Team`;

                await sock.sendMessage(myJid, { 
                    image: { url: config.START_PHOTO }, 
                    caption: startMsg 
                });
                console.log('Start Message එක සාර්ථකව ඔයාගේ Chat එකට යැව්වා! 📸');
            } catch (err) {
                console.log('Start Message එක යැවීමේදී දෝෂයක්: ', err);
            }
        }
    });

    // 2. Messages Upsert Logic (Commands & Auto Status React/Seen)
    sock.ev.on('messages.upsert', async m => {
        const msg = m.messages[0];
        if (!msg.message) return;

        const from = msg.key.remoteJid;

        // ==================== AUTO STATUS SEEN & REACT ====================
        if (from === 'status@broadcast') {
            // Auto Status Seen (ස්ටේටස් ඔටෝ බැලීම)
            if (config.AUTO_STATUS_READ === 'true') {
                await sock.readMessages([msg.key]);
                console.log(`👀 Status Seen: ${msg.pushName || 'User'}`);
            }

            // Auto Status React (ස්ටේටස් වලට ඔටෝ රියැක්ට් කිරීම)
            if (config.AUTO_STATUS_REACT === 'true') {
                await sock.sendMessage(from, {
                    react: {
                        key: msg.key,
                        text: config.STATUS_REACT_EMOJI
                    }
                }, { statusJidList: [msg.key.participant] });
                console.log(`💖 Status Reacted to ${msg.pushName || 'User'}`);
            }
            return; // ස්ටේටස් මැසේජ් එකක් නම් මෙතනින් එහාට කමාන්ඩ් චෙක් කරන්න යන්නේ නැහැ
        }
        // ===================================================================

        if (msg.key.fromMe) return;

        const messageType = Object.keys(msg.message)[0];
        let body = "";
        if (messageType === 'conversation') body = msg.message.conversation;
        else if (messageType === 'extendedTextMessage') body = msg.message.extendedTextMessage.text;

        const prefix = ".";
        const isCmd = body.startsWith(prefix);
        const command = isCmd ? body.slice(prefix.length).trim().split(' ')[0].toLowerCase() : "";
        const args = body.trim().split(' ').slice(1);
        const q = args.join(' ');

        const reply = async (text) => {
            await sock.sendMessage(from, { text: text }, { quoted: msg });
        };

        const isOwner = from.startsWith(config.OWNER_NUMBER);

        // Plugins Handler Loop
        for (const cmd of commands) {
            if (cmd.pattern && command === cmd.pattern) {
                await cmd.function(sock, msg, m, { from, body, isCmd, command, args, q, isOwner, reply });
                break;
            }
            else if (cmd.alias && cmd.alias.includes(command)) {
                await cmd.function(sock, msg, m, { from, body, isCmd, command, args, q, isOwner, reply });
                break;
            }
            else if (cmd.on === "body" && !isCmd) {
                await cmd.function(sock, msg, m, { from, body, isCmd, command, args, q, isOwner, reply });
            }
        }
    });
}

startBot();