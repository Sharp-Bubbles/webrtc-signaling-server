'use strict';

let users // map sid: username

function getSIDbyUsername(value) {
    for (let [k, v] of users.entries()) {
        if (v === value)
            return k;
    }
}

const peerConnection = new RTCPeerConnection({})

const sio = io();

const currentUser = prompt("Please enter your name");

if (!currentUser) {
    throw "User can't be empty"
}

// async function onIceCandidate(event) {
//     console.log(event)
//     try {
//         await peerConnection.addIceCandidate(event.candidate);
//     } catch (e) {
//         console.error('Failed to add ICE candidate')
//     }
//     console.log(`ICE candidate:\n${event.candidate ? event.candidate.candidate : '(null)'}`);
// }

// peerConnection.addEventListener('icecandidate', e => onIceCandidate(pc2, e));

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
    await acceptCall(data.offer, data.from)
})

sio.on('call_accepted', async data => {
    console.log("call_accepted")
    console.log(data)
    await callAccepted(data.answer)
})

sio.on('disconnect', () => {
    console.log('disconnected');
});

async function offerCall(username) {
    const offer = await createOffer()
    sio.emit("offer_call", {
        offer,
        to: getSIDbyUsername(username)
    });
}

// from: username
async function acceptCall(offer, from) {
    const answer = await createAnswer(offer)
    sio.emit("accept_call", {answer, with: from})
}

async function callAccepted(answer, from) {
    await peerConnection.setRemoteDescription(new RTCSessionDescription(answer))
}


async function createOffer() {
    let offer = await peerConnection.createOffer({OfferToReceiveAudio: true, OfferToReceiveVideo: true})
    await peerConnection.setLocalDescription(new RTCSessionDescription(offer))
    return offer
}

async function createAnswer(offer) {
    await peerConnection.setRemoteDescription(new RTCSessionDescription(offer))
    let answer = await peerConnection.createAnswer({OfferToReceiveAudio: true, OfferToReceiveVideo: true})
    await peerConnection.setLocalDescription(new RTCSessionDescription(answer))
    return answer
}


function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

sleep(1000).then(
    () => {
        const userToCall = prompt("call to: ")
        if (userToCall !== "no") {
            console.log("call")
            offerCall(userToCall).then(
                () => {
                    console.log("call offer sent")
                }
            )
        }
    }
)
