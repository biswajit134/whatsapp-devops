import mongoose from 'mongoose';

const postSchema = mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'users', required: true },
  content: { type: String },
  mediaUrl: { type: String },
  mediaType: { type: String, enum: ['image', 'video', 'none'], default: 'none' },
  likes: [{ type: mongoose.Schema.Types.ObjectId, ref: 'users' }],
  reactions: [{
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'users' },
    emoji: { type: String } // e.g. '❤️', '😂', '😮', '😢', '👍'
  }],
  comments: [{
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'users' },
    text: { type: String, required: true },
    createdAt: { type: Date, default: Date.now }
  }],
  shares: { type: Number, default: 0 }
}, { timestamps: true });

export default mongoose.model('Post', postSchema);
