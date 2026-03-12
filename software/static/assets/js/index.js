var socket = io();

let badge_id = "";

function switchConnectStatus(text, status) {
    if (status) {
        document.getElementById("connectgauge").setAttribute("class", "h-3 w-3 bg-green-500 rounded-full")
        document.getElementById("connecttext").setAttribute("class", "text-green-800")
        document.getElementById("connecttext").textContent = text
    } else {
        document.getElementById("connectgauge").setAttribute("class", "h-3 w-3 bg-red-500 rounded-full")
        document.getElementById("connecttext").setAttribute("class", "text-red-800")
        document.getElementById("connecttext").textContent = text
    }
}

function addConsoleEvent(eventData) {
    let divClass = "backdrop-blur-sm bg-white/50 flex flex-col p-4 mb-4 rounded-2xl shadow-md border-2 border-stone-50";
    let ignoreList = [
        "RFID_SCAN",
        "RFID_CALLBACK_SCANOK",
        "FOUND_USER",
        "WriteSuccess",
        "USER_NOT_FOUND"
    ]

    try {
        let parsedJson = JSON.parse(eventData.data);
        
        if (ignoreList.includes(parsedJson.type)) {
            return;
        }

        if (parsedJson.type == "RFID_CALLBACK") {
            let create = document.createElement("div");
            create.setAttribute("class", divClass);
            create.textContent = `[${eventData.time}]: Scan du badge de ${parsedJson.user} : Accès ${parsedJson.access} (${parsedJson.uid})`;
            document.getElementById("eventLog").prepend(create);
            return;
        }
    } catch (error) {
        let isIgnored = ignoreList.some(obj => eventData.data.includes(obj));

        if (isIgnored) {
            return;
        }

        if (eventData.data == "INIT_REGISTER"){
            let create = document.createElement("div");
            create.setAttribute("class", divClass);
            create.textContent = `[${eventData.time}]: Début d'enregistrement de badge RFID`;
            document.getElementById("eventLog").prepend(create);
            return; 
        }
        if (eventData.data == "REGISTER_CANCEL"){
            let create = document.createElement("div");
            create.setAttribute("class", divClass);
            create.textContent = `[${eventData.time}]: Annulation d'enregistrement de badge RFID`;
            document.getElementById("eventLog").prepend(create);
            return; 
        }

        let create = document.createElement("div");
        create.setAttribute("class", divClass);
        create.textContent = `[${eventData.time}]: ${eventData.data}`;
        document.getElementById("eventLog").prepend(create);
    }
}

socket.on('heartbeat', function (data) {
    document.getElementById("heartbeat").textContent = data.time;
    switchConnectStatus("Connecté à l'Arduino", true)
})

socket.on("consoleEvent", function (ev) {
    addConsoleEvent(ev)
})

socket.on("updateRequest", function (ev) {
    socket.emit("GET_DATA", { type: "stats", token:localStorage.getItem("token") })
})

socket.on("DATA_CALLBACK", function (data) {

    if (data.type == "logData") {
        // handle console data
        data.data.forEach(ev => {
            addConsoleEvent(ev)
        });
    }
    if (data.type == "lastPing") {
        document.getElementById("heartbeat").textContent = data.data;
        switchConnectStatus("Connecté à l'Arduino", true)
    }
    if (data.type == "stats") {
        let stats = data.data

        document.getElementById("sub_count").textContent = stats.subscribed
        document.getElementById("user_count").textContent = stats.users

        let currentDate = new Date().getMonth()
        document.getElementById("uses_count").textContent = stats.entries[currentDate]
        c.data.datasets[0].data[currentDate] = stats.entries[currentDate]
        let i = 0
        c.data.datasets[0].data.forEach(dataset => {
            c.data.datasets[0].data[i] = stats.entries[i]
            console.log({1:dataset, 2:stats.entries[i]})
            i++;
        });
        c.update()
        console.log(c.data)
    }

})

socket.emit("GET_DATA", { type: "logData", token:localStorage.getItem("token") })
socket.emit("GET_DATA", { type: "lastPing", token:localStorage.getItem("token") })
socket.emit("GET_DATA", { type: "stats", token:localStorage.getItem("token") })