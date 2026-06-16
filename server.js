const express = require('express');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 8080;

process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

// Serve static files from the root directory
app.use(express.static(path.join(__dirname, '.')));

app.listen(PORT, '0.0.0.0', (err) => {
  if (err) {
    console.error('Error starting server:', err);
    process.exit(1);
  }
  console.log(`Server is running on port ${PORT} and listening on 0.0.0.0`);
});
