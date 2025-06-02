// server.js
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
  }
});

// Middleware
app.use(cors());
app.use(express.json());

// Simple root route
app.get('/', (req, res) => {
  res.send('MMORPG 2D Backend Server is running!');
});

const MAX_PLAYERS = 10;
let players = {}; // { socketId: {x, y, ...} }

io.on('connection', (socket) => {
  if (Object.keys(players).length >= MAX_PLAYERS) {
    socket.emit('server_full', { message: 'Servidor cheio. Tente novamente mais tarde.' });
    socket.disconnect();
    return;
  }

  // Novo player entra
  players[socket.id] = {
    id: socket.id,
    x: Math.random() * 500,
    y: Math.random() * 500,
    // mais atributos podem ser adicionados aqui
  };

  // Enviar estado inicial
  socket.emit('init', { id: socket.id, players });

  // Informar outros jogadores
  socket.broadcast.emit('player_joined', players[socket.id]);

  // Recebe atualização de movimento
  socket.on('move', (data) => {
    if (players[socket.id]) {
      players[socket.id].x = data.x;
      players[socket.id].y = data.y;
      // Broadcast para os outros jogadores
      socket.broadcast.emit('player_moved', { id: socket.id, x: data.x, y: data.y });
    }
  });

  // Desconexão
  socket.on('disconnect', () => {
    delete players[socket.id];
    io.emit('player_left', { id: socket.id });
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});
