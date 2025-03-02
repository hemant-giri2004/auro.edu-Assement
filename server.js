const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// MongoDB Schema
const pollSchema = new mongoose.Schema({
    question: {
        type: String,
        required: true
    },
    options: [{
        text: String,
        votes: {
            type: Number,
            default: 0
        }
    }],
    totalVotes: {
        type: Number,
        default: 0
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

const Poll = mongoose.model('Poll', pollSchema);

// Routes
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Get all polls
app.get('/api/polls', async (req, res) => {
    try {
        const polls = await Poll.find().sort({ createdAt: -1 });
        res.json(polls);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Create new poll
app.post('/api/polls', async (req, res) => {
    try {
        const { question, options } = req.body;
        
        // Validation
        if (!question || !options || options.length < 2) {
            return res.status(400).json({ 
                message: 'Question and at least 2 options are required' 
            });
        }

        const poll = new Poll({
            question,
            options: options.map(opt => ({ text: opt, votes: 0 })),
            totalVotes: 0
        });

        const newPoll = await poll.save();
        res.status(201).json(newPoll);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
});

// Submit vote
app.post('/api/polls/:id/vote', async (req, res) => {
    try {
        const { id } = req.params;
        const { optionIndex } = req.body;

        const poll = await Poll.findById(id);
        if (!poll) {
            return res.status(404).json({ message: 'Poll not found' });
        }

        if (optionIndex < 0 || optionIndex >= poll.options.length) {
            return res.status(400).json({ message: 'Invalid option index' });
        }

        // Update vote count
        poll.options[optionIndex].votes += 1;
        poll.totalVotes += 1;
        
        const updatedPoll = await poll.save();
        res.json(updatedPoll);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
});

// Delete poll
app.delete('/api/polls/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const poll = await Poll.findByIdAndDelete(id);
        
        if (!poll) {
            return res.status(404).json({ message: 'Poll not found' });
        }
        
        res.json({ message: 'Poll deleted successfully' });
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
});

// MongoDB Connection
mongoose.connect(process.env.MONGODB_URI)
    .then(() => console.log('Connected to MongoDB'))
    .catch(err => console.error('MongoDB connection error:', err));

// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ 
        message: 'Something went wrong!',
        error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});