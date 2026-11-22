'use strict';

const path = require('path');
const express = require('express');

const store = require('./src/store');
const http = require('./src/http');
const authRoutes = require('./src/routes/auth');
const userRoutes = require('./src/routes/user');
const adminRoutes = require('./src/routes/admin');

store.init();

const app = express();
app.set('trust proxy', 1);
app.disable('x-powered-by');

app.use(http.securityHeaders);
app.use(express.json({ limit: '8mb' }));
app.use(express.urlencoded({ extended: false, limit: '1mb' }));
app.use(http.attachUser);

app.get('/api/health', (req, res) => {
  res.json({ ok: true, brand: 'ARADA BETTING', mode: 'virtual-demo', time: new Date().toISOString() });
});

app.use('/api', http.apiRateLimit);
app.use('/api/auth', authRoutes);
app.use('/api', userRoutes);
app.use('/api/admin', adminRoutes);

app.use('/api', (req, res) => {
  res.status(404).json({ error: 'Endpoint not found.' });
});

const publicDir = path.join(__dirname, 'public');
app.use(
  express.static(publicDir, {
    maxAge: '1h',
    setHeaders(res, filePath) {
      if (filePath.endsWith('.html')) res.setHeader('Cache-Control', 'no-cache');
    },
  }),
);

// Single page app fallback for every non-API route.
app.use((req, res, next) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') return next();
  res.sendFile(path.join(publicDir, 'index.html'));
});

app.use((err, req, res, next) => {
  const status = Number(err.status) || 500;
  if (status >= 500) console.error('[arada] request error:', err);
  if (res.headersSent) return next(err);
  return res.status(status).json({
    error: status >= 500 ? 'Something went wrong on our side. Please try again.' : err.message,
  });
});

const PORT = Number(process.env.PORT) || 3000;

if (require.main === module) {
  const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`ARADA BETTING demo platform listening on http://0.0.0.0:${PORT}`);
  });
  const shutdown = (signal) => {
    console.log(`[arada] ${signal} received, flushing demo database.`);
    store.flush();
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 4000).unref();
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

module.exports = app;
