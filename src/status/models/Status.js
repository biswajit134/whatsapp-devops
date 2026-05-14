import mongoose from 'mongoose';

const statusSchema = mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'users', required: true },
  type: { type: String, enum: ['text', 'image', 'video', 'audio'], required: true },
  content: { type: String },
  mediaUrl: { type: String },
  backgroundColor: { type: String, default: '#000000' },
  // ── Views ──────────────────────────────────────────────────
  views: [
    {
      userId:    { type: mongoose.Schema.Types.ObjectId, ref: 'users' },
      viewedAt:  { type: Date, default: Date.now },
    }
  ],
  createdAt: { type: Date, default: Date.now, expires: 86400 } // 24 h TTL
});

export default mongoose.model('Status', statusSchema);
