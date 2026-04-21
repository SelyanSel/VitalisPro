const { animate, scroll } = Motion

function renewSubscription() {
    document.getElementById("renewbox").hidden = true
    switchConnectStatus("Veuillez patienter...", false, "sub")
    setTimeout(() => {
        socket.emit("RENEW_SUB", { token: localStorage.getItem("token") })
    }, 500);
}

function switchConnectStatus(text, status, service) {
    if (status) {
        document.getElementById(service + "_gauge").setAttribute("class", "h-3 w-3 bg-green-500 rounded-full")
        document.getElementById(service + "_status").setAttribute("class", "text-green-800")
        document.getElementById(service + "_status").textContent = text
    } else {
        document.getElementById(service + "_gauge").setAttribute("class", "h-3 w-3 bg-red-500 rounded-full")
        document.getElementById(service + "_status").setAttribute("class", "text-red-800")
        document.getElementById(service + "_status").textContent = text
    }
}

socket.on("RENEW_ANS", function (data) {
    document.getElementById("modal-success").hidden = false;
    document.getElementById("modaltitle").textContent = "Renouvellement"
    document.getElementById("modaltext").textContent = data.status
    animate(
        document.getElementById("modal-success"),
        { opacity: [0, 1] },
        { ease: "easeOut", duration: 0.15 }
    );
    if (data.code == 0) {
        switchConnectStatus("Abonnement actif", true, "sub")
    } else if (data.code == -1) {
        switchConnectStatus("Non actif", false, "sub")
        document.getElementById("renewbox").hidden = false
    } else {
        switchConnectStatus("Abonnement inconnu", false, "sub")
        document.getElementById("renewbox").hidden = false
    }
})

function closeValidate() {
    animate(
        document.getElementById("modal-success"),
        { opacity: [1, 0] },
        { ease: "easeOut", duration: 0.15 }
    );
    setTimeout(() => {
        document.getElementById("modal-success").hidden = true;
    }, 300);
}

socket.on("SUB_CALLBACK", function (data) {
    if (data.sub) {
        switchConnectStatus("Abonnement actif", true, "sub")
    } else {
        switchConnectStatus("Non actif", false, "sub")
        document.getElementById("renewbox").hidden = false
    }

    if (data.visits.length > 0) {
        data.visits.forEach(visit => {
            let parentdiv = document.createElement("div")
            parentdiv.setAttribute("class", "backdrop-blur-sm bg-white/50 flex flex-col gap-2.5 p-5 rounded-2xl shadow-md border-2 border-stone-50")
            let text = document.createElement("a")
            text.setAttribute("class", "text-xl font-extrabold self-center")
            text.textContent = visit.timestamp
            parentdiv.appendChild(text)
            document.getElementById("visit_list").prepend(parentdiv)
        });
    }
})

socket.emit("GET_DATA", { type: "SUB_DETAILS", token: localStorage.getItem("token") })

function updateProfile() {
    let jwt = parseJwt(localStorage.getItem("token"))

    document.getElementById("name").textContent = jwt.name
    document.getElementById("email").textContent = jwt.email
}
updateProfile()