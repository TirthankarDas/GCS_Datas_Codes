const express = require('express');
const mongoose = require('mongoose');
const multer = require('multer');
const Stripe = require('stripe');
const cors = require('cors');
const morgan = require('morgan');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Initialize Stripe (Replace with your actual Stripe Secret Key later)
const stripe = Stripe('sk_test_YOUR_STRIPE_KEY');

// Middleware
app.use(cors());
app.use(express.json());
app.use(morgan('combined')); // Logging

// Serve static files from the public directory
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// --- DATABASE MODELS (MongoDB) ---
// Note: You need MongoDB installed locally or a MongoDB Atlas URI
mongoose.connect('mongodb://127.0.0.1:27017/smart_supply_chains')
    .then(() => console.log('Connected to MongoDB'))
    .catch(err => console.error('Database connection error:', err));

const shipmentSchema = new mongoose.Schema({
    trackingNumber: String,
    originAirport: String,
    destinationAirport: String,
    status: { type: String, default: 'Pending' },
    weight: Number,
    imageUrl: String,
    paymentStatus: { type: String, default: 'Unpaid' },
    createdAt: { type: Date, default: Date.now }
});
const Shipment = mongoose.model('Shipment', shipmentSchema);

// --- IMAGE UPLOAD HANDLING ---
const storage = multer.diskStorage({
    destination: './uploads/',
    filename: (req, file, cb) => {
        cb(null, `shipment-${Date.now()}${path.extname(file.originalname)}`);
    }
});
const upload = multer({ storage: storage });

// --- API ROUTES ---

// Create a new shipment
app.post('/api/shipments', async (req, res) => {
    try {
        const shipment = new Shipment(req.body);
        await shipment.save();
        res.status(201).json({ message: 'Shipment created successfully', shipment });
    } catch (error) {
        res.status(500).json({ error: 'Failed to create shipment' });
    }
});

// Upload an image for a specific shipment
app.post('/api/shipments/:id/image', upload.single('image'), async (req, res) => {
    try {
        const shipment = await Shipment.findByIdAndUpdate(
            req.params.id,
            { imageUrl: `/uploads/${req.file.filename}` },
            { new: true }
        );
        res.json({ message: 'Image uploaded', shipment });
    } catch (error) {
        res.status(500).json({ error: 'Failed to upload image' });
    }
});

// Shipment Analytics (Simple aggregation)
app.get('/api/analytics', async (req, res) => {
    try {
        const totalShipments = await Shipment.countDocuments();
        const pendingShipments = await Shipment.countDocuments({ status: 'Pending' });
        res.json({ totalShipments, pendingShipments });
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch analytics' });
    }
});

// Get all shipments (for tracking)
app.get('/api/shipments', async (req, res) => {
    try {
        const shipments = await Shipment.find().sort({ createdAt: -1 });
        res.json(shipments);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch shipments' });
    }
});

// Process Payments (Stripe Checkout Session)
app.post('/api/create-checkout-session', async (req, res) => {
    try {
        const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            line_items: [{
                price_data: {
                    currency: 'usd',
                    product_data: { name: 'Shipment Processing Fee' },
                    unit_amount: 5000, // $50.00
                },
                quantity: 1,
            }],
            mode: 'payment',
            success_url: `http://${req.get('host')}/dashboard.html`,
            cancel_url: `http://${req.get('host')}/dashboard.html`,
        });
        res.json({ url: session.url });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});


// --- HTML ROUTES ---
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
app.get('/dashboard', (req, res) => res.sendFile(path.join(__dirname, 'public', 'dashboard.html')));
app.get('/analytics', (req, res) => res.sendFile(path.join(__dirname, 'public', 'analytics.html')));
app.get('/tracking', (req, res) => res.sendFile(path.join(__dirname, 'public', 'tracking.html')));
app.get('/network', (req, res) => res.sendFile(path.join(__dirname, 'public', 'network.html')));
app.get('/logistics', (req, res) => res.sendFile(path.join(__dirname, 'public', 'network.html')));
app.get('/admin', (req, res) => res.sendFile(path.join(__dirname, 'public', 'admin.html')));

// Start the server
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server is running on http://0.0.0.0:${PORT}`);
});
