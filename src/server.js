const pckg = require('../package.json');
const app = require('./index');
const express = require('express');
const http = require('http').createServer(express);
const io = require('socket.io')(http);
const port = process.env.PORT || 8000;
const portSocketIO = process.env.PORT || 8001;
const fs = require('fs');
const winston = require('winston');

let logger = winston.createLogger({
    level: 'info',
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.printf(info => {
            return `${info.timestamp} ${info.level}: ${info.message}`;
        })
    ),
    transports: [new winston.transports.Console()]
});

let rooms = [];

io.origins('*:*'); // for latest version
io.on('connection', function (socket) {
    logger.log('info', `user ${socket.id} connected`);

    socket.on('createRoom', (roomName, userName) => {
        socket.username = userName;
        rooms.push({
            name: roomName,
            playing: false,
            users: [{id: 0, user: socket.id, username: userName, cards: [], uno: false, finished: false}],
            deck: [],
            stack: {},
            trash: [],
            userTurn: null,
            direction: '+',
            ranking: []
        });
        socket.leaveAll();
        socket.join(roomName);
        socket.broadcast.emit('responseAllRooms', getAvailableRooms());
        logger.log('info', `user ${socket.id} created room ${roomName}`);
    });

    socket.on('joinRoom', (roomName, userName) => {
        socket.username = userName;
        let index = getRoomIndexByName(roomName);
        rooms[index['room']].users.push({
            id: 0,
            user: socket.id,
            username: userName,
            cards: [],
            uno: false,
            finished: false
        });
        socket.leaveAll();
        socket.join(roomName);
        socket.broadcast.to(roomName).emit('roomData', rooms[index['room']]);
        logger.log('info', `user ${socket.id} joined room ${roomName}`);
    });

    socket.on('leaveRoom', () => {
        let index = getRoomIndexAndUserIndexBySocketId(socket.id);

        rooms[index['room']].users.splice(rooms[index['room']].users.indexOf(rooms[index['room']].users[index['user']]), 1);
        socket.leave(rooms[index['room']].name);
        socket.broadcast.to(rooms[index['room']].name).emit('roomData', rooms[index['room']]);
        logger.log('info', `user ${socket.id} left room ${rooms[index['room']].name}`);

        removeRoomIfEmpty(index['room']);
        socket.broadcast.emit('responseAllRooms', getAvailableRooms());
    });

    socket.on('getRoomData', () => {
        let index = getRoomIndexAndUserIndexBySocketId(socket.id);
        socket.emit('roomData', rooms[index['room']]);
    });

    socket.on('getAllRooms', () => {
        socket.emit('responseAllRooms', getAvailableRooms());
    });

    socket.on('clickStart', (room) => {
        resetRoom(room);

        socket.broadcast.to(room).emit('redirectStart');
        fs.readFile('./resources/cards.json', 'utf8', (err, jsonString) => {
            if (err) {
                logger.log('error', `File read failed: ${err}`);
                return
            }
            let cards = JSON.parse(jsonString);

            let index = getRoomIndexByName(room);
            rooms[index['room']].playing = true;
            rooms[index['room']].users = shuffle(rooms[index['room']].users);
            let shuffled = shuffle(cards.cards);
            for (let y = 0; y < rooms[index['room']].users.length; ++y) {
                rooms[index['room']].users[y].id = rooms[index['room']].users.indexOf(rooms[index['room']].users[y]);
                let count = 7;
                while (count !== 0) {
                    rooms[index['room']].users[y].cards.push(shuffled.shift());
                    --count;
                }
            }

            //check if stack card is not black
            let stackCard = shuffled.shift();
            while (stackCard.color === 'black') {
                shuffled.push(stackCard);
                stackCard = shuffled.shift();
            }
            rooms[index['room']].stack = stackCard;
            rooms[index['room']].deck = shuffled;
            rooms[index['room']].userTurn = Math.floor(Math.random() * rooms[index['room']].users.length);
            logger.log('info', `game in room ${rooms[index['room']].name} started`);
        });
    });

    socket.on("playCard", (card, color) => {
        let counter;
        let index = getRoomIndexAndUserIndexBySocketId(socket.id);

        checkIfUnoIsActive(index, card);

        card.colorChoice = color;
        if (valid(card, rooms[index['room']].stack)) {
            playCard(index, card);

            checkIfUserPlayedLastCard(index);

            if (!checkIfGameIsFinished(index)) {

                counter = checkIfCardActionIsReturnOrSuspend(index, card);

                while (counter !== 0) {
                    userTurn(index);
                    counter = counter - 1;
                }

                checkIfUserIsFinished(index);
            }
            if (card.action === 'draw2') {
                cardActionDraw(index, 2);
            } else if (card.action === 'draw4') {
                cardActionDraw(index, 4);
            }
        }
        socket.emit('roomData', rooms[index['room']]);
        socket.broadcast.to(rooms[index['room']].name).emit('roomData', rooms[index['room']]);

        if (checkIfGameIsFinished(index)) {
            socket.emit('finishGame');
            socket.broadcast.to(rooms[index['room']].name).emit('finishGame');
            rooms[index['room']].playing = false;
            logger.log('info', `game in room ${rooms[index['room']].name} finished`);
        }
    });

    socket.on("getCard", () => {
        let index = getRoomIndexAndUserIndexBySocketId(socket.id);

        resetUno(index);

        let card = getCard(index);

        if (!valid(card, rooms[index['room']].stack)) {
            userTurn(index);
        }
        socket.emit('roomData', rooms[index['room']]);
        socket.broadcast.to(rooms[index['room']].name).emit('roomData', rooms[index['room']]);
    });

    socket.on("clickUno", () => {
        let index = getRoomIndexAndUserIndexBySocketId(socket.id);

        rooms[index['room']].users[index['user']].uno = true;

        socket.emit('roomData', rooms[index['room']]);
        socket.broadcast.to(rooms[index['room']].name).emit('roomData', rooms[index['room']]);
        logger.log('info', `user ${rooms[index['room']].users[index['user']].username} clicked uno`);
    });

    socket.on("disconnect", () => {
        logger.log('info', `user ${socket.id} disconnected`);
        socket.leaveAll();

        let index = getRoomIndexAndUserIndexBySocketId(socket.id);

        if (index !== undefined) {
            rooms[index['room']].users.splice(rooms[index['room']].users.indexOf(rooms[index['room']].users[index['user']]), 1);
            socket.leave(rooms[index['room']].name);
            socket.broadcast.to(rooms[index['room']].name).emit('roomData', rooms[index['room']]);
            logger.log('info', `user ${socket.id} left room ${rooms[index['room']].name}`);

            socket.broadcast.to(rooms[index['room']].name).emit('cancelGame');
            rooms[index['room']].playing = false;

            removeRoomIfEmpty(index['room']);
        }
    });
});

io.listen(portSocketIO);

function getAvailableRooms() {
    let availableRooms = [];

    for (let i = 0; i < rooms.length; ++i) {
        if (!rooms[i].playing && rooms[i].users.length !== 4) {
            availableRooms.push(rooms[i].name);
        }
    }

    return availableRooms;
}

function getRoomIndexByName(roomName) {
    let index = {};
    for (let i = 0; i < rooms.length; ++i) {
        if (rooms[i].name === roomName) {
            index['room'] = i;
            return index;
        }
    }
}

function getRoomIndexAndUserIndexBySocketId(socketId) {
    let index = {};
    for (let i = 0; i < rooms.length; ++i) {
        for (let y = 0; y < rooms[i].users.length; ++y) {
            if (rooms[i].users[y].user === socketId) {
                index['room'] = i;
                index['user'] = y;
                return index;
            }
        }
    }
}

function removeRoomIfEmpty(roomIndex) {
    if (rooms[roomIndex].users.length === 0) {
        let roomName = rooms[roomIndex].name;
        rooms = rooms.filter(room => room.name !== rooms[roomIndex].name);
        logger.log('info', `room ${roomName} deleted`);
    }
}

function resetRoom(room) {
    for (let i = 0; i < rooms.length; ++i) {
        if (rooms[i].name === room) {
            rooms[i].deck = [];
            rooms[i].stack = {};
            rooms[i].userTurn = null;
            rooms[i].direction = '+';
            //ToDo: don't reset for score for all games
            rooms[i].ranking = [];
            for (let j = 0; j < rooms[i].users.length; ++j) {
                rooms[i].users[j].cards = [];
                rooms[i].users[j].uno = false;
                rooms[i].users[j].finished = false;
            }
        }
    }
    logger.log('info', `room ${room} reseted`);
}

function checkIfUnoIsActive(index, card) {
    if (rooms[index['room']].users[index['user']].cards.length === 1 && rooms[index['room']].users[index['user']].uno && !valid(card, rooms[index['room']].stack)) {
        rooms[index['room']].users[index['user']].uno = false;
        logger.log('info', `uno reseted for user ${rooms[index['room']].users[index['user']].username}`);
    } else if (rooms[index['room']].users[index['user']].cards.length === 2 && !rooms[index['room']].users[index['user']].uno) {
        for (let j = 0; j < 2; ++j) {
            getCard(index);
        }
    } else if (rooms[index['room']].users[index['user']].cards.length > 2 && rooms[index['room']].users[index['user']].uno) {
        getCard(index);
        rooms[index['room']].users[index['user']].uno = false;
        logger.log('info', `uno reseted for user ${rooms[index['room']].users[index['user']].username}`);
    }
}

function getCard(index) {
    let card = rooms[index['room']].deck.shift();
    if (rooms[index['room']].deck.length === 0) {
        rooms[index['room']].deck = shuffle(rooms[index['room']].trash);
    }
    rooms[index['room']].users[index['user']].cards.push(card);
    logger.log('info', `user ${rooms[index['room']].users[index['user']].username} got card ${card.color} ${card.number} ${card.action}`);
    return card;
}

function playCard(index, card) {
    rooms[index['room']].users[index['user']].cards = rooms[index['room']].users[index['user']].cards.filter(userCard => userCard.id !== card.id);
    rooms[index['room']].trash.push(rooms[index['room']].stack);
    rooms[index['room']].stack = card;
    logger.log('info', `user ${rooms[index['room']].users[index['user']].username} played card ${card.color} ${card.number} ${card.action}`);
}

function checkIfUserPlayedLastCard(index) {
    if (rooms[index['room']].users[index['user']].cards.length === 0 && rooms[index['room']].ranking.length === (rooms[index['room']].users.length - 2)) {
        finishPlayer(index);
        rooms[index['room']].ranking.push(rooms[index['room']].users.filter(user => user.finished !== true)[0]);
        rooms[index['room']].users.filter(user => user.finished === true)[0].finished = true;
    } else if (rooms[index['room']].users[index['user']].cards.length === 0 && rooms[index['room']].ranking.length < (rooms[index['room']].users.length - 2)) {
        finishPlayer(index);
    }
}

function finishPlayer(index) {
    rooms[index['room']].ranking.push(rooms[index['room']].users[index['user']]);
    rooms[index['room']].users[index['user']].finished = true;
    logger.log('info', `user ${rooms[index['room']].users[index['user']].username} finished`);
}

function checkIfGameIsFinished(index) {
    return rooms[index['room']].ranking.length === rooms[index['room']].users.length;
}

function checkIfCardActionIsReturnOrSuspend(index, card) {
    let counter = 1;
    if (card.action === 'return') {
        if (rooms[index['room']].direction === '+') {
            rooms[index['room']].direction = '-';
        } else {
            rooms[index['room']].direction = '+';
        }
    } else if (card.action === 'suspend') {
        counter = 2;
    }
    return counter;
}

function userTurn(index) {
    if (rooms[index['room']].direction === '+') {
        rooms[index['room']].userTurn = rooms[index['room']].userTurn + 1;
        if (rooms[index['room']].userTurn === rooms[index['room']].users.length) {
            rooms[index['room']].userTurn = 0;
        }
    } else {
        rooms[index['room']].userTurn = rooms[index['room']].userTurn - 1;
        if (rooms[index['room']].userTurn === -1) {
            rooms[index['room']].userTurn = rooms[index['room']].users.length - 1;
        }
    }
    logger.log('info', `next user is up`);
}

function checkIfUserIsFinished(index) {
    for (let z = 0; z < rooms[index['room']].users.length; ++z) {
        while (rooms[index['room']].users[z].id === rooms[index['room']].userTurn && rooms[index['room']].users[z].finished) {
            userTurn(index);
        }
    }
}

function cardActionDraw(index, count) {
    for (let z = 0; z < rooms[index['room']].users.length; ++z) {
        if (rooms[index['room']].users[z].id === rooms[index['room']].userTurn) {
            rooms[index['room']].users[z].uno = false;
            logger.log('info', `uno reseted for user ${rooms[index['room']].users[index['user']].username}`);
            index['user'] = z;
            while (count !== 0) {
                getCard(index);
                --count;
            }
        }
    }
}

function resetUno(index) {
    if (rooms[index['room']].users[index['user']].cards.length === 1 && rooms[index['room']].users[index['user']].uno) {
        rooms[index['room']].users[index['user']].uno = false;
        logger.log('info', `reseted uno for user ${rooms[index['room']].users[index['user']].username}`);
    }
}

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

app.listen(port, () => {
    logger.log('info', `################################################################`);
    logger.log('info', `${pckg.name} ${pckg.version} is starting...`);
    logger.log('info', `Server is running on PORT ${port}`);
    logger.log('info', `SocketIO is running on PORT ${portSocketIO}`);
    logger.log('info', `################################################################`);
});