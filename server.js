// server.js
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const path = require('path');
const crypto = require('crypto');
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
app.use(express.static(path.join(__dirname, 'public')));

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

  // Novo player entra (aguarda primeiro movimento para registrar info real)
  players[socket.id] = {
    id: socket.id,
    x: 0,
    y: 0,
    name: 'Outro',
    color: '#00eaff',
    mapId: 'mapa1',
  };

  // Enviar estado inicial
  socket.emit('init', { id: socket.id, players });

  // Informar outros jogadores
  socket.broadcast.emit('player_joined', players[socket.id]);

  // Recebe atualização de movimento e info
  socket.on('move', (data) => {
    if (players[socket.id]) {
      players[socket.id].x = data.x;
      players[socket.id].y = data.y;
      players[socket.id].name = data.name || players[socket.id].name;
      players[socket.id].color = data.color || players[socket.id].color;
      players[socket.id].mapId = data.mapId || players[socket.id].mapId;
      // Broadcast para os outros jogadores
      socket.broadcast.emit('player_moved', { id: socket.id, x: data.x, y: data.y, name: players[socket.id].name, color: players[socket.id].color, mapId: players[socket.id].mapId });
    }
  });

  // Desconexão
  socket.on('disconnect', () => {
    delete players[socket.id];
    io.emit('player_left', { id: socket.id });
  });
});

// --- Cadastro/Login de Usuários ---
const fs = require('fs');
const USERS_FILE = './users.json';

// Função para ler usuários do arquivo
function readUsers() {
    if (!fs.existsSync(USERS_FILE)) return [];
    return JSON.parse(fs.readFileSync(USERS_FILE));
}

// Função para salvar usuários no arquivo
function saveUsers(users) {
    fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
}

// Cadastro
app.post('/api/register', (req, res) => {
    const { login, password } = req.body;
    if (!login || !password) return res.status(400).json({ error: 'Login e senha obrigatórios.' });
    const users = readUsers();
    if (users.find(u => u.login === login)) return res.status(400).json({ error: 'Login já existe.' });
    users.push({ login, password, progress: {} }); // já cria o campo progress vazio
    saveUsers(users);
    res.json({ success: true });
});

// Login
app.post('/api/login', (req, res) => {
    const { login, password } = req.body;
    const users = readUsers();
    const user = users.find(u => u.login === login && u.password === password);
    if (!user) return res.status(401).json({ error: 'Login ou senha inválidos.' });
    // Gere um token simples (não seguro para produção, mas suficiente para testes)
    const token = crypto.randomBytes(16).toString('hex');
    user.sessionToken = token;
    saveUsers(users);
    res.json({ success: true, token, login });
});

// Salvar progresso do jogador
app.post('/api/save-progress', (req, res) => {
    const { login, progress } = req.body;
    if (!login || !progress) return res.status(400).json({ error: 'Dados insuficientes.' });
    const users = readUsers();
    const user = users.find(u => u.login === login);
    if (!user) return res.status(404).json({ error: 'Usuário não encontrado.' });
    user.progress = progress;
    saveUsers(users);
    res.json({ success: true });
});

// Recuperar progresso do jogador
app.post('/api/load-progress', (req, res) => {
    const { login } = req.body;
    if (!login) return res.status(400).json({ error: 'Login obrigatório.' });
    const users = readUsers();
    const user = users.find(u => u.login === login);
    if (!user) return res.status(404).json({ error: 'Usuário não encontrado.' });
    res.json({ progress: user.progress || null });
});

// Logout
app.post('/api/logout', (req, res) => {
    const { login, token } = req.body;
    const users = readUsers();
    const user = users.find(u => u.login === login && u.sessionToken === token);
    if (user) {
        delete user.sessionToken;
        saveUsers(users);
    }
    res.json({ success: true });
});
// --- Fim do bloco de cadastro/login ---

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});

// --- Multiplayer: Socket.IO ---
let socket = null;
let otherPlayers = {}; // { id: {name, x, y, color, mapId} }

function connectSocketIO() {
    if (socket) return;
    socket = io();
    // On connect, send player info
    socket.on('connect', () => {
        sendPlayerStateToServer();
    });
    // Receive all players on init
    socket.on('init', (data) => {
        otherPlayers = {};
        for (const [id, p] of Object.entries(data.players)) {
            if (id !== socket.id) {
                otherPlayers[id] = { ...p };
            }
        }
    });
    // New player joined
    socket.on('player_joined', (p) => {
        if (p.id !== socket.id) otherPlayers[p.id] = { ...p };
    });
    // Player moved
    socket.on('player_moved', (data) => {
        if (data.id !== socket.id) {
            otherPlayers[data.id] = {
                ...otherPlayers[data.id],
                ...data // update all fields: x, y, name, color, mapId
            };
        }
    });
    // Player left
    socket.on('player_left', (data) => {
        delete otherPlayers[data.id];
    });
}

function sendPlayerStateToServer() {
    if (!socket || !socket.connected) return;
    // Only send if in overworld
    if (gameState === 'overworld') {
        socket.emit('move', {
            x: player.overworldX,
            y: player.overworldY,
            name: player.name,
            color: player.color,
            mapId: currentMapId
        });
    }
}

