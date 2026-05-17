const config = require('../config');

async function readEnv() {
    return {
        SESSION_ID: config.SESSION_ID,
        OWNER_NUMBER: config.OWNER_NUMBER,
        AUTO_AI: config.AUTO_AI
    };
}

module.exports = { readEnv };