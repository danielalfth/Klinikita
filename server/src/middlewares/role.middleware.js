function requireRole(role) {
  return (req, res, next) => {
    if (!req.user || req.user.role !== role) {
      return res.status(403).json({ success: false, message: 'Akses ditolak. Role tidak sesuai.' });
    }
    next();
  };
}

module.exports = { requireRole };
