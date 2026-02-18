const express = require("express");
const http = require("http");
const https = require("https");
const { Server } = require("socket.io");

const DUCKDNS_TOKEN = "438d7f63-da53-4ce8-afe8-2b48e907c131";
const DUCKDNS_DOMAIN = "letshakgaem";

function updateDuckDNS() {
    https.get(
        `https://www.duckdns.org/update?domains=${DUCKDNS_DOMAIN}&token=${DUCKDNS_TOKEN}&ip=`,
        (res) => {
            res.on("data", (d) => console.log("DuckDNS update:", d.toString()));
        }
    );
}

updateDuckDNS();
setInterval(updateDuckDNS, 5 * 60 * 1000);

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: { origin: "*" }
});

let players = {};
let props = [];
let balls = [];

io.on("connection", socket => {

    socket.emit("init", { players, props, balls });

    socket.on("newPlayer", data => {
        players[socket.id] = data;
        io.emit("updatePlayers", players);
    });

    socket.on("movePlayer", pos => {
        if (players[socket.id]) {
            players[socket.id].x = pos.x;
            players[socket.id].z = pos.z;
            io.emit("updatePlayers", players);
        }
    });

    socket.on("spawnProp", data => {
        props.push(data);
        io.emit("spawnProp", data);
    });

    socket.on("spawnBall", data => {
        const ball = {
            id: Date.now() + Math.random(),
            x: data.x,
            y: 3,
            z: data.z,
            vx: data.vx || 0,
            vy: 0,
            vz: data.vz || 0
        };
        balls.push(ball);
        io.emit("spawnBall", ball);
    });

    // Broadcast texture override to all other players
    socket.on("textureOverride", data => {
        socket.broadcast.emit("textureOverride", data);
    });

    socket.on("disconnect", () => {
        delete players[socket.id];
        io.emit("updatePlayers", players);
    });
});

server.listen(3000, () => {
    console.log("Lets Hac running on http://localhost:3000");
});
