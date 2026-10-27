const mongoose = require('mongoose');

let isConnected = false;

async function connectMongo(uri = process.env.MONGODB_URI) {
  if (!uri) {
    return false;
  }
  if (isConnected) {
    return true;
  }
  try {
    await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 5000,
    });
    isConnected = true;
    console.log('🍃 Successfully connected to MongoDB Database via Mongoose.');
    return true;
  } catch (error) {
    console.error('❌ MongoDB Connection Error:', error.message);
    return false;
  }
}

function getMongoStatus() {
  return {
    isConnected: mongoose.connection.readyState === 1,
    readyState: mongoose.connection.readyState,
    host: mongoose.connection.host,
    name: mongoose.connection.name
  };
}

module.exports = { connectMongo, getMongoStatus };
