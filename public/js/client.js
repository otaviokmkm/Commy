// public/js/client.js
/**
 * Main Client Application
 * Coordinates all client-side modules and game initialization
 */
class ClientApp {
    constructor() {
        // Module instances
        this.auth = null;
        this.socketClient = null;
        this.game = null;
        this.ui = null;
        
        // Application state
        this.isInitialized = false;
        this.currentUser = null;
        
        console.log('🚀 Client application created');
    }

    /**
     * Initialize the client application
     */
    async initialize() {
        try {
            console.log('🔄 Initializing client application...');
            
            // Wait for DOM to be ready
            if (document.readyState === 'loading') {
                await new Promise(resolve => {
                    document.addEventListener('DOMContentLoaded', resolve);
                });
            }

            // Initialize modules
            this.initializeModules();
            this.setupModuleIntegration();
            this.checkExistingSession();
            
            this.isInitialized = true;
            console.log('✅ Client application initialized successfully');
        } catch (error) {
            console.error('❌ Failed to initialize client application:', error);
            throw error;
        }
    }

    /**
     * Initialize all modules
     */
    initializeModules() {
        // Initialize authentication module
        this.auth = new Auth();
        
        // Initialize socket client
        this.socketClient = new SocketClient();
        
        // Initialize game
        this.game = new Game();
        
        // Initialize UI
        this.ui = new UI();
        this.ui.initialize();
        
        // Make modules globally available for compatibility
        window.auth = this.auth;
        window.socketClient = this.socketClient;
        window.game = this.game;
        window.ui = this.ui;
        
        console.log('📦 All modules initialized');
    }    /**
     * Setup integration between modules
     */
    setupModuleIntegration() {
        // --- Auth Callbacks ---
        this.auth.onLogin((username, token) => this.handleLoginSuccess(username, token));
        this.auth.onLogout(() => this.handleLogout());

        // --- Socket Event Handlers (Now simplified) ---
        this.socketClient.on('existingPlayers', (data) => {
            if (data.players) data.players.forEach(p => this.game.addOrUpdatePlayer(p));
        });
        this.socketClient.on('playerJoined', (data) => this.game.addOrUpdatePlayer(data.playerData));
        this.socketClient.on('playerLeft', (data) => this.game.removePlayer(data));
        this.socketClient.on('playerMoved', (data) => this.game.updatePlayerPosition(data));        // Both map and update events now use the same robust handler
        this.socketClient.on('mapEnemies', (data) => {
            console.log('📡 Received mapEnemies event:', data);
            console.log(`📡 Event contains ${data.enemies?.length || 0} enemies`);
            
            if (data.enemies && data.enemies.length > 0) {
                console.log('👹 First enemy from server:', {
                    id: data.enemies[0].id,
                    name: data.enemies[0].name,
                    position: `(${data.enemies[0].overworldX}, ${data.enemies[0].overworldY})`,
                    alive: data.enemies[0].isAliveOverworld
                });
            }
            
            this.game.loadEntities(data);
            
            // Debug: Check if enemies were loaded
            console.log(`✅ After loading: ${this.game.world.entities.enemies.size} enemies in client memory`);
        });
        
        this.socketClient.on('enemyUpdate', (data) => {
            console.log('📡 Received enemyUpdate event:', data);
            this.game.loadEntities(data);
        });

        this.socketClient.on('mapData', (data) => this.game.loadMapData(data));this.socketClient.on('combatStarted', (data) => this.handleCombatStarted(data));
        this.socketClient.on('combatUpdate', (data) => this.handleCombatUpdate(data));
        this.socketClient.on('combatEnded', (data) => this.handleCombatEnded(data));
        this.socketClient.on('combatCancelled', (data) => this.handleCombatCancelled(data));
        this.socketClient.on('preparationPhaseStarted', (data) => this.handlePreparationStarted(data));
        this.socketClient.on('partyCombatNotification', (data) => this.handlePartyCombatNotification(data));
        this.socketClient.on('partyCombatJoined', (data) => this.handlePartyCombatJoined(data));
        this.socketClient.on('partyCombatStarted', (data) => this.handlePartyCombatStarted(data));
        this.socketClient.on('joinCombatFailed', (data) => this.handleJoinCombatFailed(data));
        this.socketClient.on('partyInvite', (data) => this.handlePartyInvite(data));
        this.socketClient.on('partyUpdate', (data) => this.handlePartyUpdate(data));
        this.socketClient.on('partyDisbanded', (data) => this.handlePartyDisbanded(data));
        this.socketClient.on('chatMessage', (data) => this.handleChatMessage(data));
        this.socketClient.on('error', (error) => this.handleSocketError(error));

        console.log('🔗 Module integration configured');
    }

    /**
     * Check for existing session on startup
     */
    checkExistingSession() {
        const hasSession = this.auth.checkExistingSession();
        if (!hasSession) {
            console.log('📝 No existing session found, showing login screen');
        }
    }

    /**
     * Initializes the local combat state based on server data.
     */
    initializeLocalCombatState(combatData) {
        if (!combatData) return;
        this.game.gameState = 'combat';
        this.game.combatState = combatData; // Store the authoritative state
        this.ui.showGameState('combat');
        
        // Further logic to position characters based on combatData.combatants
        // and determine whose turn it is.
        this.ui.showNotification("Combat started!", "info");
    }

    /**
     * Handle successful login
     */
    async handleLoginSuccess(username, token) {
        try {
            console.log(`✅ Login successful for user: ${username}`);
            this.currentUser = username;            // Connect socket and wait for connection
            this.socketClient.connect();
            
            // Wait for socket connection before proceeding
            await new Promise((resolve) => {
                const checkConnection = () => {
                    if (this.socketClient.isConnected()) {
                        resolve();
                    } else {
                        setTimeout(checkConnection, 100);
                    }
                };
                checkConnection();
            });
            
            // Authenticate after connection is established
            this.socketClient.authenticate(token, username);
            
            // Wait a bit for authentication to complete
            await new Promise(resolve => setTimeout(resolve, 500));

            // Initialize and start game
            await this.game.initialize();
            this.game.start(username);

            // Setup UI for gameplay
            this.ui.showGameState('overworld');
            this.ui.updatePlayerInfo(this.game.getPlayerData());
            
            // Create logout button
            const playerPanel = document.getElementById('player-info-overworld');
            if (playerPanel) {
                this.auth.createLogoutButton(playerPanel);
            }

            // Load player data
            await this.loadPlayerData();            // --- NEW CODE ADDED BELOW ---

            // After loading data, the player's mapId and position are set.
            // Now, officially join the map on the server to get world state and enemies.
            console.log(`🗺️ Joining map: ${this.game.currentMapId} at position (${this.game.player.overworldX}, ${this.game.player.overworldY})`);
            
            this.socketClient.joinMap(this.game.currentMapId, {
                name: this.game.player.name,
                x: this.game.player.overworldX,
                y: this.game.player.overworldY,
                mapId: this.game.currentMapId
            });
            
            // --- END OF NEW CODE ---

            console.log('🎮 Game started successfully');
        } catch (error) {
            console.error('❌ Error during login process:', error);
            this.ui.showNotification('Error starting game', 'error');
        }
    }

    /**
     * Handle logout
     */
    handleLogout() {
        console.log('👋 User logged out');
        
        // Notify server about disconnection
        if (this.socketClient.isConnected()) {
            this.socketClient.notifyDisconnecting(this.game?.currentMapId);
            this.socketClient.disconnect();
        }

        // Stop game
        if (this.game) {
            this.game.stop();
        }

        // Reset state
        this.currentUser = null;
        
        // Clear UI
        this.ui.clearChatMessages();
        this.ui.hidePanel('stats-panel');
        this.ui.hidePanel('party-panel');
    }    /**
     * Load player data from server
     */
    async loadPlayerData() {
        try {
            const username = this.auth.getUsername();
            const response = await fetch(`/api/load-progress/${username}`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${this.auth.getToken()}`,
                    'Content-Type': 'application/json'
                }
            });

            if (response.ok) {
                const playerData = await response.json();
                
                // Update game with loaded data
                if (playerData.progress) {
                    this.game.updatePlayerData(playerData.progress);
                }
                
                // Update statistics
                if (playerData.statistics) {
                    this.game.playerStatistics = playerData.statistics;
                    this.ui.updateStatsDisplay(playerData.statistics);
                }

                console.log('💾 Player data loaded successfully');
            } else {
                console.warn('⚠️ Failed to load player data');
            }
        } catch (error) {
            console.error('❌ Error loading player data:', error);
        }
    }

    /**
     * Save player data to server
     */
    async savePlayerData(triggerType = 'manual') {
        try {
            const playerData = this.game.getPlayerData();
            const response = await fetch('/api/save-progress', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.auth.getToken()}`
                },
                body: JSON.stringify({
                    login: this.currentUser,
                    progress: playerData,
                    triggerType
                })
            });

            if (response.ok) {
                const result = await response.json();
                if (result.success) {
                    this.ui.showNotification('Progress saved!', 'success', 2000);
                } else {
                    console.warn('⚠️ Save blocked:', result.message);
                }
            } else {
                throw new Error('Failed to save progress');
            }
        } catch (error) {
            console.error('❌ Error saving player data:', error);
            this.ui.showNotification('Failed to save progress', 'error');
        }
    }

    // Socket Event Handlers

    /**
     * Handle player joined event
     */
    handlePlayerJoined(data) {
        console.log(`👋 Player joined: ${data.playerId}`);
        this.game.otherPlayers[data.playerId] = data.playerData;
        this.ui.addChatMessage('System', `${data.playerId} joined the game`);
    }

    /**
     * Handle player left event
     */
    handlePlayerLeft(data) {
        console.log(`👋 Player left: ${data.playerId}`);
        delete this.game.otherPlayers[data.playerId];
        this.ui.addChatMessage('System', `${data.playerId} left the game`);
    }

    /**
     * Handle player moved event
     */
    handlePlayerMoved(data) {
        if (this.game.otherPlayers[data.playerId]) {
            this.game.otherPlayers[data.playerId].x = data.x;
            this.game.otherPlayers[data.playerId].y = data.y;
            this.game.otherPlayers[data.playerId].mapId = data.mapId;
        }
    }

    /**
     * Handle player updated event
     */
    handlePlayerUpdated(data) {
        if (this.game.otherPlayers[data.playerId]) {
            Object.assign(this.game.otherPlayers[data.playerId], data.updates);
        }
    }

    /**
     * Handle existing players event
     */
    handleExistingPlayers(data) {
        console.log(`📍 Received ${data.players.length} existing players in map ${data.mapId}`);
        
        // Add all players to the otherPlayers collection
        data.players.forEach(player => {
            this.game.otherPlayers[player.id] = {
                name: player.name,
                x: player.x,
                y: player.y,
                mapId: player.mapId
            };
        });
        
        // Update UI with count of other players
        const otherPlayerCount = Object.keys(this.game.otherPlayers).length;
        if (otherPlayerCount > 0) {
            this.ui.showNotification(`${otherPlayerCount} other player(s) in this map`, 'info', 3000);
        }
    }    /**
     * Handle map data event
     */
    handleMapData(data) {
        // This method is now handled directly by game.loadMapData()
        console.log(`🗺️ Map data handler (deprecated) - use direct game integration`);
    }

    /**
     * Handle map enemies event
     */
    handleMapEnemies(data) {
        // This method is now handled directly by game.loadEntities()
        console.log(`👹 Map enemies handler (deprecated) - use direct game integration`);
    }
    
    /**
     * Handle enemy update event
     */
    handleEnemyUpdate(data) {
        // This method is now handled directly by game.loadEntities()
        console.log(`🔄 Enemy update handler (deprecated) - use direct game integration`);
    }

    /**
     * Handle world state update event
     */
    handleWorldStateUpdate(data) {
        // This method is now handled directly by game.updateWorldState()
        console.log(`🌍 World state handler (deprecated) - use direct game integration`);
    }/**
     * Handle combat started event
     */
    handleCombatStarted(data) {
        console.log('⚔️ Combat started event received from server. Initializing combat state.');
        if (!data) {
            console.error("Received empty combat data from server.");
            return;
        }
        this.game.gameState = 'combat'; // AGORA é seguro mudar o estado
        this.game.combatState = data;    // Usa os dados oficiais do servidor
        this.ui.showGameState('combat');
        this.ui.updateCombatUI(data);    // Atualiza a UI com dados oficiais
    }    /**
     * Handle combat update event
     */
    handleCombatUpdate(data) {
        if (this.game.combatState && data.combatId === this.game.combatState.combatId) {
            this.game.combatState = data.newState; // Atualiza com o novo estado do servidor
            // A UI e o render() usarão automaticamente este novo estado
        }
    }

    /**
     * Handle combat ended event
     */
    handleCombatEnded(data) {
        console.log('🏁 Combat ended');
        this.game.gameState = 'overworld';
        this.game.combatState = null;
        this.ui.showGameState('overworld');
        // After combat ends, rejoin the overworld map to reload entities
        console.log('🗺️ Rejoining overworld after combat');
        this.socketClient.joinMap(this.game.currentMapId, this.game.player);
        
        if (data.victory) {
            this.ui.showNotification(data.message || 'Victory!', 'success');
            // O auto-save agora deve ser acionado pelo servidor ou em resposta a este evento
            this.savePlayerData('combatVictory'); 
        } else {
            this.ui.showNotification(data.message || 'Defeat!', 'error');
        }
    }

    /**
     * Handle combat cancelled event
     */
    handleCombatCancelled(data) {
        console.log('❌ Combat cancelled by server');
        this.game.gameState = 'overworld';
        this.game.combatState = null;
        this.ui.showGameState('overworld');
        this.ui.showNotification(data.message || 'Combat cancelled', 'info');
    }    /**
     * Handle preparation started event
     */
    handlePreparationStarted(data) {
        console.log('✅ Preparation phase confirmed by server:', data);
        
        // Set game state to preparation
        this.game.gameState = 'preparation';
        
        // Store enemy data for later use
        if (data.enemy) {
            this.game.preparationEnemy = data.enemy;
        }
        
        // Update UI to preparation mode
        if (this.ui) {
            this.ui.showGameState('preparation');
            this.ui.showNotification(`Combat preparation confirmed for ${data.enemy?.combatStats?.name || data.enemy?.name || 'Enemy'}`, 'info');
        }
    }

    /**
     * Handle party combat notification event
     */
    handlePartyCombatNotification(data) {
        console.log('⚔️ Received party combat notification:', data);
        this.game.partyCombat = data; // Store combat data, including the crucial combatId
        if (this.ui) {
            this.ui.updatePartyUI(this.game.currentParty, this.game.partyCombat);
            this.ui.showNotification(`${data.leaderName} has started a battle!`, 'info');
        }
    }

    /**
     * Handle party combat joined event
     */
    handlePartyCombatJoined(data) {
        if (data.success && data.combatData) {
            console.log('✅ Successfully joined party combat session:', data.combatData);
            this.initializeLocalCombatState(data.combatData);
        } else {
            console.log('❌ Failed to join party combat:', data);
            if (this.ui) {
                this.ui.showNotification('Failed to join combat.', 'error');
            }
        }
    }

    /**
     * Handle party combat started event
     */
    handlePartyCombatStarted(data) {
        console.log('🎉 Party combat started:', data);
        this.game.partyCombat = data;
        
        if (this.ui) {
            this.ui.showJoinBattleButton(data);
            this.ui.showNotification(`${data.initiatorName} started a battle! Click to join.`, 'info');
        }
    }

    /**
     * Handle join combat failed event
     */
    handleJoinCombatFailed(data) {
        console.log('❌ Failed to join combat:', data);
        if (this.ui) {
            this.ui.showNotification(data.message || 'Failed to join combat', 'error');
        }
    }

    /**
     * Join party combat
     */
    joinPartyCombat(combatId) {
        if (this.socketClient && this.socketClient.isConnected()) {
            console.log(`📲 Joining party combat: ${combatId}`);
            this.socketClient.socket.emit('joinCombat', {
                combatId: combatId
            });
        }
    }

    /**
     * Handle party invite event
     */
    handlePartyInvite(data) {
        console.log(`👥 Party invite received from: ${data.fromName}`);
        this.ui.showPartyInvite(data);
        this.game.addFloatingMessage(
            this.game.player.overworldX,
            this.game.player.overworldY,
            `Party invite from ${data.fromName}`,
            '#9f7aea',
            5000,
            data.from,
            'party-invite'
        );
    }

    /**
     * Handle party update event
     */
    handlePartyUpdate(data) {
        console.log('👥 Party updated');
        this.game.currentParty = data;
        this.ui.updatePartyUI(data);
    }

    /**
     * Handle party disbanded event
     */
    handlePartyDisbanded(data) {
        console.log('👥 Party disbanded');
        this.game.currentParty = null;
        this.ui.updatePartyUI(null);
        this.ui.showNotification('Party disbanded', 'info');
    }

    /**
     * Handle chat message event
     */
    handleChatMessage(data) {
        this.ui.addChatMessage(data.sender, data.message, data.timestamp);
    }

    /**
     * Handle socket error event
     */
    handleSocketError(error) {
        console.error('🔌 Socket error:', error);
        this.ui.showNotification('Connection error', 'error');
    }

    /**
     * Get application status
     */
    getStatus() {
        return {
            initialized: this.isInitialized,
            user: this.currentUser,
            connected: this.socketClient?.isConnected() || false,
            gameState: this.game?.gameState || 'none'
        };
    }
}

// Initialize the client application when DOM is ready
let clientApp = null;

document.addEventListener('DOMContentLoaded', async () => {
    try {
        clientApp = new ClientApp();
        await clientApp.initialize();
          // Make client app globally available for debugging
        window.clientApp = clientApp;
        
        // Add debug commands to console
        window.debugEnemies = () => {
            if (window.game) {
                window.game.debugEnemies();
            } else {
                console.log('❌ Game not initialized');
            }
        };
        
        console.log('🎉 Client application ready!');
        console.log('💡 Debug commands: debugEnemies()');
    } catch (error) {
        console.error('💥 Failed to start client application:', error);
        
        // Show error to user
        const errorDiv = document.createElement('div');
        errorDiv.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: #ef4444;
            color: white;
            padding: 15px;
            border-radius: 5px;
            z-index: 9999;
            max-width: 400px;
        `;
        errorDiv.textContent = `Failed to start application: ${error.message}`;
        document.body.appendChild(errorDiv);
    }
});

// Handle page unload
window.addEventListener('beforeunload', () => {
    if (clientApp && clientApp.socketClient && clientApp.socketClient.isConnected()) {
        clientApp.socketClient.notifyDisconnecting(clientApp.game?.currentMapId);
    }
});

// Export for debugging
window.ClientApp = ClientApp;
