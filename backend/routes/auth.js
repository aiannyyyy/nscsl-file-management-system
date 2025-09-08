const express = require("express");
const router = express.Router();
const mysqlDb = require("../db");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

// Login Route
router.post("/login", (req, res) => {
  const { user_name, password } = req.body;

  if (!user_name || !password) {
    return res.status(400).json({ message: "Username and password required" });
  }

  // Find user in DB
  mysqlDb.query(
    "SELECT * FROM users WHERE user_name = ? LIMIT 1",
    [user_name],
    async (err, results) => {
      if (err) {
        console.error("❌ Database error:", err);
        return res.status(500).json({ message: "Database error" });
      }

      if (results.length === 0) {
        return res.status(401).json({ message: "Invalid username or password" });
      }

      const user = results[0];

      // ⚠️ TEMP: if password is stored as plain text
      const isMatch = password === user.password_hash;

      // ✅ Once you hash passwords, replace above with:
      // const isMatch = await bcrypt.compare(password, user.password_hash);

      if (!isMatch) {
        return res.status(401).json({ message: "Invalid username or password" });
      }

      // Generate JWT
      const token = jwt.sign(
        { id: user.id, role: user.role, name: user.name },
        process.env.JWT_SECRET || "supersecretkey",
        { expiresIn: "1h" }
      );

      res.json({
        message: "✅ Login successful",
        token,
        user: {
          id: user.id,
          user_name: user.user_name,
          name: user.name,
          department: user.department,
          position: user.position,
          role: user.role,
          email: user.email,
        },
      });
    }
  );
});

module.exports = router;
