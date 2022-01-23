import socketio

sio = socketio.AsyncServer(async_mode="asgi", cors_allowed_origins="*")
app = socketio.ASGIApp(sio, static_files={"/": "./public/"})

users = {}  # mapping Dict[sid, username]


@sio.event
async def connect(sid, environ):
    print(sid, "connected")
    # connected.add(sid)


@sio.event
async def add_user(sid, data):
    username = data["username"]
    users[sid] = username
    # todo: broadcast
    await sio.emit(
        "user_added",
        {
            "users": [
                {"sid": sid, "username": username} for sid, username in users.items()
            ],
            "username": username,
            "sid": sid,
        },
    )
    print(users)


@sio.event
async def disconnect(sid):
    print(sid, "disconnected")
    username = users.pop(sid)
    await sio.emit(
        "user_disconnected",
        {
            "username": username,
            "sid": sid,
            "users": [
                {"sid": sid, "username": username} for sid, username in users.items()
            ],
        },
    )
    print(users)


@sio.event
async def offer_call(sid, data):
    print("call is offered")
    print(sid)
    print(data)
    await sio.emit("call_offered", {"offer": data["offer"], "from": sid}, to=data["to"])


@sio.event
async def sum(sid, data):
    print(users)
    result = data["numbers"][0] + data["numbers"][1]
    await sio.emit("sum_result", {"result": result}, to=sid)
