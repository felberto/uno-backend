const app = require('./index');
const express = require('express');
const http = require('http').createServer(express);
const io = require('socket.io')(http);
const port = process.env.PORT || 8000;

io.origins('*:*'); // for latest version
io.on('connection', function (socket) {
    console.log('a user connected');

    socket.on('createLobby', (lobbyName, userName) => {
        socket.username = userName;
        socket.join(lobbyName);
        console.log('created lobby ' + lobbyName);
        console.log(io.sockets.adapter.rooms);
    });

    socket.on('joinLobby', (lobbyName, userName) => {
        socket.username = userName;
        socket.join(lobbyName);
        console.log('joined lobby ' + lobbyName);
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