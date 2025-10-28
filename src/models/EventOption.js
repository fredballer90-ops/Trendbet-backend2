// backend/src/models/EventOption.js
const mongoose = require('mongoose');

const eventOptionSchema = new mongoose.Schema({
  eventId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Event', 
    required: true 
  },
  name: { type: String, required: true },
  currentOdds: { type: Number, required: true },
  initialOdds: { type: Number, required: true },
  totalStaked: { type: Number, default: 0 },
  probability: { type: Number }, // Calculated probability
  status: { 
    type: String, 
    enum: ['active', 'suspended'],
    default: 'active'
  }
}, { timestamps: true });

export default mongoose.model(EventOption, eventOptionSchema);
