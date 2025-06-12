// Tactical Combat System
class TacticalCombat {
    constructor(io, players, enemies) {
        this.io = io;
        this.players = players;
        this.enemies = enemies;
        this.activeCombats = new Map(); // combatId -> combat instance
        this.combatQueue = new Map(); // socketId -> combatId
        
        // Class definitions with spells
        this.classes = {
            mage: {
                name: 'Mage',
                baseStats: {
                    hp: 80,
                    maxHp: 80,
                    mana: 120,
                    maxMana: 120,
                    movePoints: 2,
                    maxMovePoints: 2,
                    actionPoints: 3,
                    maxActionPoints: 3
                },
                spells: [
                    {
                        id: 'fireball',
                        name: 'Fireball',
                        icon: '🔥',
                        manaCost: 25,
                        damage: 35,
                        range: 4,
                        areaOfEffect: 1,
                        cooldown: 0,
                        description: 'Hurls a fiery projectile that explodes on impact',
                        key: '1'
                    },
                    {
                        id: 'heal',
                        name: 'Heal',
                        icon: '💚',
                        manaCost: 20,
                        healing: 40,
                        range: 3,
                        cooldown: 0,
                        description: 'Restores health to target ally',
                        key: '2'
                    },                    {
                        id: 'lightning',
                        name: 'Lightning Bolt',
                        icon: '⚡',
                        manaCost: 30,
                        damage: 45,
                        range: 6,
                        cooldown: 0,
                        description: 'Strikes target with lightning',
                        key: '3'
                    },
                    {
                        id: 'teleport',
                        name: 'Teleport',
                        icon: '🌀',
                        manaCost: 40,
                        range: 5,
                        cooldown: 0,
                        description: 'Instantly teleport to target location',
                        key: '4'
                    }
                ]
            },
            ranger: {
                name: 'Ranger',
                baseStats: {
                    hp: 100,
                    maxHp: 100,
                    mana: 80,
                    maxMana: 80,
                    movePoints: 4,
                    maxMovePoints: 4,
                    actionPoints: 2,
                    maxActionPoints: 2
                },
                spells: [
                    {
                        id: 'arrow_shot',
                        name: 'Precise Shot',
                        icon: '🏹',
                        manaCost: 10,
                        damage: 30,
                        range: 6,
                        cooldown: 0,
                        description: 'Accurate ranged attack',
                        key: '1'
                    },
                    {
                        id: 'multi_shot',
                        name: 'Multi Shot',
                        icon: '🎯',
                        manaCost: 25,
                        damage: 20,
                        range: 5,                        targets: 3,
                        cooldown: 0,
                        description: 'Shoots multiple targets',
                        key: '2'
                    },
                    {
                        id: 'trap',
                        name: 'Spike Trap',
                        icon: '⚠️',
                        manaCost: 20,
                        damage: 25,
                        range: 3,
                        duration: 5,
                        cooldown: 0,
                        description: 'Places a trap that damages enemies',
                        key: '3'
                    },
                    {
                        id: 'dash',
                        name: 'Combat Dash',
                        icon: '💨',
                        manaCost: 15,
                        range: 4,
                        cooldown: 0,
                        description: 'Quick movement that doesn\'t provoke attacks',
                        key: '4'
                    }
                ]
            }
        };
    }    // Start tactical combat when units collide
    startCombat(initiator, target, type) {
        const combatId = `combat_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        console.log(`⚔️ Starting ${type} combat between:`, {
            initiator: { id: initiator.id, name: initiator.name, class: initiator.class },
            target: { id: target.id, name: target.name }
        });
        
        const combat = {
            id: combatId,
            type: type, // 'pve' or 'pvp'
            grid: this.generateTacticalGrid(),
            participants: [],
            currentTurn: 0,
            turnPhase: 'simultaneous', // 'simultaneous' - both movement and action available
            turnNumber: 1,
            status: 'active',
            simultaneousMode: true // Enable simultaneous movement and actions
        };

        // Store grid size for positioning calculations
        this.currentGridSize = { 
            width: combat.grid[0].length, 
            height: combat.grid.length 
        };

        // Add participants based on combat type
        if (type === 'pve') {
            combat.participants = [
                this.createCombatUnit(initiator, 'player', 0),
                this.createCombatUnit(target, 'enemy', 1)
            ];
        } else if (type === 'pvp') {
            combat.participants = [
                this.createCombatUnit(initiator, 'player', 0),
                this.createCombatUnit(target, 'player', 1)
            ];
        }this.activeCombats.set(combatId, combat);
        
        // Mark initial grid positions as occupied
        combat.participants.forEach(participant => {
            combat.grid[participant.gridY][participant.gridX].occupied = true;
            combat.grid[participant.gridY][participant.gridX].occupiedBy = participant.id;
        });
        
        // Add participants to combat queue
        combat.participants.forEach(participant => {
            if (participant.type === 'player') {
                this.combatQueue.set(participant.originalId, combatId);
            }
        });

        // Notify participants
        this.broadcastCombatStart(combat);
        
        console.log(`⚔️ Started ${type} combat: ${combatId}`);
        return combatId;
    }    createCombatUnit(originalUnit, type, teamId) {
        // Assign random class for players if not already assigned
        let playerClass = 'mage'; // default
        if (type === 'player') {
            const availableClasses = Object.keys(this.classes);
            playerClass = originalUnit.class || availableClasses[Math.floor(Math.random() * availableClasses.length)];
        }
        
        const classData = this.classes[playerClass];
        const baseStats = type === 'player' && classData ? {
            ...classData.baseStats,
            level: originalUnit.level || 1
        } : {
            hp: originalUnit.hp || 50,
            maxHp: originalUnit.maxHp || 50,
            mana: 40,
            maxMana: 40,
            movePoints: 2,
            maxMovePoints: 2,
            actionPoints: 1,
            maxActionPoints: 1,
            damage: 20,
            armor: 0,
            level: originalUnit.level || 1
        };

        // Adjust starting positions based on grid size
        const gridSize = this.getGridSize();
        const startPositions = this.getStartingPositions(gridSize, teamId);

        const unit = {
            id: `unit_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
            originalId: originalUnit.id,
            name: originalUnit.name,
            type: type,
            teamId: teamId,
            class: type === 'player' ? playerClass : 'enemy',
            gridX: startPositions.x,
            gridY: startPositions.y,
            ...baseStats,
            status: 'alive',
            effects: [],
            spells: type === 'player' && classData ? classData.spells : [],
            spellCooldowns: {},
            autoPhaseSwitch: true, // Auto-switch between phases, no manual toggle
            traps: [] // For ranger traps
        };

        // Initialize spell cooldowns
        if (unit.spells) {
            unit.spells.forEach(spell => {
                unit.spellCooldowns[spell.id] = 0;
            });
        }

        return unit;
    }

    getGridSize() {
        // This will be set during grid generation
        return this.currentGridSize || { width: 9, height: 9 };
    }

    getStartingPositions(gridSize, teamId) {
        if (teamId === 0) {
            // Player team starts on left side
            return {
                x: 1,
                y: Math.floor(gridSize.height / 2)
            };
        } else {
            // Enemy team starts on right side
            return {
                x: gridSize.width - 2,
                y: Math.floor(gridSize.height / 2)
            };
        }
    }    generateTacticalGrid() {
        // Random arena variations with different shapes and sizes
        const arenaTypes = ['corridor', 'cross_shaped', 'circular', 'l_shaped', 'diamond', 'bridge'];
        const arenaType = arenaTypes[Math.floor(Math.random() * arenaTypes.length)];
        
        console.log(`🏟️ Generating ${arenaType} arena`);
        
        switch (arenaType) {
            case 'corridor':
                return this.generateCorridorArena();
            case 'cross_shaped':
                return this.generateCrossArena();
            case 'circular':
                return this.generateCircularArena();
            case 'l_shaped':
                return this.generateLShapedArena();
            case 'diamond':
                return this.generateDiamondArena();
            case 'bridge':
                return this.generateBridgeArena();
            default:
                return this.generateStandardArena();
        }
    }

    generateCorridorArena() {
        const grid = [];
        const GRID_WIDTH = 15;
        const GRID_HEIGHT = 5;

        for (let y = 0; y < GRID_HEIGHT; y++) {
            const row = [];
            for (let x = 0; x < GRID_WIDTH; x++) {
                let tileType = 'normal';
                
                // Add some cover points
                if ((x === 4 || x === 7 || x === 10) && (y === 1 || y === 3)) {
                    if (Math.random() < 0.6) tileType = 'obstacle';
                }

                row.push({
                    x: x, y: y, type: tileType,
                    occupied: false, occupiedBy: null
                });
            }
            grid.push(row);
        }
        return grid;
    }

    generateCrossArena() {
        const grid = [];
        const GRID_WIDTH = 11;
        const GRID_HEIGHT = 11;

        for (let y = 0; y < GRID_HEIGHT; y++) {
            const row = [];
            for (let x = 0; x < GRID_WIDTH; x++) {
                let tileType = 'obstacle'; // Start with walls
                
                // Create cross shape
                if ((x >= 4 && x <= 6) || (y >= 4 && y <= 6)) {
                    tileType = 'normal';
                    
                    // Some rough terrain in the cross
                    if (Math.random() < 0.1) {
                        tileType = 'rough';
                    }
                }

                row.push({
                    x: x, y: y, type: tileType,
                    occupied: false, occupiedBy: null
                });
            }
            grid.push(row);
        }
        return grid;
    }

    generateCircularArena() {
        const grid = [];
        const GRID_WIDTH = 13;
        const GRID_HEIGHT = 13;
        const centerX = Math.floor(GRID_WIDTH / 2);
        const centerY = Math.floor(GRID_HEIGHT / 2);
        const radius = 5;

        for (let y = 0; y < GRID_HEIGHT; y++) {
            const row = [];
            for (let x = 0; x < GRID_WIDTH; x++) {
                let tileType = 'obstacle'; // Start with walls
                
                const distance = Math.sqrt((x - centerX) ** 2 + (y - centerY) ** 2);
                
                if (distance <= radius) {
                    tileType = 'normal';
                    
                    // Center obstacle
                    if (distance <= 1) {
                        tileType = 'obstacle';
                    } else if (Math.random() < 0.08) {
                        tileType = 'rough';
                    }
                }

                row.push({
                    x: x, y: y, type: tileType,
                    occupied: false, occupiedBy: null
                });
            }
            grid.push(row);
        }
        return grid;
    }

    generateLShapedArena() {
        const grid = [];
        const GRID_WIDTH = 12;
        const GRID_HEIGHT = 9;

        for (let y = 0; y < GRID_HEIGHT; y++) {
            const row = [];
            for (let x = 0; x < GRID_WIDTH; x++) {
                let tileType = 'obstacle'; // Start with walls
                
                // Create L shape
                if ((x < 6 && y < 6) || (x >= 6 && y >= 3)) {
                    tileType = 'normal';
                    
                    // Some obstacles within the L
                    if (Math.random() < 0.12) {
                        tileType = 'obstacle';
                    } else if (Math.random() < 0.08) {
                        tileType = 'rough';
                    }
                }

                row.push({
                    x: x, y: y, type: tileType,
                    occupied: false, occupiedBy: null
                });
            }
            grid.push(row);
        }
        return grid;
    }

    generateDiamondArena() {
        const grid = [];
        const GRID_WIDTH = 11;
        const GRID_HEIGHT = 11;
        const centerX = Math.floor(GRID_WIDTH / 2);
        const centerY = Math.floor(GRID_HEIGHT / 2);

        for (let y = 0; y < GRID_HEIGHT; y++) {
            const row = [];
            for (let x = 0; x < GRID_WIDTH; x++) {
                let tileType = 'obstacle'; // Start with walls
                
                // Create diamond shape
                const manhattanDistance = Math.abs(x - centerX) + Math.abs(y - centerY);
                
                if (manhattanDistance <= 5) {
                    tileType = 'normal';
                    
                    // Some strategic obstacles
                    if (manhattanDistance === 2 && Math.random() < 0.3) {
                        tileType = 'obstacle';
                    } else if (Math.random() < 0.1) {
                        tileType = 'rough';
                    }
                }

                row.push({
                    x: x, y: y, type: tileType,
                    occupied: false, occupiedBy: null
                });
            }
            grid.push(row);
        }
        return grid;
    }

    generateBridgeArena() {
        const grid = [];
        const GRID_WIDTH = 14;
        const GRID_HEIGHT = 8;

        for (let y = 0; y < GRID_HEIGHT; y++) {
            const row = [];
            for (let x = 0; x < GRID_WIDTH; x++) {
                let tileType = 'normal';
                
                // Create two platforms connected by bridges
                if (y >= 2 && y <= 5) {
                    if ((x >= 1 && x <= 4) || (x >= 9 && x <= 12)) {
                        // Platform areas
                        if (Math.random() < 0.15) tileType = 'obstacle';
                    } else if (x >= 5 && x <= 8) {
                        // Bridge area
                        if (y === 2 || y === 5) {
                            tileType = 'obstacle'; // Bridge sides
                        } else {
                            tileType = 'rough'; // Bridge floor
                        }
                    } else {
                        tileType = 'obstacle'; // Void areas
                    }
                } else {
                    tileType = 'obstacle'; // Void areas
                }

                row.push({
                    x: x, y: y, type: tileType,
                    occupied: false, occupiedBy: null
                });
            }
            grid.push(row);
        }
        return grid;
    }

    generateStandardArena() {
        const grid = [];
        const GRID_WIDTH = 9;
        const GRID_HEIGHT = 9;

        for (let y = 0; y < GRID_HEIGHT; y++) {
            const row = [];
            for (let x = 0; x < GRID_WIDTH; x++) {
                let tileType = 'normal';
                
                // Standard obstacles
                if (Math.random() < 0.1) {
                    tileType = 'obstacle';
                } else if (Math.random() < 0.05) {
                    tileType = 'rough';
                }

                row.push({
                    x: x, y: y, type: tileType,
                    occupied: false, occupiedBy: null
                });
            }
            grid.push(row);
        }
        return grid;
    }    // Handle player movement in combat
    handleCombatMove(socketId, targetX, targetY) {
        const combatId = this.combatQueue.get(socketId);
        if (!combatId) return { success: false, error: 'Not in combat' };

        const combat = this.activeCombats.get(combatId);
        if (!combat || combat.status !== 'active') {
            return { success: false, error: 'Combat not active' };
        }

        const currentUnit = combat.participants[combat.currentTurn];
        if (currentUnit.originalId !== socketId || currentUnit.type !== 'player') {
            return { success: false, error: 'Not your turn' };
        }

        // In simultaneous mode, movement is always allowed if you have movement points
        if (currentUnit.movePoints <= 0) {
            return { success: false, error: 'No movement points remaining' };
        }

        // Validate movement
        const moveResult = this.validateMovement(combat, currentUnit, targetX, targetY);
        if (!moveResult.valid) {
            return { success: false, error: moveResult.error };
        }

        // Execute movement
        this.executeMovement(combat, currentUnit, targetX, targetY, moveResult.cost);
        
        // Broadcast combat update
        this.broadcastCombatUpdate(combat);

        return { success: true };
    }    validateMovement(combat, unit, targetX, targetY) {
        // Check bounds using actual grid size
        const gridHeight = combat.grid.length;
        const gridWidth = combat.grid[0].length;
        
        if (targetX < 0 || targetX >= gridWidth || targetY < 0 || targetY >= gridHeight) {
            return { valid: false, error: 'Out of bounds' };
        }

        // Check if tile is occupied
        const targetTile = combat.grid[targetY][targetX];
        if (targetTile.occupied) {
            return { valid: false, error: 'Tile occupied' };
        }

        // Check if tile is obstacle
        if (targetTile.type === 'obstacle') {
            return { valid: false, error: 'Cannot move to obstacle' };
        }

        // Calculate movement cost
        const distance = Math.abs(targetX - unit.gridX) + Math.abs(targetY - unit.gridY);
        let cost = distance;

        // Rough terrain costs extra
        if (targetTile.type === 'rough') {
            cost += 1;
        }

        // Check if unit has enough movement points
        if (cost > unit.movePoints) {
            return { valid: false, error: 'Not enough movement points' };
        }

        return { valid: true, cost: cost };
    }

    executeMovement(combat, unit, targetX, targetY, cost) {
        // Clear old position
        combat.grid[unit.gridY][unit.gridX].occupied = false;
        combat.grid[unit.gridY][unit.gridX].occupiedBy = null;

        // Set new position
        unit.gridX = targetX;
        unit.gridY = targetY;
        unit.movePoints -= cost;

        // Mark new position as occupied
        combat.grid[targetY][targetX].occupied = true;
        combat.grid[targetY][targetX].occupiedBy = unit.id;
    }    // Handle combat actions (spells, abilities, etc.)
    handleCombatAction(socketId, action) {
        const combatId = this.combatQueue.get(socketId);
        if (!combatId) return { success: false, error: 'Not in combat' };

        const combat = this.activeCombats.get(combatId);
        if (!combat || combat.status !== 'active') {
            return { success: false, error: 'Combat not active' };
        }

        const currentUnit = combat.participants.find(p => p.originalId === socketId && p.type === 'player');
        if (!currentUnit) {
            return { success: false, error: 'Unit not found' };
        }

        // In simultaneous mode, actions are always allowed if you have action points and mana
        if (currentUnit.actionPoints <= 0) {
            return { success: false, error: 'No action points remaining' };
        }

        let actionResult;
        switch (action.type) {
            case 'spell':
                actionResult = this.executeSpell(combat, currentUnit, action);
                break;
            case 'defend':
                actionResult = this.executeDefend(combat, currentUnit);
                break;
            case 'wait':
                actionResult = { success: true, message: `${currentUnit.name} waits` };
                break;
            default:
                return { success: false, error: 'Unknown action' };
        }

        if (actionResult.success) {
            currentUnit.actionPoints -= action.cost || 1;
            this.broadcastCombatUpdate(combat);
            
            // Check if combat is over
            if (this.checkCombatEnd(combat)) {
                this.endCombat(combat);
            }
        }

        return actionResult;
    }

    executeSpell(combat, caster, action) {
        const spell = caster.spells.find(s => s.id === action.spellId);
        if (!spell) {
            return { success: false, error: 'Spell not found' };
        }

        // Check mana cost
        if (caster.mana < spell.manaCost) {
            return { success: false, error: 'Not enough mana' };
        }

        // Check cooldown
        if (caster.spellCooldowns[spell.id] > 0) {
            return { success: false, error: 'Spell on cooldown' };
        }

        // Check range if target is specified
        if (action.targetX !== undefined && action.targetY !== undefined) {
            const distance = Math.abs(caster.gridX - action.targetX) + Math.abs(caster.gridY - action.targetY);
            if (distance > spell.range) {
                return { success: false, error: 'Target out of range' };
            }
        }

        // Execute spell effect
        const result = this.executeSpellEffect(combat, caster, spell, action);
        
        if (result.success) {
            // Consume mana
            caster.mana -= spell.manaCost;
            
            // Set cooldown
            if (spell.cooldown > 0) {
                caster.spellCooldowns[spell.id] = spell.cooldown;
            }
        }

        return result;
    }

    executeSpellEffect(combat, caster, spell, action) {
        const targetX = action.targetX;
        const targetY = action.targetY;

        switch (spell.id) {
            case 'fireball':
                return this.executeFireball(combat, caster, spell, targetX, targetY);
            case 'heal':
                return this.executeHeal(combat, caster, spell, targetX, targetY);
            case 'lightning':
                return this.executeLightning(combat, caster, spell, targetX, targetY);
            case 'teleport':
                return this.executeTeleport(combat, caster, spell, targetX, targetY);
            case 'arrow_shot':
                return this.executeArrowShot(combat, caster, spell, targetX, targetY);
            case 'multi_shot':
                return this.executeMultiShot(combat, caster, spell, targetX, targetY);
            case 'trap':
                return this.executeTrap(combat, caster, spell, targetX, targetY);
            case 'dash':
                return this.executeDash(combat, caster, spell, targetX, targetY);
            default:
                return { success: false, error: 'Unknown spell' };
        }
    }

    executeFireball(combat, caster, spell, targetX, targetY) {
        const targets = this.getUnitsInArea(combat, targetX, targetY, spell.areaOfEffect || 1);
        let totalDamage = 0;
        const hitTargets = [];

        targets.forEach(target => {
            if (target.teamId !== caster.teamId) {
                const damage = spell.damage;
                target.hp = Math.max(0, target.hp - damage);
                totalDamage += damage;
                hitTargets.push(target.name);
                
                if (target.hp <= 0) {
                    target.status = 'defeated';
                }
            }
        });

        return {
            success: true,
            message: `${caster.name} casts Fireball! ${hitTargets.length > 0 ? `Hit: ${hitTargets.join(', ')} for ${totalDamage} damage` : 'No targets hit'}`,
            effect: 'explosion',
            targetX,
            targetY
        };
    }

    executeHeal(combat, caster, spell, targetX, targetY) {
        const target = this.getUnitAt(combat, targetX, targetY);
        if (!target) {
            return { success: false, error: 'No target at location' };
        }

        if (target.teamId !== caster.teamId) {
            return { success: false, error: 'Cannot heal enemies' };
        }

        const healing = spell.healing;
        const actualHealing = Math.min(healing, target.maxHp - target.hp);
        target.hp += actualHealing;

        return {
            success: true,
            message: `${caster.name} heals ${target.name} for ${actualHealing} HP`,
            effect: 'heal',
            targetX,
            targetY
        };
    }

    executeLightning(combat, caster, spell, targetX, targetY) {
        const target = this.getUnitAt(combat, targetX, targetY);
        if (!target) {
            return { success: false, error: 'No target at location' };
        }

        if (target.teamId === caster.teamId) {
            return { success: false, error: 'Cannot attack allies' };
        }

        const damage = spell.damage;
        target.hp = Math.max(0, target.hp - damage);
        
        if (target.hp <= 0) {
            target.status = 'defeated';
        }

        return {
            success: true,
            message: `${caster.name} strikes ${target.name} with lightning for ${damage} damage!`,
            effect: 'lightning',
            targetX,
            targetY
        };
    }

    executeTeleport(combat, caster, spell, targetX, targetY) {
        // Check if target location is valid
        if (!this.isValidCombatPosition(combat, targetX, targetY)) {
            return { success: false, error: 'Invalid teleport location' };
        }

        // Clear old position
        combat.grid[caster.gridY][caster.gridX].occupied = false;
        combat.grid[caster.gridY][caster.gridX].occupiedBy = null;

        // Set new position
        const oldX = caster.gridX;
        const oldY = caster.gridY;
        caster.gridX = targetX;
        caster.gridY = targetY;

        // Mark new position as occupied
        combat.grid[targetY][targetX].occupied = true;
        combat.grid[targetY][targetX].occupiedBy = caster.id;

        return {
            success: true,
            message: `${caster.name} teleports to (${targetX}, ${targetY})!`,
            effect: 'teleport',
            oldX,
            oldY,
            targetX,
            targetY
        };
    }

    executeArrowShot(combat, caster, spell, targetX, targetY) {
        const target = this.getUnitAt(combat, targetX, targetY);
        if (!target) {
            return { success: false, error: 'No target at location' };
        }

        if (target.teamId === caster.teamId) {
            return { success: false, error: 'Cannot attack allies' };
        }

        const damage = spell.damage;
        target.hp = Math.max(0, target.hp - damage);
        
        if (target.hp <= 0) {
            target.status = 'defeated';
        }

        return {
            success: true,
            message: `${caster.name} shoots ${target.name} for ${damage} damage!`,
            effect: 'arrow',
            targetX,
            targetY
        };
    }

    executeMultiShot(combat, caster, spell, targetX, targetY) {
        const nearbyTargets = this.getEnemiesInRange(combat, caster, spell.range)
            .slice(0, spell.targets || 3);

        if (nearbyTargets.length === 0) {
            return { success: false, error: 'No targets in range' };
        }

        let totalDamage = 0;
        const hitTargets = [];

        nearbyTargets.forEach(target => {
            const damage = spell.damage;
            target.hp = Math.max(0, target.hp - damage);
            totalDamage += damage;
            hitTargets.push(target.name);
            
            if (target.hp <= 0) {
                target.status = 'defeated';
            }
        });

        return {
            success: true,
            message: `${caster.name} shoots multiple targets: ${hitTargets.join(', ')} for ${totalDamage} total damage!`,
            effect: 'multi_arrow',
            targets: nearbyTargets.map(t => ({ x: t.gridX, y: t.gridY }))
        };
    }

    executeTrap(combat, caster, spell, targetX, targetY) {
        if (!this.isValidCombatPosition(combat, targetX, targetY)) {
            return { success: false, error: 'Invalid trap location' };
        }

        // Check if there's already a trap here
        const existingTrap = caster.traps.find(t => t.x === targetX && t.y === targetY);
        if (existingTrap) {
            return { success: false, error: 'Trap already exists at this location' };
        }

        // Place trap
        const trap = {
            id: `trap_${Date.now()}`,
            x: targetX,
            y: targetY,
            damage: spell.damage,
            duration: spell.duration,
            caster: caster.id
        };

        caster.traps.push(trap);

        return {
            success: true,
            message: `${caster.name} places a spike trap at (${targetX}, ${targetY})`,
            effect: 'trap',
            targetX,
            targetY
        };
    }

    executeDash(combat, caster, spell, targetX, targetY) {
        // Check if target location is valid
        if (!this.isValidCombatPosition(combat, targetX, targetY)) {
            return { success: false, error: 'Invalid dash location' };
        }

        const distance = Math.abs(caster.gridX - targetX) + Math.abs(caster.gridY - targetY);
        if (distance > spell.range) {
            return { success: false, error: 'Dash distance too far' };
        }

        // Clear old position
        combat.grid[caster.gridY][caster.gridX].occupied = false;
        combat.grid[caster.gridY][caster.gridX].occupiedBy = null;

        // Set new position
        const oldX = caster.gridX;
        const oldY = caster.gridY;
        caster.gridX = targetX;
        caster.gridY = targetY;

        // Mark new position as occupied
        combat.grid[targetY][targetX].occupied = true;
        combat.grid[targetY][targetX].occupiedBy = caster.id;

        return {
            success: true,
            message: `${caster.name} dashes to (${targetX}, ${targetY})!`,
            effect: 'dash',
            oldX,
            oldY,
            targetX,
            targetY
        };
    }

    // Helper methods for spell targeting
    getUnitAt(combat, x, y) {
        return combat.participants.find(p => p.gridX === x && p.gridY === y && p.status === 'alive');
    }

    getUnitsInArea(combat, centerX, centerY, radius) {
        return combat.participants.filter(p => {
            if (p.status !== 'alive') return false;
            const distance = Math.abs(p.gridX - centerX) + Math.abs(p.gridY - centerY);
            return distance <= radius;
        });
    }

    getEnemiesInRange(combat, caster, range) {
        return combat.participants.filter(p => {
            if (p.status !== 'alive' || p.teamId === caster.teamId) return false;
            const distance = Math.abs(p.gridX - caster.gridX) + Math.abs(p.gridY - caster.gridY);
            return distance <= range;
        });
    }    isValidCombatPosition(combat, x, y) {
        if (x < 0 || y < 0 || y >= combat.grid.length || x >= combat.grid[0].length) {
            return false;
        }

        const tile = combat.grid[y][x];
        return tile.type !== 'obstacle' && !tile.occupied;
    }    executeDefend(combat, unit) {
        // Defending gives armor bonus for the turn
        unit.armor += 5;
        unit.effects.push({
            type: 'defense_boost',
            duration: 1,
            value: 5
        });

        return {
            success: true,
            message: `${unit.name} takes a defensive stance!`
        };
    }

    executeAttack(combat, attacker, targetId) {
        const target = combat.participants.find(p => p.id === targetId);
        if (!target) {
            return { success: false, error: 'Target not found' };
        }

        if (target.status !== 'alive') {
            return { success: false, error: 'Target is not alive' };
        }

        if (target.teamId === attacker.teamId) {
            return { success: false, error: 'Cannot attack allies' };
        }

        // Calculate damage
        const baseDamage = attacker.damage || 25;
        const armor = target.armor || 0;
        const finalDamage = Math.max(1, baseDamage - armor);

        // Apply damage
        target.hp = Math.max(0, target.hp - finalDamage);

        if (target.hp <= 0) {
            target.status = 'defeated';
        }

        return {
            success: true,
            message: `${attacker.name} attacks ${target.name} for ${finalDamage} damage!`
        };
    }// End turn and move to next participant
    endTurn(socketId) {
        const combatId = this.combatQueue.get(socketId);
        if (!combatId) {
            console.log(`⚠️ endTurn called but no combat found for ${socketId}`);
            return { success: false, error: 'Not in combat' };
        }

        const combat = this.activeCombats.get(combatId);
        if (!combat) {
            console.log(`⚠️ Combat ${combatId} not found`);
            return { success: false, error: 'Combat not found' };
        }

        const currentUnit = combat.participants[combat.currentTurn];
        
        // Allow ending turn if it's the player's turn OR if it's an AI unit
        if (currentUnit.type === 'player' && currentUnit.originalId !== socketId) {
            return { success: false, error: 'Not your turn' };
        }

        console.log(`🔄 Ending turn for ${currentUnit.name} (${currentUnit.type})`);

        // In simultaneous mode, simply end the turn
        combat.currentTurn = (combat.currentTurn + 1) % combat.participants.length;
        
        // If back to first participant, increment turn number and refresh resources
        if (combat.currentTurn === 0) {
            combat.turnNumber++;
            this.refreshTurnResources(combat);
            console.log(`🔄 Turn ${combat.turnNumber} started`);
        }

        const nextUnit = combat.participants[combat.currentTurn];
        console.log(`🔄 Next turn: ${nextUnit.name} (${nextUnit.type})`);

        // Broadcast combat update first
        this.broadcastCombatUpdate(combat);

        // Handle AI turn if it's an enemy
        if (nextUnit.type === 'enemy' && nextUnit.status === 'alive') {
            console.log(`🤖 Starting AI turn for ${nextUnit.name} in 1 second...`);
            setTimeout(() => {
                // Double-check combat is still active
                if (this.activeCombats.has(combat.id) && combat.status === 'active') {
                    this.executeAITurn(combat);
                }
            }, 1000);
        }

        return { success: true };
    }

    refreshTurnResources(combat) {
        combat.participants.forEach(unit => {
            if (unit.status === 'alive') {
                // Refresh movement and action points
                unit.movePoints = unit.maxMovePoints;
                unit.actionPoints = unit.maxActionPoints;
                
                // Process effects
                unit.effects = unit.effects.filter(effect => {
                    effect.duration--;
                    if (effect.duration <= 0) {
                        // Remove effect
                        if (effect.type === 'defense_boost') {
                            unit.armor -= effect.value;
                        }
                        return false;
                    }
                    return true;
                });
            }
        });
    }    executeAITurn(combat) {
        const aiUnit = combat.participants[combat.currentTurn];
        if (aiUnit.type !== 'enemy' || aiUnit.status !== 'alive') {
            console.log(`⚠️ AI turn called but unit is ${aiUnit.type} with status ${aiUnit.status}`);
            this.forceEndAITurn(combat, aiUnit);
            return;
        }

        console.log(`🤖 AI turn for ${aiUnit.name} - Starting complete turn`);

        // Execute AI turn synchronously with proper delays
        this.executeAIMovementAndAction(combat, aiUnit);
    }    executeAIMovementAndAction(combat, aiUnit) {
        // Simultaneous movement and action for AI
        console.log(`🤖 ${aiUnit.name} - Simultaneous Phase`);

        // Find nearest enemy for targeting
        const enemies = combat.participants.filter(p => p.teamId !== aiUnit.teamId && p.status === 'alive');
        if (enemies.length === 0) {
            console.log(`🤖 No enemies found for ${aiUnit.name}, ending turn`);
            this.forceEndAITurn(combat, aiUnit);
            return;
        }

        const target = enemies[0];
        console.log(`🤖 ${aiUnit.name} targeting ${target.name} at (${target.gridX}, ${target.gridY})`);
        
        // Try to move closer first
        const moveResult = this.aiCalculateMove(combat, aiUnit, target);
        if (moveResult.canMove && aiUnit.movePoints > 0) {
            console.log(`🤖 ${aiUnit.name} moving from (${aiUnit.gridX}, ${aiUnit.gridY}) to (${moveResult.targetX}, ${moveResult.targetY})`);
            this.executeMovement(combat, aiUnit, moveResult.targetX, moveResult.targetY, moveResult.cost);
            this.broadcastCombatUpdate(combat);
        } else {
            console.log(`🤖 ${aiUnit.name} cannot move closer or no movement points`);
        }

        // Then try to perform action
        setTimeout(() => {
            const distance = Math.abs(aiUnit.gridX - target.gridX) + Math.abs(aiUnit.gridY - target.gridY);
            console.log(`🤖 Distance to target: ${distance}, AP: ${aiUnit.actionPoints}`);
            
            if (distance <= 1 && aiUnit.actionPoints >= 1) {
                console.log(`🤖 ${aiUnit.name} attacking ${target.name}!`);
                const attackResult = this.executeAttack(combat, aiUnit, target.id);
                if (attackResult.success) {
                    console.log(`🤖 Attack successful: ${attackResult.message}`);
                    aiUnit.actionPoints -= 1;
                    
                    // Check if combat ends after attack
                    if (this.checkCombatEnd(combat)) {
                        console.log(`🤖 Combat ended after AI attack`);
                        this.endCombat(combat);
                        return;
                    }
                } else {
                    console.log(`🤖 Attack failed: ${attackResult.error}`);
                }
            } else if (aiUnit.actionPoints >= 1) {
                // If can't attack, defend instead
                const defendResult = this.executeDefend(combat, aiUnit);
                console.log(`🤖 ${aiUnit.name} defending: ${defendResult.message}`);
                aiUnit.actionPoints -= 1;
            }

            this.broadcastCombatUpdate(combat);

            // End AI turn
            setTimeout(() => {
                this.forceEndAITurn(combat, aiUnit);
            }, 800);
        }, 600);
    }    forceEndAITurn(combat, aiUnit) {
        if (combat.status !== 'active') {
            console.log(`🤖 Combat not active, cannot end turn`);
            return;
        }

        console.log(`🤖 Force ending turn for ${aiUnit.name}`);
        
        // Move to next participant
        const oldTurn = combat.currentTurn;
        combat.currentTurn = (combat.currentTurn + 1) % combat.participants.length;
        
        // If back to first participant, increment turn number and refresh resources
        if (combat.currentTurn === 0) {
            combat.turnNumber++;
            this.refreshTurnResources(combat);
            console.log(`🔄 Turn ${combat.turnNumber} started`);
        }

        const nextUnit = combat.participants[combat.currentTurn];
        console.log(`🔄 Next turn: ${nextUnit.name} (${nextUnit.type})`);

        // Broadcast combat update
        this.broadcastCombatUpdate(combat);

        // Handle next AI turn if it's another enemy
        if (nextUnit.type === 'enemy' && nextUnit.status === 'alive') {
            console.log(`🤖 Starting next AI turn for ${nextUnit.name} in 1.5 seconds...`);
            setTimeout(() => this.executeAITurn(combat), 1500);
        }
    }

    aiCalculateMove(combat, aiUnit, target) {
        const currentDistance = Math.abs(aiUnit.gridX - target.gridX) + Math.abs(aiUnit.gridY - target.gridY);
        
        // If already adjacent, don't move
        if (currentDistance <= 1) {
            return { canMove: false };
        }

        // Try all possible moves within movement range
        let bestMove = null;
        let bestDistance = currentDistance;

        for (let dx = -aiUnit.movePoints; dx <= aiUnit.movePoints; dx++) {
            for (let dy = -aiUnit.movePoints; dy <= aiUnit.movePoints; dy++) {
                const cost = Math.abs(dx) + Math.abs(dy);
                if (cost === 0 || cost > aiUnit.movePoints) continue;

                const newX = aiUnit.gridX + dx;
                const newY = aiUnit.gridY + dy;

                const moveValidation = this.validateMovement(combat, aiUnit, newX, newY);
                if (!moveValidation.valid) continue;

                const newDistance = Math.abs(newX - target.gridX) + Math.abs(newY - target.gridY);
                if (newDistance < bestDistance) {
                    bestDistance = newDistance;
                    bestMove = { targetX: newX, targetY: newY, cost: cost };
                }
            }
        }

        if (bestMove) {
            return { canMove: true, ...bestMove };
        }

        return { canMove: false };
    }    checkCombatEnd(combat) {
        const aliveByTeam = {};
        combat.participants.forEach(p => {
            if (p.status === 'alive') {
                aliveByTeam[p.teamId] = (aliveByTeam[p.teamId] || 0) + 1;
            }
        });

        const aliveTeams = Object.keys(aliveByTeam).length;
        return aliveTeams <= 1;
    }    endCombat(combat) {
        combat.status = 'ended';
        
        // Determine winner
        const aliveByTeam = {};
        combat.participants.forEach(p => {
            if (p.status === 'alive') {
                aliveByTeam[p.teamId] = (aliveByTeam[p.teamId] || 0) + 1;
            }
        });

        const winningTeam = Object.keys(aliveByTeam)[0];
        const winners = combat.participants.filter(p => p.teamId === parseInt(winningTeam) && p.status === 'alive');
        const losers = combat.participants.filter(p => p.teamId !== parseInt(winningTeam));
        
        // Handle character deletion for defeated players
        losers.forEach(loser => {
            if (loser.type === 'player' && loser.status === 'defeated') {
                console.log(`💀 Player ${loser.name} was defeated and will be deleted!`);
                this.handlePlayerDeath(loser.originalId, loser.name);
            }
        });
        
        // Remove from combat queue
        combat.participants.forEach(p => {
            if (p.type === 'player') {
                this.combatQueue.delete(p.originalId);
            }
        });

        // Broadcast combat end
        this.broadcastCombatEnd(combat, winners, losers);
        
        // Clean up
        this.activeCombats.delete(combat.id);
        
        console.log(`⚔️ Combat ${combat.id} ended. Winners: ${winners.map(w => w.name).join(', ')}`);
    }    broadcastCombatStart(combat) {
        const combatData = this.serializeCombat(combat);
        console.log(`📡 Broadcasting combat start to ${combat.participants.length} participants`);
        
        combat.participants.forEach(p => {
            if (p.type === 'player') {
                console.log(`🔍 Looking for socket for player ${p.originalId} (${p.name})`);
                const socket = this.getPlayerSocket(p.originalId);
                if (socket) {
                    console.log(`✅ Found socket for ${p.name}, emitting combatStart`);
                    socket.emit('combatStart', combatData);
                } else {
                    console.log(`❌ No socket found for player ${p.originalId} (${p.name})`);
                }
            }
        });
    }

    broadcastCombatUpdate(combat) {
        const combatData = this.serializeCombat(combat);
        combat.participants.forEach(p => {
            if (p.type === 'player') {
                const socket = this.getPlayerSocket(p.originalId);
                if (socket) {
                    socket.emit('combatUpdate', combatData);
                }
            }
        });
    }    broadcastCombatEnd(combat, winners, losers) {
        const combatData = this.serializeCombat(combat);
        combat.participants.forEach(p => {
            if (p.type === 'player') {
                const socket = this.getPlayerSocket(p.originalId);
                if (socket) {
                    const isWinner = winners.some(w => w.originalId === p.originalId);
                    const isLoser = losers.some(l => l.originalId === p.originalId && l.status === 'defeated');
                    
                    socket.emit('combatEnded', {
                        combat: combatData,
                        winners: winners,
                        losers: losers,
                        isWinner: isWinner,
                        isDefeated: isLoser,
                        characterDeleted: isLoser // Flag to indicate character deletion
                    });
                }
            }
        });
    }

    serializeCombat(combat) {
        return {
            id: combat.id,
            type: combat.type,
            grid: combat.grid,
            participants: combat.participants,
            currentTurn: combat.currentTurn,
            turnPhase: combat.turnPhase,
            turnNumber: combat.turnNumber,
            status: combat.status
        };
    }    getPlayerSocket(playerId) {
        // Find socket by player ID from the players map
        const player = Array.from(this.players.values()).find(p => p.id === playerId || p.socketId === playerId);
        if (!player) return null;
        
        return Array.from(this.io.sockets.sockets.values()).find(socket => socket.id === player.socketId || socket.id === player.id);
    }

    // Check if player is in combat
    isInCombat(socketId) {
        return this.combatQueue.has(socketId);
    }    // Get combat for player
    getCombat(socketId) {
        const combatId = this.combatQueue.get(socketId);
        return combatId ? this.activeCombats.get(combatId) : null;
    }
      // Handle character deletion for defeated players
    handlePlayerDeath(playerId, playerName) {
        // Remove player from the main players map
        if (this.players.has(playerId)) {
            this.players.delete(playerId);
            console.log(`💀 Deleted player ${playerName} from game`);
        }
        
        // Notify all players about character deletion
        this.io.emit('playerDeleted', {
            playerId: playerId,
            playerName: playerName,
            reason: 'Defeated in combat'
        });
        
        // Disconnect the player's socket
        const socket = this.getPlayerSocket(playerId);
        if (socket) {
            socket.emit('characterDeleted', {
                message: 'Your character was defeated and has been deleted. You must create a new character.',
                playerName: playerName
            });
            
            // Disconnect after a delay to allow message to be received
            setTimeout(() => {
                socket.disconnect(true);
            }, 3000);
        }
    }

    // Handle flee combat
    handleFleeCombat(socketId) {
        const combatId = this.combatQueue.get(socketId);
        if (!combatId) return { success: false, error: 'Not in combat' };

        const combat = this.activeCombats.get(combatId);
        if (!combat || combat.status !== 'active') {
            return { success: false, error: 'Combat not active' };
        }

        // Find the fleeing player
        const fleeingUnit = combat.participants.find(p => p.originalId === socketId);
        if (!fleeingUnit) {
            return { success: false, error: 'Player not found in combat' };
        }

        console.log(`🏃 ${fleeingUnit.name} is fleeing from combat!`);

        // Mark player as fled
        fleeingUnit.status = 'fled';
        
        // Remove from combat queue
        this.combatQueue.delete(socketId);

        // Check if combat should end
        if (this.checkCombatEnd(combat)) {
            this.endCombat(combat);
        } else {
            // If it was the fleeing player's turn, move to next turn
            if (combat.participants[combat.currentTurn].originalId === socketId) {
                this.endTurn(socketId);
            } else {
                this.broadcastCombatUpdate(combat);
            }
        }

        return { 
            success: true, 
            message: `${fleeingUnit.name} fled from combat!`
        };
    }
}

module.exports = TacticalCombat;