require('dotenv').config();
const express = require('express');
const path = require('path');
const groqHandler = require('./groq');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// Serve static files (index.html, style.css, script.js)
app.use(express.static(path.join(__dirname)));

// API route
app.post('/api/actions', groqHandler);

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});