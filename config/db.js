const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Mongo conectado 🚀');
  } catch (error) {
    console.error('Erro Mongo:', error);
    process.exit(1);
  }
};

module.exports = connectDB;