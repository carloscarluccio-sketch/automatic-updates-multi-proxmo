const speakeasy = require('speakeasy');
const QRCode = require('qrcode');

async function test2FA() {
  console.log('\n=== Testing 2FA Generation ===');

  // Generate secret
  const secret = speakeasy.generateSecret({
    name: 'Proxmox Multi-Tenant (admin@proxmox.local)',
    issuer: 'Proxmox Multi-Tenant',
    length: 32
  });

  console.log('\nGenerated Secret:');
  console.log('- Base32:', secret.base32);
  console.log('- Base32 Length:', secret.base32.length);
  console.log('- OTPAuth URL:', secret.otpauth_url);

  if (!secret.otpauth_url) {
    console.error('ERROR: otpauth_url is undefined!');
    return;
  }

  // Generate QR code
  try {
    const qrCodeDataUrl = await QRCode.toDataURL(secret.otpauth_url, {
      errorCorrectionLevel: 'H',
      type: 'image/png',
      width: 300,
      margin: 1,
    });
    console.log('\nQR Code Generated:');
    console.log('- Data URL Length:', qrCodeDataUrl.length);
    console.log('- Starts with data:image/png:', qrCodeDataUrl.startsWith('data:image/png'));
    console.log('- First 100 chars:', qrCodeDataUrl.substring(0, 100));

    // Test token generation
    const token = speakeasy.totp({
      secret: secret.base32,
      encoding: 'base32'
    });
    console.log('\nTest Token Generated:', token);
    console.log('- Token Length:', token.length);

    // Verify token
    const verified = speakeasy.totp.verify({
      secret: secret.base32,
      encoding: 'base32',
      token: token,
      window: 2
    });
    console.log('- Token Verification:', verified ? 'SUCCESS' : 'FAILED');

  } catch (error) {
    console.error('QR Code generation error:', error.message);
  }
}

test2FA().catch(console.error);
