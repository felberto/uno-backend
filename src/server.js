const app = require('./index');
const express = require('express');
const http = require('http').createServer(express);
const io = require('socket.io')(http);
const port = process.env.PORT || 8000;

io.origins('*:*'); // for latest version
io.on('connection', function (socket) {
    console.log('a user connected');

    socket.on('createRoom', (roomName, userName) => {
        socket.username = userName;
        socket.join(roomName);
        console.log('created room ' + roomName);
    });

    socket.on('joinRoom', (roomName, userName) => {
        socket.username = userName;
        socket.join(roomName);
        console.log('joined room ' + roomName);
    });

    socket.on('leaveRoom', () => {
        const room = Object.keys(socket.rooms);
        socket.leave(room);
        console.log('left room ' + room);
    });

    socket.on('getAllRooms', () => {
        let availableRooms = [];
        let rooms = io.sockets.adapter.rooms;
        if (rooms) {
            for (let room in rooms) {
                if (!rooms[room].hasOwnProperty(room)) {
                    availableRooms.push({name: room});
                }
            }
        }
        socket.emit('responseAllRooms', availableRooms);
    });

    socket.on("disconnect", () => {
        console.log("user disconnected");
    });
});

io.listen(8001);

// define a simple route
app.get('/api', (req, res) => {
    res.status(200).send("uno backend");
});

app.listen(port, () => {
    console.log(`Server is running on PORT ${port}`);
});