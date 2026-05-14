import mongoose from 'mongoose';

const roomSchema = mongoose.Schema({
  name: String,
  isGroup: { type: Boolean, default: false },
  participants: [{ type: mongoose.Schema.Types.ObjectId, ref: 'users' }],
  admin: { type: mongoose.Schema.Types.ObjectId, ref: 'users' }
}, { timestamps: true });

export default mongoose.model('rooms', roomSchema);
