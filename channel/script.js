const peerConnection = new RTCPeerConnection({});

const videoGrid = document.getElementById("video-grid");

(() => {
    const showChat = document.querySelector("#showChat");
    document.querySelector(".main__left").style.display = "flex";
    document.querySelector(".main__left").style.flex = "1";
    document.querySelector(".main__right").style.display = "none";

    html = `<i class="fas fa-comment-slash"></i>`;
    showChat.className = "options__button background__red";
    showChat.innerHTML = html;
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
const signaling = new BroadcastChannel('webrtc');

signaling.onmessage = e => {
    if (!localStream) {
        console.log('not ready yet');
        return;
    }
    switch (e.data.type) {
        case 'offer':
            handleOffer(e.data);
            break;
        case 'answer':
            handleAnswer(e.data);
            break;
        case 'candidate':
            handleCandidate(e.data);
            break;
        case 'ready':
            // A second tab joined. This tab will initiate a call unless in a call already.
            if (pc) {
                console.log('already in call, ignoring');
                return;
            }
            makeCall();
            break;
        case 'bye':
            if (pc) {
                hangup();
            }
            break;
        default:
            console.log('unhandled', e);
            break;
    }
};

const start = async () => {
    console.log("start")
    localStream = await navigator.mediaDevices.getUserMedia({audio: true, video: true});
    const localVideo = document.createElement("video");
    addVideoStream(localVideo, localStream)

    signaling.postMessage({type: 'ready'});
};

const addVideoStream = (video, stream) => {
    if (streams.has(stream.id)) {
        console.log("skip stream")
        console.log(stream)
        return
    }
    streams.add(stream.id)
    console.log(streams)
    video.srcObject = stream;
    video.addEventListener("loadedmetadata", () => {
        video.play();
        videoGrid.append(video);
    });
};


const stop = async () => {
    hangup();
    signaling.postMessage({type: 'bye'});
};

async function hangup() {
    if (pc) {
        pc.close();
        pc = null;
    }
    localStream.getTracks().forEach(track => track.stop());
    localStream = null;
}

function createPeerConnection() {
    pc = new RTCPeerConnection();
    pc.onicecandidate = e => {
        const message = {
            type: 'candidate',
            candidate: null,
        };
        if (e.candidate) {
            message.candidate = e.candidate.candidate;
            message.sdpMid = e.candidate.sdpMid;
            message.sdpMLineIndex = e.candidate.sdpMLineIndex;
        }
        signaling.postMessage(message);
    };
    pc.ontrack = e => {
        const remoteVideo = document.createElement("video");
        addVideoStream(remoteVideo, e.streams[0])

    }
    localStream.getTracks().forEach(track => pc.addTrack(track, localStream));
}

async function makeCall() {
    await createPeerConnection();

    const offer = await pc.createOffer();
    signaling.postMessage({type: 'offer', sdp: offer.sdp});
    await pc.setLocalDescription(offer);
}

async function handleOffer(offer) {
    if (pc) {
        console.error('existing peerconnection');
        return;
    }
    await createPeerConnection();
    await pc.setRemoteDescription(offer);

    const answer = await pc.createAnswer();
    signaling.postMessage({type: 'answer', sdp: answer.sdp});
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
    if (!candidate.candidate) {
        await pc.addIceCandidate(null);
    } else {
        await pc.addIceCandidate(candidate);
    }
}


function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

sleep(1000).then(
    async () => await start()
)
