const express = require('express');
const app = express();
const bodyParser = require('body-parser');
const bcrypt = require('bcryptjs');
const path = require('path');
require('dotenv').config();
const session = require('express-session');
const pgSession = require('connect-pg-simple')(session);
// Use db.js for the pool
const pool = require('./db');
const multer = require('multer');
const http = require('http').createServer(app);
const io = require('socket.io')(http);

const port = process.env.PORT || 3000;
const url = process.env.DIRECTUS_URL;
const token = process.env.TOKEN;
const { fetch } = require('fetch-ponyfill')();

let onlineUsers = new Map();

io.on('connection', (socket) => {
    socket.on('user_online', (userId) => {
        onlineUsers.set(userId, socket.id);
        io.emit('update_online', Array.from(onlineUsers.keys()));
    });

    socket.on('send_message', async (data) => {
        // Save message to DB
        await pool.query(
            'INSERT INTO chat_messages (sender_id, receiver_id, message, is_read) VALUES ($1, $2, $3, $4)',
            [data.sender_id, data.receiver_id, data.message, false]
        );
        // Emit to receiver if online
        const receiverSocketId = onlineUsers.get(String(data.receiver_id));
        if (receiverSocketId) {
            io.to(receiverSocketId).emit('receive_message', data);
            io.to(receiverSocketId).emit('update_badge', { type: 'chats', value: true });
        }
    });

    socket.on('read_messages', async ({ fromUserId, toUserId }) => {
        // Mark as read in DB
        await pool.query(
            'UPDATE chat_messages SET is_read = TRUE, read_at = NOW() WHERE sender_id = $1 AND receiver_id = $2 AND is_read = FALSE',
            [fromUserId, toUserId]
        );
        // Notify sender if online
        const senderSocketId = onlineUsers.get(String(fromUserId));
        if (senderSocketId) {
            io.to(senderSocketId).emit('messages_read', { by: toUserId });
        }
    });

    socket.on('disconnect', () => {
        for (let [userId, id] of onlineUsers.entries()) {
            if (id === socket.id) {
                onlineUsers.delete(userId);
                break;
            }
        }
        io.emit('update_online', Array.from(onlineUsers.keys()));
    });
});

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

app.use(session({
    store: new pgSession({ pool: pool, tableName: 'session' }),
    secret: 'MPILHSALJD',
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 30 * 24 * 60 * 60 * 1000 },
}));

// Set up multer storage for profile pictures
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, path.join(__dirname, 'public', 'uploads'));
    },
    filename: function (req, file, cb) {
        const ext = path.extname(file.originalname);
        cb(null, 'profile_' + req.session.user.id + '_' + Date.now() + ext);
    }
});
const upload = multer({ storage });

// Serve uploaded files statically
app.use('/uploads', express.static(path.join(__dirname, 'public', 'uploads')));

// Helper for Directus API
async function query(path, config) {
    const res = await fetch(encodeURI(`${url}${path}`), {
        headers: {
            "Authorization": `Bearer ${token}`,
            "Content-Type": "application/json",
        },
        ...config
    });
    return res;
}

// Middleware to check if the user has an active session
const checkSession = async (req, res, next) => {
    if (req.session.user) {
        // Update last_active timestamp
        try {
            await pool.query('UPDATE users SET last_active = NOW() WHERE id = $1', [req.session.user.id]);
        } catch (e) { /* ignore errors here */ }
        next();
    } else {
        res.redirect('/login');
    }
};

// Render signup page
app.get('/signup', (req, res) => {
    res.render('signup');
});

// Render signin page
app.get('/signin', (req, res) => {
    res.render('signin');
});

//Render aboutus page
app.get('/aboutus', (req, res) => {
    res.render('aboutus');
});

// Services page: show all users with role janitor, carpenter, electrician, or plumber
app.get('/services', async (req, res) => {
    try {
        const roles = ['janitor', 'carpenter', 'electrician', 'plumber'];
        // Fetch all service providers
        const result = await pool.query(
            'SELECT * FROM users WHERE role = ANY($1)',
            [roles]
        );
        const users = result.rows;
        // For each user, fetch their latest review and average rating
        for (let user of users) {
            // Average rating
            const avgRes = await pool.query(
                'SELECT AVG(rating) as avg_rating FROM ratings_reviews WHERE user_id = $1',
                [user.id]
            );
            user.rating = avgRes.rows[0].avg_rating ? parseFloat(avgRes.rows[0].avg_rating).toFixed(1) : null;
            // Latest review
            const reviewRes = await pool.query(
                'SELECT review, rating, created_at FROM ratings_reviews WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1',
                [user.id]
            );
            if (reviewRes.rows.length > 0) {
                user.latest_review = reviewRes.rows[0].review;
                user.latest_review_rating = reviewRes.rows[0].rating;
                user.latest_review_date = reviewRes.rows[0].created_at;
            } else {
                user.latest_review = null;
                user.latest_review_rating = null;
                user.latest_review_date = null;
            }
        }
        res.render('services', { users, user: req.session.user, user_logged_in: req.session.user });
    } catch (error) {
        console.error('Error fetching service providers:', error);
        res.status(500).send('Failed to load services page.');
    }
});

// GET /servicerequest
app.get('/servicerequest', checkSession, async (req, res) => {
    const professional_id = req.query.professional_id || '';
    let selected_role = '';
    if (professional_id) {
        const profRes = await pool.query('SELECT role FROM users WHERE id = $1', [professional_id]);
        if (profRes.rows.length > 0) {
            selected_role = profRes.rows[0].role;
        }
    }
    res.render('servicerequest', { user: req.session.user, selected_role, professional_id });
});

// POST /servicerequest
app.post('/servicerequest', checkSession, async (req, res) => {
    try {
        const { username, email, residential_area, professional_required, job_description, service_time, professional_id } = req.body;
        // Insert into service_requests table (now includes professional_id)
        await pool.query(
            'INSERT INTO service_requests (user_id, username, email, residential_area, professional_required, job_description, service_time, professional_id) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)',
            [req.session.user.id, username, email, residential_area, professional_required, job_description, service_time, professional_id]
        );
        // Emit notification to the professional if online
        const receiverSocketId = onlineUsers.get(String(professional_id));
        if (receiverSocketId) {
            io.to(receiverSocketId).emit('service_request_notification', {
                from: username,
                email,
                residential_area,
                professional_required,
                job_description,
                service_time
            });
            io.to(receiverSocketId).emit('update_badge', { type: 'notifications', value: true });
        }
        res.json({ success: true });
    } catch (error) {
        console.error('Service request error:', error);
        res.json({ success: false, error: error.message });
    }
});

// SIGNUP route
app.post('/signup', async (req, res) => {
    try {
        const { username, email, password, role } = req.body;
        if (!username || !email || !password || !role) {
            return res.status(400).json({ error: 'All fields are required' });
        }
        // Check if user exists in your Postgres DB
        const userCheck = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
        if (userCheck.rows.length > 0) {
            return res.status(400).json({ error: 'Email already registered' });
        }
        // Hash the password
        const hashedPassword = await bcrypt.hash(password, 10);
        // Insert into your users table, set residential_area to null
        await pool.query(
            'INSERT INTO users (username, email, password, role, residential_area) VALUES ($1, $2, $3, $4, $5)',
            [username, email, hashedPassword, role, null]
        );
        res.redirect('/signin');
    } catch (error) {
        console.error('Signup error:', error);
        res.status(500).json({ error: 'Error creating account', details: error.message });
    }
});

// SIGNIN route
app.post('/signin', async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password are required' });
        }
        // Authenticate user from your Postgres DB
        const userRes = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
        const user = userRes.rows[0];
        if (!user) {
            return res.status(401).json({ error: 'User not found' });
        }
        // Compare password
        const valid = await bcrypt.compare(password, user.password);
        if (!valid) {
            return res.status(401).json({ error: 'Invalid password' });
        }
        req.session.user = user;
        res.redirect('/dashboard');
    } catch (error) {
        console.error('Signin error:', error);
        res.status(401).json({ error: 'Authentication failed', details: error.message });
    }
});

// GET /profile
app.get('/profile', checkSession, async (req, res) => {
    const badges = await getDrawerBadges(req.session.user.id);
    try {
        const userId = req.session.user.id;
        const userRes = await pool.query('SELECT * FROM users WHERE id = $1', [userId]);
        const user = userRes.rows[0];
        res.render('profile', { user: req.session.user, ...badges });
    } catch (error) {
        console.error('Profile fetch error:', error);
        res.status(500).send('Failed to load profile.');
    }
});

// POST /profile
app.post('/profile', checkSession, upload.single('profile_picture'), async (req, res) => {
    try {
        const userId = req.session.user.id;
        const { username, email, password, residential_area } = req.body;
        let queryStr = 'UPDATE users SET username = $1, email = $2, residential_area = $3';
        let updateValues = [username, email, residential_area];
        let paramIdx = 4;
        if (password && password.trim() !== '') {
            const hashedPassword = await bcrypt.hash(password, 10);
            queryStr += `, password = $${paramIdx}`;
            updateValues.push(hashedPassword);
            paramIdx++;
        }
        // Handle profile picture upload
        if (req.file) {
            const profilePicPath = '/uploads/' + req.file.filename;
            queryStr += `, profile_picture = $${paramIdx}`;
            updateValues.push(profilePicPath);
            paramIdx++;
        }
        queryStr += ` WHERE id = $${paramIdx} RETURNING *`;
        updateValues.push(userId);
        const updatedRes = await pool.query(queryStr, updateValues);
        req.session.user = updatedRes.rows[0];
        res.json({ success: true });
    } catch (error) {
        console.error('Profile update error:', error);
        res.json({ success: false, error: error.message });
    }
});

// Helper to get unread notification/chat counts for the drawer
async function getDrawerBadges(userId) {
    // Unread notifications: service requests for this user as professional, not marked as read
    const notifRes = await pool.query(
        'SELECT COUNT(*) FROM service_requests WHERE professional_id = $1 AND (is_read IS NULL OR is_read = FALSE)',
        [userId]
    );
    // Unread chats: chat_messages sent to this user, not marked as read
    const chatRes = await pool.query(
        'SELECT COUNT(*) FROM chat_messages WHERE receiver_id = $1 AND is_read = FALSE',
        [userId]
    );
    return {
        hasUnreadNotifications: Number(notifRes.rows[0].count) > 0,
        hasUnreadChats: Number(chatRes.rows[0].count) > 0
    };
}

// Dashboard route (protected)
app.get('/dashboard', checkSession, async (req, res) => {
    const badges = await getDrawerBadges(req.session.user.id);
    res.render('dashboard', { user: req.session.user, ...badges });
});

// Logout route
app.get('/logout', (req, res) => {
    req.session.destroy(() => {
        res.redirect('/signin');
    });
});

// Serve index page at root
app.get('/', (req, res) => {
    res.render('index');
});

// GET /ratings
app.get('/ratings', checkSession, async (req, res) => {
    try {
        const ratedUserId = req.query.user_id;
        let rated_user = null;
        if (ratedUserId) {
            const userRes = await pool.query('SELECT * FROM users WHERE id = $1', [ratedUserId]);
            rated_user = userRes.rows[0];
        }
        res.render('ratings', { rated_user, user: req.session.user });
    } catch (error) {
        console.error('Ratings page error:', error);
        res.status(500).send('Failed to load ratings page.');
    }
});

// POST /ratings
app.post('/ratings', checkSession, async (req, res) => {
    try {
        const reviewerid = req.session.user.id;
        const { rated_user_id, rating, review } = req.body;
        if (!rated_user_id || !rating || rating < 1 || rating > 5) {
            return res.json({ success: false, error: 'Invalid rating data' });
        }
        await pool.query(
            'INSERT INTO ratings_reviews (user_id, reviewer_id, rating, review) VALUES ($1, $2, $3, $4)',
            [rated_user_id, reviewerid, rating, review]
        );
        res.json({ success: true });
    } catch (error) {
        console.error('Rating submission error:', error);
        res.json({ success: false, error: error.message });
    }
});

// GET /chat (user list, no selected user)
app.get('/chat', checkSession, async (req, res) => {
    const badges = await getDrawerBadges(req.session.user.id);
    // Find users with whom the logged-in user has a service request (either as requester or provider)
    const serviceUsersRes = await pool.query(`
        SELECT DISTINCT
            CASE
                WHEN sr.user_id = $1 THEN u2.id
                ELSE sr.user_id
            END AS id,
            u2.username,
            u2.role
        FROM service_requests sr
        JOIN users u2 ON (u2.id = sr.user_id OR u2.id = sr.professional_id)
        WHERE (sr.user_id = $1 OR sr.professional_id = $1)
          AND u2.id != $1
    `, [req.session.user.id]);
    res.render('chat', { users: serviceUsersRes.rows, user: req.session.user, selectedUser: null, messages: [], restriction: null, ...badges });
});

// GET /chat/:userId (chat with selected user)
app.get('/chat/:userId', checkSession, async (req, res) => {
    const badges = await getDrawerBadges(req.session.user.id);
    // Check if there is a service request between the two users
    const srRes = await pool.query(
        `SELECT * FROM service_requests WHERE (user_id = $1 AND professional_id = $2) OR (user_id = $2 AND professional_id = $1)`,
        [req.session.user.id, req.params.userId]
    );
    let restriction = null;
    if (srRes.rows.length === 0) {
        restriction = 'You can only chat with users after a service request is made and accepted.';
    }
    // Only show users with whom the logged-in user has a service request
    const serviceUsersRes = await pool.query(`
        SELECT DISTINCT
            CASE
                WHEN sr.user_id = $1 THEN u2.id
                ELSE sr.user_id
            END AS id,
            u2.username,
            u2.role
        FROM service_requests sr
        JOIN users u2 ON (u2.id = sr.user_id OR u2.id = sr.professional_id)
        WHERE (sr.user_id = $1 OR sr.professional_id = $1)
          AND u2.id != $1
    `, [req.session.user.id]);
    // Only fetch messages if allowed
    let messages = [];
    let selectedUser = null;
    let selectedUserLastActive = null;
    if (!restriction) {
        // Mark all messages from selectedUser to current user as read
        await pool.query(
            'UPDATE chat_messages SET is_read = TRUE, read_at = NOW() WHERE sender_id = $1 AND receiver_id = $2 AND is_read = FALSE',
            [req.params.userId, req.session.user.id]
        );
        const selectedUserRes = await pool.query('SELECT id, username, role, profile_picture, last_active FROM users WHERE id = $1', [req.params.userId]);
        selectedUser = selectedUserRes.rows[0];
        selectedUserLastActive = selectedUser ? selectedUser.last_active : null;
        const messagesRes = await pool.query(
            `SELECT *, is_read, read_at FROM chat_messages
             WHERE (sender_id = $1 AND receiver_id = $2) OR (sender_id = $2 AND receiver_id = $1)
             ORDER BY created_at ASC`,
            [req.session.user.id, req.params.userId]
        );
        messages = messagesRes.rows;
        // Emit badge update to self
        const userSocketId = onlineUsers.get(String(req.session.user.id));
        if (userSocketId) {
            io.to(userSocketId).emit('update_badge', { type: 'chats', value: false });
        }
    }
    res.render('chat', {
        users: serviceUsersRes.rows,
        user: req.session.user,
        selectedUser,
        selectedUserLastActive,
        messages,
        restriction,
        ...badges
    });
});

// POST /chat (send message)
app.post('/chat', checkSession, async (req, res) => {
    const { receiver_id, message } = req.body;
    await pool.query(
        'INSERT INTO chat_messages (sender_id, receiver_id, message) VALUES ($1, $2, $3)',
        [req.session.user.id, receiver_id, message]
    );
    res.json({ success: true });
});

// GET /chat/:userId/messages (fetch messages for AJAX polling)
app.get('/chat/:userId/messages', checkSession, async (req, res) => {
    const messagesRes = await pool.query(
        `SELECT * FROM chat_messages
         WHERE (sender_id = $1 AND receiver_id = $2) OR (sender_id = $2 AND receiver_id = $1)
         ORDER BY created_at ASC`,
        [req.session.user.id, req.params.userId]
    );
    res.json({ messages: messagesRes.rows, user_id: req.session.user.id });
});

// Notifications page for service providers
app.get('/notifications', checkSession, async (req, res) => {
    try {
        const badges = await getDrawerBadges(req.session.user.id);
        const notificationsRes = await pool.query(
            'SELECT * FROM service_requests WHERE professional_id = $1 ORDER BY created_at DESC',
            [req.session.user.id]
        );
        // Mark all notifications as read
        await pool.query('UPDATE service_requests SET is_read = TRUE WHERE professional_id = $1 AND (is_read IS NULL OR is_read = FALSE)', [req.session.user.id]);
        // Emit badge update to self
        const userSocketId = onlineUsers.get(String(req.session.user.id));
        if (userSocketId) {
            io.to(userSocketId).emit('update_badge', { type: 'notifications', value: false });
        }
        res.render('notifications', { notifications: notificationsRes.rows, user: req.session.user, ...badges });
    } catch (error) {
        console.error('Notifications fetch error:', error);
        res.status(500).send('Failed to load notifications.');
    }
});

http.listen(port, () => {
    console.log(`Server running on http://localhost:${port}`);
});