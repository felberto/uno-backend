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
            users: [{id: 0, user: socket.id, username: userName, cards: [], uno: false}],
            deck: [],
            stack: {},
            userTurn: null,
            direction: '+'
        });
        socket.leaveAll();
        socket.join(roomName);
        console.log('created room ' + roomName);
        console.log(io.sockets.adapter.sids[socket.id]);

        let availableRooms = [];
        console.log(this.rooms);

        for (let i = 0; i < this.rooms.length; ++i) {
            if (!this.rooms[i].playing && this.rooms[i].users.length !== 4) {
                availableRooms.push(this.rooms[i].name);
            }
        }
        socket.broadcast.emit('responseAllRooms', availableRooms);
    });

    socket.on('joinRoom', (roomName, userName) => {
        console.log('join');
        console.log(roomName);
        socket.username = userName;
        for (let i = 0; i < this.rooms.length; ++i) {
            if (this.rooms[i].name === roomName) {
                this.rooms[i].users.push({id: 0, user: socket.id, username: userName, cards: []});
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
                    this.rooms[i].users = shuffle(this.rooms[i].users);
                    let shuffled = shuffle(cards.cards);
                    for (let y = 0; y < this.rooms[i].users.length; ++y) {
                        this.rooms[i].users[y].id = this.rooms[i].users.indexOf(this.rooms[i].users[y]);
                        let count = 7;
                        while (count !== 0) {
                            this.rooms[i].users[y].cards.push(shuffled.shift());
                            --count;
                        }
                    }
                    this.rooms[i].stack = shuffled.shift();
                    this.rooms[i].deck = shuffled;
                    this.rooms[i].userTurn = Math.floor(Math.random() * this.rooms[i].users.length);
                }
            }
        });
    });

    socket.on("playCard", (card, color) => {
        let counter;
        for (let i = 0; i < this.rooms.length; ++i) {
            for (let y = 0; y < this.rooms[i].users.length; ++y) {
                if (this.rooms[i].users[y].user === socket.id) {
                    console.log(this.rooms[i].users[y].uno);
                    if (this.rooms[i].users[y].cards.length === 2 && !this.rooms[i].users[y].uno) {
                        for (let j = 0; j < 2; ++j) {
                            let card = this.rooms[i].deck.shift();
                            this.rooms[i].users[y].cards.push(card);
                        }
                    } else if (this.rooms[i].users[y].cards.length > 2 && this.rooms[i].users[y].uno) {
                        let card = this.rooms[i].deck.shift();
                        this.rooms[i].users[y].cards.push(card);
                    }
                    card.colorChoice = color;
                    if (valid(card, this.rooms[i].stack)) {
                        this.rooms[i].users[y].cards = this.rooms[i].users[y].cards.filter(userCard => userCard.id !== card.id);
                        this.rooms[i].stack = card;
                        counter = 1;
                        if (card.action === 'return') {
                            if (this.rooms[i].direction === '+') {
                                this.rooms[i].direction = '-';
                            } else {
                                this.rooms[i].direction = '+';
                            }
                        } else if (card.action === 'suspend') {
                            counter = 2;
                        }

                        while (counter !== 0) {
                            if (this.rooms[i].direction === '+') {
                                this.rooms[i].userTurn = this.rooms[i].userTurn + 1;
                                if (this.rooms[i].userTurn === this.rooms[i].users.length) {
                                    this.rooms[i].userTurn = 0;
                                }
                            } else {
                                this.rooms[i].userTurn = this.rooms[i].userTurn - 1;
                                if (this.rooms[i].userTurn === -1) {
                                    this.rooms[i].userTurn = this.rooms[i].users.length - 1;
                                }
                            }
                            counter = counter - 1;
                        }

                        if (card.action === 'draw2') {
                            for (let z = 0; z < this.rooms[i].users.length; ++z) {
                                if (this.rooms[i].users[z].id === this.rooms[i].userTurn) {
                                    let count = 2;
                                    while (count !== 0) {
                                        this.rooms[i].users[z].cards.push(this.rooms[i].deck.shift());
                                        --count;
                                    }
                                }
                            }
                        } else if (card.action === 'draw4') {
                            for (let z = 0; z < this.rooms[i].users.length; ++z) {
                                if (this.rooms[i].users[z].id === this.rooms[i].userTurn) {
                                    let count = 4;
                                    while (count !== 0) {
                                        this.rooms[i].users[z].cards.push(this.rooms[i].deck.shift());
                                        --count;
                                    }
                                }
                            }
                        }

                        socket.emit('roomData', this.rooms[i]);
                        socket.broadcast.to(this.rooms[i].name).emit('roomData', this.rooms[i]);
                    }
                }
            }
        }
    });

    socket.on("getCard", () => {
        for (let i = 0; i < this.rooms.length; ++i) {
            for (let y = 0; y < this.rooms[i].users.length; ++y) {
                if (this.rooms[i].users[y].user === socket.id) {
                    let card = this.rooms[i].deck.shift();
                    this.rooms[i].users[y].cards.push(card);
                    if (!valid(card, this.rooms[i].stack)) {
                        if (this.rooms[i].direction === '+') {
                            this.rooms[i].userTurn = this.rooms[i].userTurn + 1;
                            if (this.rooms[i].userTurn === this.rooms[i].users.length) {
                                this.rooms[i].userTurn = 0;
                            }
                        } else {
                            this.rooms[i].userTurn = this.rooms[i].userTurn - 1;
                            if (this.rooms[i].userTurn === -1) {
                                this.rooms[i].userTurn = this.rooms[i].users.length - 1;
                            }
                        }
                    }
                    socket.emit('roomData', this.rooms[i]);
                    socket.broadcast.to(this.rooms[i].name).emit('roomData', this.rooms[i]);
                }
            }
        }
    });

    socket.on("clickUno", () => {
        for (let i = 0; i < this.rooms.length; ++i) {
            for (let y = 0; y < this.rooms[i].users.length; ++y) {
                if (this.rooms[i].users[y].user === socket.id) {
                    this.rooms[i].users[y].uno = true;

                    socket.emit('roomData', this.rooms[i]);
                    socket.broadcast.to(this.rooms[i].name).emit('roomData', this.rooms[i]);
                }
            }
        }
    });

    socket.on("disconnect", () => {
        console.log("user disconnected");
    });
});

io.listen(8001);

function valid(card, stackCard) {
    if ((stackCard.color === card.color && stackCard.color !== 'black') || (stackCard.number === card.number && card.number !== null) || (stackCard.action === card.action && card.action !== null)) {
        return true;
    } else if (card.color === 'black' && stackCard.color !== 'black') {
        return true;
    } else if (stackCard.color === 'black' && stackCard.colorChoice === card.color) {
        return true
    } else {
        return false;
    }
}

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