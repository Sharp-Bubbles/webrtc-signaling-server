import socketio

sio = socketio.AsyncServer(async_mode="asgi", cors_allowed_origins="*")
app = socketio.ASGIApp(sio, static_files={"/": "./public/"})

connected_users = {}  # mapping Dict[sid, username]

GLOBAL_ROOM = "global_room"


@sio.event
async def join_global_room(sid, data):
    sio.enter_room(sid, GLOBAL_ROOM)
    connected_users[sid] = data["username"]
    await sio.emit(
        "user_joined_global_room",
        {"sid": sid, "username": data["username"], "users": [
            {"sid": sid, "username": username} for sid, username in connected_users.items()
        ]},
        room=GLOBAL_ROOM
    )


@sio.event
async def connect(sid, environ):
    print(sid, "connected")


@sio.event
async def disconnect(sid):
    sio.leave_room(sid, GLOBAL_ROOM)
    username = connected_users.pop(sid)
    await sio.emit("user_left_global_room", {"sid": sid, "username": username, "users": [
        {"sid": sid, "username": username} for sid, username in connected_users.items()
    ]}, room=GLOBAL_ROOM, skip_sid=sid)


@sio.event
async def offer_call(sid, data):
    print("call is offered")
    await sio.emit("call_offered", {"offer": data["offer"], "from": sid}, to=data["to"])


@sio.event
async def accept_call(sid, data):
    print("call is offered")
    await sio.emit("call_accepted", {"answer": data["answer"], "from": sid}, to=data["with"])


@sio.event
async def ice_candidate(sid, data):
    print("ice candidate")
    await sio.emit("add_ice_candidate", {"candidate": data["candidate"], "from": sid}, to=data["to"])
