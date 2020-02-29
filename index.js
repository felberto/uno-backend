const express = require('express');
const bodyParser = require('body-parser');

const app = express();

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended: false}));

// define a simple route
app.get('/api', (req, res) => {
    res.status(200).send("uno backend");
});

module.exports = app;