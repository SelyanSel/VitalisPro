var socket = io();

const statusTitle = document.getElementById("titletext")
const statusText = document.getElementById("statustext")
const statusImg = document.getElementById("statusimg")
const inputTextArea = document.getElementById("inputText")
const inputTextField = document.getElementById("email")
const backgroundColors = {
    Blue: "transition-colors backdrop-blur-sm bg-blue-500 flex flex-1 flex-col p-5 m-5 rounded-2xl shadow-md border-2 border-blue-500 text-white justify-center items-center gap-4",
    Red: "transition-colors backdrop-blur-sm bg-red-500 flex flex-1 flex-col p-5 m-5 rounded-2xl shadow-md border-2 border-red-500 text-white justify-center items-center gap-4",
    Green: "transition-colors backdrop-blur-sm bg-green-500 flex flex-1 flex-col p-5 m-5 rounded-2xl shadow-md border-2 border-green-500 text-white justify-center items-center gap-4",
    Yellow: "transition-colors backdrop-blur-sm bg-yellow-500 flex flex-1 flex-col p-5 m-5 rounded-2xl shadow-md border-2 border-yellow-500 text-white justify-center items-center gap-4"
}
const background = document.getElementById("bg")
let isSuccess = false;
let tagUUID = "";

function setBG(backgroundColor) {
    background.setAttribute("class", backgroundColor)
}

function setImg(image) {
    statusImg.setAttribute("src", "./assets/img/" + image)
}

// end variables

setBG(backgroundColors.Yellow)
statusTitle.textContent = "Initialisation..."
statusText.textContent = "Connexion arduino..."
setImg("loading.png")

socket.emit("INIT_REGISTER", {})

socket.on("REGISTER_READY", function () {
    setBG(backgroundColors.Blue)
    statusTitle.textContent = "Présentez le badge"
    statusText.textContent = "En attente..."
    setImg("analyse-qr.png")
})

socket.on("REGISTER_SCANNED", function (data) {
    let uid = data.uid
    tagUUID = uid

    setBG(backgroundColors.Yellow)
    statusTitle.textContent = "Enregistrement"
    statusText.textContent = "Badge : " + uid
    setImg("user.png")
    setTimeout(() => {
        statusTitle.textContent = ""
        inputTextArea.hidden = false;
    }, 1000);
})
socket.on("REGISTER_ERR", function (data) {
    if (data.fatal) {
        setBG(backgroundColors.Red)
        setImg("alert.png")
        statusTitle.textContent = data.title
        statusText.textContent = data.message
    }

    socket.emit("REGISTER_CANCEL")

    setTimeout(() => {
        window.location = "./"
    }, 3000);
})
socket.on("REGISTER_SUCCESS", function (data) {
    setBG(backgroundColors.Green)
    setImg("user.png")
    statusTitle.textContent = "Succès"
    statusText.textContent = "L'utilisateur a été enregistré avec succès."

    isSuccess = true;

    setTimeout(() => {
        window.location = "./"
    }, 3000);
})

addEventListener("beforeunload", (event) => {
    if (!isSuccess) socket.emit("REGISTER_CANCEL");
})

function regValidate() {
    let email = inputTextField.value;

    if (!email.includes("@")) {
        alert("Email invalide.")
        return;
    }

    // send registration

    inputTextArea.hidden = true;
    setImg("loading.png")
    statusTitle.textContent = "Envoi au serveur..."

    socket.emit("REGISTER_BEGIN", { mail: email, tag: tagUUID })
}