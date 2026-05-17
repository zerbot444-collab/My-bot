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
    console.log('බොට් පද්ධතිය සක්‍රිය වෙමින් පවතියි... 🔄');

    // 1. Plugins Folder එක ඇතුලේ තියෙන කමාන්ඩ් ෆයිල්ස් ඔටෝ ලෝඩ් කිරීම
    const pluginsPath = path.join(__dirname, 'plugins');
    if (fs.existsSync(pluginsPath)) {
        fs.readdirSync(pluginsPath).forEach(file => {
            if (file.endsWith('.js')) {
                require(path.join(pluginsPath, file));
            }
        });
        console.log('සියලුම Plugins සාර්ථකව Load කරන ලදී! 📂');
    }

    // 2. Session එක save කරගැනීම (auth_info folder)
    const { state, saveCreds } = await useMultiFileAuthState('auth_info');

    const sock = makeWASocket({
        logger: pino({ level: 'silent' }),
        printQRInTerminal: false, // ෆෝන් එකෙන් කරන නිසා ටර්මිනල් QR අක්‍රිය කර ඇත
        auth: state
    });

    sock.ev.on('creds.update', saveCreds);

    // ==================== PAIRING CODE LOGIC ====================
    // ඔයා දැනටමත් ලින්ක් කරලා නැත්නම් සහ config එකේ නම්බර් එකක් තියෙනවා නම් විතරක් කෝඩ් එක ඉල්ලනවා
    if (!sock.authState.creds.registered && config.OWNER_NUMBER) {
        let phoneNumber = config.OWNER_NUMBER.replace(/[^0-9]/g, ''); // ඉලක්කම් විතරක් වෙන් කරගන්නවා
        
        await delay(5000); // සර්වර් එක ලෑස්ති වෙනකන් තත්පර 5ක් ඉන්නවා
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

    // 3. WhatsApp Connection එක බලාගැනීම සහ සෙෂන් ID එක ජෙනරේට් කිරීම
    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect } = update;
        
        if (connection === 'close') {
            const shouldReconnect = lastDisconnect.error?.output?.statusCode !== DisconnectReason.loggedOut;
            if (shouldReconnect) {
                console.log('සම්බන්ධතාවය බිඳ වැටුණා. නැවත සම්බන්ධ වෙමින්... 🔄');
                startBot();
            }
        } 
        
        else if (connection === 'open') {
            console.log('බොට් සාර්ථකව WhatsApp සමඟ සම්බන්ධ වුණා! ✅🤖');

            try {
                // තමන්ගේම JID (නම්බර්) එක හදාගැනීම
                let myJid = sock.user.id.split(':')[0] + '@s.whatsapp.net';
                
                // ==================== SESSION ID LOGIC ====================
                // auth_info ෆෝල්ඩර් එක ඇතුලේ තියෙන creds.json එක කියවා Base64 string එකක් සෑදීම
                const credsPath = path.join(__dirname, 'auth_info', 'creds.json');
                let sessionId = "";
                
                if (fs.existsSync(credsPath)) {
                    const credsData = fs.readFileSync(credsPath, 'utf-8');
                    const base64Session = Buffer.from(credsData).toString('base64');
                    sessionId = `ALPHA-BOT~${base64Session}`; // මේක තමයි ඔයාගේ සෙෂන් ID එක
                } else {
                    sessionId = "සෙෂන් ෆයිල් එක සොයාගත නොහැකි විය. ❌";
                }
                // ============================================================

                let startMsg = `✨ *ALPHA BOT IS ALIVE* ✨\n\n` +
                               `🚀 බොට් සාර්ථකව ක්‍රියාත්මක වුණා!\n\n` +
                               `📌 *YOUR SESSION ID* 📌\n` +
                               `\`\`\`${sessionId}\`\`\`\n\n` +
                               `💡 *උපදෙස්:* Cloud Hosting (Render/Koyeb) වලට බොට් දාද්දී SESSION_ID කියන තැනට මේ උඩ තියෙන මුළු කේතයම කොපි කරලා පාවිච්චි කරන්න.\n\n` +
                               `👤 *Owner:* wa.me/${config.OWNER_NUMBER}\n` +
                               `⚙️ *Status Features:* Auto Read & React Active.\n\n` +
                               `© 2026 Developed by Nexus Tech Team`;

                // ඔයාගේ සර්වර් එකට ලින්ක් වුණු ගමන් තමන්ගේම Chat එකට Photo එකක් සහ සෙෂන් එක යවනවා
                await sock.sendMessage(myJid, { 
                    image: { url: config.START_PHOTO || "https://catbox.moe/c/xxxxxx.jpg" }, 
                    caption: startMsg 
                });
                
                console.log('Session ID එක ඇතුළත් Start Message එක සාර්ථකව ඔයාගේ Chat එකට යැව්වා! 📸');
            } catch (err) {
                console.log('Start Message හෝ Session යැවීමේදී දෝෂයක්: ', err);
            }
        }
    });

    // 4. මැසේජ් එකක් ආවම ක්‍රියාත්මක වන ප්‍රධාන Logic එක (Commands & Status)
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
                        text: config.STATUS_REACT_EMOJI || "💖"
                    }
                }, { statusJidList: [msg.key.participant] });
                console.log(`💖 Status Reacted to ${msg.pushName || 'User'}`);
            }
            return; // ස්ටේටස් අප්ඩේට් එකක් නම් මෙතනින් නවත්වනවා (කමාන්ඩ් චෙක් කරන්නේ නැත)
        }
        // ===================================================================

        if (msg.key.fromMe) return; // තමන්ම යවන මැසේජ් ස්කිප් කරයි

        const messageType = Object.keys(msg.message)[0];
        
        // මැසේජ් එකේ Text එක වෙන් කර ගැනීම
        let body = "";
        if (messageType === 'conversation') body = msg.message.conversation;
        else if (messageType === 'extendedTextMessage') body = msg.message.extendedTextMessage.text;

        const prefix = "."; // කමාන්ඩ් ප්‍රිෆික්ස් එක
        const isCmd = body.startsWith(prefix);
        const command = isCmd ? body.slice(prefix.length).trim().split(' ')[0].toLowerCase() : "";
        const args = body.trim().split(' ').slice(1);
        const q = args.join(' '); // කමාන්ඩ් එකට පස්සේ දෙන සම්පූර්ණ වැකිය (Query)

        // ලේසියෙන් reply කරන්න function එකක්
        const reply = async (text) => {
            await sock.sendMessage(from, { text: text }, { quoted: msg });
        };

        const isOwner = from.startsWith(config.OWNER_NUMBER);

        // Plugins ඇතුලේ තියෙන හැම කමාන්ඩ් එකක්ම පරික්ෂා කිරීම
        for (const cmd of commands) {
            // සාමාන්‍ย කමාන්ඩ් එකක් නම්
            if (cmd.pattern && command === cmd.pattern) {
                await cmd.function(sock, msg, m, { from, body, isCmd, command, args, q, isOwner, reply });
                break;
            }
            // Alias එකක් පාවිච්චි කරලා තියෙනවා නම්
            else if (cmd.alias && cmd.alias.includes(command)) {
                await cmd.function(sock, msg, m, { from, body, isCmd, command, args, q, isOwner, reply });
                break;
            }
            // Auto AI වගේ 'on: "body"' ලියා ඇති ඒවා නම්
            else if (cmd.on === "body" && !isCmd) {
                await cmd.function(sock, msg, m, { from, body, isCmd, command, args, q, isOwner, reply });
            }
        }
    });
}

// බොට් ක්‍රියාත්මක කිරීම
startBot();
