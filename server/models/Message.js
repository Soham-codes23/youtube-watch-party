const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema(
  {
    room: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Room',
      required: true,
      index: true,
    },
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    senderUsername: {
      type: String,
      required: true,
    },
    content: {
      type: String,
      required: [true, 'Message content is required'],
      maxlength: [500, 'Message cannot exceed 500 characters'],
      trim: true,
    },
    type: {
      type: String,
      enum: ['chat', 'system'],
      default: 'chat',
    },
  },
  { timestamps: true }
);

// Compound index for fetching messages by room in chronological order
messageSchema.index({ room: 1, createdAt: 1 });

module.exports = mongoose.model('Message', messageSchema);
