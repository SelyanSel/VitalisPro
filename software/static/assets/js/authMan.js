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
    if (!localStorage.getItem("token")) {
        connectCallback(false);
        currentStatus = connStatus.invalid
        return false;
    }

    socket.emit("AUTH_REQ", ({
        token: localStorage.getItem("token")
    }))
}

function connectCallback(success) {
    if (window.location.toString().includes("login")) {
        return;
    }

    if (success) {
        currentStatus = connStatus.success
        console.log("[Auth] Success connecting");
    } else {
        currentStatus = connStatus.invalid
        console.log("[Auth] Token invalid !");
        localStorage.removeItem("token")
        window.location = "./login.html"
    }
}

socket.on("AUTH_RES", function (res) {
    connectCallback(res.valid)
})

socket.on("LOGIN_RES", function (res){
    console.log(res)
    if (res.status){
        if (res.token){
            localStorage.setItem("token", res.token)
            window.location = "./"
        }else{
            console.log(res)
            alert("Erreur interne (NO_TOKEN_RES)")
        }
    }else{
        console.log("[Auth] invalid password or email")
        alert("Mot de passe et/ou email invalide.")
    }
})

if (!window.location.toString().includes("login")) {
    verifyConnection()
}else{
    if (localStorage.getItem("token")){
        window.location = "./"
    }
    console.log("[Auth] Skip autologging...")
}

function login(){
    const email = document.getElementById("email").value
    const password = document.getElementById("password").value

    socket.emit("LOGIN_REQ", {e:email,p:password})
}

function logout(){
    localStorage.removeItem("token")
    window.location = "./login.html"
}