const fs = require('fs');
if (fs.existsSync('config.env')) require('dotenv').config({ path: './config.env' });

module.exports = {
    SESSION_ID: process.env.SESSION_ID || "ඔයාගේ_SESSION_ID",
    OWNER_NUMBER: process.env.OWNER_NUMBER || "94725613084", // මෙතනට ඔයාගේ නම්බර් එක හරියටම දෙන්න
    START_PHOTO: process.env.START_PHOTO || "https://github.com/zerbot444-collab/My-bot/blob/main/img/d24acafd6f0c96f5a30812061a0a6dfc.jpg", // ඔයාගේ ෆොටෝ ලින්ක් එක
    AUTO_STATUS_READ: "true",  // ස්ටේටස් ඔටෝ බලන්න
    AUTO_STATUS_REACT: "true", // ස්ටේටස් වලට ඔටෝ රියැක්ට් කරන්න
    STATUS_REACT_EMOJI: "💖"   // රියැක්ට් කරන්න ඕනේ ඉමෝජි එක
};
