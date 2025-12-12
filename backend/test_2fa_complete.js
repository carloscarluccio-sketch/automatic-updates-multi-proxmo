const axios = require('axios');

async function test2FAFlow() {
  console.log('\n=== Testing Complete 2FA Flow ===\n');

  try {
    // Step 1: Login
    console.log('Step 1: Logging in...');
    const loginResponse = await axios.post('http://localhost:3000/api/auth/login', {
      email: 'admin@proxmox.local',
      password: 'admin'
    });

    if (!loginResponse.data.success) {
      console.error('Login failed:', loginResponse.data.message);
      return;
    }

    const token = loginResponse.data.data.token;
    console.log('Login successful, token received:', token.substring(0, 20) + '...\n');

    // Step 2: Setup 2FA
    console.log('Step 2: Setting up 2FA...');
    const setupResponse = await axios.post('http://localhost:3000/api/2fa/setup', {}, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    console.log('\n2FA Setup Response:');
    console.log('- Success:', setupResponse.data.success);
    console.log('- Message:', setupResponse.data.message);

    if (setupResponse.data.data) {
      console.log('\n2FA Data:');
      console.log('- Secret Length:', setupResponse.data.data.secret?.length || 0);
      console.log('- Secret:', setupResponse.data.data.secret);
      console.log('- Manual Entry Key Length:', setupResponse.data.data.manualEntryKey?.length || 0);
      console.log('- QR Code Data URL Length:', setupResponse.data.data.qrCode?.length || 0);
      console.log('- QR Code starts with data:image/png:', setupResponse.data.data.qrCode?.startsWith('data:image/png') || false);
      console.log('- QR Code first 100 chars:', setupResponse.data.data.qrCode?.substring(0, 100) || 'N/A');
      console.log('- OTPAuth URL:', setupResponse.data.data.otpauthUrl || 'N/A');
    } else {
      console.log('\nNo data in response!');
      console.log('Full response:', JSON.stringify(setupResponse.data, null, 2));
    }

  } catch (error) {
    console.error('\nError during 2FA flow test:');
    console.error('- Message:', error.message);
    if (error.response) {
      console.error('- Status:', error.response.status);
      console.error('- Response:', JSON.stringify(error.response.data, null, 2));
    }
  }
}

test2FAFlow().catch(console.error);
