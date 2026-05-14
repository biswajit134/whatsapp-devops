import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';
import Status from './models/Status.js';
import './models/User.js'; // Must be imported so Mongoose registers the 'users' model for populate()

dotenv.config();

const app  = express();
const port = process.env.PORT || 9002;

// ── Middleware ─────────────────────────────────────────────────
app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ limit: '100mb', extended: true }));
app.use(helmet());
app.use(helmet.crossOriginResourcePolicy({ policy: 'cross-origin' }));
app.use(morgan('common'));
app.use(cors());

// ── DB ─────────────────────────────────────────────────────────
const connection_url = process.env.MONGO_URI || 'mongodb://localhost:27017/whatsappdb';
mongoose.connect(connection_url)
  .then(() => console.log('Status MongoDB Connected'))
  .catch(err  => console.log('MongoDB Connection Error:', err));

// ── Helper: populate views with user info ──────────────────────
const populateStatus = (query) =>
  query
    .populate('userId', 'name profilePic')
    .populate('views.userId', 'name profilePic');

// ── GET /api/status — all statuses grouped by user ─────────────
app.get('/api/status', async (req, res) => {
  try {
    const statuses = await populateStatus(
      Status.find().sort({ createdAt: 1 })
    );

    const grouped = statuses.reduce((acc, status) => {
      if (!status.userId) return acc;
      const uid = status.userId._id.toString();
      if (!acc[uid]) acc[uid] = { user: status.userId, statuses: [] };
      acc[uid].statuses.push(status);
      return acc;
    }, {});

    const result = Object.values(grouped).sort((a, b) => {
      const lastA = a.statuses[a.statuses.length - 1].createdAt;
      const lastB = b.statuses[b.statuses.length - 1].createdAt;
      return new Date(lastB) - new Date(lastA);
    });

    res.status(200).json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/status — create new status ───────────────────────
app.post('/api/status', async (req, res) => {
  try {
    const { userId, type, content, mediaUrl, backgroundColor } = req.body;
    const newStatus  = await Status.create({ userId, type, content, mediaUrl, backgroundColor });
    const populated  = await populateStatus(Status.findById(newStatus._id));
    res.status(201).json(populated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/status/:id/view — record a view (idempotent) ─────
app.post('/api/status/:id/view', async (req, res) => {
  try {
    const { viewerId } = req.body;          // ID of the user who is watching
    if (!viewerId) return res.status(400).json({ error: 'viewerId required' });

    const status = await Status.findById(req.params.id);
    if (!status) return res.status(404).json({ error: 'Status not found' });

    // Don't count the owner's own views
    if (status.userId.toString() === viewerId) {
      return res.status(200).json({ message: 'owner view ignored' });
    }

    // Idempotent — add only if not already viewed by this user
    const alreadyViewed = status.views.some(v => v.userId?.toString() === viewerId);
    if (!alreadyViewed) {
      status.views.push({ userId: viewerId, viewedAt: new Date() });
      await status.save();
    }

    const updated = await populateStatus(Status.findById(status._id));
    res.status(200).json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/status/:id/views — fetch viewers list (owner only) ─
app.get('/api/status/:id/views', async (req, res) => {
  try {
    const status = await populateStatus(Status.findById(req.params.id));
    if (!status) return res.status(404).json({ error: 'Status not found' });
    res.status(200).json(status.views);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── DELETE /api/status/:id — delete a status ──────────────────
app.delete('/api/status/:id', async (req, res) => {
  try {
    const { userId } = req.body;
    const status = await Status.findById(req.params.id);
    if (!status) return res.status(404).json({ error: 'Not found' });
    if (status.userId.toString() !== userId) return res.status(403).json({ error: 'Forbidden' });
    await status.deleteOne();
    res.status(200).json({ message: 'Deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/', (req, res) => res.status(200).send('Status Microservice API'));

app.listen(port, () => console.log(`Status Service listening on port ${port}`));
