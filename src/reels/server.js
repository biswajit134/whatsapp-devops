import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';
import Reel from './models/Reel.js';
import User from './models/User.js'; // register schema for populate

dotenv.config();

const app = express();
const port = process.env.PORT || 9003;

// Middleware
app.use(express.json({ limit: '200mb' }));
app.use(express.urlencoded({ limit: '200mb', extended: true }));
app.use(helmet());
app.use(helmet.crossOriginResourcePolicy({ policy: 'cross-origin' }));
app.use(morgan('common'));
app.use(cors());

// DB
const connection_url = process.env.MONGO_URI || 'mongodb://localhost:27017/whatsappdb';
mongoose.connect(connection_url)
  .then(() => console.log('Reels MongoDB Connected'))
  .catch(err => console.log('MongoDB Error:', err));

// ─── HELPERS ─────────────────────────────────────────────────
const populateReel = (query) =>
  query
    .populate('userId', 'name profilePic')
    .populate('comments.userId', 'name profilePic');

// ─── ROUTES ──────────────────────────────────────────────────

// GET  /api/reels           – fetch all reels (latest first)
app.get('/api/reels', async (req, res) => {
  try {
    const reels = await populateReel(Reel.find().sort({ createdAt: -1 }));
    res.status(200).json(reels);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET  /api/reels/:id       – single reel (also increments view count)
app.get('/api/reels/:id', async (req, res) => {
  try {
    const reel = await populateReel(
      Reel.findByIdAndUpdate(req.params.id, { $inc: { views: 1 } }, { new: true })
    );
    if (!reel) return res.status(404).json({ error: 'Reel not found' });
    res.status(200).json(reel);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/reels           – create a reel
app.post('/api/reels', async (req, res) => {
  try {
    const { userId, videoUrl, caption, audioName } = req.body;
    const reel = await Reel.create({ userId, videoUrl, caption, audioName });
    const populated = await populateReel(Reel.findById(reel._id));
    res.status(201).json(populated);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// DELETE /api/reels/:id    – delete own reel
app.delete('/api/reels/:id', async (req, res) => {
  try {
    const { userId } = req.body;
    const reel = await Reel.findById(req.params.id);
    if (!reel) return res.status(404).json({ error: 'Reel not found' });
    if (reel.userId.toString() !== userId) return res.status(403).json({ error: 'Unauthorized' });
    await reel.deleteOne();
    res.status(200).json({ message: 'Reel deleted' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/reels/:id/like – toggle like
app.post('/api/reels/:id/like', async (req, res) => {
  try {
    const { userId } = req.body;
    const reel = await Reel.findById(req.params.id);
    if (!reel) return res.status(404).json({ error: 'Reel not found' });

    const idx = reel.likes.indexOf(userId);
    if (idx === -1) reel.likes.push(userId);
    else reel.likes.splice(idx, 1);

    await reel.save();
    const populated = await populateReel(Reel.findById(reel._id));
    res.status(200).json(populated);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/reels/:id/comment – add comment
app.post('/api/reels/:id/comment', async (req, res) => {
  try {
    const { userId, text } = req.body;
    const reel = await Reel.findById(req.params.id);
    if (!reel) return res.status(404).json({ error: 'Reel not found' });

    reel.comments.push({ userId, text });
    await reel.save();
    const populated = await populateReel(Reel.findById(reel._id));
    res.status(200).json(populated);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/reels/:id/share – increment share count
app.post('/api/reels/:id/share', async (req, res) => {
  try {
    const reel = await populateReel(
      Reel.findByIdAndUpdate(req.params.id, { $inc: { shares: 1 } }, { new: true })
    );
    if (!reel) return res.status(404).json({ error: 'Reel not found' });
    res.status(200).json(reel);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Health
app.get('/', (req, res) => res.status(200).send('Reels Microservice API'));

app.listen(port, () => console.log(`Reels Service listening on port ${port}`));
