// backend/src/models/Event.js
const mongoose = require('mongoose');

const eventSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: { type: String },
  category: { 
    type: String, 
    required: true,
    enum: [
      'politics',
      'entertainment', 
      'sports',
      'business',
      'social-media',
      'reality-tv',
      'awards',
      'other'
    ]
  },
  startTime: { type: Date, required: true },
  endTime: { type: Date, required: true },
  status: { 
    type: String, 
    enum: ['active', 'suspended', 'completed', 'cancelled'],
    default: 'active'
  },
  result: { type: String }, // Winning option ID
  totalStaked: { type: Number, default: 0 },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  // Dynamic odds calculation
  oddsMargin: { type: Number, default: 0.05 } // 5% house edge
}, { timestamps: true });

export default mongoose.model(Event, eventSchema);
