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
        this.rooms.push({name: roomName, users: [socket.id], variables: {}});
        socket.join(roomName);
        console.log('created room ' + roomName);
        console.log(this.rooms)
    });

    socket.on('joinRoom', (roomName, userName) => {
        console.log(socket.id);
        socket.username = userName;
        this.rooms.forEach(room => {
            if (room.name === roomName) {
                room.users.push(socket.id);
            }
        });
        socket.join(roomName);
        console.log('joined room ' + roomName);
        console.log(this.rooms);
    });

    socket.on('getAllRooms', () => {
        socket.emit('responseAllRooms', this.rooms);
    });

    socket.on('startGame', () => {
        let rawData = fs.readFileSync('cards.json');
        let cards = JSON.parse(rawData);
        console.log(cards);

        //Store deck in client id => https://stackoverflow.com/questions/15876616/save-data-on-socket-in-socket-io
        //Or over multiple sockets for all users
        socket.deck = shuffle(cards);
        console.log(socket.deck);
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