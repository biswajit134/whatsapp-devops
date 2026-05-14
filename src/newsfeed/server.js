import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';
import Post from './models/Post.js';
import User from './models/User.js'; // to register the schema

dotenv.config();

const app = express();
const port = process.env.PORT || 9001;

// Middleware
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use(helmet());
app.use(helmet.crossOriginResourcePolicy({ policy: "cross-origin" }));
app.use(morgan('common'));
app.use(cors());

// DB config
const connection_url = process.env.MONGO_URI || 'mongodb://localhost:27017/whatsappdb';

mongoose.connect(connection_url)
  .then(() => console.log('Newsfeed MongoDB Connected'))
  .catch((err) => console.log('MongoDB Connection Error: ', err));

// API Routes
app.get('/api/newsfeed', async (req, res) => {
  try {
    const posts = await Post.find()
      .sort({ createdAt: -1 })
      .populate('userId', 'name profilePic')
      .populate('comments.userId', 'name profilePic');
    res.status(200).json(posts);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/newsfeed', async (req, res) => {
  try {
    const { userId, content, mediaUrl, mediaType } = req.body;
    const newPost = await Post.create({ userId, content, mediaUrl, mediaType });
    const populatedPost = await Post.findById(newPost._id).populate('userId', 'name profilePic');
    res.status(201).json(populatedPost);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/newsfeed/:id/like', async (req, res) => {
  try {
    const { userId } = req.body;
    const post = await Post.findById(req.params.id);
    
    if (!post) return res.status(404).json({ error: 'Post not found' });

    const index = post.likes.indexOf(userId);
    if (index === -1) {
      post.likes.push(userId); // like
    } else {
      post.likes.splice(index, 1); // unlike
    }
    
    await post.save();
    res.status(200).json(post);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/newsfeed/:id/comment', async (req, res) => {
  try {
    const { userId, text } = req.body;
    const post = await Post.findById(req.params.id);
    
    if (!post) return res.status(404).json({ error: 'Post not found' });

    post.comments.push({ userId, text });
    await post.save();
    
    const populatedPost = await Post.findById(post._id)
      .populate('userId', 'name profilePic')
      .populate('comments.userId', 'name profilePic');
      
    res.status(200).json(populatedPost);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/newsfeed/:id/react', async (req, res) => {
  try {
    const { userId, emoji } = req.body;
    const post = await Post.findById(req.params.id);
    if (!post) return res.status(404).json({ error: 'Post not found' });

    const existingIndex = post.reactions.findIndex(r => r.userId.toString() === userId);
    if (existingIndex !== -1) {
      if (post.reactions[existingIndex].emoji === emoji) {
        post.reactions.splice(existingIndex, 1); // remove if same emoji (toggle off)
      } else {
        post.reactions[existingIndex].emoji = emoji; // change emoji
      }
    } else {
      post.reactions.push({ userId, emoji });
    }

    await post.save();
    const populatedPost = await Post.findById(post._id)
      .populate('userId', 'name profilePic')
      .populate('comments.userId', 'name profilePic');
    res.status(200).json(populatedPost);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/newsfeed/:id/share', async (req, res) => {
  try {
    const post = await Post.findByIdAndUpdate(
      req.params.id,
      { $inc: { shares: 1 } },
      { new: true }
    ).populate('userId', 'name profilePic').populate('comments.userId', 'name profilePic');
    if (!post) return res.status(404).json({ error: 'Post not found' });
    res.status(200).json(post);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/', (req, res) => res.status(200).send('Newsfeed Microservice API'));

app.listen(port, () => console.log(`Newsfeed Service listening on port ${port}`));
