const app = require('./index');
const express = require('express');
const http = require('http').createServer(express);
const io = require('socket.io')(http);
const port = process.env.PORT || 8000;
const fs = require('fs');

let rooms = [];

io.origins('*:*'); // for latest version
io.on('connection', function (socket) {
    console.log('a user connected');

    socket.on('createRoom', (roomName, userName) => {
        socket.username = userName;
        this.rooms.push({
            name: roomName,
            playing: false,
            users: [{user: socket.id, username: userName, cards: []}],
            deck: [],
            stack: {}
        });
        socket.leaveAll();
        socket.join(roomName);
        console.log('created room ' + roomName);
        console.log(io.sockets.adapter.sids[socket.id]);
    });

    socket.on('joinRoom', (roomName, userName) => {
        socket.username = userName;
        for (let i = 0; i < this.rooms.length; ++i) {
            if (this.rooms[i].name === roomName) {
                this.rooms[i].users.push({user: socket.id, username: userName, cards: []});
                socket.leaveAll();
                socket.join(roomName);
                socket.broadcast.to(roomName).emit('roomData', this.rooms[i]);
                console.log('joined room ' + roomName);
            }
        }
    });

    socket.on('leaveRoom', () => {
        for (let i = 0; i < this.rooms.length; ++i) {
            for (let y = 0; y < this.rooms[i].users.length; ++y) {
                if (this.rooms[i].users[y].user === socket.id) {
                    this.rooms[i].users.splice(this.rooms[i].users.indexOf(this.rooms[i].users[y]), 1);
                    socket.leave(this.rooms[i].name);
                    socket.broadcast.to(this.rooms[i].name).emit('roomData', this.rooms[i]);
                    console.log('left room ' + this.rooms[i].name);
                }
            }
        }
    });

    socket.on('getRoomData', () => {
        for (let i = 0; i < this.rooms.length; ++i) {
            for (let y = 0; y < this.rooms[i].users.length; ++y) {
                if (this.rooms[i].users[y].user === socket.id) {
                    socket.emit('roomData', this.rooms[i]);
                }
            }
        }
    });

    socket.on('getAllRooms', () => {
        let availableRooms = [];
        console.log(this.rooms);

        for (let i = 0; i < this.rooms.length; ++i) {
            if (!this.rooms[i].playing && this.rooms[i].users.length !== 4) {
                availableRooms.push(this.rooms[i].name);
            }
        }
        socket.emit('responseAllRooms', availableRooms);
    });

    socket.on('clickStart', (room) => {
        socket.broadcast.to(room).emit('redirectStart');
        fs.readFile('./resources/cards.json', 'utf8', (err, jsonString) => {
            if (err) {
                console.log("File read failed:", err);
                return
            }
            let cards = JSON.parse(jsonString);
            for (let i = 0; i < this.rooms.length; ++i) {
                if (this.rooms[i].name === room) {
                    let shuffled = shuffle(cards.cards);
                    for (let y = 0; y < this.rooms[i].users.length; ++y) {
                        let count = 7;
                        while (count !== 0) {
                            this.rooms[i].users[y].cards.push(shuffled.shift());
                            --count;
                        }
                    }
                    this.rooms[i].stack = shuffled.shift();
                    this.rooms[i].deck.push(shuffled);
                }
            }
        });
    });

    socket.on("disconnect", () => {
        console.log("user disconnected");
    });
});

io.listen(8001);

function shuffle(array) {
    let ctr = array.length, temp, index;

    // While there are elements in the array
    while (ctr > 0) {
        // Pick a random index
        index = Math.floor(Math.random() * ctr);
        // Decrease ctr by 1
        ctr--;
        // And swap the last element with it
        temp = array[ctr];
        array[ctr] = array[index];
        array[index] = temp;
    }
    return array;
}

// define a simple route
app.get('/api', (req, res) => {
    res.status(200).send("uno backend");
});

app.listen(port, () => {
    console.log(`Server is running on PORT ${port}`);
});