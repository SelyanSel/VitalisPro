let socket = io();

function getFirstLine(text) {
    var index = text.indexOf("\n");
    if (index === -1) index = undefined;
    return text.substring(0, index);
}

function parseLog() {

}

function switchTextareaVisible(visible) {
    if (visible) {
        document.getElementById("txtArea").hidden = false;
        document.getElementById("cancelBtn").hidden = false;
        document.getElementById("date").hidden = false;
        document.getElementById("eventLog").hidden = true;
    } else {
        document.getElementById("txtArea").hidden = true;
        document.getElementById("cancelBtn").hidden = true;
        document.getElementById("date").hidden = true;
        document.getElementById("eventLog").hidden = false;
    }
}

socket.on("DATA_CALLBACK", function (data) {
    if (data.type = "preciseLog") {
        try {
            document.getElementById("logdata").value = data.data
            document.getElementById("date").textContent = new Date(parseInt(getFirstLine(data.data))).toString()
            switchTextareaVisible(true)
        } catch (error) {

        }
    }
    if (data.type = "logHistory") {
        let divClass = "backdrop-blur-sm bg-white/50 flex flex-col cursor-pointer p-4 mb-4 rounded-2xl shadow-md border-2 border-stone-50";

        data.data.forEach(timestamp => {
            if (timestamp != "latest") {
                let create = document.createElement("div");
                create.setAttribute("onclick", "show('" + timestamp + "');")
                create.setAttribute("class", divClass);
                create.textContent = new Date(parseInt(timestamp)).toString();
                document.getElementById("eventLog").prepend(create);
            }else{
                let create = document.createElement("div");
                create.setAttribute("onclick", "show('latest');")
                create.setAttribute("class", divClass);
                create.textContent = "Session en cours (latest)";
                document.getElementById("eventLog").prepend(create);
            }
        });

        switchTextareaVisible(false)
    }
})

function show(timestamp) {
    socket.emit("GET_DATA", { token: localStorage.getItem("token"), type: "preciseLog", timestamp: timestamp })
}

function navReturn(){
    switchTextareaVisible(false)
}

socket.emit("GET_DATA", { token: localStorage.getItem("token"), type: "getLogs" })