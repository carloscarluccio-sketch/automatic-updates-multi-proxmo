import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function resetPasswords() {
  try {
    // Hash the new passwords
    const adminPassword = await bcrypt.hash('admin123', 10);
    const testPassword = await bcrypt.hash('test123', 10);
    const apiPassword = await bcrypt.hash('api123', 10);

    // Update admin@proxmox.local
    await prisma.users.update({
      where: { email: 'admin@proxmox.local' },
      data: { password_hash: adminPassword }
    });
    console.log('✓ Reset admin@proxmox.local password to: admin123');

    // Update test@test.com
    await prisma.users.update({
      where: { email: 'test@test.com' },
      data: { password_hash: testPassword }
    });
    console.log('✓ Reset test@test.com password to: test123');

    // Update apitest@local.com
    await prisma.users.update({
      where: { email: 'apitest@local.com' },
      data: { password_hash: apiPassword }
    });
    console.log('✓ Reset apitest@local.com password to: api123');

    console.log('\nAll passwords have been reset successfully!');
  } catch (error) {
    console.error('Error resetting passwords:', error);
  } finally {
    await prisma.$disconnect();
  }
}

resetPasswords();
