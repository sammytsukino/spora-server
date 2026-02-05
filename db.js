const mongoose = require('mongoose');

async function connectDB() {
  await mongoose.connect(process.env.MONGO_URL || 'mongodb://localhost:27017/sporadb')
    .then(() => console.log('MongoDB connected!'))
    .catch((err) => console.log('MongoDB connection error:', err));
}

module.exports = { connectDB };
