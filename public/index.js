'use strict';

let users // map sid: username

const sio = io();

const currentUser = prompt("Please enter your name");

if (!currentUser) {
    throw "User can't be empty"
}

sio.on('connect', () => {
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

sio.on('call_offered', data => {
    console.log(data)
})

sio.on('disconnect', () => {
    console.log('disconnected');
});
