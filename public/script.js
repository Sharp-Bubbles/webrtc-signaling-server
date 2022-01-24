const videoGrid = document.getElementById("video-grid");

(() => {
    document.querySelector(".main__left").style.display = "flex";
    document.querySelector(".main__left").style.flex = "1";
    document.querySelector(".main__right").style.display = "none";
})();


const inviteButton = document.querySelector("#inviteButton");
const muteButton = document.querySelector("#muteButton");
const stopVideo = document.querySelector("#stopVideo");
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

inviteButton.addEventListener("click", (e) => {
    prompt(
        "Copy this link and send it to people you want to meet with",
        window.location.href
    );
});


const peerConnections = new Map() // map sid: RTCPeerConnection

let localStream;
const streams = new Set()
let users // map sid: username


function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function getSIDbyUsername(value) {
    for (let [k, v] of users.entries()) {
        if (v === value)
            return k;
    }
}

const sio = io();

const currentUser = prompt("Please enter your name");

if (!currentUser) {
    throw "User can't be empty"
}
sio.on('connect', async () => {
    // handle local user media
    await start()
    sio.emit("join_global_room", {username: currentUser})
});

sio.on('user_joined_global_room', async data => {
    console.log("user connected to a global room " + data.username)
    users = new Map()
    data.users.map(user => users.set(user.sid, user.username))


    if (users.size === 1) {
        console.log("first user is ready")
    } else {
        if (currentUser === data.username) {
            console.log(`${currentUser} has joined the room. Calling other users in global room`)
            await callAllUsers()
        }
    }
})

sio.on('user_left_global_room', data => {
    const {sid, username} = data
    console.log("user disconnected " + data.username)
    users = new Map()
    data.users.map(user => users.set(user.sid, user.username))
    console.log(users)

    if (username !== currentUser) {
        peerConnections.get(sid).close()
        peerConnections.delete(sid)
    } else {
        throw "user_left_global_room event shouldn't be triggered for user who has left the room"
    }
})

sio.on('disconnect', () => {
    console.log('disconnected');
    // maybe conn should close only from one side
    closeAllPeerConnections()
    sio.emit("left_global_room")
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

const start = async () => {
    localStream = await navigator.mediaDevices.getUserMedia({audio: true, video: true});
    const localVideo = document.createElement("video");
    addVideoStream(localVideo, localStream)
};

const addVideoStream = (video, stream) => {
    if (streams.has(stream.id)) {
        return
    }
    streams.add(stream.id)
    video.srcObject = stream;
    video.addEventListener("loadedmetadata", () => {
        video.play();
        videoGrid.append(video);
    });
};


const stop = async () => {
    hangup();
};

async function hangup() {
    // todo: close all peer connections
    localStream.getTracks().forEach(track => track.stop());
    localStream = null;
}

function createPeerConnection(remoteUserSID) {
    const peerConn = new RTCPeerConnection();
    peerConn.onicecandidate = e => {
        sio.emit("ice_candidate", {candidate: e.candidate, to: remoteUserSID})
    };
    peerConn.ontrack = e => {
        const remoteVideo = document.createElement("video");
        addVideoStream(remoteVideo, e.streams[0])
        // todo: remote video element as well

    }
    localStream.getTracks().forEach(track => peerConn.addTrack(track, localStream));
    peerConnections.set(remoteUserSID, peerConn)
    return peerConn
}

function closeAllPeerConnections() {
    for (let [remoteUserSID, conn] of peerConnections) {
        conn.close()
        console.log("Close connection with " + remoteUserSID);
    }
}

async function callAllUsers() {
    [...users.values()]
        .filter(username => username !== currentUser)
        .map(async username => await makeCall(username))
}

async function createOffer(peerConn, remoteUserSID) {
    const offer = await peerConn.createOffer();
    sio.emit("offer_call", {offer, to: remoteUserSID})
    await peerConn.setLocalDescription(offer);
}


async function makeCall(remoteUsername) {
    const remoteUserSID = getSIDbyUsername(remoteUsername)
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
        console.log(peerConnections)
        console.log(users)
        throw "Trying to create answer for unknown user"
    }

    await conn.setRemoteDescription(answer)
}

async function handleCandidate(candidate, from) {
    const conn = peerConnections.get(from)
    if (!conn) {
        console.log(peerConnections)
        console.log(users)
        throw "Trying to add ice candidate from unknown user"
    }

    await conn.addIceCandidate(candidate);
}