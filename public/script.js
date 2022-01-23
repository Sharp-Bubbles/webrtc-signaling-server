const sio = io();

const peerConnection = new RTCPeerConnection({});

peerConnection.addEventListener('icecandidate', e => onIceCandidate(e));
// peerConnection.addEventListener('iceconnectionstatechange', e => onIceStateChange(e));
peerConnection.addEventListener('track', gotRemoteStream);

function gotRemoteStream(e) {

    const remoteVideo = document.createElement("video");

    console.log("got remote stream")
    console.log(e.streams)
    addVideoStream(remoteVideo, e.streams[0])

    // console.log(e)
    // console.log(remoteVideo)
    // if (remoteVideo.srcObject !== e.streams[0]) {
    //     remoteVideo.srcObject = e.streams[0];
    //     console.log('received remote stream');
    // }
}

async function onIceCandidate(event) {
    try {
        if (event.candidate) {
            console.log("send ice candidate to " + peerConnectedUserSID)
            sio.emit("ice_candidate", {candidate: event.candidate, to: peerConnectedUserSID})
        }
    } catch (e) {
        console.log(`failed to add ICE Candidate: ${e.toString()}`);
    }
    console.log(`ICE candidate:\n${event.candidate ? event.candidate.candidate : '(null)'}`);
}

const videoGrid = document.getElementById("video-grid");
const myVideo = document.createElement("video");
myVideo.muted = true;


// temporary hide chat and disable button
(() => {
    const showChat = document.querySelector("#showChat");
    document.querySelector(".main__left").style.display = "flex";
    document.querySelector(".main__left").style.flex = "1";
    document.querySelector(".main__right").style.display = "none";

    html = `<i class="fas fa-comment-slash"></i>`;
    showChat.className = "options__button background__red";
    showChat.innerHTML = html;

    showChat.addEventListener("click", () => makeCall())
})();


let localStream;
navigator.mediaDevices
    .getUserMedia({
        audio: true,
        video: true,
    })
    .then((stream) => {
        localStream = stream;
        console.log(localStream)
        addVideoStream(myVideo, stream);

        // todo: handle when some joins the room add new cell with video and share local stream with him
        // peer.on("call", (call) => {
        //     call.answer(stream);
        //     const video = document.createElement("video");
        //     call.on("stream", (userVideoStream) => {
        //         addVideoStream(video, userVideoStream);
        //     });
        // });

        // socket.on("user-connected", (userId) => {
        //     connectToNewUser(userId, stream);
        // });
    });

// const connectToNewUser = (userId, stream) => {
//     const call = peer.call(userId, stream);
//     const video = document.createElement("video");
//     call.on("stream", (userVideoStream) => {
//         addVideoStream(video, userVideoStream);
//     });
// };

// peer.on("open", (id) => {
//     socket.emit("join-room", ROOM_ID, id, user);
// });

const addVideoStream = (video, stream) => {
    video.srcObject = stream;
    video.addEventListener("loadedmetadata", () => {
        video.play();
        videoGrid.append(video);
    });
};

// let text = document.querySelector("#chat_message");
// let send = document.getElementById("send");
// let messages = document.querySelector(".messages");
//
// send.addEventListener("click", (e) => {
//     if (text.value.length !== 0) {
//         socket.emit("message", text.value);
//         text.value = "";
//     }
// });
//
// text.addEventListener("keydown", (e) => {
//     if (e.key === "Enter" && text.value.length !== 0) {
//         socket.emit("message", text.value);
//         text.value = "";
//     }
// });

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

// socket.on("createMessage", (message, userName) => {
//     messages.innerHTML =
//         messages.innerHTML +
//         `<div class="message">
//         <b><i class="far fa-user-circle"></i> <span> ${
//             userName === user ? "me" : userName
//         }</span> </b>
//         <span>${message}</span>
//     </div>`;
// });

let peerConnectedUserSID;
let users // map sid: username

function getSIDbyUsername(value) {
    for (let [k, v] of users.entries()) {
        if (v === value)
            return k;
    }
}

const currentUser = prompt("Enter your name");

// common events handlers ------------------------------------------------------------------------------------------
sio.on('connect', async () => {
    console.log('connected');
    sio.emit("add_user", {username: currentUser})
});


sio.on('user_added', async data => {
    console.log("user added " + data.username)
    users = new Map()
    data.users.map(user => users.set(user.sid, user.username))
    console.log(users)
})

sio.on('user_disconnected', data => {
    console.log("user disconnected " + data.username)
    users = new Map()
    data.users.map(user => users.set(user.sid, user.username))
    console.log(users)
})

sio.on('add_ice_candidate', async data => {
    console.log("try to add ice candidate")
    await peerConnection.addIceCandidate(new RTCIceCandidate(data.candidate)) // todo: handle
})

sio.on('disconnect', () => {
    console.log('disconnected');
});

// caller events handlers ------------------------------------------------------------------------------------------
sio.on('call_accepted', async data => {
    console.log("call_accepted")
    await peerConnection.setRemoteDescription(new RTCSessionDescription(data.answer))
})

// called events handlers ------------------------------------------------------------------------------------------
sio.on('call_offered', async data => {
    console.log("call_offered")
    peerConnectedUserSID = data.from
    await acceptCall(data.offer, data.from)
})

async function acceptCall(offer, from) {
    const answer = await createAnswer(offer)
    sio.emit("accept_call", {answer, with: from})
    openLocalTracks(); // todo: update
}

function openLocalTracks() {
    localStream.getTracks().forEach(track => peerConnection.addTrack(track, localStream));
}

async function createOffer(options = {
    offerToReceiveAudio: 1,
    offerToReceiveVideo: 1
}) {
    let offer = await peerConnection.createOffer(options)
    await peerConnection.setLocalDescription(new RTCSessionDescription(offer))
    return offer
}

async function createAnswer(offer, options = {
    offerToReceiveAudio: 1,
    offerToReceiveVideo: 1
}) {
    await peerConnection.setRemoteDescription(new RTCSessionDescription(offer))
    let answer = await peerConnection.createAnswer(options)
    await peerConnection.setLocalDescription(new RTCSessionDescription(answer))
    return answer
}


// -–––––
async function offerCall(remoteUserSID) {
    peerConnectedUserSID = remoteUserSID

    const offer = await createOffer()
    sio.emit("offer_call", {
        offer,
        to: remoteUserSID
    });
}

function makeCall() {
    console.log('Starting call');
    openLocalTracks();

    const userToCall = prompt("call to: ")
    if (userToCall !== "no") {
        console.log('Added local stream');
        offerCall(getSIDbyUsername(userToCall)).then(() => console.log("call offer sent"))
    }
}


