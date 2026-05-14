import mongoose from 'mongoose';

const userSchema = mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  phone: { type: String, required: true },
  profilePic: { type: String, default: '' },
  description: { type: String, default: 'Hey there! I am using WhatsApp.' }
}, { timestamps: true });

export default mongoose.model('users', userSchema);
