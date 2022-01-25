(() => {
    document.querySelector(".main__left").style.display = "flex";
    document.querySelector(".main__left").style.flex = "1";
    document.querySelector(".main__right").style.display = "none";
})();

const videoGrid = document.getElementById("video-grid");
const createRoomButton = document.querySelector("#createRoomButton");
const leaveRoomButton = document.querySelector("#leaveRoomButton");
const joinOtherRoomButton = document.querySelector("#joinOtherRoom");
const inviteButton = document.querySelector("#inviteButton");
const muteButton = document.querySelector("#muteButton");
const stopVideo = document.querySelector("#stopVideo");
const videoLoader = document.querySelector(".loader")

muteButton.addEventListener("click", () => {
    const enabled = localStream.getAudioTracks()[0].enabled;
    if (enabled) {
        localStream.getAudioTracks()[0].enabled = false;
        html = `<i class="fas fa-microphone-slash"></i>`;
        muteButton.classList.toggle("background__red");
        muteButton.innerHTML = html;
    } else {
        localStream.getAudioTracks()[0].enabled = true;
        html = `<i class="fas fa-microphone"></i>`;
        muteButton.classList.toggle("background__red");
        muteButton.innerHTML = html;
    }
});

function setInRoom() {
    muteButton.style.display = "flex"
    stopVideo.style.display = "flex"
    leaveRoomButton.style.display = "flex"
    inviteButton.style.display = "flex"

    joinOtherRoomButton.style.display = "none"
    createRoomButton.style.display = "none"
}

function setWithoutRoom() {
    muteButton.style.display = "none"
    stopVideo.style.display = "none"
    leaveRoomButton.style.display = "none"
    inviteButton.style.display = "none"

    createRoomButton.style.display = "flex"
    joinOtherRoomButton.style.display = "flex"
}


stopVideo.addEventListener("click", () => {
    const enabled = localStream.getVideoTracks()[0].enabled;
    if (enabled) {
        localStream.getVideoTracks()[0].enabled = false;
        html = `<i class="fas fa-video-slash"></i>`;
        stopVideo.classList.toggle("background__red");
        stopVideo.innerHTML = html;
    } else {
        localStream.getVideoTracks()[0].enabled = true;
        html = `<i class="fas fa-video"></i>`;
        stopVideo.classList.toggle("background__red");
        stopVideo.innerHTML = html;
    }
});

let enteredRoom;
let inviteLink;

inviteButton.addEventListener("click", (e) => {
    prompt(
        "Copy this link and send it to people you want to meet with",
        `${window.location.href}?room=${inviteLink}`
    );
});


async function createRoom() {
    setInRoom()
    emitCreateRoom()
    await openLocalStream()
}

createRoomButton.addEventListener("click", async () => await createRoom())

async function leaveRoom() {
    setWithoutRoom()
    emitLeaveRoom()
    await closeConnectionsAndLocalStream()
}

leaveRoomButton.addEventListener("click", async () => await leaveRoom())


async function joinRoom(room) {
    emitJoinPrivateRoom(room)
}

function validateInviteLink(link) {
    const parts = link.split("?")
    if (parts.length !== 2) {
        return false
    }
    if (!parts[1].includes("room=")) {
        return false
    }
    if (parts[0].trimRight() !== window.location.href) {
        return false
    }
    return true

}

joinOtherRoomButton.addEventListener("click", () => {
    const link = prompt("Enter invite link: ")
    if (link) {
        if (validateInviteLink(link)) {
            window.location.assign(link);
        }
    }
})

setWithoutRoom()


const peerConnections = new Map() // map sid: RTCPeerConnection


let localStream;
const streams = new Set()

const sio = io();


function emitCreateRoom() {
    sio.emit("create_private_room")
}

function emitLeaveRoom() {
    sio.emit("leave_private_room", {room: enteredRoom})
    enteredRoom = null
    inviteLink = null
}

sio.on('private_room_created', data => {
    const {room_name, invite_link} = data
    enteredRoom = room_name
    inviteLink = invite_link
})


sio.on('connect', async () => {
    console.log("connect")
    sio.emit("get_users")
});

function promptUser(usernames, message = "Please enter your name") {
    const username = prompt(message);
    if (usernames.has(username)) {
        return promptUser(usernames, `Username: ${username} is already taken. Please take something else.`)
    } else {
        if (!username) {
            return promptUser(usernames, "It is not possible to use blank username ...")
        }
        return username
    }
}

sio.on("users_returned", async data => {
    let currentUser;
    if (sessionStorage.getItem("currentUser")) {
        currentUser = sessionStorage.getItem("currentUser")
        window.currentUser = currentUser
    } else {
        const usernames = new Set(data.users.map(user => user.username))
        currentUser = promptUser(usernames)
        sessionStorage.setItem("currentUser", currentUser)
    }
    document.querySelector('.header__title').innerHTML = `Video App from Sharp-Bubbles says: Hello to ${currentUser}! :) `


    sio.emit("join_global_room", {username: currentUser})
    await joinRoomIfProvidedByLink(window.location.href)
})

async function joinRoomIfProvidedByLink(link) {
    if (link.includes('?')) {
        const [url, roomToJoin] = link.split('?room=')
        history.pushState({}, null, url);
        await joinRoom(roomToJoin)
    }
}

sio.on('join_private_room_failed', async data => {
    alert("Failed to join room because of err: " + data.error)
})

sio.on('user_joined_global_room', async data => {
    console.log("user connected to a global room " + data.username)
})

sio.on('user_left_global_room', data => {
    console.log("user disconnected " + data.username)
})

sio.on('user_joined_private_room', data => {
    console.log('user_joined_private_room')
})

sio.on('user_left_private_room', data => {
    disconnectFromUser(data.sid)
})


sio.on('you_joined_private_room', async data => {
    enteredRoom = data.room

    await openLocalStream()
    setInRoom()

    console.log("you_joined_private_room")
    const {participants_sids} = data;
    console.log(participants_sids)
    participants_sids.map(async sid => {
        console.log("call sid: " + sid)
        await makeCall(sid)
    })
})

function disconnectFromUser(remoteUserSID) {
    peerConnections.get(remoteUserSID).close()
    peerConnections.delete(remoteUserSID)
    document.getElementById(`user__${remoteUserSID}`).remove()
}

sio.on('disconnect', () => {
    console.log('disconnected');
    closeAllPeerConnections()
});

sio.on("call_offered", data => {
    const {offer, from} = data
    handleOffer(offer, from)
})

sio.on("call_accepted", data => {
    const {answer, from} = data
    handleAnswer(answer, from)
})

sio.on("add_ice_candidate", data => {
    const {candidate, from} = data
    handleCandidate(candidate, from)
})

sio.on("disconnected_from_private_room", async () => {
    alert("You has been disconnected from private room because admin has left")
    await leaveRoom()
})

sio.on("disconnected_from_private_room_admin", async () => {
    alert("You has been disconnected from private room by admin")
    await leaveRoom()
})

function emitJoinPrivateRoom(room) {
    sio.emit("join_private_room", {room})
}

const openLocalStream = async () => {
    videoLoader.style.display = "flex"

    const localVideo = document.createElement("video");
    localVideo.setAttribute("id", 'localVideo')
    localStream = await navigator.mediaDevices.getUserMedia({audio: true, video: true});
    addVideoStream(localVideo, localStream)

    videoLoader.style.display = "none"
};

const addVideoStream = (video, stream) => {
    if (streams.has(stream.id)) {
        console.log("duplicated stream has been ignored")
        return
    }
    streams.add(stream.id)
    video.srcObject = stream;
    video.addEventListener("loadedmetadata", () => {
        video.play();
        videoGrid.append(video);
    });
};

function closeLocalStream() {
    localStream.getTracks().forEach(track => track.stop());
    localStream = null;
}

async function closeConnectionsAndLocalStream() {
    closeAllPeerConnections();
    closeLocalStream()
    document.querySelector('#localVideo').remove()
}

function createPeerConnection(remoteUserSID) {
    const peerConn = new RTCPeerConnection({
        iceServers: [
            {
                urls: 'stun:stun1.l.google.com:19302'
            },
            {
                urls: 'stun:stun3.l.google.com:19302'
            },
            {
                urls: 'stun:stun4.l.google.com:19302'
            }
        ]
    });
    peerConn.onicecandidate = e => {
        sio.emit("ice_candidate", {candidate: e.candidate, to: remoteUserSID})
    };
    peerConn.ontrack = e => {
        const remoteVideo = document.createElement("video");
        remoteVideo.setAttribute("id", `user__${remoteUserSID}`)
        addVideoStream(remoteVideo, e.streams[0])
    }
    localStream.getTracks().forEach(track => peerConn.addTrack(track, localStream));
    peerConnections.set(remoteUserSID, peerConn)
    return peerConn
}

function closeAllPeerConnections() {
    [...peerConnections.keys()].map(
        remoteUserSID => {
            disconnectFromUser(remoteUserSID)
            console.log("Close connection with " + remoteUserSID);
        })
}

async function createOffer(peerConn, remoteUserSID) {
    const offer = await peerConn.createOffer();
    sio.emit("offer_call", {offer, to: remoteUserSID})
    await peerConn.setLocalDescription(offer);
}


async function makeCall(remoteUserSID) {
    const peerConn = await createPeerConnection(remoteUserSID);
    await createOffer(peerConn, remoteUserSID)
    return peerConn
}

async function handleOffer(offer, from) {
    const peerConn = await createPeerConnection(from);
    await peerConn.setRemoteDescription(offer);

    const answer = await peerConn.createAnswer();

    sio.emit("accept_call", {answer: answer, with: from})
    await peerConn.setLocalDescription(answer);

}

async function handleAnswer(answer, from) {
    const conn = peerConnections.get(from)
    if (!conn) {
        throw "Trying to create answer for unknown user"
    }

    await conn.setRemoteDescription(answer)
}

async function handleCandidate(candidate, from) {
    const conn = peerConnections.get(from)
    if (!conn) {
        throw "Trying to add ice candidate from unknown user"
    }

    await conn.addIceCandidate(candidate);
}