const express = require('express');
const bodyParser = require('body-parser');

const app = express();

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended: false}));

const port = process.env.PORT || 8000;

// define a simple route
app.get('/api', (req, res) => {
    res.send("uno backend");
});

app.listen(port, () => {
    console.log(`Server is running on PORT ${port}`);
});