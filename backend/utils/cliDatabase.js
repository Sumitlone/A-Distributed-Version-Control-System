const mongoose = require("mongoose");

async function connectCliDatabase() {
  if (mongoose.connection.readyState === 1) {
    return;
  }

  const mongoURI = process.env.MONGODB_URI;

  if (!mongoURI) {
    throw new Error("MONGODB_URI is not configured.");
  }

  await mongoose.connect(mongoURI);

  console.log("CLI MongoDB connection successful.");
}

async function disconnectCliDatabase() {
  if (mongoose.connection.readyState === 1) {
    await mongoose.connection.close();
  }
}

module.exports = {
  connectCliDatabase,
  disconnectCliDatabase,
};
