const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const cors = require('cors');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));
// Add this near the top of your server.js
app.use(express.static(path.join(__dirname, 'public')));
// Database setup
const db = new sqlite3.Database('polls.db');

// Create tables
db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS polls (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        question TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);
    
    db.run(`CREATE TABLE IF NOT EXISTS options (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        poll_id INTEGER,
        text TEXT NOT NULL,
        votes INTEGER DEFAULT 0,
        FOREIGN KEY(poll_id) REFERENCES polls(id)
    )`);
});

// Routes
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});
// Add this route to your server.js
app.post('/api/reset', (req, res) => {
    db.run(`DELETE FROM options`, [], (err) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        db.run(`DELETE FROM polls`, [], (err) => {
            if (err) {
                res.status(500).json({ error: err.message });
                return;
            }
            // Reset the auto-increment
            db.run(`DELETE FROM sqlite_sequence WHERE name IN ('polls', 'options')`, [], (err) => {
                if (err) {
                    res.status(500).json({ error: err.message });
                    return;
                }
                res.json({ message: 'Database reset successfully' });
            });
        });
    });
});

// Get all polls
app.get('/api/polls', (req, res) => {
    db.all(`
        SELECT 
            p.id, 
            p.question, 
            p.created_at,
            json_group_array(
                json_object(
                    'id', o.id,
                    'text', o.text,
                    'votes', o.votes
                )
            ) as options
        FROM polls p
        LEFT JOIN options o ON p.id = o.poll_id
        GROUP BY p.id
        ORDER BY p.created_at DESC
    `, (err, rows) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        // Parse the JSON string in options
        rows.forEach(row => {
            row.options = JSON.parse(row.options);
        });
        res.json(rows);
    });
});

// Create new poll
app.post('/api/polls', (req, res) => {
    const { question, options } = req.body;
    
    if (!question || !options || options.length < 2) {
        return res.status(400).json({ 
            error: 'Question and at least 2 options are required' 
        });
    }

    db.run(`INSERT INTO polls (question) VALUES (?)`, [question], function(err) {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        
        const pollId = this.lastID;
        const optionValues = options.map(opt => `(${pollId}, ?, 0)`).join(',');
        const optionParams = options.map(opt => opt.toString());
        
        db.run(
            `INSERT INTO options (poll_id, text, votes) VALUES ${optionValues}`,
            optionParams,
            (err) => {
                if (err) {
                    res.status(500).json({ error: err.message });
                    return;
                }
                res.status(201).json({ 
                    id: pollId, 
                    question, 
                    options: options.map(text => ({ text, votes: 0 }))
                });
            }
        );
    });
});

// Submit vote
app.post('/api/polls/:pollId/vote', (req, res) => {
    const { pollId } = req.params;
    const { optionId } = req.body;
    
    db.run(
        `UPDATE options SET votes = votes + 1 
         WHERE id = ? AND poll_id = ?`,
        [optionId, pollId],
        function(err) {
            if (err) {
                res.status(500).json({ error: err.message });
                return;
            }
            if (this.changes === 0) {
                res.status(404).json({ error: 'Option not found' });
                return;
            }
            
            // Get updated poll data
            db.get(
                `SELECT 
                    p.id, 
                    p.question,
                    json_group_array(
                        json_object(
                            'id', o.id,
                            'text', o.text,
                            'votes', o.votes
                        )
                    ) as options
                FROM polls p
                LEFT JOIN options o ON p.id = o.poll_id
                WHERE p.id = ?
                GROUP BY p.id`,
                [pollId],
                (err, row) => {
                    if (err) {
                        res.status(500).json({ error: err.message });
                        return;
                    }
                    row.options = JSON.parse(row.options);
                    res.json(row);
                }
            );
        }
    );
});

// Delete poll
app.delete('/api/polls/:id', (req, res) => {
    const { id } = req.params;
    
    db.run(`DELETE FROM options WHERE poll_id = ?`, [id], (err) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        
        db.run(`DELETE FROM polls WHERE id = ?`, [id], function(err) {
            if (err) {
                res.status(500).json({ error: err.message });
                return;
            }
            if (this.changes === 0) {
                res.status(404).json({ error: 'Poll not found' });
                return;
            }
            res.json({ message: 'Poll deleted successfully' });
        });
    });
});

// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});