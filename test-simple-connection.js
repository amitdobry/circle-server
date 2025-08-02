const { MongoClient } = require('mongodb');
require('dotenv').config();

async function testConnection() {
  const uri = 'mongodb+srv://Amit_test:Aa123456789@cluster0.fur2sj9.mongodb.net/soulcircle';
  
  console.log('Testing MongoDB Atlas connection...');
  
  const client = new MongoClient(uri, {
    connectTimeoutMS: 30000,
    socketTimeoutMS: 30000,
    serverSelectionTimeoutMS: 30000,
    maxPoolSize: 10,
    retryWrites: true,
    retryReads: true
  });

  try {
    console.log('Connecting...');
    await client.connect();
    console.log('✅ Connected successfully!');
    
    // Test database operations
    const db = client.db('soulcircle');
    const result = await db.admin().ping();
    console.log('✅ Ping result:', result);
    
    // List collections
    const collections = await db.listCollections().toArray();
    console.log('✅ Collections:', collections.map(c => c.name));
    
    // Test insert/read
    const testCol = db.collection('connectionTest');
    const insertResult = await testCol.insertOne({
      test: true,
      timestamp: new Date(),
      message: 'Connection test successful'
    });
    console.log('✅ Insert successful:', insertResult.insertedId);
    
    const findResult = await testCol.findOne({ _id: insertResult.insertedId });
    console.log('✅ Read successful:', findResult);
    
    // Cleanup
    await testCol.deleteOne({ _id: insertResult.insertedId });
    console.log('✅ Cleanup successful');
    
  } catch (error) {
    console.error('❌ Connection failed:');
    console.error('Message:', error.message);
    console.error('Name:', error.name);
    
    if (error.cause) {
      console.error('Cause:', error.cause);
    }
    
    // Check specific error types
    if (error.message.includes('ETIMEDOUT')) {
      console.log('\n🔍 This appears to be a network timeout issue.');
      console.log('Possible solutions:');
      console.log('1. Check your internet connection');
      console.log('2. Try connecting from a different network (mobile hotspot)');
      console.log('3. Check if corporate firewall is blocking MongoDB ports');
      console.log('4. Verify MongoDB Atlas IP whitelist settings');
    }
    
    if (error.message.includes('authentication')) {
      console.log('\n🔍 This appears to be an authentication issue.');
      console.log('Possible solutions:');
      console.log('1. Verify username and password');
      console.log('2. Check database user permissions');
      console.log('3. Ensure the user has access to the database');
    }
    
  } finally {
    try {
      await client.close();
      console.log('Connection closed');
    } catch (closeError) {
      console.error('Error closing connection:', closeError.message);
    }
  }
}

// Also test if we can reach the hostname
async function testConnectivity() {
  console.log('\n=== Testing Network Connectivity ===');
  
  try {
    const { execSync } = require('child_process');
    
    // Test DNS resolution
    console.log('Testing DNS resolution...');
    const nslookup = execSync('nslookup cluster0.fur2sj9.mongodb.net', { encoding: 'utf8' });
    console.log('✅ DNS resolution successful');
    
  } catch (error) {
    console.error('❌ DNS resolution failed:', error.message);
  }
}

async function main() {
  await testConnectivity();
  await testConnection();
}

main();
