import mongoose from 'mongoose';

const whatsappSchema = mongoose.Schema({
  message: String,
  name: String,
  timestamp: String,
  received: Boolean,
  seen: { type: Boolean, default: false },
  roomId: String,
  messageType: { type: String, default: 'text' }
});

export default mongoose.model('messagecontents', whatsappSchema);
