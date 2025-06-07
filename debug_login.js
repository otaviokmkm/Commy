/**
 * Debug script to test login process step by step
 */

const puppeteer = require('puppeteer');

async function debugLogin() {
    console.log('🎮 Starting Login Debug Test...\n');
    
    const browser = await puppeteer.launch({ 
        headless: false, 
        slowMo: 2000 // Very slow for observation
    });
    
    try {
        const page = await browser.newPage();
        await page.setViewport({ width: 1200, height: 800 });
        
        // Navigate to the game
        console.log('📍 Navigating to game...');
        await page.goto('http://localhost:54879');
        
        // Wait for auth modal
        console.log('🔍 Waiting for auth modal...');
        await page.waitForSelector('#auth-modal', { timeout: 10000 });
        console.log('✅ Auth modal found');
        
        // Clear and type username
        console.log('👤 Entering username...');
        await page.click('#login-username'); // Focus first
        await page.keyboard.down('Control');
        await page.keyboard.press('KeyA');
        await page.keyboard.up('Control');
        await page.type('#login-username', 'testuser');
        
        // Clear and type password
        console.log('🔑 Entering password...');
        await page.click('#login-password'); // Focus first
        await page.keyboard.down('Control');
        await page.keyboard.press('KeyA');
        await page.keyboard.up('Control');
        await page.type('#login-password', 'testpass');
        
        // Click submit
        console.log('🚀 Clicking submit...');
        await page.click('button[type="submit"]');
        
        // Wait for response
        console.log('⏳ Waiting for login response...');
        await page.waitForTimeout(5000);
        
        // Check if still on auth modal or if logged in
        const authModalVisible = await page.evaluate(() => {
            const modal = document.getElementById('auth-modal');
            return modal && window.getComputedStyle(modal).display !== 'none';
        });
        
        if (authModalVisible) {
            console.log('❌ Still on auth modal - login failed');
            
            // Check for error message
            const errorMsg = await page.evaluate(() => {
                const errorEl = document.getElementById('auth-error');
                return errorEl ? errorEl.textContent : 'No error message found';
            });
            console.log('Error message:', errorMsg);
        } else {
            console.log('✅ Auth modal hidden - login successful');
            
            // Check game initialization
            const gameInitialized = await page.evaluate(() => {
                return window.gameInitialized === true;
            });
            console.log('Game initialized:', gameInitialized);
        }
        
        console.log('🔍 Browser will remain open for manual inspection...');
        await new Promise(resolve => {
            // Keep browser open
        });
        
    } catch (error) {
        console.error('❌ Debug failed with error:', error.message);
    }
}

debugLogin().catch(console.error);
