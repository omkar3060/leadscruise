const axios = require('axios');

const LOCAL_SERVER = 'https://api.leadscruise.com';
const WORKER_SERVER = 'http://82.112.227.97:5001';
const NGROK_URL = 'https://sourish-wambly-felicidad.ngrok-free.dev';

async function testFullFlow() {
  console.log('🚀 Testing Full Server Communication Flow\n');
  console.log('=' .repeat(70));
  
  // Test 1: Local Server
  console.log('\n📊 Test 1: Local Server (Server 1)');
  console.log(`URL: ${LOCAL_SERVER}/api/active-sessions`);
  try {
    const response = await axios.get(`${LOCAL_SERVER}/api/active-sessions`, { 
      timeout: 5000 
    });
    console.log('✅ Local server is running!');
    console.log(`Active sessions: ${response.data.length || 0}`);
  } catch (error) {
    console.log('❌ Local server not running');
    console.log(`Error: ${error.message}`);
    console.log('\n💡 Solution: Start your local server with "npm start"');
    return;
  }
  
  // Test 2: Worker Server
  console.log('\n📊 Test 2: Worker Server (Server 2)');
  console.log(`URL: ${WORKER_SERVER}/health`);
  try {
    const response = await axios.get(`${WORKER_SERVER}/health`, { 
      timeout: 5000 
    });
    console.log('✅ Worker server is running!');
    console.log(`Main Server URL: ${response.data.mainServerUrl}`);
    console.log(`Active processes: ${response.data.activeProcesses}`);
    
    // Verify worker server has correct main server URL
    if (response.data.mainServerUrl !== NGROK_URL) {
      console.log('⚠️  WARNING: Worker server has wrong MAIN_SERVER_URL');
      console.log(`   Expected: ${NGROK_URL}`);
      console.log(`   Got: ${response.data.mainServerUrl}`);
      console.log('\n💡 Update .env on Server 2 and restart worker-server');
    }
  } catch (error) {
    console.log('❌ Worker server not accessible');
    console.log(`Error: ${error.message}`);
    return;
  }
  
  // Test 3: ngrok Tunnel
  console.log('\n📊 Test 3: ngrok Tunnel');
  console.log(`URL: ${NGROK_URL}/api/active-sessions`);
  try {
    const response = await axios.get(`${NGROK_URL}/api/active-sessions`, { 
      timeout: 10000,
      headers: {
        'ngrok-skip-browser-warning': 'true'
      }
    });
    console.log('✅ ngrok tunnel is working!');
    console.log(`Active sessions: ${response.data.length || 0}`);
  } catch (error) {
    console.log('❌ ngrok tunnel not working');
    console.log(`Error: ${error.message}`);
    console.log('\n💡 Make sure ngrok is running: ngrok http 5000');
    return;
  }
  
  // Test 4: Worker to Main Server Communication
  console.log('\n📊 Test 4: Worker → Main Server Communication');
  console.log('Simulating worker server calling main server...');
  try {
    // This simulates what worker server does when notifying main server
    const response = await axios.post(
      `${NGROK_URL}/api/worker/balance-update`,
      {
        userEmail: 'test@example.com',
        balance: 100
      },
      { 
        timeout: 10000,
        headers: {
          'ngrok-skip-browser-warning': 'true'
        }
      }
    );
    console.log('✅ Worker can communicate with main server!');
  } catch (error) {
    if (error.response && error.response.status === 404) {
      console.log('✅ Communication works (endpoint returned 404, which is expected)');
    } else {
      console.log('⚠️  Communication may have issues');
      console.log(`Error: ${error.message}`);
    }
  }
  
  console.log('\n' + '=' .repeat(70));
  console.log('\n✨ Summary:');
  console.log('┌─────────────────────────────────────────────────────────────┐');
  console.log('│ Server Configuration:                                       │');
  console.log('├─────────────────────────────────────────────────────────────┤');
  console.log(`│ Local Server:    ${LOCAL_SERVER.padEnd(40)} │`);
  console.log(`│ Worker Server:   ${WORKER_SERVER.padEnd(40)} │`);
  console.log(`│ ngrok Tunnel:    ${NGROK_URL.padEnd(40)} │`);
  console.log('└─────────────────────────────────────────────────────────────┘');
  
  console.log('\n📝 Configuration Files:');
  console.log('\n✅ Local Server .env (leadscruise/backend/.env):');
  console.log(`   WORKER_SERVER_URL=${WORKER_SERVER}`);
  
  console.log('\n✅ Worker Server .env (backend2/.env on 82.112.227.97):');
  console.log(`   MAIN_SERVER_URL=${NGROK_URL}`);
  console.log(`   WORKER_SERVER_URL=${WORKER_SERVER}`);
  
  console.log('\n🎯 Ready to test script execution!');
  console.log('\n' + '=' .repeat(70));
}

testFullFlow().catch(error => {
  console.error('\n❌ Test failed:', error.message);
});