import admin from './src/config/firebase.js';

async function testWrite() {
  try {
    const db = admin.database();
    
    console.log('🧪 Testing Firebase Admin write access...');
    
    // Test write
    const testRef = db.ref('test_admin_write');
    await testRef.set({
      message: 'Admin SDK write test',
      timestamp: Date.now()
    });
    
    console.log('✅ Write successful!');
    
    // Test read
    const snapshot = await testRef.once('value');
    console.log('📖 Read successful:', snapshot.val());
    
    // Clean up
    await testRef.remove();
    console.log('🗑️  Test data cleaned up');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Firebase test failed:', error);
    console.error('Error code:', error.code);
    console.error('Error details:', error.details);
    process.exit(1);
  }
}

testWrite();
