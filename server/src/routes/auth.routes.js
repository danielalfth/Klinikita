const express = require('express');
const router = express.Router();
const { login, me } = require('../controllers/auth.controller');
const { verifyToken } = require('../middlewares/auth.middleware');

router.post('/login', login);
router.get('/me', verifyToken, me);

module.exports = router;
