import mongoose from 'mongoose';

const reelSchema = mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'users', required: true },
  videoUrl:  { type: String, required: true },  // Base64 or URL
  caption:   { type: String, default: '' },
  audioName: { type: String, default: 'Original Audio' },
  likes: [{ type: mongoose.Schema.Types.ObjectId, ref: 'users' }],
  comments: [{
    userId:    { type: mongoose.Schema.Types.ObjectId, ref: 'users' },
    text:      { type: String, required: true },
    createdAt: { type: Date, default: Date.now }
  }],
  shares: { type: Number, default: 0 },
  views:  { type: Number, default: 0 }
}, { timestamps: true });

export default mongoose.model('Reel', reelSchema);
