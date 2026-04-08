const mongoose = require('mongoose');

const auctionSchema = new mongoose.Schema({
  title:          { type: String, required: true },
  host:           { type: String, required: true },
  imageUrl:       { type: String, default: '' },
  currentBid:     { type: Number, default: 0 },
  highestBidder:  { type: String, default: '' },
  status:         { type: String, enum: ['live', 'upcoming', 'ended'], default: 'upcoming' },
  endTime:        { type: Date, required: true },
  createdAt:      { type: Date, default: Date.now }
});

module.exports = mongoose.model('Auction', auctionSchema);
