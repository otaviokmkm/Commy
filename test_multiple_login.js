// test_multiple_login.js
// Teste para verificar se o sistema de sessões exclusivas funciona

const fetch = require('node-fetch'); // Você pode precisar instalar com: npm install node-fetch
const io = require('socket.io-client'); // Você pode precisar instalar com: npm install socket.io-client

const SERVER_URL = 'http://localhost:3000';

async function testMultipleLogin() {
    console.log('=== TESTE DE MÚLTIPLOS LOGINS SIMULTÂNEOS ===');
    
    const testUser = {
        login: '123',
        password: '123'
    };
    
    console.log('\n1. Fazendo primeiro login...');
    try {
        const response1 = await fetch(`${SERVER_URL}/api/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(testUser)
        });
        
        const data1 = await response1.json();
        console.log('Login 1 resultado:', data1);
        
        if (data1.success) {
            console.log('Token 1:', data1.token);
            
            // Conectar socket 1
            const socket1 = io(SERVER_URL);
            
            socket1.on('connect', () => {
                console.log('Socket 1 conectado, autenticando...');
                socket1.emit('authenticate', {
                    login: testUser.login,
                    sessionToken: data1.token
                });
            });
            
            socket1.on('authenticationSuccess', (data) => {
                console.log('Socket 1 autenticado com sucesso:', data.message);
            });
            
            socket1.on('sessionInvalidated', (data) => {
                console.log('Socket 1 - Sessão invalidada:', data.message);
                socket1.disconnect();
            });
            
            // Aguardar um pouco antes do segundo login
            setTimeout(async () => {
                console.log('\n2. Fazendo segundo login (deveria invalidar o primeiro)...');
                
                try {
                    const response2 = await fetch(`${SERVER_URL}/api/login`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(testUser)
                    });
                    
                    const data2 = await response2.json();
                    console.log('Login 2 resultado:', data2);
                    
                    if (data2.success) {
                        console.log('Token 2:', data2.token);
                        
                        // Conectar socket 2
                        const socket2 = io(SERVER_URL);
                        
                        socket2.on('connect', () => {
                            console.log('Socket 2 conectado, autenticando...');
                            socket2.emit('authenticate', {
                                login: testUser.login,
                                sessionToken: data2.token
                            });
                        });
                        
                        socket2.on('authenticationSuccess', (data) => {
                            console.log('Socket 2 autenticado com sucesso:', data.message);
                            
                            // Finalizar teste após 3 segundos
                            setTimeout(() => {
                                console.log('\n=== FINALIZANDO TESTE ===');
                                socket2.disconnect();
                                process.exit(0);
                            }, 3000);
                        });
                        
                        socket2.on('sessionInvalidated', (data) => {
                            console.log('Socket 2 - Sessão invalidada:', data.message);
                            socket2.disconnect();
                        });
                        
                    } else {
                        console.log('Erro no segundo login:', data2.error);
                    }
                    
                } catch (error) {
                    console.error('Erro no segundo login:', error);
                }
                
            }, 2000); // Aguardar 2 segundos antes do segundo login
            
        } else {
            console.log('Erro no primeiro login:', data1.error);
        }
        
    } catch (error) {
        console.error('Erro no primeiro login:', error);
    }
}

// Executar teste
testMultipleLogin();
