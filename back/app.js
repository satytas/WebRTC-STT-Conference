const express = require('express');
const path = require('path');
const app = express();
const port = 3000;

// Serve static files from the public dic
app.use(express.static(path.join(__dirname, '../front')));
// Catch all routes and send index.html
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../front', 'index.html'));
});

// Start the server
app.listen(port, () => {
  console.log(`Express server running on http://localhost:${port}`);
});