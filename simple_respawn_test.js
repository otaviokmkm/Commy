/**
 * Simple test to verify that testuser respawns at saved position
 */

const puppeteer = require('puppeteer');

async function testRespawnPosition() {
    console.log('🎮 Testing Player Respawn Position...\n');
    
    const browser = await puppeteer.launch({ 
        headless: false, 
        slowMo: 1000
    });
    
    try {
        const page = await browser.newPage();
        await page.setViewport({ width: 1200, height: 800 });
        
        console.log('📍 Navigating to game...');
        await page.goto('http://localhost:3000');
        
        console.log('🔍 Waiting for auth modal...');
        await page.waitForSelector('#auth-modal', { timeout: 10000 });
        
        console.log('🔐 Logging in as testuser...');
        await page.click('#login-username');
        await page.keyboard.down('Control');
        await page.keyboard.press('KeyA');
        await page.keyboard.up('Control');
        await page.type('#login-username', 'testuser');
        
        await page.click('#login-password');
        await page.keyboard.down('Control');
        await page.keyboard.press('KeyA');
        await page.keyboard.up('Control');
        await page.type('#login-password', 'testpass');
        
        await page.click('button[type="submit"]');
        
        console.log('⏳ Waiting for login...');
        await page.waitForTimeout(3000);
        
        // Check if still on auth modal
        const authModalVisible = await page.evaluate(() => {
            const modal = document.getElementById('auth-modal');
            return modal && window.getComputedStyle(modal).display !== 'none';
        });
        
        if (authModalVisible) {
            const errorMsg = await page.evaluate(() => {
                const errorEl = document.getElementById('auth-error');
                return errorEl ? errorEl.textContent : 'No error message found';
            });
            console.log('❌ Login failed. Error:', errorMsg);
            return;
        }
        
        console.log('✅ Login successful!');
        
        console.log('⏳ Waiting for game to initialize...');
        await page.waitForTimeout(5000);
        
        // Get player position
        const playerData = await page.evaluate(() => {
            return {
                gameInitialized: typeof window.gameInitialized !== 'undefined' ? window.gameInitialized : 'undefined',
                playerExists: typeof window.player !== 'undefined',
                overworldX: window.player ? window.player.overworldX : 'undefined',
                overworldY: window.player ? window.player.overworldY : 'undefined',
                mapId: window.currentMapId || 'undefined'
            };
        });
        
        console.log('🎯 Player Data:', playerData);
        
        // Check if player is at the saved position (50, 50) according to testuser data
        if (playerData.overworldX === 50 && playerData.overworldY === 50) {
            console.log('✅ SUCCESS: Player spawned at saved position (50, 50)!');
        } else {
            console.log('❌ FAILED: Player spawned at wrong position. Expected (50, 50), got (' + playerData.overworldX + ', ' + playerData.overworldY + ')');
        }
        
        console.log('👀 Browser will remain open for manual verification...');
        await new Promise(resolve => {
            // Keep browser open for manual inspection
            setTimeout(() => {
                console.log('🔚 Test completed. You can close the browser now.');
                resolve();
            }, 30000); // Keep open for 30 seconds
        });
        
    } catch (error) {
        console.error('❌ Test failed with error:', error.message);
    } finally {
        await browser.close();
    }
}

testRespawnPosition().catch(console.error);
