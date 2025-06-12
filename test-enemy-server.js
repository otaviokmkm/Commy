// Simple test server to verify enemy rendering
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

// Test data
const testEnemies = [];
for (let i = 0; i < 10; i++) {
    testEnemies.push({
        id: i,
        name: `Test Goblin ${i + 1}`,
        overworldX: 90 + (i % 5) * 5,
        overworldY: 90 + Math.floor(i / 5) * 5,
        hp: 50,
        maxHp: 50,
        isAliveOverworld: true
    });
}

console.log('🧪 Test enemies generated:', testEnemies.length);

// Socket handling
io.on('connection', (socket) => {
    console.log(`🔌 Test connection: ${socket.id}`);
    
    socket.on('playerJoin', (data) => {
        console.log(`👤 Test player join:`, data);
        
        // Send test enemies immediately
        socket.emit('mapEnemies', {
            mapId: 'open_world',
            enemies: testEnemies
        });
        
        console.log(`📡 Sent ${testEnemies.length} test enemies`);
    });
    
    socket.on('joinMap', (data) => {
        console.log(`🗺️ Test joinMap:`, data);
        
        // Send test enemies again
        socket.emit('mapEnemies', {
            mapId: 'open_world',
            enemies: testEnemies
        });
        
        console.log(`📡 Sent ${testEnemies.length} test enemies via joinMap`);
    });
    
    socket.on('playerMove', (data) => {
        console.log(`🚶 Test move:`, data);
    });
});

// Static files
app.use(express.static('public'));

const PORT = 3001; // Different port to avoid conflicts
server.listen(PORT, () => {
    console.log('🧪 TEST SERVER running on port', PORT);
    console.log('🌐 Open http://localhost:' + PORT + ' to test enemies');
    console.log('👹 Test enemies ready:', testEnemies.length);
});