const bcrypt = require('bcrypt');
bcrypt.hash('admin123', 10, (err, hash) => {
  if (err) { console.error(err); process.exit(1); }
  console.log('Username: admin');
  console.log('Password: admin123');
  console.log('Hash:', hash);
});
