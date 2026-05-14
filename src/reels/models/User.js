import mongoose from 'mongoose';

// Lightweight user schema just for populate() references
const userSchema = mongoose.Schema({
  name:       { type: String, required: true },
  email:      { type: String, required: true, unique: true },
  profilePic: { type: String, default: '' }
}, { timestamps: true });

export default mongoose.model('users', userSchema);
