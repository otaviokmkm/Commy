// server/gameLogic/combatManager.js

/**
 * Combat Manager - Handles combat sessions and party combat
 */
class CombatManager {
    constructor() {
        this.activeCombats = new Map(); // combatId -> combat session
        this.combatIdCounter = 0;
        
        console.log('⚔️ Combat Manager initialized');
    }

    /**
     * Generate unique combat ID
     */
    generateCombatId(type = 'pve') {
        this.combatIdCounter++;
        return `${type}_${Date.now()}_${this.combatIdCounter}`;
    }
    
    /**
     * Processa uma ação de um jogador no combate.
     * Esta é a nova função central.
     * @param {string} combatId - ID da sessão de combate.
     * @param {string} playerId - ID do jogador que realiza a ação.
     * @param {object} action - Objeto da ação { type: 'attack' | 'move', targetId, position, etc. }
     * @returns {{success: boolean, newState: object|null, message: string}}
     */
    processAction(combatId, playerId, action) {
        const session = this.activeCombats.get(combatId);
        if (!session) {
            return { success: false, newState: null, message: 'Combat session not found.' };
        }

        // TODO: Adicionar validação de turno (quem pode jogar agora)
        const combatant = session.combatants.find(c => c.id === playerId);
        if (!combatant) {
            return { success: false, newState: null, message: 'Combatant not found in session.' };
        }

        console.log(`[COMBAT ACTION] Processing '${action.type}' for ${playerId} in combat ${combatId}`);

        switch(action.type) {
            case 'attack':
                const target = session.combatants.find(c => c.id === action.targetId);
                if (!target || !target.isAlive) {
                    return { success: false, newState: session, message: 'Invalid target.' };
                }

                // Lógica de ataque simples (exemplo)
                const damage = combatant.attackPower || 15;
                target.hp = Math.max(0, target.hp - damage);
                console.log(`${combatant.name} attacked ${target.name} for ${damage} damage. Target HP: ${target.hp}`);
                
                if (target.hp === 0) {
                    target.isAlive = false;
                    console.log(`${target.name} has been defeated.`);
                }
                break;

            case 'move':
                // TODO: Adicionar validação de movimento (distância, obstáculos)
                combatant.position = action.position;
                console.log(`${combatant.name} moved to`, action.position);
                break;
            
            // Adicionar mais ações aqui (spells, items, etc.)
        }

        // TODO: Avançar o turno
        // this.nextTurn(combatId);

        return { success: true, newState: session, message: 'Action processed.' };
    }

    /**
     * Retorna o estado atualizado do combate.
     */
    getCombatState(combatId) {
        return this.activeCombats.get(combatId) || null;
    }

    /**
     * [FIX ADDED] A compatibility method to prevent server crashes.
     * The 'requestStartCombat' handler in socketHandlers.js calls this.
     * NOTE: This is a temporary fix. The handler should be updated to use
     * createCombatSession and add combatants manually.
     *
     * @param {string} initiatorId - The ID of the player who started the combat.
     * @param {string} enemyId - The ID of the enemy being fought.
     * @param {string} mapId - The map where the combat is taking place.
     * @returns {object|null} The created (but empty) combat session.
     */
    createCombat(initiatorId, enemyId, mapId) {
        console.warn("[Compatibility Fix] Using deprecated createCombat. This should be refactored.");
        const combatId = this.generateCombatId('pve');
        
        // Create an empty session to prevent a crash.
        // The next step is to populate this session with combatants.
        const session = this.createCombatSession(combatId, initiatorId, mapId, 'pve');
        
        return session;
    }

    /**
     * Create a new combat session
     */
    createCombatSession(combatId, initiatorId, mapId, type = 'pve', partyData = null) {
        const session = {
            combatId: combatId,
            type: type,
            initiatorId: initiatorId,
            mapId: mapId,
            isPartyCombat: !!partyData,
            partyId: partyData?.id || null,
            combatants: [],
            turnOrder: [],
            currentTurn: 0,
            turnPhase: 'select', // select, move, action, end
            startTime: Date.now(),
            status: 'preparing', // preparing, active, ended
            settings: {
                gridWidth: 8,
                gridHeight: 6,
                turnTimeLimit: 30000,
                maxPlayers: partyData ? partyData.members.length : 1
            }
        };

        this.activeCombats.set(combatId, session);
        console.log(`⚔️ Created ${type} combat session: ${combatId} (party: ${!!partyData})`);
        
        return session;
    }

    /**
     * Create party combat session
     */
    createPartyCombatSession(partyId, initiatorId, mapId, enemyData) {
        const combatId = this.generateCombatId('party');
        const partyData = { id: partyId, members: [] }; // This would come from party system
        
        const session = this.createCombatSession(combatId, initiatorId, mapId, 'party', partyData);
        
        // Add enemy to combat
        this.addCombatant(combatId, {
            id: enemyData.id,
            name: enemyData.combatStats?.name || enemyData.name || 'Enemy',
            type: 'enemy',
            hp: enemyData.combatStats?.maxHp || enemyData.hp || 100,
            maxHp: enemyData.combatStats?.maxHp || 100,
            ap: enemyData.combatStats?.maxAp || 3,
            maxAp: enemyData.combatStats?.maxAp || 3,
            mp: enemyData.combatStats?.maxMp || 2,
            maxMp: enemyData.combatStats?.maxMp || 2,
            position: { x: 6, y: 2 },
            isAlive: true
        });
        
        return session;
    }

    /**
     * Add combatant to existing session
     */
    addCombatant(combatId, combatantData) {
        const session = this.activeCombats.get(combatId);
        if (!session) {
            console.error(`❌ Combat session not found: ${combatId}`);
            return false;
        }

        // Assign position if not provided
        if (!combatantData.position) {
            combatantData.position = this.getNextAvailablePosition(session, combatantData.type);
        }

        // Ensure combatant has required properties
        const combatant = {
            isAlive: true,
            ...combatantData
        };

        session.combatants.push(combatant);
        session.turnOrder.push(combatant.id);

        console.log(`⚔️ Added ${combatant.type} ${combatant.name} to combat ${combatId}`);
        return true;
    }

    /**
     * Add party member to combat
     */
    addPartyMemberToCombat(combatId, playerId, playerData) {
        const session = this.activeCombats.get(combatId);
        if (!session) {
            console.error(`❌ Combat session not found: ${combatId}`);
            return false;
        }

        if (!session.isPartyCombat) {
            console.error(`❌ Attempting to add party member to non-party combat: ${combatId}`);
            return false;
        }

        // Check if player already in combat
        const existingCombatant = session.combatants.find(c => c.id === playerId);
        if (existingCombatant) {
            console.warn(`⚠️ Player ${playerId} already in combat ${combatId}`);
            return false;
        }

        // Add player to combat
        const playerCombatant = {
            id: playerId,
            name: playerData.name,
            type: 'player',
            hp: playerData.hp || 100,
            maxHp: playerData.maxHp || 100,
            ap: playerData.ap || 60,
            maxAp: playerData.maxAp || 60,
            mp: playerData.mp || 30,
            maxMp: playerData.maxMp || 30,
            position: this.getNextAvailablePosition(session, 'player'),
            isAlive: true,
            socketId: playerData.socketId
        };

        return this.addCombatant(combatId, playerCombatant);
    }

    /**
     * Add player to existing combat session
     */
    addPlayerToCombat(combatId, playerData) {
        const session = this.activeCombats.get(combatId);
        if (!session) {
            console.error(`❌ Combat session not found: ${combatId}`);
            return null;
        }

        // Check if player already in combat
        const existingCombatant = session.combatants.find(c => c.id === playerData.id);
        if (existingCombatant) {
            console.warn(`⚠️ Player ${playerData.id} already in combat ${combatId}`);
            return session;
        }

        // Add player to combat
        const playerCombatant = {
            id: playerData.id,
            name: playerData.name,
            type: 'player',
            hp: playerData.hp || 100,
            maxHp: playerData.maxHp || 100,
            ap: playerData.ap || 60,
            maxAp: playerData.maxAp || 60,
            mp: playerData.mp || 30,
            maxMp: playerData.maxMp || 30,
            position: this.getNextAvailablePosition(session, 'player'),
            isAlive: true,
            socketId: playerData.socketId
        };

        const success = this.addCombatant(combatId, playerCombatant);
        if (success) {
            console.log(`✅ Player ${playerData.name} joined combat ${combatId}`);
            return session;
        }
        
        return null;
    }

    /**
     * Get next available position on the battlefield
     */
    getNextAvailablePosition(session, type) {
        const { gridWidth, gridHeight } = session.settings;
        const occupiedPositions = session.combatants.map(c => `${c.position.x},${c.position.y}`);
        
        // Players start on the left side, enemies on the right
        const startX = type === 'player' ? 1 : gridWidth - 2;
        const endX = type === 'player' ? Math.floor(gridWidth / 2) : gridWidth - 1;
        
        for (let y = 1; y < gridHeight - 1; y++) {
            for (let x = startX; x < endX; x++) {
                const posKey = `${x},${y}`;
                if (!occupiedPositions.includes(posKey)) {
                    return { x, y };
                }
            }
        }
        
        // Fallback position
        return { x: startX, y: 1 };
    }

    /**
     * Get combat session
     */
    getCombatSession(combatId) {
        return this.activeCombats.get(combatId);
    }

    /**
     * Start combat (transition from preparing to active)
     */
    startCombat(combatId) {
        const session = this.activeCombats.get(combatId);
        if (!session) {
            console.error(`❌ Combat session not found: ${combatId}`);
            return false;
        }

        session.status = 'active';
        session.currentTurn = 0;
        
        console.log(`🚀 Combat started: ${combatId}`);
        return session;
    }

    /**
     * End combat session
     */
    endCombat(combatId, result = 'victory') {
        const session = this.activeCombats.get(combatId);
        if (!session) {
            console.error(`❌ Combat session not found: ${combatId}`);
            return false;
        }

        session.status = 'ended';
        session.endTime = Date.now();
        session.result = result;

        console.log(`🏁 Combat ended: ${combatId} (${result})`);
        
        // Remove after delay for cleanup
        setTimeout(() => {
            this.activeCombats.delete(combatId);
            console.log(`🗑️ Combat session cleaned up: ${combatId}`);
        }, 60000); // 1 minute cleanup delay

        return session;
    }

    /**
     * Get all active combats
     */
    getActiveCombats() {
        return Array.from(this.activeCombats.values());
    }

    /**
     * Get combat statistics
     */
    getCombatStats() {
        return {
            activeCombats: this.activeCombats.size,
            totalCombats: this.combatIdCounter
        };
    }    /**
     * Lida com a desconexão de um jogador, limpando qualquer combate ativo.
     * @param {string} playerId - O ID do jogador que desconectou.
     * @returns {{combatId: string, ended: boolean, newState: object}|null} - O resultado da limpeza.
     */
    handlePlayerDisconnect(playerId) {
        for (const [combatId, session] of this.activeCombats.entries()) {
            const combatantIndex = session.combatants.findIndex(c => c.id === playerId && c.type === 'player');

            if (combatantIndex !== -1) {
                console.log(`[Combat Cleanup] Player ${playerId} disconnected from combat ${combatId}.`);
                session.combatants[combatantIndex].isAlive = false;
                session.combatants[combatantIndex].disconnected = true;

                const remainingPlayers = session.combatants.filter(c => c.type === 'player' && c.isAlive);

                if (remainingPlayers.length === 0) {
                    console.log(`[Combat End] All players left combat ${combatId}. Ending it.`);
                    this.endCombat(combatId, 'abandoned');
                    return { combatId, ended: true, newState: session };
                } else {
                    return { combatId, ended: false, newState: session };
                }
            }
        }
        return null; // Nenhum combate encontrado para este jogador.
    }
}

module.exports = CombatManager;