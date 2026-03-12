// no need to import socket

let isLoggedIn = false;
const connStatus = {
    success: "CONN_SUCCESS",
    error: "CONN_ERR",
    invalid: "CONN_INVALID",
    expired: "CONN_EXPIRED",
    connecting: "CONN_PROGRESS"
}
let currentStatus = connStatus.connecting;

function verifyConnection() {
    if (!localStorage.getItem("token")){
        console.log("[Auth] Token invalid !");
        localStorage.removeItem("token")
        window.location = "./login.html"
        return false;
    }

    socket.emit("AUTH_REQ", ({
        token: localStorage.getItem("token")
    }))
}

socket.on("AUTH_RES", function (res) {
    if (res.valid) {
        console.log("[Auth] Success connecting");
    } else {
        console.log("[Auth] Token invalid !");
        localStorage.removeItem("token")
        window.location = "./login.html"
    }
})

verifyConnection()