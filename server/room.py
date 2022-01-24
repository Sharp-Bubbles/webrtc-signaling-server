import typing as t


class _Room:
    def __init__(self, name, admin_sid):
        self.name = name
        self.users_sids: t.Set = set()
        self.admin_sid = admin_sid

    def get_all_users(self):
        return [self.admin_sid, *self.users_sids]


class Rooms:
    def __init__(self):
        self.rooms: t.Dict[str, _Room] = {}

    def get(self, name) -> _Room:
        return self.rooms.get(name)

    def has(self, name) -> bool:
        return name in self.rooms.keys()

    def add_user_to_room(self, room_name, user_sid):
        room = self.rooms.get(room_name)
        if not room:
            raise RuntimeError("such room doesn't exist")

        return room.users_sids.add(user_sid)

    def create(self, name, admin_sid):
        if self.rooms.get(name):
            raise RuntimeError("such room is already exists")
        self.rooms[name] = _Room(name, admin_sid)

    def remove(self):
        self.rooms: t.Dict[str, _Room] = {}

    def pop(self, name):
        return self.rooms.pop(name)
