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

let pc;
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
    console.log('connected');
    sio.emit("add_user", {username: currentUser})
});

sio.on('user_added', async data => {
    console.log("user added " + data.username)
    users = new Map()
    data.users.map(user => users.set(user.sid, user.username))

    if (users.size === 1) {
        console.log("first user is ready")
        await start()
    } else if (users.size === 2) {
        console.log("second user is ready")
        console.log("Setup RTCPeerConnection connection. Calling first user ...")
        await start()
        await makeCall();
    } else {
        throw "Only one to one call supported for now"
    }

})

sio.on('user_disconnected', data => {
    console.log("user disconnected " + data.username)
    users = new Map()
    data.users.map(user => users.set(user.sid, user.username))
    console.log(users)
})

sio.on('disconnect', () => {
    console.log('disconnected');
});

sio.on("call_offered", data => {
    const {offer, from} = data
    handleOffer(offer, from)
})

sio.on("call_accepted", data => {
    const {answer, from} = data
    handleAnswer(answer)
})

sio.on("add_ice_candidate", data => {
    const {candidate} = data
    handleCandidate(candidate)
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
    // signaling.postMessage({type: 'bye'});
};

async function hangup() {
    if (pc) {
        pc.close();
        pc = null;
    }
    localStream.getTracks().forEach(track => track.stop());
    localStream = null;
}

function createPeerConnection(remoteUserSID) {
    pc = new RTCPeerConnection();
    pc.onicecandidate = e => {
        sio.emit("ice_candidate", {candidate: e.candidate, to: remoteUserSID})
    };
    pc.ontrack = e => {
        const remoteVideo = document.createElement("video");
        addVideoStream(remoteVideo, e.streams[0])

    }
    localStream.getTracks().forEach(track => pc.addTrack(track, localStream));
}

async function makeCall() {
    const [firstUser, secondUser] = users.values();

    const userToCall = (currentUser === firstUser) ? secondUser : firstUser;
    console.log(`${currentUser} is calling ${secondUser}`)

    const remoteUserSID = getSIDbyUsername(userToCall)
    await createPeerConnection(remoteUserSID);
    const offer = await pc.createOffer();

    sio.emit("offer_call", {offer, to: remoteUserSID})
    await pc.setLocalDescription(offer);
}

async function handleOffer(offer, from) {
    if (pc) {
        console.error('existing peerconnection');
        return;
    }
    await createPeerConnection(from);
    await pc.setRemoteDescription(offer);

    const answer = await pc.createAnswer();

    sio.emit("accept_call", {answer: answer, with: from})
    await pc.setLocalDescription(answer);
}

async function handleAnswer(answer) {
    if (!pc) {
        console.error('no peerconnection');
        return;
    }
    await pc.setRemoteDescription(answer);
}

async function handleCandidate(candidate) {
    if (!pc) {
        console.error('no peerconnection');
        return;
    }
    await pc.addIceCandidate(candidate);
}