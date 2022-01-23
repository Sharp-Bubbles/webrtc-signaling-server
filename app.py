import socketio

sio = socketio.AsyncServer(async_mode="asgi", cors_allowed_origins="*")
app = socketio.ASGIApp(sio, static_files={"/": "./public/"})

connected_users = {}  # mapping Dict[sid, username]


def _get_sid_by_username(username: str):
    for key, value in connected_users.items():
        if value == username:
            return key


@sio.event
async def connect(sid, environ):
    print(sid, "connected")
    # connected.add(sid)


@sio.event
async def add_user(sid, data):
    username = data["username"]
    connected_users[sid] = username
    # todo: broadcast
    await sio.emit(
        "user_added",
        {
            "users": [
                {"sid": sid, "username": username} for sid, username in connected_users.items()
            ],
            "username": username,
            "sid": sid,
        },
    )
    print(connected_users)


@sio.event
async def disconnect(sid):
    print(sid, "disconnected")
    username = connected_users.pop(sid)
    await sio.emit(
        "user_disconnected",
        {
            "username": username,
            "sid": sid,
            "users": [
                {"sid": sid, "username": username} for sid, username in connected_users.items()
            ],
        },
    )
    print(connected_users)


@sio.event
async def offer_call(sid, data):
    print("call is offered")
    print(sid)
    print(data)
    await sio.emit("call_offered", {"offer": data["offer"], "from": sid}, to=data["to"])


@sio.event
async def accept_call(sid, data):
    print("call is offered")
    print(connected_users)
    print(sid)
    print(data)
    await sio.emit("call_accepted", {"answer": data["answer"], "from": sid}, to=data["with"])


# async function onIceCandidate(pc, event) {
#     try {
#         await (getOtherPc(pc).addIceCandidate(event.candidate));
#         onAddIceCandidateSuccess(pc);
#     } catch (e) {
#         onAddIceCandidateError(pc, e);
#     }
#     console.log(`${getName(pc)} ICE candidate:\n${event.candidate ? event.candidate.candidate : '(null)'}`);
# }

@sio.event
async def icecandidate(sid, data):
    pass


@sio.event
async def sum(sid, data):
    print(connected_users)
    result = data["numbers"][0] + data["numbers"][1]
    await sio.emit("sum_result", {"result": result}, to=sid)
