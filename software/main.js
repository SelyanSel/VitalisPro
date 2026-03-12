const express = require('express')
const app = express()
const port = 3000
const bodyParser = require('body-parser')
const jsonParser = bodyParser.json()
const http = require('http');
const server = http.createServer(app);
const { Server } = require("socket.io");
const io = new Server(server);
const fs = require("node:fs")
const env = require('dotenv')
const jwt = require('jsonwebtoken')
const bcrypt = require('bcrypt')

// config

env.config();

// arduino

const { SerialPort } = require('serialport');
const { ReadlineParser } = require("@serialport/parser-readline")

const jwt_secret = process.env.CLE_SECRETE

// importations de librairies

const fileManager = require("./modules/fileManager");

// logging

const ConsoleColors = {
    reset: "\x1b[0m",
    info: "\x1b[36m",    // Cyan
    success: "\x1b[32m", // Vert
    warn: "\x1b[33m",    // Jaune
    error: "\x1b[31m",   // Rouge
    debug: "\x1b[35m"    // Magenta
}

let logData = [
    {
        time: "",
        data: ""
    }
]
let lastPing = "Patientez...";
let sessionEntries = 0;

function beginLogging() {
    logData = [];
    if (fs.existsSync('./data/logs/latest.log')) {
        let oldDate = fs.readFileSync("./data/logs/latest.log", 'utf-8')
        let formatDate = oldDate.split('\n')[0]
        fs.renameSync("./data/logs/latest.log", `./data/logs/${formatDate}.log`)
    }
    const date = new Date()
    fileManager.writeToFile("./data/logs/latest.log", date.getTime() + "\n")
}

beginLogging();

function logConsole(message = "") {
    const date = new Date().toLocaleTimeString();

    console.log(
        `[${date}]:` + message
    );

    logData.push({ time: date, data: message })
    io.emit("consoleEvent", { time: date, data: message })

    let log = ""
    log = fileManager.readFileContent("./data/logs/latest.log")

    log += `[${date}]:` + message + "\n"

    fileManager.writeToFile("./data/logs/latest.log", log)
}

// detection arduino

let ardPort = 'COM6';
let isConnected = false;

SerialPort.list().then(function (ports) {
    ports.forEach(function (port) {
        if (port.friendlyName.includes("Arduino Uno")) {
            ardPort = port.path;
        }
    })
})

let ard_port;

try {
    ard_port = new SerialPort({
        path: ardPort,
        baudRate: 9600
    })
    logConsole(`Connecté au port ${ardPort}.`)
} catch (error) {
    logConsole("Arduino non trouvé.")
    setTimeout(() => {
        retryConnect()
    }, 1500);
}

function retryConnect() {
    try {
        SerialPort.list().then(function (ports) {
            ports.forEach(function (port) {
                if (port.friendlyName.includes("Arduino Uno")) {
                    ardPort = port.path;

                    ard_port = new SerialPort({
                        path: ardPort,
                        baudRate: 9600
                    })
                    return;
                }
            })
        })
    } catch (error) {
        logConsole("Arduino non trouvé.")
        setTimeout(() => {
            retryConnect()
        }, 1500);
    }
}

const ResponseStatus = {
    ALLOW_ACCESS: 1,
    EXPIRED_SUB: 2,
    UNKNOWN_BADGE: 3
}

let statDB = {
    entries: 0,
    tags: []
}
statDB = JSON.parse(fileManager.readFileContent("./data/db/stats.json"))

let userDB = [
    {
        name: "",
        hasSubscription: false,
        email: "",
        visits: [],
        password: "",
        tagSignature: "",
        isInside:false
    }
]
userDB = []
userDB = JSON.parse(fileManager.readFileContent("./data/db/user.json"))

const parser = ard_port.pipe(new ReadlineParser({ delimiter: '\r\n' }));

function writeArduino(msg) {
    ard_port.write(msg, (err) => {
        if (err) {
            logConsole(err.toString())
            logConsole("WriteError :: " + msg)
            return console.log('Erreur lors de l\'envoi : ', err.message);
        } else {
            logConsole("WriteSuccess :: " + msg)
        }
    });
}

function verifyBadge(uid) {
    let user = userDB.find(user => {
        return user.tagSignature == uid
    })

    if (user) {
        logConsole("FOUND_USER :: " + user.name)
        if (user.hasSubscription) {
            writeArduino("0," + user.name)
            logConsole(`{"type":"RFID_CALLBACK","user":"${user.name}","access":"accordé", "uid":"${uid}"}`)
            sessionEntries += 1;
            statDB.entries = statDB.entries + 1
            io.emit("updateRequest", "")
            fileManager.writeToFile("./data/db/stats.json", JSON.stringify(statDB))
        } else {
            writeArduino("1," + user.name)
            logConsole(`{"type":"RFID_CALLBACK","user":"${user.name}","access":"refusé (expiré)", "uid":"${uid}"}`)
            io.emit("updateRequest", "")
        }
    } else {
        logConsole("USER_NOT_FOUND")
        writeArduino("2,null")
        logConsole(`{"type":"RFID_CALLBACK","user":"Inconnu","access":"refusé", "uid":"${uid}"}`)
        io.emit("updateRequest", "")
    }
}

// auth security

function makeToken(data) {
    const token = jwt.sign(data, process.env.CLE_SECRETE, {});
    return token;
}


function verifyToken(token) {
    let res = jwt.verify(token, process.env.CLE_SECRETE, (err, decoded) => {
        if (err) {
            console.log(err)
            return false;
        } else {
            return true;
        }
    });
    return res;
}

async function hashPassword(password) {
  const saltRounds = process.env.SALT
  const hashedPassword = await bcrypt.hash(password, Number.parseInt(saltRounds))
  return hashedPassword
}

async function verifyPassword(password, hashedPassword) {
  const isValid = await bcrypt.compare(password, hashedPassword)
  return isValid
}

parser.on('data', (data) => {
    let json;
    try {
        json = JSON.parse(data)
    } catch (error) {
        ard_port.write("-1", (err) => {
            if (err) {
                return console.log('Erreur lors de l\'envoi : ', err.message);
            } else {
                logConsole("RFID_CALLBACK_SCANOK")
            }
        });
    }

    try {

        if (json.type == "ALIVE_HEARTBEAT") {
            lastPing = new Date().toLocaleTimeString();
            io.emit("heartbeat", { "time": `${new Date().toLocaleTimeString()}` })
            return;
        }

        logConsole(data)

        if (json.type == "RFID_SCAN") {
            ard_port.write("0", (err) => {
                if (err) {
                    return console.log('Erreur lors de l\'envoi : ', err.message);
                } else {
                    logConsole("RFID_CALLBACK_SCANOK")
                }
            });

            setTimeout(() => {
                verifyBadge(json.uid)
            }, 1000);
        } else if (json.type == "RFID_REGISTER_SCAN") {
            let foundUser = false;

            userDB.forEach(usr => {
                if (usr.tagSignature == json.uid) {
                    foundUser = true;
                }
            });

            if (!foundUser) {
                setTimeout(() => {
                    io.emit("REGISTER_SCANNED", { uid: json.uid })
                }, 500);
            } else {
                setTimeout(() => {
                    io.emit("REGISTER_ERR", {
                        fatal: true,
                        title: "Erreur fatale",
                        message: "Le badge est déjà enregistré."
                    })
                }, 500);
            }
        }

    } catch (error) {
        console.log(error)
    }
});

// debug

app.post('/addsettings', jsonParser, (req, res) => {
    let settings = JSON.parse(fileManager.readFileContent("./data/server.json"))
    console.log(settings)

    let pushJson = JSON.parse(`{"${req.body.name}":"${req.body.value}"}`)

    settings[req.body.name] = req.body.value

    fileManager.writeToFile("./data/server.json", JSON.stringify(settings))
    res.status(200).send(settings)
})

// admin

app.get('/test', (req, res) => {
    console.log(req.headers.authorization)
    res.status(200).send("test!")
})

// socket

io.on('connection', (socket) => {
    socket.on("AUTH_REQ", (data)=>{
        try {
            console.log(data)
            if (data.token){
                let valid = verifyToken(data.token)
                console.log(valid)
                if (valid){
                    socket.emit("AUTH_RES", {valid:true})
                }else{
                    socket.emit("AUTH_RES", {valid:false})
                }
            }
        } catch (error) {
            socket.emit("AUTH_RES", {valid:false})
            console.log(error)
        }
    })
    socket.on("LOGIN_REQ", async (data)=>{
        try {
            let user;
            console.log(data)
            userDB.forEach(usr => {
                if (usr.email == data.e){
                    user = usr
                }
            });

            if (!user.email){
                socket.emit("LOGIN_RES", {status:false})
                return;
            }

            let match = await verifyPassword(data.p, user.password)

            if (match){
                let token = makeToken(user)
                socket.emit("LOGIN_RES", {status:true, token:token})
                return;
            }else{
                socket.emit("LOGIN_RES", {status:false})
                return;
            }
        } catch (error) {
            socket.emit("LOGIN_RES", {status:false})
        }
    })
    socket.on('BADGE_ALLOW', (msg) => {
        ard_port.write("0,Celian", (err) => {
            if (err) {
                return console.log('Erreur lors de l\'envoi : ', err.message);
            } else {
                logConsole("RFID_CALLBACK :: BADGE_ALLOW")
            }
        });
    });
    socket.on('BADGE_EXPIRED', (msg) => {
        ard_port.write("1,Celian", (err) => {
            if (err) {
                return console.log('Erreur lors de l\'envoi : ', err.message);
            } else {
                logConsole("RFID_CALLBACK :: BADGE_EXPIRED")
            }
        });
    });
    socket.on('GET_DATA', (req) => {
        if (!verifyToken(req.token)) {
            socket.emit("INVALID_AUTH")
            return;
        }

        if (req.type == "logData") {
            socket.emit("DATA_CALLBACK", { type: "logData", data: logData })
        }
        if (req.type == "lastPing") {
            socket.emit("DATA_CALLBACK", { type: "lastPing", data: lastPing })
        }
        if (req.type == "stats") {
            let sub = 0
            userDB.forEach((user) => {
                if (user.hasSubscription) {
                    sub++;
                }
            });
            socket.emit("DATA_CALLBACK", {
                type: "stats",
                data: {
                    subscribed: sub,
                    users: userDB.length,
                    entries: statDB.entries
                }
            })
        }
    })
    socket.on('INIT_REGISTER', (req) => {
        ard_port.write("-1", (err) => {
            if (err) {
                return console.log('Erreur lors de l\'envoi : ', err.message);
            } else {
                logConsole("INIT_REGISTER")
                socket.emit("REGISTER_READY")
            }
        });
    })
    socket.on("REGISTER_CANCEL", () => {
        ard_port.write("-5", (err) => {
            if (err) {
                return console.log('Erreur lors de l\'envoi : ', err.message);
            } else {
                logConsole("REGISTER_CANCEL")
            }
        });
    })
    socket.on("REGISTER_BEGIN", (packet) => {
        let foundUser = false;

        userDB.forEach(usr => {
            if (usr.email == packet.mail) {
                foundUser = true;
            }
        });

        if (!foundUser) {
            let newUser = {
                name: "-1",
                hasSubscription: false,
                email: packet.mail,
                visits: [],
                password: "-1",
                tagSignature: packet.tag
            }
            userDB.push(newUser)
            fileManager.writeToFile("./data/db/user.json", JSON.stringify(userDB))
            socket.emit("REGISTER_SUCCESS")
            ard_port.write("3", (err) => {
                if (err) {
                    return console.log('Erreur lors de l\'envoi : ', err.message);
                } else {
                    logConsole("REGISTER_SUCCESS")
                    socket.emit("REGISTER_SUCCESS")
                }
            });
        } else {
            socket.emit("REGISTER_ERR", {
                fatal: true,
                title: "Erreur fatale",
                message: "L'email est déjà utilisé par un autre utilisateur."
            })
        }
    })
});

async function gen(){
    let gent = await hashPassword("seltest")
    console.log(gent)
    return gent;
}

gen()

app.use(express.static('static'))
server.listen(port, () => {
    console.log(`VitalisPro Backend lancé en local : http://localhost:${port}`)
})
