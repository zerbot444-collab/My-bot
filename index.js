const { 
    default: makeWASocket, 
    useMultiFileAuthState, 
    DisconnectReason,
    delay
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
        printQRInTerminal: false, // ෆෝන් එකෙන් කරන නිසා QR පෙන්වන එක නවත්වනවා
        auth: state
    });

    sock.ev.on('creds.update', saveCreds);

    // ==================== PAIRING CODE LOGIC ====================
    // ඔයා දැනටමත් ලින්ක් කරලා නැත්නම් සහ config එකේ නම්බර් එකක් තියෙනවා නම් විතරක් කෝඩ් එක ඉල්ලනවා
    if (!sock.authState.creds.registered && config.OWNER_NUMBER) {
        let phoneNumber = config.OWNER_NUMBER.replace(/[^0-9]/g, ''); // ඉලක්කම් විතරක් වෙන් කරගන්නවා
        
        await delay(3000); // සර්වර් එක ලෑස්ති වෙනකන් තත්පර 3ක් ඉන්නවා
        try {
            let code = await sock.requestPairingCode(phoneNumber);
            console.log('\n=============================================');
            console.log(`📌 මෙන්න ඔයාගේ බොට් කනෙක්ටින් කෝඩ් එක: 👉 ${code} 👈`);
            console.log('=============================================\n');
            console.log('💡 පියවර: WhatsApp -> Linked Devices -> Link with phone number instead ගොස් මේ කෝඩ් එක ඇතුලත් කරන්න.\n');
        } catch (error) {
            console.log('Pairing Code ලබාගැනීමේදී දෝෂයක්: ', error);
        }
    }
    // ============================================================

    // Connection Update Logic (Start Message With Photo)
    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect } = update;
        
        if (connection === 'close') {
            const shouldReconnect = lastDisconnect.error?.output?.statusCode !== DisconnectReason.loggedOut;
            if (shouldReconnect) startBot();
        } 
        
        else if (connection === 'open') {
            console.log('බොට් සාර්ථකව WhatsApp සමඟ සම්බන්ධ වුණා! ✅🤖');

            try {
                let myJid = sock.user.id.split(':')[0] + '@s.whatsapp.net';
                let startMsg = `✨ *ALPHA BOT IS ALIVE* ✨\n\n` +
                               `🚀 බොට් සාර්ථකව ක්‍රියාත්මක වුණා!\n` +
                               `👤 *Owner:* wa.me/${config.OWNER_NUMBER}\n` +
                               `⚙️ *Status Features:* Auto Read & React Active.\n\n` +
                               `© 2026 Developed by Nexus Tech Team`;

                await sock.sendMessage(myJid, { 
                    image: { url: config.START_PHOTO || "https://catbox.moe/c/xxxxxx.jpg" }, 
                    caption: startMsg 
                });
                console.log('Start Message එක සාර්ථකව ඔයාගේ Chat එකට යැව්වා! 📸');
            } catch (err) {
                console.log('Start Message එක යැවීමේදී දෝෂයක්: ', err);
            }
        }
    });

    // Messages Upsert Logic (Commands & Auto Status React/Seen)
    sock.ev.on('messages.upsert', async m => {
        const msg = m.messages[0];
        if (!msg.message) return;

        const from = msg.key.remoteJid;

        // Auto Status Seen & React
        if (from === 'status@broadcast') {
            if (config.AUTO_STATUS_READ === 'true') await sock.readMessages([msg.key]);
            if (config.AUTO_STATUS_REACT === 'true') {
                await sock.sendMessage(from, {
                    react: { key: msg.key, text: config.STATUS_REACT_EMOJI || "💖" }
                }, { statusJidList: [msg.key.participant] });
            }
            return;
        }

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
