// public/js/SocketClient.js
/**
 * Socket.IO Client Wrapper
 * Handles all real-time communication with the server
 */
class SocketClient {
    constructor() {
        this.socket = null;
        this.localPlayerId = null;
        this.onPlayerUpdate = null;
        this.onGameStateUpdate = null;
        this.eventHandlers = new Map();
    }    /**
     * Initialize socket connection
     */
    connect() {
        this.socket = io('http://localhost:3001');
        this.setupEventHandlers();
        console.log('🔌 Socket connection initialized');
    }

    /**
     * Set up all socket event handlers
     */
    setupEventHandlers() {
        if (!this.socket) return;

        // Connection events
        this.socket.on('connect', () => {
            console.log('✅ Connected to server via Socket.IO');
        });

        this.socket.on('disconnect', () => {
            console.log('❌ Disconnected from server');
        });

        // Authentication events
        this.socket.on('sessionInvalidated', (data) => {
            console.log('🚫 Session invalidated:', data.message);
            alert(data.message || 'Your session has been invalidated.');
            this.disconnect();
            window.location.reload();
        });        // Enemy event handlers
        this.socket.on('mapEnemies', (data) => {
            console.log('📍 Received map enemies:', data);
            if (window.game) {
                console.log(`✅ Loading ${data.enemies?.length || 0} enemies for map ${data.mapId}`);
                window.game.loadEntities(data);
            }
        });

        this.socket.on('enemyUpdate', (data) => {
            console.log('📍 Received enemy update:', data);
            if (window.game) {
                console.log(`✅ Updating ${data.enemies?.length || 0} enemies for map ${data.mapId}`);
                window.game.loadEntities(data);
            }
        });

        this.socket.on('enemyDefeated', (data) => {
            console.log('💀 Enemy defeated:', data);
            if (window.game) {
                // Remove defeated enemy from arrays
                if (data.mapId === 'open_world') {
                    window.game.openWorldEnemies = window.game.openWorldEnemies.filter(
                        enemy => enemy.id !== data.enemyId
                    );
                } else {
                    window.game.enemies = window.game.enemies.filter(
                        enemy => enemy.id !== data.enemyId
                    );
                }
            }
        });

        // Player movement and updates
        this.socket.on('playerJoined', (data) => {
            this.emit('playerJoined', data);
        });

        this.socket.on('playerLeft', (data) => {
            this.emit('playerLeft', data);
        });

        this.socket.on('playerMoved', (data) => {
            this.emit('playerMoved', data);
        });

        this.socket.on('playerUpdated', (data) => {
            this.emit('playerUpdated', data);
        });

        // Map and world events
        this.socket.on('mapData', (data) => {
            this.emit('mapData', data);
        });

        this.socket.on('worldStateUpdate', (data) => {
            this.emit('worldStateUpdate', data);
        });        // Combat events
        this.socket.on('combatStarted', (data) => {
            this.emit('combatStarted', data);
        });

        this.socket.on('combatUpdate', (data) => {
            this.emit('combatUpdate', data);
        });

        this.socket.on('combatEnded', (data) => {
            this.emit('combatEnded', data);
        });
        
        this.socket.on('combatCancelled', (data) => {
            this.emit('combatCancelled', data);
        });

        // Party system events
        this.socket.on('partyInvite', (data) => {
            this.emit('partyInvite', data);
        });

        this.socket.on('partyUpdate', (data) => {
            this.emit('partyUpdate', data);
        });

        this.socket.on('partyDisbanded', (data) => {
            this.emit('partyDisbanded', data);
        });

        // Chat events
        this.socket.on('chatMessage', (data) => {
            this.emit('chatMessage', data);
        });

        // Error handling
        this.socket.on('error', (error) => {
            console.error('❌ Socket error:', error);
            this.emit('error', error);
        });

        console.log('🎧 Socket event handlers configured');
    }    /**
     * Authenticate with the server
     */
    authenticate(sessionToken, username) {
        if (!this.socket) {
            console.error('❌ Socket not connected');
            return;
        }

        this.localPlayerId = username;
        this.socket.emit('authenticate', { sessionToken, login: username });
        console.log(`🔐 Authentication sent for user: ${username}`);
    }    /**
     * Notify server that player is joining the game
     */
    playerJoin(mapId, player) {
        if (!this.socket || !this.localPlayerId) {
            console.error('❌ Cannot join, socket or player ID not ready.');
            return;
        }

        console.log(`➡️ Emitting 'playerJoin' for player ${this.localPlayerId}`);
        
        this.socket.emit('playerJoin', {
            mapId: mapId,
            playerId: this.localPlayerId,
            username: player.name,
            position: { x: player.overworldX, y: player.overworldY }
        });
    }    /**
     * Join a specific map
     */
    joinMap(mapId, player) {
        if (!this.socket || !this.localPlayerId) {
            console.error('❌ Cannot join map, socket or player ID not ready.');
            console.log('🔍 Socket state:', {
                socketExists: !!this.socket,
                connected: this.socket?.connected,
                playerId: this.localPlayerId
            });
            return;
        }
        
        console.log(`➡️ Emitting 'joinMap' for player ${this.localPlayerId} to map ${mapId}`);
        console.log('🔍 Player data being sent:', player);
        
        this.socket.emit('joinMap', {
            mapId: mapId,
            playerId: this.localPlayerId,
            x: player.overworldX,
            y: player.overworldY,
            name: player.name,
            color: player.color 
        });
        
        console.log('✅ joinMap event emitted successfully');
    }

    /**
     * Update player position
     */
    updatePlayerPosition(x, y, mapId) {
        if (!this.socket) return;
        
        this.socket.emit('playerMove', {
            playerId: this.localPlayerId,
            x,
            y,
            mapId
        });
    }

    /**
     * Send chat message
     */
    sendChatMessage(message, mapId) {
        if (!this.socket) return;
        
        this.socket.emit('chatMessage', {
            playerId: this.localPlayerId,
            message,
            mapId
        });
    }    /**
     * Start combat with enemy
     */
    startCombat(enemyId, mapId) {
        if (!this.socket) return;
        
        this.socket.emit('requestStartCombat', {
            playerId: this.localPlayerId,
            enemyId,
            mapId
        });
    }

    /**
     * Send party invite
     */
    sendPartyInvite(targetPlayerId) {
        if (!this.socket) return;
        
        this.socket.emit('partyInvite', {
            from: this.localPlayerId,
            to: targetPlayerId
        });
    }

    /**
     * Respond to party invite
     */
    respondToPartyInvite(inviteId, accept) {
        if (!this.socket) return;
        
        this.socket.emit('partyInviteResponse', {
            inviteId,
            accept,
            playerId: this.localPlayerId
        });
    }

    /**
     * Leave current party
     */
    leaveParty() {
        if (!this.socket) return;
        
        this.socket.emit('leaveParty', {
            playerId: this.localPlayerId
        });
    }

    /**
     * Notify server about disconnection
     */
    notifyDisconnecting(mapId) {
        if (!this.socket) return;
        
        this.socket.emit('playerDisconnecting', {
            playerId: this.localPlayerId,
            mapId
        });
    }

    /**
     * Generic event emitter
     */
    emit(eventName, data) {
        const handlers = this.eventHandlers.get(eventName) || [];
        handlers.forEach(handler => {
            try {
                handler(data);
            } catch (error) {
                console.error(`❌ Error in ${eventName} handler:`, error);
            }
        });
    }

    /**
     * Add event listener
     */
    on(eventName, handler) {
        if (!this.eventHandlers.has(eventName)) {
            this.eventHandlers.set(eventName, []);
        }
        this.eventHandlers.get(eventName).push(handler);
    }

    /**
     * Remove event listener
     */
    off(eventName, handler) {
        const handlers = this.eventHandlers.get(eventName);
        if (handlers) {
            const index = handlers.indexOf(handler);
            if (index !== -1) {
                handlers.splice(index, 1);
            }
        }
    }

    /**
     * Disconnect and cleanup
     */
    disconnect() {
        if (this.socket) {
            this.socket.disconnect();
            this.socket = null;
        }
        this.localPlayerId = null;
        this.eventHandlers.clear();
        console.log('🔌 Socket disconnected and cleaned up');
    }

    /**
     * Check if socket is connected
     */
    isConnected() {
        return this.socket && this.socket.connected;
    }

    /**
     * Get local player ID
     */
    getLocalPlayerId() {
        return this.localPlayerId;
    }
}

// Export for use in other modules
window.SocketClient = SocketClient;
