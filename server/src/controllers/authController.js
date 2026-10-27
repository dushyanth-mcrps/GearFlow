const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { getDb } = require('../db/connection');
const { JWT_SECRET } = require('../middleware/auth');
const User = require('../models/User');
const mongoose = require('mongoose');

function isMongo() {
  return mongoose.connection && mongoose.connection.readyState === 1;
}

async function register(req, res) {
  try {
    const { name, email, password, role = 'borrower', department, phone } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Name, email, and password are required' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters long' });
    }

    const validRoles = ['borrower', 'custodian', 'admin'];
    if (!validRoles.includes(role)) {
      return res.status(400).json({ error: 'Invalid user role' });
    }

    const normalizedEmail = email.toLowerCase().trim();

    // MongoDB Flow
    if (isMongo()) {
      const existing = await User.findOne({ email: normalizedEmail });
      if (existing) {
        return res.status(409).json({ error: 'User with this email already exists' });
      }

      const hashedPassword = bcrypt.hashSync(password, 10);
      const createdUser = await User.create({
        name: name.trim(),
        email: normalizedEmail,
        password: hashedPassword,
        role,
        department: department || null,
        phone: phone || null,
        depositBalance: 250.0
      });

      const token = jwt.sign(
        { id: createdUser._id.toString(), email: createdUser.email, role: createdUser.role, name: createdUser.name },
        JWT_SECRET,
        { expiresIn: '7d' }
      );

      return res.status(201).json({
        message: 'User registered successfully in MongoDB',
        token,
        user: createdUser.toJSON()
      });
    }

    // SQLite Fallback Flow
    const db = getDb();
    const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(normalizedEmail);
    if (existing) {
      return res.status(409).json({ error: 'User with this email already exists' });
    }

    const hashedPassword = bcrypt.hashSync(password, 10);
    const result = db.prepare(`
      INSERT INTO users (name, email, password, role, department, phone, depositBalance)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(name.trim(), normalizedEmail, hashedPassword, role, department || null, phone || null, 250.0);

    const user = {
      id: result.lastInsertRowid,
      name: name.trim(),
      email: normalizedEmail,
      role,
      department: department || null,
      phone: phone || null,
      depositBalance: 250.0
    };

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role, name: user.name },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    return res.status(201).json({
      message: 'User registered successfully',
      token,
      user
    });
  } catch (error) {
    console.error('Registration error:', error);
    return res.status(500).json({ error: 'Internal server error during registration' });
  }
}

async function login(req, res) {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const normalizedEmail = email.toLowerCase().trim();

    // MongoDB Flow
    if (isMongo()) {
      const user = await User.findOne({ email: normalizedEmail });
      if (!user) {
        return res.status(401).json({ error: 'Invalid email or password' });
      }

      const match = bcrypt.compareSync(password, user.password);
      if (!match) {
        return res.status(401).json({ error: 'Invalid email or password' });
      }

      const token = jwt.sign(
        { id: user._id.toString(), email: user.email, role: user.role, name: user.name },
        JWT_SECRET,
        { expiresIn: '7d' }
      );

      return res.json({
        message: 'Login successful (MongoDB)',
        token,
        user: user.toJSON()
      });
    }

    // SQLite Fallback Flow
    const db = getDb();
    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(normalizedEmail);

    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const match = bcrypt.compareSync(password, user.password);
    if (!match) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role, name: user.name },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    const { password: _, ...userProfile } = user;

    return res.json({
      message: 'Login successful',
      token,
      user: userProfile
    });
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({ error: 'Internal server error during login' });
  }
}

async function getProfile(req, res) {
  try {
    if (isMongo()) {
      const user = await User.findById(req.user.id);
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }
      return res.json({ user: user.toJSON() });
    }

    const db = getDb();
    const user = db.prepare('SELECT id, name, email, role, department, phone, depositBalance, createdAt FROM users WHERE id = ?').get(req.user.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    return res.json({ user });
  } catch (error) {
    console.error('Get profile error:', error);
    return res.status(500).json({ error: 'Failed to retrieve profile' });
  }
}

async function getAllUsers(req, res) {
  try {
    if (isMongo()) {
      const users = await User.find().sort({ name: 1 });
      return res.json({ users: users.map(u => u.toJSON()) });
    }

    const db = getDb();
    const users = db.prepare('SELECT id, name, email, role, department, phone, depositBalance, createdAt FROM users ORDER BY name ASC').all();
    return res.json({ users });
  } catch (error) {
    console.error('Get all users error:', error);
    return res.status(500).json({ error: 'Failed to fetch users' });
  }
}

module.exports = { register, login, getProfile, getAllUsers };
