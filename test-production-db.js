const mongoose = require('mongoose');

async function testProductionDB() {
  console.log('🧪 Testing Production MongoDB Connection...');
  console.log('Environment:', process.env.NODE_ENV);
  
  const mongoURI = process.env.MONGODB_URI;
  
  if (!mongoURI) {
    console.error('❌ No MONGODB_URI found in environment variables');
    return;
  }
  
  console.log('📡 URI configured:', mongoURI ? 'Yes' : 'No');
  
  try {
    await mongoose.connect(mongoURI);
    console.log('✅ Connected to MongoDB successfully');
    
    // Test basic operations
    const testData = {
      test: 'production-connection',
      timestamp: new Date(),
      environment: process.env.NODE_ENV || 'unknown'
    };
    
    // Create a simple schema for testing
    const TestSchema = new mongoose.Schema({
      test: String,
      timestamp: Date,
      environment: String
    });
    
    const TestModel = mongoose.model('Test', TestSchema);
    
    // Insert test document
    const doc = await TestModel.create(testData);
    console.log('✅ Test document created:', doc._id);
    
    // Read test document
    const found = await TestModel.findById(doc._id);
    console.log('✅ Test document retrieved:', found.test);
    
    // Clean up
    await TestModel.findByIdAndDelete(doc._id);
    console.log('✅ Test document cleaned up');
    
    console.log('🎉 All database operations successful!');
    
  } catch (error) {
    console.error('❌ Database test failed:', error.message);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Database connection closed');
  }
}

testProductionDB();
