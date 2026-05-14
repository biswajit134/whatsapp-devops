import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer } from 'http';
import { Server } from 'socket.io';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import Messages from './models/Message.js';
import Rooms from './models/Room.js';
import User from './models/User.js';

// Load environment variables
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = process.env.PORT || 9000;

// Set up HTTP Server and Socket.io
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Middleware
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use(helmet()); // Security headers
app.use(helmet.crossOriginResourcePolicy({ policy: "cross-origin" })); // Allow images from other domains if necessary
app.use(morgan('common')); // Logging
app.use(cors({
  origin: "*",
  methods: ["GET", "POST"]
}));

// DB config
const connection_url = process.env.MONGO_URI || 'mongodb://localhost:27017/whatsappdb';

mongoose.connect(connection_url)
  .then(() => console.log('MongoDB Connected'))
  .catch((err) => console.log('MongoDB Connection Error: ', err));

// Real-time socket connection
const onlineUsers = new Map();

io.on('connection', (socket) => {
  console.log('A user connected:', socket.id);

  socket.on('user_connected', (userId) => {
    onlineUsers.set(userId, socket.id);
    io.emit('online_users', Array.from(onlineUsers.keys()));
  });

  // WebRTC Calling Signaling
  socket.on('call_user', (data) => {
    const socketIdToCall = onlineUsers.get(data.userToCall);
    if (socketIdToCall) {
      io.to(socketIdToCall).emit('incoming_call', { offer: data.offer, from: data.from, name: data.name, callType: data.callType });
    }
  });

  socket.on('answer_call', (data) => {
    const socketId = onlineUsers.get(data.to);
    if (socketId) {
      io.to(socketId).emit('call_accepted', data.answer);
    }
  });

  socket.on('ice_candidate', (data) => {
    const socketId = onlineUsers.get(data.to);
    if (socketId) {
      io.to(socketId).emit('ice_candidate', { candidate: data.candidate, from: data.from });
    }
  });

  socket.on('end_call', (data) => {
    const socketId = onlineUsers.get(data.to);
    if (socketId) {
      io.to(socketId).emit('call_ended');
    }
  });

  socket.on('start_group_call', async (data) => {
    const { groupId, callerName, callType } = data;
    try {
      const room = await Rooms.findById(groupId);
      if (room && room.isGroup) {
        room.participants.forEach(participantId => {
          const pId = participantId.toString();
          if (pId !== socket.id) { // Not to self, wait we don't have user id here easily except from onlineUsers
             const socketId = onlineUsers.get(pId);
             if (socketId) {
               io.to(socketId).emit('incoming_group_call', { groupId, callerName, callType, groupName: room.name });
             }
          }
        });
      }
    } catch(err) {
      console.error(err);
    }
  });

  const removeUser = () => {
    for (let [userId, socketId] of onlineUsers.entries()) {
      if (socketId === socket.id) {
        onlineUsers.delete(userId);
        io.emit('online_users', Array.from(onlineUsers.keys()));
        break;
      }
    }
  };

  socket.on('user_disconnected', () => {
    removeUser();
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
    removeUser();
  });
});

// API routes
app.get('/api/users', async (req, res) => {
  try {
    const users = await User.find({}, '-password'); // exclude password
    res.status(200).send(users);
  } catch (err) {
    res.status(500).send({ error: err.message });
  }
});

app.post('/api/users/profilePic', async (req, res) => {
  try {
    const { userId, profilePic } = req.body;
    await User.findByIdAndUpdate(userId, { profilePic });
    
    const updatedUser = await User.findById(userId, '-password');
    io.emit('user_updated', updatedUser);
    
    res.status(200).send({ success: true, profilePic });
  } catch (err) {
    res.status(500).send({ error: err.message });
  }
});

app.get('/api/rooms', async (req, res) => {
  try {
    const data = await Rooms.find({});
    res.status(200).send(data);
  } catch (err) {
    res.status(500).send({ error: err.message });
  }
});

app.post('/api/rooms/new', async (req, res) => {
  const dbRoom = req.body;
  try {
    const data = await Rooms.create(dbRoom);
    io.emit('inserted_room', data.toJSON());
    res.status(201).send(data);
  } catch (err) {
    res.status(500).send({ error: err.message });
  }
});

app.post('/api/groups/new', async (req, res) => {
  const { name, participants, admin } = req.body;
  try {
    const data = await Rooms.create({
      name,
      isGroup: true,
      participants,
      admin
    });
    io.emit('inserted_room', data.toJSON());
    res.status(201).send(data);
  } catch (err) {
    res.status(500).send({ error: err.message });
  }
});

app.get('/api/rooms/:roomId', async (req, res) => {
  try {
    const data = await Rooms.findById(req.params.roomId);
    res.status(200).send(data);
  } catch (err) {
    res.status(500).send({ error: err.message });
  }
});

app.get('/api/messages/:roomId', async (req, res) => {
  try {
    const data = await Messages.find({ roomId: req.params.roomId });
    res.status(200).send(data);
  } catch (err) {
    res.status(500).send({ error: err.message });
  }
});

app.post('/api/messages/new', async (req, res) => {
  const dbMessage = req.body;
  try {
    const data = await Messages.create(dbMessage);
    io.emit('inserted_message', data.toJSON());
    res.status(201).send(data);
  } catch (err) {
    res.status(500).send({ error: err.message });
  }
});

app.post('/api/messages/seen', async (req, res) => {
  const { roomId, username } = req.body;
  try {
    await Messages.updateMany(
      { roomId: roomId, name: { $ne: username }, seen: false },
      { $set: { seen: true } }
    );
    io.emit('messages_seen', { roomId });
    res.status(200).send({ success: true });
  } catch (err) {
    res.status(500).send({ error: err.message });
  }
});

app.get('/api/messages/unread-counts/:username', async (req, res) => {
  const { username } = req.params;
  try {
    const counts = await Messages.aggregate([
      { $match: { name: { $ne: username }, seen: false } },
      { $group: { _id: "$roomId", count: { $sum: 1 } } }
    ]);
    
    const countMap = {};
    counts.forEach(item => {
      countMap[item._id] = item.count;
    });
    
    res.status(200).send(countMap);
  } catch (err) {
    res.status(500).send({ error: err.message });
  }
});

app.post('/api/users/update', async (req, res) => {
  try {
    const { userId, name, email, password, phone, description } = req.body;
    let updateFields = { name, email, phone, description };
    
    if (password && password.trim().length > 0) {
      const salt = await bcrypt.genSalt(10);
      updateFields.password = await bcrypt.hash(password, salt);
    }
    
    await User.findByIdAndUpdate(userId, updateFields);
    
    const updatedUser = await User.findById(userId, '-password');
    io.emit('user_updated', updatedUser);
    
    res.status(200).send({ success: true, user: updatedUser });
  } catch (err) {
    res.status(500).send({ error: err.message });
  }
});

// Auth Routes
const JWT_SECRET = process.env.JWT_SECRET || 'supersecretkey123';

app.post('/api/auth/register', async (req, res) => {
  try {
    const { name, email, password, phone, profilePic } = req.body;
    
    const existingUser = await User.findOne({ email });
    if (existingUser) return res.status(400).json({ error: "User already exists" });

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const newUser = await User.create({
      name, email, password: hashedPassword, phone, profilePic
    });

    const userObj = {
      _id: newUser._id,
      name: newUser.name,
      email: newUser.email,
      phone: newUser.phone,
      profilePic: newUser.profilePic,
      description: newUser.description
    };

    io.emit('new_user', userObj);

    const token = jwt.sign({ id: newUser._id }, JWT_SECRET, { expiresIn: '7d' });

    res.status(201).json({
      token,
      user: userObj
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ error: "Invalid credentials" });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ error: "Invalid credentials" });

    const token = jwt.sign({ id: user._id }, JWT_SECRET, { expiresIn: '7d' });

    res.status(200).json({
      token,
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        profilePic: user.profilePic,
        description: user.description
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/', (req, res) => res.status(200).send('WhatsApp Clone API'));

// Listen
httpServer.listen(port, () => console.log(`Listening on port ${port}`));
