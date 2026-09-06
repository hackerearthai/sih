const express = require("express");
const jwt = require("jsonwebtoken");
const { query } = require("../db");

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || "sih26190-development-secret";

router.post("/login", async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: "username and password are required" });
  }
  try {
    const result = await query(
      `SELECT user_id AS "userId", username, password, role FROM users WHERE username = $1`,
      [username]
    );
    const user = result.rows[0];
    if (!user || user.password !== password) {
      return res.status(401).json({ error: "Invalid username or password" });
    }
    const token = jwt.sign(
      { userId: user.userId, role: user.role, username: user.username },
      JWT_SECRET,
      { expiresIn: "8h" }
    );
    res.json({ token, role: user.role, userId: user.userId });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
