const fs = require('node:fs');

exports.readFileContent = function(path, format = "utf8"){
    return fs.readFileSync(path, format);
}

exports.writeToFile = function(path, content = ""){
    return fs.writeFileSync(path, content);
}