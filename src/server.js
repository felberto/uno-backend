const app = require('./app');
const http = require('http').createServer(express);
const io = require('socket.io')(http);
const port = process.env.PORT || 8000;

io.origins('*:*'); // for latest version

io.on('connection', function (socket) {
    console.log('a user connected');

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