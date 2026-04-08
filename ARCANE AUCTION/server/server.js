// ================================================
// ARCANE AUCTION — Backend Server
// Express + Socket.IO + Mongoose
// ================================================

require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const Auction = require('./models/Auction');

// --- App Setup ---
const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST', 'PUT'] }
});

// --- Middleware ---
app.use(cors());
app.use(express.json());

// Serve the client folder as static files
app.use(express.static(path.join(__dirname, '..', 'client')));

// --- MongoDB Connection ---
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('✅ Connected to MongoDB'))
  .catch(err => console.error('❌ MongoDB connection error:', err));

// ================================================
// REST API ROUTES
// ================================================

// GET /api/auctions — List all auctions (newest first)
app.get('/api/auctions', async (req, res) => {
  try {
    const auctions = await Auction.find().sort({ createdAt: -1 });
    res.json(auctions);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch auctions' });
  }
});

// POST /api/auction — Create a new auction
app.post('/api/auction', async (req, res) => {
  try {
    const { title, host, imageUrl, currentBid, endTime } = req.body;

    const auction = new Auction({
      title,
      host,
      imageUrl: imageUrl || '',
      currentBid: currentBid || 0,
      status: 'live',
      endTime: new Date(endTime)
    });

    await auction.save();

    // Broadcast the new auction to all connected clients
    io.emit('newAuction', auction);

    res.status(201).json(auction);
  } catch (err) {
    res.status(400).json({ error: 'Failed to create auction', details: err.message });
  }
});

// POST /api/bid — Place a bid on an auction
app.post('/api/bid', async (req, res) => {
  try {
    const { auctionId, bidder, amount } = req.body;

    const auction = await Auction.findById(auctionId);
    if (!auction) return res.status(404).json({ error: 'Auction not found' });
    if (auction.status === 'ended') return res.status(400).json({ error: 'Auction has ended' });
    if (amount <= auction.currentBid) {
      return res.status(400).json({ error: `Bid must be higher than current bid of ${auction.currentBid}` });
    }

    // Update auction with new bid
    auction.currentBid = amount;
    auction.highestBidder = bidder;
    await auction.save();

    // Broadcast the bid update to all connected clients
    io.emit('bidUpdate', {
      auctionId: auction._id,
      currentBid: auction.currentBid,
      highestBidder: auction.highestBidder
    });

    res.json({ success: true, auction });
  } catch (err) {
    res.status(500).json({ error: 'Failed to place bid', details: err.message });
  }
});

// PUT /api/auction/:id/end — End an auction (host control)
app.put('/api/auction/:id/end', async (req, res) => {
  try {
    const { host } = req.body;
    const auction = await Auction.findById(req.params.id);

    if (!auction) return res.status(404).json({ error: 'Auction not found' });
    if (auction.host !== host) return res.status(403).json({ error: 'Only the host can end this auction' });
    if (auction.status === 'ended') return res.status(400).json({ error: 'Auction already ended' });

    auction.status = 'ended';
    await auction.save();

    // Broadcast auction ended to all clients
    io.emit('auctionEnded', {
      auctionId: auction._id,
      winner: auction.highestBidder,
      finalBid: auction.currentBid
    });

    res.json({ success: true, auction });
  } catch (err) {
    res.status(500).json({ error: 'Failed to end auction', details: err.message });
  }
});

// Fallback — serve index.html for any unmatched route
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'client', 'index.html'));
});

// ================================================
// SOCKET.IO — Realtime Events
// ================================================

io.on('connection', (socket) => {
  console.log(`🔌 User connected: ${socket.id}`);

  // Client can also place bids via socket (alternative to REST)
  socket.on('placeBid', async (data) => {
    try {
      const { auctionId, bidder, amount } = data;
      const auction = await Auction.findById(auctionId);

      if (!auction || auction.status === 'ended') {
        socket.emit('bidError', { error: 'Auction not available' });
        return;
      }
      if (amount <= auction.currentBid) {
        socket.emit('bidError', { error: `Bid must be higher than ${auction.currentBid}` });
        return;
      }

      auction.currentBid = amount;
      auction.highestBidder = bidder;
      await auction.save();

      // Broadcast to ALL clients including sender
      io.emit('bidUpdate', {
        auctionId: auction._id,
        currentBid: auction.currentBid,
        highestBidder: auction.highestBidder
      });
    } catch (err) {
      socket.emit('bidError', { error: 'Failed to place bid' });
    }
  });

  socket.on('disconnect', () => {
    console.log(`🔌 User disconnected: ${socket.id}`);
  });
});

// ================================================
// START SERVER
// ================================================

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`🚀 Arcane Auction server running on http://localhost:${PORT}`);
});
