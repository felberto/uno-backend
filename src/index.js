const express = require('express');
const bodyParser = require('body-parser');
const http = require('http').createServer(express);
const io = require('socket.io')(http);

const app = express();

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended: false}));

// Set CORS on express
app.use(function (req, res, next) {
    res.header("Access-Control-Allow-Origin", "http://localhost:3000");
    res.header("Access-Control-Allow-Credentials", "true");
    res.header("Access-Control-Allow-Methods", "GET, PUT, POST, DELETE");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, Authorization");
    next();
});

// define a simple route
app.get('/api', (req, res) => {
    res.status(200).send("uno backend");
});

module.exports = app;