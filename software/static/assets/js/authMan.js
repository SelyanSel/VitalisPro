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

// stackoverflow https://stackoverflow.com/questions/38552003/how-to-decode-jwt-token-without-using-a-library
function parseJwt(token) {
    var base64Url = token.split('.')[1];
    var base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    var jsonPayload = decodeURIComponent(window.atob(base64).split('').map(function (c) {
        return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
    }).join(''));

    return JSON.parse(jsonPayload);
}

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
    if (window.location.toString().includes("login") || window.location.toString().includes("accountwizard")) {
        return;
    }

    if (success) {
        currentStatus = connStatus.success
        console.log("[Auth] Success connecting");

        let pJwt = parseJwt(localStorage.getItem("token"))
        console.log(pJwt)

        if (window.location.toString().includes("client")) {
            if (pJwt.privileges[0] == "2") {
                window.location = "./"
            }
        } else {
            console.log("[Auth] Invalid web path!")
            if (pJwt.privileges[0] != "2") {
                window.location = "./client/"
            }
        }
    } else {
        currentStatus = connStatus.invalid
        console.log("[Auth] Token invalid !");
        localStorage.removeItem("token")
        if (window.location.toString().includes("client")) {
            window.location = "../login.html"
        } else {
            window.location = "./login.html"
        }
    }
}

socket.on("AUTH_RES", function (res) {
    connectCallback(res.valid)
})

socket.on("LOGIN_RES", function (res) {
    console.log(res)
    if (res.status) {
        if (res.token) {
            localStorage.setItem("token", res.token)
            let pJwt = parseJwt(localStorage.getItem("token"))
            console.log(pJwt)

            if (pJwt.privileges[0] == "2") {
                window.location = "./"
            } else if (pJwt.privileges[0] != "2") {
                window.location = "./client/"
            }
        } else {
            console.log(res)
            alert("Erreur interne (NO_TOKEN_RES)")
        }
    } else {
        console.log("[Auth] invalid password or email")
        alert("Mot de passe et/ou email invalide.")
    }
})

socket.on("REGISTER_ANS", function (res) {
    console.log(res)
    if (res.status) {
        alert("Succès! Veuillez vous connecter.")
        window.location = "../login.html"
    } else {
        console.log("[Auth]" + res.reason)
        alert(res.reason)
    }
})

if (!window.location.toString().includes("login")) {
    verifyConnection()
} else {
    if (localStorage.getItem("token")) {
        window.location = "./"
    }
    console.log("[Auth] Skip autologging...")
}

function login() {
    const email = document.getElementById("email").value
    const password = document.getElementById("password").value

    socket.emit("LOGIN_REQ", { e: email, p: password })
}

function logout() {
    localStorage.removeItem("token")
    if (window.location.toString().includes("client")) {
        window.location = "../login.html"
    } else {
        window.location = "./login.html"
    }
}

function newRegister() {
    const email = document.getElementById("email").value
    const name = document.getElementById("name").value
    const password = document.getElementById("password").value
    const vPassword = document.getElementById("vPassword").value

    if (password != vPassword) {
        alert("Les mots de passe ne correspondent pas.")
        return;
    }

    console.log({
        e: email,
        password: password,
        name: name
    })

    socket.emit("REGISTER_REQ", {
        e: email,
        password: password,
        name: name
    })
}