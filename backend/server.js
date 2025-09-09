const express = require("express");
const cors = require("cors");
require("dotenv").config();
const mysqlDb = require("./db"); // import your db.js

const app = express();
app.use(cors());
app.use(express.json());


app.use("/api/auth", require("./routes/auth"));
app.use("/api/files", require("./routes/files"));

// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`✅ Server running at http://localhost:${PORT}`);
});
