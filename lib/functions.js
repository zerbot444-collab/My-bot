const axios = require('axios');

/**
 * URL එකකින් JSON දත්ත ලබාගැනීම සඳහා
 * @param {String} url 
 * @returns {Object} JSON Data
 */
const fetchJson = async (url, options) => {
    try {
        options = options || {};
        const res = await axios({
            method: 'GET',
            url: url,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/95.0.4638.69 Safari/537.36'
            },
            ...options
        });
        return res.data;
    } catch (err) {
        throw err;
    }
};

module.exports = { fetchJson };