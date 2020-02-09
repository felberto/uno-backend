const express = require('express');

// create express app
const app = express();

// Set CORS on express
app.use(function (req, res, next) {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Methods", "GET, PUT, POST, DELETE");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, Authorization");
    next();
});

// define a simple route
app.get('/api', (req, res) => {
    res.send("uno backend");
});

// listen for requests
app.listen(8080, () => {
    console.log("Server is listening on port 8080");
});