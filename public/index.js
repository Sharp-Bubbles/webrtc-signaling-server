'use strict';

const startButton = document.getElementById('startButton');
const callButton = document.getElementById('callButton');
const hangupButton = document.getElementById('hangupButton');
callButton.disabled = true;
hangupButton.disabled = true;

const peerConnection = new RTCPeerConnection({});

let peerConnectedUserSID;

let localStream;
const offerOptions = {
    offerToReceiveAudio: 1,
    offerToReceiveVideo: 1
};

startButton.addEventListener('click', start);
callButton.addEventListener('click', call);
hangupButton.addEventListener('click', hangup);

peerConnection.addEventListener('icecandidate', e => onIceCandidate(e));
peerConnection.addEventListener('iceconnectionstatechange', e => onIceStateChange(e));
peerConnection.addEventListener('track', gotRemoteStream);

function hangup() {
    console.log('Ending call');
    peerConnection.close();
    // peerConnection = null;
    hangupButton.disabled = true;
    callButton.disabled = false;
}


let startTime;
const localVideo = document.getElementById('localVideo');
const remoteVideo = document.getElementById('remoteVideo');

localVideo.addEventListener('loadedmetadata', function () {
    console.log(`Local video videoWidth: ${this.videoWidth}px,  videoHeight: ${this.videoHeight}px`);
});

remoteVideo.addEventListener('loadedmetadata', function () {
    console.log(`Remote video videoWidth: ${this.videoWidth}px,  videoHeight: ${this.videoHeight}px`);
});

remoteVideo.addEventListener('resize', () => {
    console.log(`Remote video size changed to ${remoteVideo.videoWidth}x${remoteVideo.videoHeight} - Time since pageload ${performance.now().toFixed(0)}ms`);
    // We'll use the first onsize callback as an indication that video has started
    // playing out.
    if (startTime) {
        const elapsedTime = window.performance.now() - startTime;
        console.log('Setup time: ' + elapsedTime.toFixed(3) + 'ms');
        startTime = null;
    }
});

async function start() {
    console.log('Requesting local stream');
    startButton.disabled = true;
    try {
        const stream = await navigator.mediaDevices.getUserMedia({audio: true, video: true});
        console.log('Received local stream');
        localVideo.srcObject = stream;
        localStream = stream;
        callButton.disabled = false;
    } catch (e) {
        alert(`getUserMedia() error: ${e.name}`);
        throw e
    }
}


function gotRemoteStream(e) {
    console.log(e)
    console.log(remoteVideo)
    if (remoteVideo.srcObject !== e.streams[0]) {
        remoteVideo.srcObject = e.streams[0];
        console.log('received remote stream');
    }
}

async function onIceCandidate(event, user) {
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

function onIceStateChange(event) {
    console.log(`ICE state: ${peerConnection.iceConnectionState}`);
    console.log('ICE state change event: ', event);
}

function openLocalTracks() {
    startTime = window.performance.now();

    const videoTracks = localStream.getVideoTracks();
    const audioTracks = localStream.getAudioTracks();

    if (videoTracks.length > 0) {
        console.log(`Using video device: ${videoTracks[0].label}`);
    }
    if (audioTracks.length > 0) {
        console.log(`Using audio device: ${audioTracks[0].label}`);
    }

    localStream.getTracks().forEach(track => peerConnection.addTrack(track, localStream));
}

async function call() {
    callButton.disabled = true;
    hangupButton.disabled = false;
    console.log('Starting call');

    openLocalTracks();

    const userToCall = prompt("call to: ")
    if (userToCall !== "no") {
        console.log('Added local stream');

        offerCall(userToCall).then(() => console.log("call offer sent"))
    }
}

// -------------------
let users // map sid: username

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

sio.on('user_added', data => {
    console.log("user added " + data.username)
    console.log(data)
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

sio.on('call_offered', async data => {
    console.log("call_offered")
    console.log(data)
    peerConnectedUserSID = data.from
    await acceptCall(data.offer, data.from)
})

sio.on('call_accepted', async data => {
    console.log("call_accepted")
    console.log(data)
    await peerConnection.setRemoteDescription(new RTCSessionDescription(data.answer))
})

sio.on('add_ice_candidate', async data => {
    console.log("try to add ice candidate")
    console.log(data.candidate)
    await peerConnection.addIceCandidate(new RTCIceCandidate(data.candidate))
})

sio.on('disconnect', () => {
    console.log('disconnected');
});

async function offerCall(username) {
    const remoteUserSID = getSIDbyUsername(username)
    peerConnectedUserSID = remoteUserSID

    const offer = await createOffer()
    sio.emit("offer_call", {
        offer,
        to: remoteUserSID
    });
}

// from: username
async function acceptCall(offer, from) {
    const answer = await createAnswer(offer)
    sio.emit("accept_call", {answer, with: from})
    openLocalTracks();
}


async function createOffer() {
    let offer = await peerConnection.createOffer(offerOptions)
    await peerConnection.setLocalDescription(new RTCSessionDescription(offer))
    return offer
}

async function createAnswer(offer) {
    await peerConnection.setRemoteDescription(new RTCSessionDescription(offer))
    let answer = await peerConnection.createAnswer(offerOptions)
    await peerConnection.setLocalDescription(new RTCSessionDescription(answer))
    return answer
}
