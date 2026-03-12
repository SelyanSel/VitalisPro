const {readFileContent, writeToFile} = require("./fileManager")

module.exports = colors = {
    reset: "\x1b[0m",
    info: "\x1b[36m",    // Cyan
    success: "\x1b[32m", // Vert
    warn: "\x1b[33m",    // Jaune
    error: "\x1b[31m",   // Rouge
    debug: "\x1b[35m"    // Magenta
}

module.exports = function logConsole(type, message, data = "") {
    const color = this.colors[type] || this.colors.reset;
    const date = new Date().toLocaleTimeString();

    console.log(
        `${this.colors.reset}[${date}] ${color}${type.toUpperCase()}${this.colors.reset}:`,
        message,
        data
    );

    let log = ""
    log = readFileContent("../data/logs/latest.log")

    log += `${this.colors.reset}[${date}] ${color}${type.toUpperCase()}${this.colors.reset}:` + message + data + "\n"

    writeToFile("../data/logs/latest.log", log)
}