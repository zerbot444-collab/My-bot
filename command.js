const commands = [];

function cmd(info, func) {
    const data = info;
    data.function = func;
    
    // Pattern එකක් නැත්නම් ඒක non-command listener එකක් (on: "body" වගේ)
    if (!data.pattern) data.pattern = '';
    
    commands.push(data);
    return data;
}

module.exports = {
    cmd,
    commands
};