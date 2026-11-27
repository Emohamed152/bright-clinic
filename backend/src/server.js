// Local run only: MONGODB_URI=... JWT_SECRET=... node src/server.js
const app = require('./app');
const port = process.env.PORT || 3001;
app.listen(port, () => console.log(`API on http://localhost:${port}`));
