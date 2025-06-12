// public/js/UI.js
/**
 * UI Management Class
 * Handles all user interface elements and interactions
 */
class UI {    constructor() {
        // UI Elements
        this.elements = {};
        
        // Minimap
        this.minimapCanvas = null;
        this.minimapCtx = null;
        this.MINIMAP_SCALE = 0.15;
        this.MINIMAP_TILE_SIZE = 2;
        
        // Combat UI
        this.combatHotbar = null;
        this.combatUiPanel = null;
          // Preparation system
        this.preparationTimer = null;
        this.preparationTimeLeft = 0;
        this.preparationStartTime = 0;
        
        // Notifications
        this.notificationTimeout = null;
        
        // Chat system
        this.chatMessages = [];
        this.maxChatMessages = 50;
        
        // Party UI
        this.partyPanel = null;
        
        // Statistics
        this.statsPanel = null;
        
        console.log('🖥️ UI manager created');
    }

    /**
     * Initialize UI elements
     */
    initialize() {
        this.cacheElements();
        this.setupEventListeners();
        this.initializeMinimap();
        this.initializeChat();
        this.initializePartyUI();
        this.initializeStatsUI();
        
        console.log('✅ UI initialized');
    }

    /**
     * Cache DOM elements
     */
    cacheElements() {
        this.elements = {
            // Game containers
            gameContainer: document.getElementById('game-container'),
            canvas: document.getElementById('gameCanvas'),
            
            // Player info panels
            playerInfoOverworld: document.getElementById('player-info-overworld'),
            combatUiPanel: document.getElementById('combat-ui-panel'),
            
            // Combat elements
            combatHotbar: document.getElementById('combat-hotbar'),
            moveButton: document.getElementById('moveButton'),
            attackButton: document.getElementById('attackButton'),
            endTurnButton: document.getElementById('endTurnButton'),
            
            // Player stats displays
            playerNameOverworld: document.getElementById('playerNameOverworld'),
            playerHPOverworld: document.getElementById('playerHPOverworld'),
            playerGoldOverworld: document.getElementById('playerGoldOverworld'),
            playerAPCombat: document.getElementById('playerAPCombat'),
            playerMPCombat: document.getElementById('playerMPCombat'),
            
            // Chat elements
            chatInput: document.getElementById('chat-input'),
            chatMessages: document.getElementById('chat-messages'),
            
            // Minimap elements
            minimapCanvas: document.getElementById('minimapCanvas'),
            minimapCurrentMap: document.getElementById('minimap-current-map'),
            minimapPosition: document.getElementById('minimap-position'),
            
            // Status and notifications
            gameLogMessage: document.getElementById('gameLogMessage'),
            statusInfo: document.getElementById('statusInfo'),
            
            // Preparation elements
            preparationCountdown: document.getElementById('preparation-countdown'),
            preparationProgress: document.getElementById('preparation-progress'),
            startCombatEarly: document.getElementById('start-combat-early'),
            cancelCombat: document.getElementById('cancel-combat'),
        };

        console.log('📋 UI elements cached');
    }

    /**
     * Setup UI event listeners
     */
    setupEventListeners() {
        // Chat input
        if (this.elements.chatInput) {
            this.elements.chatInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    this.sendChatMessage();
                }
            });
        }        // Combat buttons
        if (this.elements.moveButton) {
            this.elements.moveButton.addEventListener('click', () => this.handleCombatAction('move'));
        }
        if (this.elements.attackButton) {
            this.elements.attackButton.addEventListener('click', () => this.handleCombatAction('attack'));
        }
        if (this.elements.endTurnButton) {
            this.elements.endTurnButton.addEventListener('click', () => this.handleCombatAction('endTurn'));
        }// Preparation buttons
        if (this.elements.startCombatEarly) {
            this.elements.startCombatEarly.addEventListener('click', () => this.startCombatEarly());
        }
        if (this.elements.cancelCombat) {
            this.elements.cancelCombat.addEventListener('click', () => this.cancelPreparation());
        }

        console.log('🎧 UI event listeners configured');
    }

    /**
     * Initialize minimap
     */
    initializeMinimap() {
        this.minimapCanvas = this.elements.minimapCanvas;
        if (this.minimapCanvas) {
            this.minimapCtx = this.minimapCanvas.getContext('2d');
            console.log('🗺️ Minimap initialized');
        }
    }

    /**
     * Initialize chat system
     */
    initializeChat() {
        if (this.elements.chatMessages) {
            this.clearChatMessages();
            console.log('💬 Chat system initialized');
        }
    }    /**
     * Initialize party UI
     */
    initializePartyUI() {
        this.createPartyPanel();
        this.setupPartyUI();
        console.log('👥 Party UI initialized');
    }

    /**
     * Initialize statistics UI
     */
    initializeStatsUI() {
        this.createStatsPanel();
        console.log('📊 Statistics UI initialized');
    }

    /**
     * Update player info display
     */
    updatePlayerInfo(player) {
        if (this.elements.playerNameOverworld) {
            this.elements.playerNameOverworld.textContent = player.name || 'Adventurer';
        }
        if (this.elements.playerHPOverworld) {
            this.elements.playerHPOverworld.textContent = `${player.hp}/${player.maxHp}`;
        }
        if (this.elements.playerGoldOverworld) {
            this.elements.playerGoldOverworld.textContent = player.gold || 0;
        }
        if (this.elements.playerAPCombat) {
            this.elements.playerAPCombat.textContent = `${player.ap}/${player.maxAp}`;
        }
        if (this.elements.playerMPCombat) {
            this.elements.playerMPCombat.textContent = `${player.mp}/${player.maxMp}`;
        }
    }

    /**
     * Update minimap
     */
    updateMinimap(game) {
        if (!this.minimapCanvas || !this.minimapCtx || !game) return;

        // Clear minimap
        this.minimapCtx.clearRect(0, 0, this.minimapCanvas.width, this.minimapCanvas.height);

        // Draw border
        this.minimapCtx.strokeStyle = '#4a5568';
        this.minimapCtx.lineWidth = 1;
        this.minimapCtx.strokeRect(0, 0, this.minimapCanvas.width, this.minimapCanvas.height);

        if (game.currentMapId === game.OPEN_WORLD_ID) {
            this.drawOpenWorldMinimap(game);
        } else {
            this.drawRegularMapMinimap(game);
        }

        this.updateMinimapInfo(game);
    }

    /**
     * Draw open world minimap
     */
    drawOpenWorldMinimap(game) {
        const viewportSize = 30;
        const centerX = this.minimapCanvas.width / 2;
        const centerY = this.minimapCanvas.height / 2;

        // Draw background
        this.minimapCtx.fillStyle = '#2d3748';
        this.minimapCtx.fillRect(0, 0, this.minimapCanvas.width, this.minimapCanvas.height);

        // Calculate visible area
        const startX = Math.max(0, game.player.overworldX - viewportSize);
        const endX = Math.min(game.OPEN_WORLD_SIZE, game.player.overworldX + viewportSize);
        const startY = Math.max(0, game.player.overworldY - viewportSize);
        const endY = Math.min(game.OPEN_WORLD_SIZE, game.player.overworldY + viewportSize);

        // Draw terrain
        const layout = game.world.currentMap.layout;
        if (layout && layout.length > 0) {
            for (let y = startY; y < endY; y++) {
                for (let x = startX; x < endX; x++) {
                    const tileType = layout[y]?.[x] || 0;
                    const relX = x - game.player.overworldX;
                    const relY = y - game.player.overworldY;
                    const pixelX = centerX + relX * this.MINIMAP_TILE_SIZE;
                    const pixelY = centerY + relY * this.MINIMAP_TILE_SIZE;

                    switch (tileType) {
                        case 1: // OBSTACLE_ROCK
                            this.minimapCtx.fillStyle = '#718096';
                            this.minimapCtx.fillRect(pixelX, pixelY, this.MINIMAP_TILE_SIZE, this.MINIMAP_TILE_SIZE);
                            break;
                        case 2: // DECORATION_TREE
                            this.minimapCtx.fillStyle = '#38a169';
                            this.minimapCtx.fillRect(pixelX, pixelY, this.MINIMAP_TILE_SIZE, this.MINIMAP_TILE_SIZE);
                            break;
                        case 3: // DECORATION_BUSH
                            this.minimapCtx.fillStyle = '#48bb78';
                            this.minimapCtx.fillRect(pixelX, pixelY, this.MINIMAP_TILE_SIZE, this.MINIMAP_TILE_SIZE);
                            break;
                    }
                }
            }
        }

        // Draw enemies using new world structure
        game.world.entities.enemies.forEach(enemy => {
            if (!enemy.isAliveOverworld) return;

            const relX = enemy.overworldX - game.player.overworldX;
            const relY = enemy.overworldY - game.player.overworldY;
            const pixelX = centerX + relX * this.MINIMAP_TILE_SIZE;
            const pixelY = centerY + relY * this.MINIMAP_TILE_SIZE;

            if (Math.abs(relX) <= viewportSize && Math.abs(relY) <= viewportSize) {
                this.minimapCtx.fillStyle = '#e53e3e';
                this.minimapCtx.fillRect(pixelX - 1, pixelY - 1, 3, 3);
            }
        });

        // Draw other players using new world structure
        game.world.entities.players.forEach(otherPlayer => {
            if (otherPlayer.mapId !== game.OPEN_WORLD_ID) return;

            const relX = otherPlayer.x - game.player.overworldX;
            const relY = otherPlayer.y - game.player.overworldY;
            const pixelX = centerX + relX * this.MINIMAP_TILE_SIZE;
            const pixelY = centerY + relY * this.MINIMAP_TILE_SIZE;

            if (Math.abs(relX) <= viewportSize && Math.abs(relY) <= viewportSize) {
                this.minimapCtx.fillStyle = '#4299e1';
                this.minimapCtx.fillRect(pixelX - 1, pixelY - 1, 3, 3);
            }
        });

        // Draw player at center
        this.minimapCtx.fillStyle = '#48bb78';
        this.minimapCtx.fillRect(centerX - 2, centerY - 2, 4, 4);

        // Draw direction indicator
        this.minimapCtx.strokeStyle = '#48bb78';
        this.minimapCtx.lineWidth = 2;
        this.minimapCtx.beginPath();
        this.minimapCtx.moveTo(centerX, centerY);
        this.minimapCtx.lineTo(centerX, centerY - 6);
        this.minimapCtx.stroke();
    }

    /**
     * Draw regular map minimap
     */
    drawRegularMapMinimap(game) {
        if (!game.mapData || game.GRID_COLS === 0 || game.GRID_ROWS === 0) return;

        // Draw background
        this.minimapCtx.fillStyle = '#2d3748';
        this.minimapCtx.fillRect(0, 0, this.minimapCanvas.width, this.minimapCanvas.height);

        // Calculate scale
        const scaleX = this.minimapCanvas.width / game.GRID_COLS;
        const scaleY = this.minimapCanvas.height / game.GRID_ROWS;
        const tileScale = Math.min(scaleX, scaleY, 4);

        const offsetX = (this.minimapCanvas.width - game.GRID_COLS * tileScale) / 2;
        const offsetY = (this.minimapCanvas.height - game.GRID_ROWS * tileScale) / 2;

        // Draw terrain
        for (let y = 0; y < game.GRID_ROWS; y++) {
            for (let x = 0; x < game.GRID_COLS; x++) {
                if (!game.mapData[y] || !game.mapData[y][x]) continue;

                const tileType = game.mapData[y][x];
                const pixelX = offsetX + x * tileScale;
                const pixelY = offsetY + y * tileScale;

                switch (tileType) {
                    case game.MAP_TILES.OBSTACLE_ROCK:
                        this.minimapCtx.fillStyle = '#718096';
                        this.minimapCtx.fillRect(pixelX, pixelY, tileScale, tileScale);
                        break;
                    case game.MAP_TILES.DECORATION_TREE:
                        this.minimapCtx.fillStyle = '#38a169';
                        this.minimapCtx.fillRect(pixelX, pixelY, tileScale, tileScale);
                        break;
                    case game.MAP_TILES.DECORATION_BUSH:
                        this.minimapCtx.fillStyle = '#48bb78';
                        this.minimapCtx.fillRect(pixelX, pixelY, tileScale, tileScale);
                        break;
                }
            }
        }

        // Draw enemies
        if (game.enemies) {
            game.enemies.forEach(enemy => {
                if (!enemy.isAliveOverworld || enemy.mapId !== game.currentMapId) return;

                const pixelX = offsetX + enemy.overworldX * tileScale;
                const pixelY = offsetY + enemy.overworldY * tileScale;

                this.minimapCtx.fillStyle = '#e53e3e';
                this.minimapCtx.fillRect(pixelX - 1, pixelY - 1, tileScale + 2, tileScale + 2);
            });
        }

        // Draw other players
        for (const playerId in game.otherPlayers) {
            const otherPlayer = game.otherPlayers[playerId];
            if (otherPlayer.mapId !== game.currentMapId) continue;

            const pixelX = offsetX + otherPlayer.x * tileScale;
            const pixelY = offsetY + otherPlayer.y * tileScale;

            this.minimapCtx.fillStyle = '#4299e1';
            this.minimapCtx.fillRect(pixelX - 1, pixelY - 1, tileScale + 2, tileScale + 2);
        }

        // Draw player
        const playerPixelX = offsetX + game.player.overworldX * tileScale;
        const playerPixelY = offsetY + game.player.overworldY * tileScale;

        this.minimapCtx.fillStyle = '#48bb78';
        this.minimapCtx.fillRect(playerPixelX - 2, playerPixelY - 2, tileScale + 4, tileScale + 4);
    }

    /**
     * Update minimap info display
     */
    updateMinimapInfo(game) {
        if (this.elements.minimapCurrentMap) {
            const mapName = game.currentMapId === game.OPEN_WORLD_ID ? 'Open World' : `Map ${game.currentMapId}`;
            this.elements.minimapCurrentMap.textContent = mapName;
        }

        if (this.elements.minimapPosition) {
            this.elements.minimapPosition.textContent = `${game.player.overworldX}, ${game.player.overworldY}`;
        }
    }

    /**
     * Send chat message
     */
    sendChatMessage() {
        if (!this.elements.chatInput) return;

        const message = this.elements.chatInput.value.trim();
        if (!message) return;

        // Send to server via socket
        if (window.socketClient && window.socketClient.isConnected()) {
            window.socketClient.sendChatMessage(message, window.game?.currentMapId);
        }

        // Clear input
        this.elements.chatInput.value = '';
    }

    /**
     * Add chat message to display
     */
    addChatMessage(sender, message, timestamp = null) {
        if (!this.elements.chatMessages) return;

        const messageElement = document.createElement('div');
        messageElement.className = 'chat-message text-sm mb-1';
        
        const time = timestamp ? new Date(timestamp).toLocaleTimeString() : new Date().toLocaleTimeString();
        messageElement.innerHTML = `
            <span class="text-gray-400">[${time}]</span>
            <span class="text-blue-300">${sender}:</span>
            <span class="text-white">${message}</span>
        `;

        this.elements.chatMessages.appendChild(messageElement);

        // Scroll to bottom
        this.elements.chatMessages.scrollTop = this.elements.chatMessages.scrollHeight;

        // Limit message count
        this.chatMessages.push({ sender, message, timestamp: time });
        if (this.chatMessages.length > this.maxChatMessages) {
            this.chatMessages.shift();
            const firstChild = this.elements.chatMessages.firstChild;
            if (firstChild) {
                this.elements.chatMessages.removeChild(firstChild);
            }
        }
    }

    /**
     * Clear chat messages
     */
    clearChatMessages() {
        if (this.elements.chatMessages) {
            this.elements.chatMessages.innerHTML = '';
        }
        this.chatMessages = [];
    }    /**
     * Handle combat actions
     */
    handleCombatAction(action) {
        console.log(`🎮 UI: Combat action triggered: ${action}`);
        
        // Call the game's combat action handler
        if (window.game && window.game.handleCombatAction) {
            window.game.handleCombatAction(action);
        } else {
            console.error('❌ Game instance or handleCombatAction method not found');
            this.showNotification('Combat system not ready', 'error');
        }
    }    /**
     * Start combat early
     */
    startCombatEarly() {
        console.log('🚀 Requesting to start combat early...');
        if (this.preparationTimer) clearInterval(this.preparationTimer);

        if (window.socketClient && window.game.preparationEnemy) {
            window.socketClient.socket.emit('requestStartCombat', { 
                enemyId: window.game.preparationEnemy.id,
                mapId: window.game.currentMapId 
            });
        }
    }/**
     * Cancel combat preparation
     */    cancelCombatPreparation() {
        console.log('❌ Requesting to cancel combat preparation...');
        
        // Clear preparation timer
        if (this.preparationTimer) {
            clearInterval(this.preparationTimer);
            this.preparationTimer = null;
        }
        
        // Request server to cancel combat
        if (window.socketClient && window.socketClient.isConnected()) {
            window.socketClient.socket.emit('cancelCombat', {
                playerId: window.socketClient.getLocalPlayerId()
            });
        } else {
            // Fallback to local cancelation if no server connection
            if (window.game) {
                window.game.gameState = 'overworld';
                this.showGameState('overworld');
                this.showNotification('Combat cancelled (local)', 'warning');
            }
        }
    }/**
     * Show/hide UI panels
     */
    showPanel(panelId) {
        const panel = document.getElementById(panelId);
        if (panel) {
            panel.classList.remove('hidden');
            console.log(`👁️ Showing panel: ${panelId}`);
        } else {
            console.warn(`⚠️ Panel not found: ${panelId}`);
        }
    }

    hidePanel(panelId) {
        const panel = document.getElementById(panelId);
        if (panel) {
            panel.classList.add('hidden');
            console.log(`🙈 Hiding panel: ${panelId}`);
        } else {
            console.warn(`⚠️ Panel not found: ${panelId}`);
        }
    }

    togglePanel(panelId) {
        const panel = document.getElementById(panelId);
        if (panel) {
            panel.classList.toggle('hidden');
        }
    }    /**
     * Show game state (overworld/preparation/combat)
     */
    showGameState(state) {
        console.log(`🎮 Switching to game state: ${state}`);
        
        if (state === 'overworld') {
            this.showPanel('player-info-overworld');
            this.hidePanel('combat-ui-panel');
            this.hidePanel('combat-hotbar');
            this.hidePanel('combat-preparation');
            console.log('📍 Overworld UI activated');
        } else if (state === 'preparation') {
            this.hidePanel('player-info-overworld');
            this.hidePanel('combat-ui-panel');
            this.hidePanel('combat-hotbar');
            this.showPanel('combat-preparation');
            this.startPreparationCountdown();
            console.log('⏳ Preparation UI activated');
        } else if (state === 'combat') {
            this.hidePanel('player-info-overworld');
            this.hidePanel('combat-preparation');
            this.showPanel('combat-ui-panel');
            this.showPanel('combat-hotbar');
            console.log('⚔️ Combat UI activated');
        }
    }    /**
     * Update combat UI
     */
    updateCombatUI(combatData) {
        // Update combat-specific UI elements
        const playerAPEl = document.getElementById('playerAPCombat');
        const playerMPEl = document.getElementById('playerMPCombat');
        
        if (playerAPEl && window.game && window.game.player) {
            playerAPEl.textContent = `${window.game.player.ap}/${window.game.player.maxAp}`;
        }
        
        if (playerMPEl && window.game && window.game.player) {
            playerMPEl.textContent = `${window.game.player.mp}/${window.game.player.maxMp}`;
        }
        
        if (combatData && playerAPEl && playerMPEl) {
            playerAPEl.textContent = `${combatData.ap || 0}/${combatData.maxAp || 6}`;
            playerMPEl.textContent = `${combatData.mp || 0}/${combatData.maxMp || 3}`;
        }
    }/**
     * Show notification message
     */
    showNotification(message, type = 'info', duration = 3000) {
        // Create or update notification element
        let notificationEl = document.getElementById('game-notification');
        if (!notificationEl) {
            notificationEl = document.createElement('div');
            notificationEl.id = 'game-notification';
            notificationEl.className = 'notification';
            document.body.appendChild(notificationEl);
        }

        notificationEl.textContent = message;
        notificationEl.className = `notification ${type}`;
        notificationEl.style.display = 'block';

        // Clear any existing timeout
        if (this.notificationTimeout) {
            clearTimeout(this.notificationTimeout);
        }

        // Set new timeout to hide notification
        this.notificationTimeout = setTimeout(() => {
            if (notificationEl) {
                notificationEl.style.display = 'none';
            }
        }, duration);

        console.log(`📢 Notification: ${message} (${type})`);
    }

    /**
     * Create party panel
     */
    createPartyPanel() {
        let partyPanel = document.getElementById('party-panel');
        if (!partyPanel) {
            partyPanel = document.createElement('div');
            partyPanel.id = 'party-panel';
            partyPanel.className = 'ui-panel hidden';
            partyPanel.innerHTML = `
                <h2 class="text-lg font-semibold border-b border-slate-600 pb-1 mb-2 text-purple-300">👥 Party</h2>
                <div id="party-content">
                    <p class="text-gray-400">No party</p>
                </div>
                <div id="party-invites" class="mt-4">
                    <!-- Party invites will appear here -->
                </div>
            `;
            
            const rightPanel = document.getElementById('right-ui-panel') || document.body;
            rightPanel.appendChild(partyPanel);
        }
        this.partyPanel = partyPanel;
    }

    /**
     * Create stats panel
     */
    createStatsPanel() {
        let statsPanel = document.getElementById('stats-panel');
        if (!statsPanel) {
            statsPanel = document.createElement('div');
            statsPanel.id = 'stats-panel';
            statsPanel.className = 'ui-panel hidden';
            statsPanel.innerHTML = `
                <h2 class="text-lg font-semibold border-b border-slate-600 pb-1 mb-2 text-emerald-300">📊 Statistics</h2>
                <div id="stats-content" class="text-sm space-y-2">
                    <div class="border-b border-slate-600 pb-2 mb-2">
                        <p class="text-emerald-300 font-semibold">Combat:</p>
                        <p>Battles Won: <span id="stat-battles-won">0</span></p>
                        <p>Enemies Defeated: <span id="stat-enemies-defeated">0</span></p>
                        <p>Total Damage: <span id="stat-total-damage">0</span></p>
                    </div>
                    <div class="border-b border-slate-600 pb-2 mb-2">
                        <p class="text-emerald-300 font-semibold">Exploration:</p>
                        <p>Maps Visited: <span id="stat-maps-visited">0</span></p>
                        <p>Distance Traveled: <span id="stat-distance-traveled">0</span></p>
                        <p>Treasures: <span id="stat-treasures">0</span></p>
                    </div>
                    <div>
                        <p class="text-emerald-300 font-semibold">Economy:</p>
                        <p>Gold Earned: <span id="stat-gold-earned">0</span></p>
                        <p>Items Acquired: <span id="stat-items-acquired">0</span></p>
                    </div>
                </div>
            `;
            
            const rightPanel = document.getElementById('right-ui-panel') || document.body;
            rightPanel.appendChild(statsPanel);
        }
        this.statsPanel = statsPanel;
    }

    /**
     * Update statistics display
     */
    updateStatsDisplay(playerStatistics) {
        if (!playerStatistics || !this.statsPanel) return;

        try {
            // Combat stats
            if (playerStatistics.combat) {
                const battlesWonEl = document.getElementById('stat-battles-won');
                const enemiesDefeatedEl = document.getElementById('stat-enemies-defeated');
                const totalDamageEl = document.getElementById('stat-total-damage');
                
                if (battlesWonEl) battlesWonEl.textContent = playerStatistics.combat.battlesWon || 0;
                if (enemiesDefeatedEl) enemiesDefeatedEl.textContent = playerStatistics.combat.enemiesDefeated || 0;
                if (totalDamageEl) totalDamageEl.textContent = playerStatistics.combat.totalDamageDealt || 0;
            }
            
            // Exploration stats
            if (playerStatistics.exploration) {
                const mapsVisitedEl = document.getElementById('stat-maps-visited');
                const distanceTraveledEl = document.getElementById('stat-distance-traveled');
                const treasuresEl = document.getElementById('stat-treasures');
                
                if (mapsVisitedEl) {
                    const mapsCount = Array.isArray(playerStatistics.exploration.mapsVisited) 
                        ? playerStatistics.exploration.mapsVisited.length 
                        : (playerStatistics.exploration.mapsVisited?.size || 0);
                    mapsVisitedEl.textContent = mapsCount;
                }
                if (distanceTraveledEl) distanceTraveledEl.textContent = Math.floor(playerStatistics.exploration.distanceTraveled || 0);
                if (treasuresEl) treasuresEl.textContent = playerStatistics.exploration.treasuresCollected || 0;
            }
            
            // Economy stats
            if (playerStatistics.progression) {
                const goldEarnedEl = document.getElementById('stat-gold-earned');
                const itemsAcquiredEl = document.getElementById('stat-items-acquired');
                
                if (goldEarnedEl) goldEarnedEl.textContent = playerStatistics.progression.goldEarned || 0;
                if (itemsAcquiredEl) itemsAcquiredEl.textContent = playerStatistics.progression.itemsAcquired || 0;
            }
            
            console.log('📊 Stats display updated successfully');
        } catch (error) {
            console.error('❌ Error updating stats display:', error);
        }
    }

    /**
     * Setup party UI interactions
     */
    setupPartyUI() {
        // Party combat join button
        const joinPartyCombatBtn = document.getElementById('join-party-combat-btn');
        if (joinPartyCombatBtn) {
            joinPartyCombatBtn.onclick = () => {
                const partyCombat = window.game.partyCombat; // Get data from game instance
                if (window.socketClient && partyCombat && partyCombat.combatId) {
                    if (partyCombat.mapId === window.game.currentMapId) {
                        console.log(`📲 Emitting 'joinPartyCombat' for session: ${partyCombat.combatId}`);
                        window.socketClient.socket.emit('joinPartyCombat', {
                            sessionId: partyCombat.combatId,
                            playerId: window.socketClient.getLocalPlayerId()
                        });
                    } else {
                        this.showNotification('You must be on the same map to join!', 'error');
                    }
                } else {
                    this.showNotification('Could not find an active party combat.', 'error');
                }
            };
        }
    }

    /**
     * Update party UI
     */
    updatePartyUI(partyData) {
        const partyContent = document.getElementById('party-content');
        if (!partyContent) return;

        if (!partyData) {
            partyContent.innerHTML = '<p class="text-gray-400">No party</p>';
            return;
        }

        let membersHtml = `<p class="text-purple-300 font-semibold">Leader: ${partyData.leader}</p>`;
        membersHtml += '<div class="mt-2">';
        
        if (partyData.members && partyData.members.length > 0) {
            membersHtml += '<p class="text-sm text-gray-300">Members:</p>';
            partyData.members.forEach(member => {
                membersHtml += `<p class="text-sm text-blue-300">• ${member}</p>`;
            });
        }
        
        membersHtml += '</div>';
        partyContent.innerHTML = membersHtml;
    }

    /**
     * Show join battle button for party combat
     */
    showJoinBattleButton(combatData) {
        // Remove any existing join battle button
        this.hideJoinBattleButton();
        
        // Create join battle button
        const joinButton = document.createElement('div');
        joinButton.id = 'join-battle-notification';
        joinButton.className = 'fixed top-20 right-4 bg-purple-600 border-2 border-purple-400 rounded-lg p-4 z-50 max-w-sm';
        joinButton.innerHTML = `
            <h3 class="text-white font-bold mb-2">🎯 Party Battle Started!</h3>
            <p class="text-purple-200 text-sm mb-3">${combatData.initiatorName} has initiated combat!</p>
            <div class="flex gap-2">
                <button id="join-battle-btn" class="bg-green-600 hover:bg-green-700 px-4 py-2 rounded text-white font-bold">
                    Join Battle
                </button>
                <button id="decline-battle-btn" class="bg-gray-600 hover:bg-gray-700 px-2 py-2 rounded text-white">
                    Ignore
                </button>
            </div>
        `;
        
        document.body.appendChild(joinButton);
        
        // Add event listeners
        const joinBtn = document.getElementById('join-battle-btn');
        const declineBtn = document.getElementById('decline-battle-btn');
        
        if (joinBtn) {
            joinBtn.addEventListener('click', () => {
                if (window.clientApp) {
                    window.clientApp.joinPartyCombat(combatData.combatId);
                }
                this.hideJoinBattleButton();
            });
        }
        
        if (declineBtn) {
            declineBtn.addEventListener('click', () => {
                this.hideJoinBattleButton();
            });
        }
        
        // Auto-hide after 30 seconds
        setTimeout(() => {
            this.hideJoinBattleButton();
        }, 30000);
    }

    /**
     * Hide join battle button
     */
    hideJoinBattleButton() {
        const joinButton = document.getElementById('join-battle-notification');
        if (joinButton) {
            joinButton.remove();
        }
    }

    /**
     * Show party invite
     */
    showPartyInvite(inviteData) {
        const invitesContainer = document.getElementById('party-invites');
        if (!invitesContainer) return;

        const inviteElement = document.createElement('div');
        inviteElement.className = 'party-invite bg-purple-700 p-2 rounded mb-2';
        inviteElement.innerHTML = `
            <p class="text-sm text-white">Party invite from <span class="text-purple-300">${inviteData.fromName}</span></p>
            <div class="mt-2 flex gap-2">
                <button class="accept-invite bg-green-600 hover:bg-green-700 px-2 py-1 rounded text-xs">Accept</button>
                <button class="decline-invite bg-red-600 hover:bg-red-700 px-2 py-1 rounded text-xs">Decline</button>
            </div>
        `;

        // Add event listeners
        const acceptBtn = inviteElement.querySelector('.accept-invite');
        const declineBtn = inviteElement.querySelector('.decline-invite');
        
        acceptBtn.addEventListener('click', () => {
            if (window.socketClient) {
                window.socketClient.respondToPartyInvite(inviteData.inviteId, true);
            }
            inviteElement.remove();
        });
        
        declineBtn.addEventListener('click', () => {
            if (window.socketClient) {
                window.socketClient.respondToPartyInvite(inviteData.inviteId, false);
            }
            inviteElement.remove();
        });

        invitesContainer.appendChild(inviteElement);
        
        // Auto-remove after 30 seconds
        setTimeout(() => {
            if (inviteElement.parentNode) {
                inviteElement.remove();
            }
        }, 30000);
    }

    /**
     * Start preparation countdown
     */
    startPreparationCountdown() {
        this.preparationTimeLeft = 10000; // 10 seconds
        this.preparationStartTime = Date.now();
        this.updatePreparationDisplay();
        
        if (this.preparationTimer) {
            clearInterval(this.preparationTimer);
        }
        
        this.preparationTimer = setInterval(() => {
            this.updatePreparationDisplay();
            
            if (this.preparationTimeLeft <= 0) {
                this.finishPreparation();
            }
        }, 100);
    }    /**
     * Update preparation display
     */
    updatePreparationDisplay() {
        const elapsed = Date.now() - this.preparationStartTime;
        this.preparationTimeLeft = Math.max(0, 10000 - elapsed);
        
        const secondsLeft = Math.ceil(this.preparationTimeLeft / 1000);
        const progress = (10000 - this.preparationTimeLeft) / 10000;
        
        // Update countdown display - matches the HTML structure
        const countdownEl = document.getElementById('preparation-countdown');
        if (countdownEl) {
            countdownEl.textContent = `${secondsLeft}`;
        }
        
        // Update progress bar - matches the HTML structure
        const progressBarEl = document.querySelector('#preparation-progress .progress-bar');
        if (progressBarEl) {
            progressBarEl.style.width = `${progress * 100}%`;
        }
        
        console.log(`⏰ Preparation: ${secondsLeft}s remaining (${Math.round(progress * 100)}%)`);
    }    /**
     * Finish preparation and request combat start
     */    
    finishPreparation() {
        if (this.preparationTimer) clearInterval(this.preparationTimer);
        this.startCombatEarly(); // A lógica é a mesma
    }/**
     * Cancel preparation
     */
    cancelPreparation() {
        if (this.preparationTimer) {
            clearInterval(this.preparationTimer);
            this.preparationTimer = null;
        }
        
        // Request server to cancel combat
        if (window.socketClient && window.socketClient.isConnected()) {
            this.showNotification('Cancelling combat...', 'info');
            window.socketClient.socket.emit('cancelCombat', {
                playerId: window.socketClient.getLocalPlayerId()
            });
        } else {
            // Fallback to local cancelation if no server connection
            if (window.game) {
                window.game.gameState = 'overworld';
                this.showGameState('overworld');
                this.showNotification('Combat cancelled', 'info');
            }
        }
    }
}

// Export for use in other modules
window.UI = UI;
