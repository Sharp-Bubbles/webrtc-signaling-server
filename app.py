import socketio

from server.room import Rooms

sio = socketio.AsyncServer(async_mode="asgi", cors_allowed_origins="*")
app = socketio.ASGIApp(sio, static_files={"/": "./public/"})

connected_users = {}  # mapping Dict[sid, username]

rooms = Rooms()


@sio.event
async def join_global_room(sid, data):
    connected_users[sid] = data["username"]
    await sio.emit(
        "user_joined_global_room",
        {"sid": sid, "username": data["username"], "users": [
            {"sid": sid, "username": username} for sid, username in connected_users.items()
        ]},
    )


@sio.event
async def create_private_room(sid):
    username = connected_users[sid]

    room_name = f"{sid}_{username}"
    # todo: temp fix to have unique room name
    import random
    room_name = room_name + str(random.randint(0, 10 ** 20))

    rooms.create(room_name, sid)
    sio.enter_room(sid, room_name)

    await sio.emit("private_room_created", {"room_name": room_name, "invite_link": room_name}, to=sid)


@sio.event
async def join_private_room(sid, data):
    room_name = data["room"]
    username = data["username"]

    rooms.add_user_to_room(room_name, sid)
    sio.enter_room(sid, room_name)

    await sio.emit("user_joined_private_room", {"username": username}, room=room_name, skip_sid=sid)


async def left_room(room_name, sid):
    room = rooms.get(room_name)
    if room.admin_sid == sid:
        removed_room = rooms.pop(room_name)
        participant_sids = removed_room.users_sids
        for sid in participant_sids:
            print('disconnect sid' + sid)
            await sio.emit("disconnected_from_private_room", to=sid)
        await sio.close_room(room_name)
    else:
        room.users_sids.remove(sid)
        sio.leave_room(sid, room_name)
        await sio.emit("user_left_private_room", {"username": connected_users[sid], "sid": sid}, room=room_name,
                       skip_id=sid)


@sio.event
async def disconnect_from_private_room(sid, data):
    await sio.emit("disconnected_from_private_room_by_admin", to=sid)
    # room_name = data["room"]
    # left_room(room_name, sid)


@sio.event
async def leave_private_room(sid, data):
    room_name = data["room"]
    await left_room(room_name, sid)


@sio.event
async def connect(sid, environ):
    print(sid, "connected")


@sio.event
async def disconnect(sid):
    print("disconnect called")
    print(sio.rooms(sid))
    for room in sio.rooms(sid):
        # todo: why more roooms with (user sid) also here
        if room in rooms.rooms.keys():
            await left_room(room, sid)

    username = connected_users.pop(sid)
    await sio.emit("user_left_global_room", {"sid": sid, "username": username, "users": [
        {"sid": sid, "username": username} for sid, username in connected_users.items()
    ]}, skip_sid=sid)


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
