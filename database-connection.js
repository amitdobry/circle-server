const mongoose = require('mongoose');
require('dotenv').config();

class DatabaseConnection {
  constructor() {
    this.isConnected = false;
  }

  async connectToMongoDB() {
    try {
      const mongoUri = process.env.NODE_ENV === 'production' 
        ? process.env.MONGODB_URI_PROD 
        : process.env.MONGODB_URI;

      console.log(`Connecting to MongoDB (${process.env.NODE_ENV || 'development'} mode)...`);
      
      const options = {
        // Connection options for both local and Atlas
        maxPoolSize: 10,
        serverSelectionTimeoutMS: 5000,
        socketTimeoutMS: 45000,
        bufferCommands: false,
      };

      // Additional options for Atlas (production)
      if (process.env.NODE_ENV === 'production') {
        options.retryWrites = true;
        options.retryReads = true;
      }

      await mongoose.connect(mongoUri, options);
      
      this.isConnected = true;
      console.log('✅ MongoDB connected successfully');
      
      // Test the connection
      const db = mongoose.connection.db;
      const ping = await db.admin().ping();
      console.log('✅ Database ping successful:', ping);
      
      return true;
      
    } catch (error) {
      console.error('❌ MongoDB connection failed:', error.message);
      this.isConnected = false;
      
      if (error.message.includes('ETIMEDOUT')) {
        console.log('🔍 Network timeout - check firewall/network settings');
      } else if (error.message.includes('authentication')) {
        console.log('🔍 Authentication failed - check credentials');
      }
      
      throw error;
    }
  }

  async disconnect() {
    if (this.isConnected) {
      await mongoose.disconnect();
      this.isConnected = false;
      console.log('📤 MongoDB disconnected');
    }
  }

  isDbConnected() {
    return this.isConnected && mongoose.connection.readyState === 1;
  }
}

// Test both development and production connections
async function testConnections() {
  const db = new DatabaseConnection();
  
  console.log('=== Testing Development Connection ===');
  process.env.NODE_ENV = 'development';
  try {
    await db.connectToMongoDB();
    await db.disconnect();
  } catch (error) {
    console.log('Development connection failed (expected if MongoDB not running locally)');
  }
  
  console.log('\n=== Testing Production Connection ===');
  process.env.NODE_ENV = 'production';
  try {
    await db.connectToMongoDB();
    await db.disconnect();
  } catch (error) {
    console.log('Production connection failed - network issue');
  }
}

// Export for use in your application
module.exports = DatabaseConnection;

// Run tests if this file is executed directly
if (require.main === module) {
  testConnections();
}
