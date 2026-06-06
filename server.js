const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const path = require('path');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const session = require('express-session');
const cookieParser = require('cookie-parser');
const fs = require('fs');
const QRCode = require('qrcode');
const multer = require('multer');
require('dotenv').config();

// ============ FORCE SOUTH AFRICA TIMEZONE (SAST / UTC+2) ============
process.env.TZ = 'Africa/Johannesburg';

const app = express();
const PORT = process.env.PORT || 3000;

// ============ SUPABASE CLIENT ============
const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY
);

// ============ HELPER: GET SAST TIME ============
function getSASTTime() { return new Date(); }
function getSASTDateString() {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
}
function getSASTTimeString() {
    return new Date().toLocaleTimeString('en-ZA', { hour12: false, timeZone: 'Africa/Johannesburg' });
}
function getSASTISOString() { return new Date().toISOString(); }
function getSASTDateTimeForSQL() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}:${String(d.getSeconds()).padStart(2,'0')}`;
}

// ============ PASSWORD STRENGTH HELPER ============
function isStrongPassword(password) {
    const minLength = 8;
    const hasLetters = /[A-Za-z]/.test(password);
    const hasNumbers = /\d/.test(password);
    const hasSpecial = /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(password);
    return password.length >= minLength && hasLetters && hasNumbers && hasSpecial;
}

// ============ IMAGE UPLOAD CONFIGURATION ============
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const dir = './uploads/services';
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        cb(null, dir);
    },
    filename: (req, file, cb) => {
        const unique = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = path.extname(file.originalname);
        cb(null, `service-${unique}${ext}`);
    }
});
const fileFilter = (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg'];
    if (allowed.includes(file.mimetype)) cb(null, true);
    else cb(new Error('Only JPEG, PNG, WEBP allowed'), false);
};
const upload = multer({ storage, fileFilter, limits: { fileSize: 5 * 1024 * 1024 } });

// ============ SECURITY MIDDLEWARE ============
app.use(helmet({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false }));
const limiter = rateLimit({ windowMs: 60 * 1000, max: 500, skipSuccessfulRequests: true, message: { error: 'Too many requests, please try again later.' } });
app.use('/api/', limiter);
const loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 10, skipSuccessfulRequests: true, message: { error: 'Too many login attempts, please try again later.' } });
app.use(session({ secret: process.env.SESSION_SECRET || 'xclusive_session_secret', resave: false, saveUninitialized: false, cookie: { secure: process.env.NODE_ENV === 'production', httpOnly: true, maxAge: 30 * 60 * 1000, sameSite: 'lax' } }));
app.use(cors({ origin: ['http://localhost:3000', 'http://192.168.15.191:3000'], credentials: true }));
app.use(express.json());
app.use(cookieParser());
app.use(express.static('public'));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ============ AUTH MIDDLEWARE ============
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'Access denied' });
    jwt.verify(token, process.env.JWT_SECRET || 'xclusive_secret', (err, user) => {
        if (err) return res.status(403).json({ error: 'Invalid token' });
        req.user = user;
        next();
    });
};
const isAdmin = (req, res, next) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin access required' });
    next();
};

// ============ AUDIT LOGGING ============
async function logAudit(userId, userEmail, action, details, req) {
    const ip = req?.ip || req?.connection?.remoteAddress || 'unknown';
    const userAgent = req?.headers['user-agent'] || 'unknown';
    await supabase.from('audit_logs').insert([{ user_id: userId, user_email: userEmail, action, details, ip_address: ip, user_agent: userAgent }]);
}

// ============ AI CHATBOT RESPONSES (PERSONA-DRIVEN) ============
const chatbotResponses = {
    'services': "✂️ We offer a wide range of premium grooming services:\n• Fades (Low, Mid, High, Taper, Burst)\n• Dreadlocks (Installation, Retwist, Styling)\n• Beard trimming & Hot Towel shave\n• Classic cuts (Blade, Brush, etc.)\n• Custom hair dye (Burgundy, Platinum Blonde, Black)\n\nCheck our Services page for full details and prices!",
    'booking': "📅 To book an appointment:\n1. Go to the Services page\n2. Choose a service (and dye option if needed)\n3. Select your preferred barber\n4. Pick a date and time (24/7 available)\n5. Confirm – you'll receive a QR code for check‑in.\n\nYou can also reschedule or cancel from 'My Bookings'.",
    'price': "💰 Our prices (R):\n• Low Fade: 120, Mid: 130, High: 140, Taper: 125, Burst: 135\n• Dreadlocks Installation: 450, Retwist: 180, Styling: 150\n• Beard Trim: 80, Beard + Hot Towel: 120\n• Classic cuts: 90‑100\n• Dye add‑on: +100 (except Black +80)\n\nExact prices are shown on the service card.",
    'fade': "💇 Fade styles & prices:\n• Low Fade: R120\n• Mid Fade: R130\n• High Fade: R140\n• Taper Fade: R125\n• Burst Fade: R135\n\nAll fades include a shape‑up and hot towel finish!",
    'dreadlocks': "🌿 Dreadlock services:\n• Installation: R450\n• Retwist: R180\n• Styling: R150\n\nWe specialize in freeform, comb coils, and interlocking. Book a consultation if you're unsure!",
    'beard': "🧔 Beard services:\n• Beard Trim: R80\n• Beard + Hot Towel Shave: R120\nWe also offer beard shaping, oil treatment, and dyeing.",
    'cancel': "❌ To cancel an appointment:\nGo to 'My Bookings' → find your appointment → click 'Cancel'. You can also reschedule there.\nIf you have issues, contact us directly.",
    'hours': "🕐 Opening hours:\nMonday – Friday: 9am – 7pm\nSaturday: 9am – 5pm\nSunday: Closed\nWe are open on public holidays (please call ahead).",
    'location': "📍 121 Helen Joseph Rd, Bulwer, Durban, 4001\nWe're opposite the Engen garage, with free parking available.",
    'contact': "📞 Contact us:\n• Phone: +27 31 123 4567\n• WhatsApp: +27 71 234 5678\n• Email: info@xclusivebarbershop.co.za\n• Instagram/Facebook: @xclusivebarbershop",
    'dye': "🎨 Hair dye options:\n• Burgundy Red\n• Platinum Blonde\n• Black\nPrices start from +R80. Dye service includes professional application and aftercare advice.",
    'help': "🆘 I'm your XCLUSIVE assistant. You can ask me about:\n• Services & prices\n• Booking & cancellations\n• Opening hours & location\n• Dreadlocks & beard care\n• Dye colours\nJust type your question naturally!",
    'welcome': "👋 Welcome to THE XCLUSIVE Barbershop! I'm your virtual assistant. How can I help you today?"
};

const defaultResponse = "Thanks for your message! I'm still learning. Please rephrase or ask something like:\n• What services do you offer?\n• How to book an appointment?\n• Opening hours?\n• Prices for fades/dreadlocks/beard?";

function getBotResponse(message) {
    const lowerMsg = message.toLowerCase().trim();
    
    // Direct keyword matching (more specific first)
    if (lowerMsg.includes('service') || lowerMsg.includes('offer') || lowerMsg.includes('what do you do')) 
        return chatbotResponses['services'];
    if (lowerMsg.includes('book') || lowerMsg.includes('appointment') || lowerMsg.includes('schedule') || lowerMsg.includes('reserve')) 
        return chatbotResponses['booking'];
    if (lowerMsg.includes('price') || lowerMsg.includes('cost') || lowerMsg.includes('how much') || lowerMsg.includes('rate')) 
        return chatbotResponses['price'];
    if (lowerMsg.includes('fade') || (lowerMsg.includes('low') && lowerMsg.includes('fade')) || lowerMsg.includes('mid') || lowerMsg.includes('high') || lowerMsg.includes('taper') || lowerMsg.includes('burst')) 
        return chatbotResponses['fade'];
    if (lowerMsg.includes('dreadlock') || lowerMsg.includes('locs') || lowerMsg.includes('retwist') || lowerMsg.includes('dreads')) 
        return chatbotResponses['dreadlocks'];
    if (lowerMsg.includes('beard') || lowerMsg.includes('shave') || lowerMsg.includes('hot towel')) 
        return chatbotResponses['beard'];
    if (lowerMsg.includes('cancel') || lowerMsg.includes('refund') || lowerMsg.includes('reschedule')) 
        return chatbotResponses['cancel'];
    if (lowerMsg.includes('hour') || lowerMsg.includes('open') || lowerMsg.includes('close') || lowerMsg.includes('time')) 
        return chatbotResponses['hours'];
    if (lowerMsg.includes('location') || lowerMsg.includes('where') || lowerMsg.includes('address') || lowerMsg.includes('near')) 
        return chatbotResponses['location'];
    if (lowerMsg.includes('contact') || lowerMsg.includes('phone') || lowerMsg.includes('email') || lowerMsg.includes('whatsapp')) 
        return chatbotResponses['contact'];
    if (lowerMsg.includes('dye') || lowerMsg.includes('color') || lowerMsg.includes('colour') || lowerMsg.includes('hair colour')) 
        return chatbotResponses['dye'];
    if (lowerMsg.includes('help') || lowerMsg.includes('what can you do') || lowerMsg.includes('assist')) 
        return chatbotResponses['help'];
    if (lowerMsg.includes('hello') || lowerMsg.includes('hi') || lowerMsg.includes('hey') || lowerMsg.includes('good morning') || lowerMsg.includes('good afternoon')) 
        return chatbotResponses['welcome'];
    
    // If nothing matches, return a helpful default message
    return defaultResponse;
}

// ============ REAL-TIME IOT SENSOR SIMULATION ============
let simulatedBarberStatus = {
    1: { status: 'available', currentCustomer: null, startTime: null, barberName: 'Michael' },
    2: { status: 'available', currentCustomer: null, startTime: null, barberName: 'Thabo' },
    3: { status: 'available', currentCustomer: null, startTime: null, barberName: 'James' }
};

async function updateAllSensors() {
    try {
        const now = getSASTTime();
        const nowStr = getSASTISOString();
        const timeStr = getSASTTimeString();
        console.log(`📡 Updating sensors at ${timeStr} (SAST)...`);
        
        const { count: waitingCount } = await supabase.from('queue_status').select('*', { count: 'exact', head: true }).eq('status', 'waiting');
        await supabase.from('iot_sensors').update({ last_data: { count: waitingCount || 0, timestamp: nowStr, current_time: timeStr }, last_update: nowStr, status: 'online' }).eq('sensor_name', 'Queue Counter Sensor');
        
        const { data: waitingList } = await supabase.from('queue_status').select('customer_name, queue_number').eq('status', 'waiting').order('queue_number', { ascending: true });
        await supabase.from('iot_sensors').update({ last_data: { waiting: waitingList?.length || 0, waiting_list: waitingList || [], current_time: timeStr, last_updated: nowStr }, last_update: nowStr, status: 'online' }).eq('sensor_name', 'Digital Queue Display');
        
        await supabase.from('iot_sensors').update({ last_data: { status: 'ready', last_check: nowStr, current_time: timeStr }, last_update: nowStr, status: 'online' }).eq('sensor_name', 'QR Code Scanner');
        
        for (let i = 1; i <= 3; i++) {
            const barberStatus = simulatedBarberStatus[i];
            let sensorMainStatus = 'online';
            if (barberStatus.status === 'unavailable') sensorMainStatus = 'offline';
            if (barberStatus.status === 'maintenance') sensorMainStatus = 'maintenance';
            await supabase.from('iot_sensors').update({
                last_data: { station: i, status: barberStatus.status, barber: barberStatus.barberName, serving: barberStatus.currentCustomer, since: barberStatus.startTime ? barberStatus.startTime.toISOString() : null },
                last_update: nowStr,
                status: sensorMainStatus
            }).eq('sensor_name', `Barber Station ${i}`);
        }
        console.log(`✅ Sensors updated at ${timeStr} SAST | Waiting: ${waitingList?.length || 0}`);
    } catch (error) {
        console.error('❌ ERROR in updateAllSensors:', error);
    }
}

async function updateBarberStations() { return; }
function startIoTSimulation() {
    console.log('\n🔄 Starting IoT Sensor Simulation (SAST TIMEZONE)...\n');
    setTimeout(() => { console.log('⏰ Running initial sensor update...'); updateAllSensors(); }, 1000);
    setInterval(() => { updateAllSensors(); }, 5000);
    console.log('✅ IoT Sensors active - Updates every 5 seconds');
    console.log('✅ Manual serving ONLY - Customers will NOT be served automatically');
}

// ============ BARBER ROUTES ============
app.get('/api/barber/stats', authenticateToken, async (req, res) => {
    const barberStation = req.user.barber_station || 1;
    const { count: waitingCount } = await supabase.from('queue_status').select('*', { count: 'exact', head: true }).eq('status', 'waiting');
    const todayStr = getSASTDateString();
    const { count: completedToday } = await supabase.from('queue_status').select('*', { count: 'exact', head: true }).eq('status', 'completed').eq('barber_station', barberStation).gte('completed_at', todayStr);
    const { data: completedServices } = await supabase.from('queue_status').select('actual_start_time, completed_at, created_at').eq('status', 'completed').eq('barber_station', barberStation).not('completed_at', 'is', null);
    let avgServiceTime = 0;
    if (completedServices && completedServices.length > 0) {
        let totalMinutes = 0, validServices = 0;
        for (const service of completedServices) {
            const startTime = service.actual_start_time, endTime = service.completed_at;
            if (startTime && endTime) {
                const minutes = (new Date(endTime) - new Date(startTime)) / 60000;
                if (minutes > 0 && minutes < 180) { totalMinutes += minutes; validServices++; }
            }
        }
        if (validServices > 0) avgServiceTime = Math.round(totalMinutes / validServices);
    }
    const { data: myCurrentCustomer } = await supabase.from('queue_status').select('*').eq('status', 'serving').eq('barber_station', barberStation).single();
    res.json({ waitingCount: waitingCount || 0, completedToday: completedToday || 0, avgServiceTime, barberStation, currentCustomer: myCurrentCustomer });
});

app.put('/api/barber/start/:id', authenticateToken, async (req, res) => {
    const { id } = req.params;
    const { barber_station } = req.body;
    const user = req.user;
    
    if (user.role !== 'barber' && user.role !== 'admin') {
        return res.status(403).json({ success: false, message: 'Only barbers can start services' });
    }
    
    try {
        // 1. Get queue item
        const { data: queueItem, error: fetchError } = await supabase
            .from('queue_status')
            .select('*')
            .eq('id', id)
            .single();
        
        if (fetchError || !queueItem) {
            return res.status(404).json({ success: false, message: 'Queue item not found' });
        }
        
        if (queueItem.status !== 'waiting') {
            return res.status(400).json({ success: false, message: 'Customer is not in waiting queue' });
        }
        
        // 2. If this queue item has an appointment, get its barber_station
        let appointmentBarberStation = null;
        if (queueItem.appointment_id) {
            const { data: appointment, error: appError } = await supabase
                .from('appointments')
                .select('barber_station')
                .eq('id', queueItem.appointment_id)
                .single();
            if (!appError && appointment) {
                appointmentBarberStation = appointment.barber_station;
            }
        }
        
        const barberStation = barber_station || user.barber_station;
        if (appointmentBarberStation && appointmentBarberStation !== barberStation) {
            return res.status(403).json({ 
                success: false, 
                message: `This customer is assigned to Station ${appointmentBarberStation}. You cannot serve them.` 
            });
        }
        
        const targetStation = barberStation || 1;
        const nowISO = getSASTISOString();
        
        // 3. Update queue item status
        const { error: updateError } = await supabase
            .from('queue_status')
            .update({ 
                status: 'serving', 
                barber_station: targetStation, 
                actual_start_time: nowISO 
            })
            .eq('id', id);
        
        if (updateError) throw updateError;
        
        // 4. Update simulated barber status
        if (simulatedBarberStatus[targetStation]) {
            simulatedBarberStatus[targetStation].status = 'busy';
            simulatedBarberStatus[targetStation].currentCustomer = queueItem.customer_name;
            simulatedBarberStatus[targetStation].startTime = getSASTTime();
        }
        
        await logAudit(user.id, user.email, 'START_SERVICE', `Started serving ${queueItem.customer_name} (Queue #${queueItem.queue_number}) at Station ${targetStation}`, req);
        await updateAllSensors();
        
        res.json({ success: true, message: 'Service started successfully!', start_time: nowISO });
        
    } catch (err) {
        console.error('Start service error:', err);
        res.status(500).json({ success: false, message: err.message });
    }
});

app.put('/api/barber/complete/:id', authenticateToken, async (req, res) => {
    const { id } = req.params;
    const { barber_station } = req.body;
    const user = req.user;
    if (user.role !== 'barber' && user.role !== 'admin') return res.status(403).json({ success: false, message: 'Only barbers can complete services' });
    try {
        // 1. Get queue item
        const { data: queueItem, error: fetchError } = await supabase
            .from('queue_status')
            .select('*')
            .eq('id', id)
            .single();
        if (fetchError || !queueItem) return res.status(404).json({ success: false, message: 'Queue item not found' });
        if (queueItem.status !== 'serving') return res.status(400).json({ success: false, message: 'This customer is not being served' });
        if (user.role === 'barber') {
            const userBarberStation = user.barber_station || barber_station;
            if (queueItem.barber_station !== userBarberStation) {
                return res.status(403).json({ success: false, message: 'You are not serving this customer' });
            }
        }
        // 2. Update queue item to completed
        const { error: updateError } = await supabase
            .from('queue_status')
            .update({ status: 'completed', completed_at: getSASTISOString() })
            .eq('id', id);
        if (updateError) throw updateError;
        // 3. Update simulated barber status
        for (let i = 1; i <= 3; i++) {
            if (simulatedBarberStatus[i].currentCustomer === queueItem.customer_name) {
                simulatedBarberStatus[i].status = 'available';
                simulatedBarberStatus[i].currentCustomer = null;
                simulatedBarberStatus[i].startTime = null;
                break;
            }
        }
        // 4. If linked to an appointment, mark it as completed
        if (queueItem.appointment_id) {
            await supabase.from('appointments').update({ status: 'completed' }).eq('id', queueItem.appointment_id);
            console.log(`✅ Appointment #${queueItem.appointment_id} marked as completed`);
        }
        await logAudit(user.id, user.email, 'COMPLETE_SERVICE', `Completed service for ${queueItem.customer_name} (Queue #${queueItem.queue_number})`, req);
        await updateAllSensors();
        res.json({ success: true, message: 'Service completed successfully!' });
    } catch (err) {
        console.error('Complete service error:', err);
        res.status(500).json({ success: false, message: err.message });
    }
});

// ============ QR CODE GENERATION & CHECK-IN ============
app.post('/api/appointments/:id/generate-qr', authenticateToken, async (req, res) => {
    try {
        const appointmentId = parseInt(req.params.id);
        const { data: appointment, error } = await supabase.from('appointments').select('*').eq('id', appointmentId).eq('user_id', req.user.id).single();
        if (error || !appointment) return res.status(404).json({ error: 'Appointment not found' });
        const qrData = JSON.stringify({ id: appointment.id, name: appointment.customer_name, service: appointment.service_name, date: appointment.appointment_date });
        const qrCodeBase64 = await QRCode.toDataURL(qrData, { errorCorrectionLevel: 'H', margin: 2, width: 400, color: { dark: '#000000', light: '#FFFFFF' } });
        res.json({ success: true, qrCode: qrCodeBase64, qrData });
    } catch (err) { console.error(err); res.status(500).json({ error: err.message }); }
});

app.post('/api/check-in', async (req, res) => {
    console.log('📱 Check-in request received');
    try {
        let bookingData;
        try { bookingData = typeof req.body.qrData === 'string' ? JSON.parse(req.body.qrData) : req.body.qrData; } catch(e) { bookingData = { id: parseInt(req.body.qrData) }; }
        const appointmentId = bookingData.id;
        const { data: appointment, error } = await supabase.from('appointments').select('*').eq('id', appointmentId).single();
        if (error || !appointment) return res.status(404).json({ error: `Booking ID #${appointmentId} not found.` });
        if (appointment.status === 'cancelled') return res.status(400).json({ error: `Booking #${appointmentId} has been cancelled.` });
        if (appointment.checked_in === true) return res.status(409).json({ success: false, already_checked_in: true, error: `Booking #${appointmentId} has already been checked in.` });
        if (appointment.status === 'completed') return res.status(400).json({ error: `Booking #${appointmentId} has already been completed.` });
        const today = getSASTDateString();
        if (appointment.appointment_date < today) return res.status(400).json({ error: `Booking #${appointmentId} was for ${appointment.appointment_date}. This appointment has expired.` });
        await supabase.from('appointments').update({ checked_in: true, checked_in_at: getSASTISOString() }).eq('id', appointment.id);
        const { data: maxQueue } = await supabase.from('queue_status').select('queue_number').order('queue_number', { ascending: false }).limit(1);
        const nextNumber = (maxQueue && maxQueue[0]?.queue_number) ? maxQueue[0].queue_number + 1 : 1;
        await supabase.from('queue_status').insert([{
            customer_name: appointment.customer_name, customer_email: appointment.customer_email, customer_phone: appointment.customer_phone,
            queue_number: nextNumber, service_name: appointment.service_name, status: 'waiting', estimated_wait_time: 20,
            appointment_id: appointment.id, barber_station: appointment.barber_station, created_at: getSASTISOString()
        }]);
        console.log('✅ Check-in successful! Queue #:', nextNumber);
        await updateAllSensors();
        res.json({ success: true, message: `Check-in successful! You have been added to the queue.`, queue_number: nextNumber, estimated_wait: 20 });
    } catch (err) { console.error('❌ Check-in error:', err); res.status(500).json({ error: 'Server error. Please try again or ask reception for assistance.' }); }
});

// ============ REGISTER (with strong password) ============
app.post('/api/register', async (req, res) => {
    const { name, email, phone, password } = req.body;
    if (!name || !email || !password) return res.status(400).json({ error: 'All fields required' });
    if (!isStrongPassword(password)) return res.status(400).json({ error: 'Password must be at least 8 characters and include letters, numbers, and special characters' });
    try {
        const { data: existing } = await supabase.from('users').select('id').eq('email', email).single();
        if (existing) return res.status(400).json({ error: 'Email already exists' });
        const hashedPassword = await bcrypt.hash(password, 10);
        const { data: user } = await supabase.from('users').insert([{ name, email, phone: phone || '', password: hashedPassword, role: 'client' }]).select().single();
        await logAudit(user.id, email, 'REGISTER', 'User registered successfully', req);
        res.json({ success: true, message: 'Registration successful!' });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// ============ LOGIN ============
app.post('/api/login', loginLimiter, async (req, res) => {
    const { email, password, remember } = req.body;
    try {
        const { data: users } = await supabase.from('users').select('*').eq('email', email);
        if (!users || users.length === 0) return res.status(401).json({ error: 'Invalid credentials' });
        const user = users[0];
        const validPassword = await bcrypt.compare(password, user.password);
        if (!validPassword) return res.status(401).json({ error: 'Invalid credentials' });
        const expiresIn = remember ? '30d' : '7d';
        const token = jwt.sign({ id: user.id, name: user.name, email: user.email, role: user.role, barber_station: user.barber_station || null }, process.env.JWT_SECRET || 'xclusive_secret', { expiresIn });
        const cookieOptions = { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', maxAge: remember ? 30 * 24 * 60 * 60 * 1000 : 7 * 24 * 60 * 60 * 1000 };
        res.cookie('token', token, cookieOptions);
        await logAudit(user.id, user.email, 'LOGIN', 'User logged in successfully', req);
        res.json({ success: true, token, user: { id: user.id, name: user.name, email: user.email, role: user.role, phone: user.phone, barber_station: user.barber_station } });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/logout', (req, res) => { res.clearCookie('token'); res.json({ success: true }); });

// ============ GET SERVICES (Public) ============
app.get('/api/services', async (req, res) => {
    try {
        const { data: services } = await supabase.from('services').select('*').eq('is_active', true);
        const { data: dyeColors } = await supabase.from('dye_colors').select('*').eq('is_active', true);
        res.json({ services: services || [], dyeColors: dyeColors || [] });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// ============ CHECK AVAILABILITY ============
app.get('/api/check-availability', authenticateToken, async (req, res) => {
    const { date, time } = req.query;
    const { count: userCount } = await supabase.from('appointments').select('*', { count: 'exact', head: true }).eq('user_id', req.user.id).eq('appointment_date', date).eq('appointment_time', time).neq('status', 'cancelled');
    const { count: totalCount } = await supabase.from('appointments').select('*', { count: 'exact', head: true }).eq('appointment_date', date).eq('appointment_time', time).neq('status', 'cancelled');
    res.json({ slotTaken: totalCount >= 5, userAlreadyBooked: userCount > 0, currentBookings: totalCount || 0, remainingSpots: 5 - (totalCount || 0), maxPerSlot: 5, isAvailable: totalCount < 5 && userCount === 0 });
});

// ============ CREATE APPOINTMENT (Customer) ============
app.post('/api/appointments', authenticateToken, async (req, res) => {
    const { service_name, service_price, dye_color, appointment_date, appointment_time, barber_station } = req.body;
    if (!service_name || !service_price || !appointment_date || !appointment_time) return res.status(400).json({ error: 'Missing required fields' });
    const todaySAST = getSASTDateString();
    if (appointment_date < todaySAST) return res.status(400).json({ error: 'Cannot book appointments in the past. Please select a future date.' });
    try {
        const { count: userCount } = await supabase.from('appointments').select('*', { count: 'exact', head: true }).eq('user_id', req.user.id).eq('appointment_date', appointment_date).eq('appointment_time', appointment_time).neq('status', 'cancelled');
        if (userCount > 0) return res.status(409).json({ error: '❌ You already have a booking at this time slot.' });
        const { count: totalCount } = await supabase.from('appointments').select('*', { count: 'exact', head: true }).eq('appointment_date', appointment_date).eq('appointment_time', appointment_time).neq('status', 'cancelled');
        if (totalCount >= 5) return res.status(409).json({ error: `❌ This time slot already has 5 clients. Maximum 5 per time slot.` });
        const { data: newAppointment, error } = await supabase.from('appointments').insert([{
            user_id: req.user.id, customer_name: req.user.name, customer_email: req.user.email, customer_phone: '',
            service_name, service_price, dye_color: dye_color || null, appointment_date, appointment_time,
            barber_station: barber_station || null, status: 'confirmed', added_to_queue: 0, checked_in: false
        }]).select().single();
        if (error) throw error;
        await logAudit(req.user.id, req.user.email, 'BOOK_APPOINTMENT', `Booked ${service_name} on ${appointment_date} at ${appointment_time} with barber station ${barber_station || 'Any'}`, req);
        res.json({ success: true, message: 'Appointment booked!', id: newAppointment.id });
    } catch (err) { console.error('Booking error:', err); res.status(500).json({ error: err.message }); }
});

// ============ GET MY APPOINTMENTS ============
app.get('/api/my-appointments', authenticateToken, async (req, res) => {
    const { data: appointments } = await supabase.from('appointments').select('*').eq('user_id', req.user.id).order('appointment_date', { ascending: false });
    res.json(appointments || []);
});

app.delete('/api/appointments/:id', authenticateToken, async (req, res) => {
    await supabase.from('appointments').update({ status: 'cancelled' }).eq('id', req.params.id).eq('user_id', req.user.id);
    await logAudit(req.user.id, req.user.email, 'CANCEL_APPOINTMENT', `Cancelled appointment #${req.params.id}`, req);
    res.json({ success: true, message: 'Appointment cancelled' });
});

app.put('/api/appointments/:id', authenticateToken, async (req, res) => {
    const { appointment_date, appointment_time, barber_station } = req.body;
    const todaySAST = getSASTDateString();
    if (appointment_date < todaySAST) return res.status(400).json({ error: 'Cannot reschedule to a past date.' });
    const { count: userCount } = await supabase.from('appointments').select('*', { count: 'exact', head: true }).eq('user_id', req.user.id).eq('appointment_date', appointment_date).eq('appointment_time', appointment_time).neq('id', req.params.id).neq('status', 'cancelled');
    if (userCount > 0) return res.status(409).json({ error: '❌ You already have another booking at this time slot.' });
    const { count: totalCount } = await supabase.from('appointments').select('*', { count: 'exact', head: true }).eq('appointment_date', appointment_date).eq('appointment_time', appointment_time).neq('id', req.params.id).neq('status', 'cancelled');
    if (totalCount >= 5) return res.status(409).json({ error: 'This time slot already has 5 clients. Max 5 per time slot.' });
    await supabase.from('appointments').update({ appointment_date, appointment_time, barber_station: barber_station || null }).eq('id', req.params.id).eq('user_id', req.user.id);
    await logAudit(req.user.id, req.user.email, 'UPDATE_APPOINTMENT', `Updated appointment #${req.params.id}`, req);
    res.json({ success: true });
});

// ============ BARBER SCHEDULE ENDPOINT (filtered by station) ============
app.get('/api/barber/schedule', authenticateToken, async (req, res) => {
    if (req.user.role !== 'barber' && req.user.role !== 'admin') return res.status(403).json({ error: 'Only barbers can view schedule' });
    let barberStation = null;
    if (req.user.role === 'barber') { barberStation = req.user.barber_station; if (!barberStation) return res.status(400).json({ error: 'Your barber station is not configured. Contact admin.' }); }
    else { barberStation = req.query.station ? parseInt(req.query.station) : null; }
    const todaySAST = getSASTDateString();
    try {
        let query = supabase.from('appointments').select('*').eq('appointment_date', todaySAST).neq('status', 'cancelled').neq('status', 'completed').order('appointment_time', { ascending: true });
        if (barberStation) query = query.eq('barber_station', barberStation);
        const { data: appointments, error } = await query;
        if (error) throw error;
        res.json({ success: true, barber_station: barberStation, date: todaySAST, appointments: appointments || [] });
    } catch (err) { console.error('Schedule error:', err); res.status(500).json({ error: err.message }); }
});

// ============ CHAT ROUTES ============
app.post('/api/chat', authenticateToken, async (req, res) => {
    const { message } = req.body;
    if (!message || message.trim() === '') return res.status(400).json({ error: 'Message cannot be empty' });
    const botReply = getBotResponse(message);
    await supabase.from('chat_messages').insert([{ user_id: req.user.id, user_name: req.user.name, message, status: 'unread' }]);
    res.json({ success: true, botReply });
});
app.get('/api/chat', authenticateToken, async (req, res) => { const { data: messages } = await supabase.from('chat_messages').select('*').eq('user_id', req.user.id).order('created_at', { ascending: true }); res.json(messages || []); });
app.delete('/api/chat/clear', authenticateToken, async (req, res) => { try { await supabase.from('chat_messages').delete().eq('user_id', req.user.id); res.json({ success: true, message: 'Chat cleared' }); } catch (err) { res.status(500).json({ error: err.message }); } });

// ============ REVIEWS ROUTES ============
app.post('/api/reviews', authenticateToken, async (req, res) => {
    const { service_name, rating, comment } = req.body;
    if (!rating || rating < 1 || rating > 5) return res.status(400).json({ error: 'Rating must be between 1 and 5' });
    await supabase.from('reviews').insert([{ user_id: req.user.id, user_name: req.user.name, service_name: service_name || null, rating, comment: comment || null, status: 'approved' }]);
    await logAudit(req.user.id, req.user.email, 'SUBMIT_REVIEW', `Submitted ${rating}-star review`, req);
    res.json({ success: true, message: 'Review submitted! Thank you!' });
});
app.get('/api/reviews', async (req, res) => { const { data: reviews } = await supabase.from('reviews').select('*').eq('status', 'approved').order('created_at', { ascending: false }).limit(50); res.json(reviews || []); });

// ============ QUEUE MANAGEMENT (NO JOIN – AVOIDS FOREIGN KEY ERROR) ============
app.get('/api/queue/status', authenticateToken, async (req, res) => {
    try {
        // 1. Get all queue items
        const { data: queue, error: queueError } = await supabase
            .from('queue_status')
            .select('*')
            .order('queue_number', { ascending: true });

        if (queueError) {
            console.error('Queue fetch error:', queueError);
            return res.status(500).json({ error: queueError.message });
        }

        if (!queue || queue.length === 0) {
            return res.json({ queue: [], waitingCount: 0, estimatedWaitTime: 0, maxPerSlot: 5 });
        }

        // 2. Get unique appointment IDs that exist in the queue
        const appointmentIds = [...new Set(queue.filter(q => q.appointment_id).map(q => q.appointment_id))];

        let appointmentMap = new Map();
        if (appointmentIds.length > 0) {
            // 3. Fetch those appointments (only needed columns)
            const { data: appointments, error: appError } = await supabase
                .from('appointments')
                .select('id, barber_station')
                .in('id', appointmentIds);

            if (!appError && appointments) {
                appointments.forEach(app => appointmentMap.set(app.id, app.barber_station));
            }
        }

        // 4. Enrich each queue item with the barber_station from the appointment
        const enrichedQueue = queue.map(item => ({
            ...item,
            barber_station: item.appointment_id ? appointmentMap.get(item.appointment_id) || null : null
        }));

        // 5. Apply barber filtering (if user is a barber)
        let filteredQueue = enrichedQueue;
        if (req.user.role === 'barber') {
            const barberStation = req.user.barber_station;
            if (!barberStation) {
                return res.status(400).json({ error: 'Barber station not configured' });
            }
            filteredQueue = enrichedQueue.filter(item => {
                // Show if no barber assigned (null) OR assigned to this barber
                return item.barber_station === null || item.barber_station === barberStation;
            });
        }

        const waitingCount = filteredQueue.filter(q => q.status === 'waiting').length;
        res.json({
            queue: filteredQueue,
            waitingCount,
            estimatedWaitTime: waitingCount * 20,
            maxPerSlot: 5
        });
    } catch (err) {
        console.error('Queue error:', err);
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/queue/add', authenticateToken, isAdmin, async (req, res) => {
    const { customer_name, customer_phone, service_name } = req.body;
    const { data: maxQueue } = await supabase.from('queue_status').select('queue_number').order('queue_number', { ascending: false }).limit(1);
    const nextNumber = (maxQueue && maxQueue[0]?.queue_number) ? maxQueue[0].queue_number + 1 : 1;
    await supabase.from('queue_status').insert([{ customer_name, customer_phone, queue_number: nextNumber, status: 'waiting', service_name: service_name || 'Haircut', estimated_wait_time: nextNumber * 20, created_at: getSASTISOString() }]);
    await logAudit(req.user.id, req.user.email, 'ADD_TO_QUEUE', `Added ${customer_name} to queue #${nextNumber} with service ${service_name || 'Haircut'}`, req);
    await updateAllSensors();
    res.json({ success: true, queueNumber: nextNumber });
});

app.put('/api/queue/:id/status', authenticateToken, isAdmin, async (req, res) => {
    const { status } = req.body;
    const { data: queueItem, error: fetchError } = await supabase.from('queue_status').select('*, appointments(barber_station)').eq('id', req.params.id).single();
    if (fetchError || !queueItem) return res.status(404).json({ error: 'Queue item not found' });
    if (status === 'serving') {
        const assignedStation = queueItem.appointments?.barber_station;
        const barberStation = req.body.barber_station || req.user.barber_station;
        if (assignedStation && assignedStation !== barberStation) {
            return res.status(403).json({ error: `This customer is assigned to Station ${assignedStation}. You cannot serve them.` });
        }
    }
    if (status === 'serving') {
        await supabase.from('queue_status').update({ status, actual_start_time: getSASTISOString() }).eq('id', req.params.id);
    } else {
        await supabase.from('queue_status').update({ status }).eq('id', req.params.id);
    }
    if (status === 'serving' && queueItem) {
        for (let i = 1; i <= 3; i++) if (simulatedBarberStatus[i].status === 'available') { simulatedBarberStatus[i].status = 'busy'; simulatedBarberStatus[i].currentCustomer = queueItem.customer_name; simulatedBarberStatus[i].startTime = getSASTTime(); break; }
        console.log(`✂️ Started serving: ${queueItem.customer_name} (Queue #${queueItem.queue_number})`);
    }
    if (status === 'completed' && queueItem) {
        for (let i = 1; i <= 3; i++) if (simulatedBarberStatus[i].currentCustomer === queueItem.customer_name) { simulatedBarberStatus[i].status = 'available'; simulatedBarberStatus[i].currentCustomer = null; simulatedBarberStatus[i].startTime = null; break; }
        if (queueItem.appointment_id) await supabase.from('appointments').update({ status: 'completed' }).eq('id', queueItem.appointment_id);
        console.log(`✅ Completed: ${queueItem.customer_name}`);
    }
    await logAudit(req.user.id, req.user.email, 'UPDATE_QUEUE_STATUS', `Updated queue #${req.params.id} to ${status}`, req);
    await updateAllSensors();
    res.json({ success: true });
});

// ============ IOT SENSORS ============
app.get('/api/iot/sensors', authenticateToken, isAdmin, async (req, res) => { const { data: sensors } = await supabase.from('iot_sensors').select('*'); res.json(sensors || []); });
app.put('/api/iot/sensors/:id', authenticateToken, isAdmin, async (req, res) => { const { status, last_data } = req.body; await supabase.from('iot_sensors').update({ status, last_data, last_update: getSASTISOString() }).eq('id', req.params.id); res.json({ success: true }); });
app.post('/api/iot/simulate-now', authenticateToken, isAdmin, async (req, res) => { await updateAllSensors(); await updateBarberStations(); console.log('🔄 Manual sensor update triggered at:', getSASTTimeString()); res.json({ success: true, message: 'Sensors updated' }); });

// ============ ADMIN ROUTES ============
app.get('/api/admin/stats', authenticateToken, isAdmin, async (req, res) => {
    const { count: totalBookings } = await supabase.from('appointments').select('*', { count: 'exact', head: true }).neq('status', 'cancelled');
    const { count: completedBookings } = await supabase.from('appointments').select('*', { count: 'exact', head: true }).eq('status', 'completed');
    const { data: revenueData } = await supabase.from('appointments').select('service_price').neq('status', 'cancelled');
    const totalRevenue = revenueData?.reduce((sum, r) => sum + parseFloat(r.service_price), 0) || 0;
    const { count: totalUsers } = await supabase.from('users').select('*', { count: 'exact', head: true }).eq('role', 'client');
    const { count: todayBookings } = await supabase.from('appointments').select('*', { count: 'exact', head: true }).eq('appointment_date', getSASTDateString()).neq('status', 'cancelled');
    const { count: queueWaiting } = await supabase.from('queue_status').select('*', { count: 'exact', head: true }).eq('status', 'waiting');
    res.json({ totalBookings: totalBookings || 0, completedBookings: completedBookings || 0, totalRevenue, totalUsers: totalUsers || 0, todayBookings: todayBookings || 0, queueWaiting: queueWaiting || 0 });
});

app.get('/api/admin/appointments', authenticateToken, isAdmin, async (req, res) => { const { data: appointments } = await supabase.from('appointments').select('*').order('appointment_date', { ascending: false }); res.json(appointments || []); });
app.get('/api/admin/users', authenticateToken, isAdmin, async (req, res) => { const { data: users } = await supabase.from('users').select('id, name, email, phone, role, barber_station, created_at'); res.json(users || []); });
app.post('/api/admin/users', authenticateToken, isAdmin, async (req, res) => {
    const { name, email, phone, role, barber_station, password } = req.body;
    if (!name || !email || !password) return res.status(400).json({ error: 'Name, email and password are required' });
    if (!isStrongPassword(password)) return res.status(400).json({ error: 'Password must be at least 8 characters and include letters, numbers, and special characters' });
    const { data: existing } = await supabase.from('users').select('id').eq('email', email).single();
    if (existing) return res.status(400).json({ error: 'Email already exists' });
    const hashedPassword = await bcrypt.hash(password, 10);
    const { data: newUser, error } = await supabase.from('users').insert([{ name, email, phone: phone || '', password: hashedPassword, role: role || 'barber', barber_station: barber_station || 1 }]).select().single();
    if (error) return res.status(500).json({ error: error.message });
    await logAudit(req.user.id, req.user.email, 'ADMIN_CREATE_BARBER', `Created barber ${name} (${email})`, req);
    res.json({ success: true, user: newUser });
});
app.put('/api/admin/users/:id', authenticateToken, isAdmin, async (req, res) => {
    const { id } = req.params;
    const { name, email, phone, barber_station, password } = req.body;
    const updateData = { name, email, phone, barber_station };
    if (password && password.trim() !== '') {
        if (!isStrongPassword(password)) return res.status(400).json({ error: 'Password must be at least 8 characters and include letters, numbers, and special characters' });
        updateData.password = await bcrypt.hash(password, 10);
    }
    const { data: updatedUser, error } = await supabase.from('users').update(updateData).eq('id', id).select().single();
    if (error) return res.status(500).json({ error: error.message });
    await logAudit(req.user.id, req.user.email, 'ADMIN_UPDATE_BARBER', `Updated barber ${name} (${email})`, req);
    res.json({ success: true, user: updatedUser });
});
app.delete('/api/admin/users/:id', authenticateToken, isAdmin, async (req, res) => {
    const { id } = req.params;
    const { data: barber } = await supabase.from('users').select('name, email').eq('id', id).single();
    const { error } = await supabase.from('users').delete().eq('id', id);
    if (error) return res.status(500).json({ error: error.message });
    await logAudit(req.user.id, req.user.email, 'ADMIN_DELETE_BARBER', `Deleted barber ${barber?.name} (${barber?.email})`, req);
    res.json({ success: true });
});
app.put('/api/admin/users/:id/reset-password', authenticateToken, isAdmin, async (req, res) => {
    const { id } = req.params;
    const { password } = req.body;
    if (!password || !isStrongPassword(password)) return res.status(400).json({ error: 'Password must be at least 8 characters and include letters, numbers, and special characters' });
    const hashedPassword = await bcrypt.hash(password, 10);
    const { error } = await supabase.from('users').update({ password: hashedPassword }).eq('id', id);
    if (error) return res.status(500).json({ error: error.message });
    const { data: barber } = await supabase.from('users').select('name, email').eq('id', id).single();
    await logAudit(req.user.id, req.user.email, 'ADMIN_RESET_BARBER_PASSWORD', `Reset password for barber ${barber?.name}`, req);
    res.json({ success: true });
});
app.put('/api/admin/appointments/:id/status', authenticateToken, isAdmin, async (req, res) => {
    const { id } = req.params;
    const { status } = req.body;
    const { error } = await supabase.from('appointments').update({ status }).eq('id', id);
    if (error) return res.status(500).json({ error: error.message });
    await logAudit(req.user.id, req.user.email, 'ADMIN_UPDATE_APPOINTMENT_STATUS', `Updated appointment #${id} status to ${status}`, req);
    res.json({ success: true });
});
app.delete('/api/admin/appointments/:id', authenticateToken, isAdmin, async (req, res) => {
    const { id } = req.params;
    const { error } = await supabase.from('appointments').delete().eq('id', id);
    if (error) return res.status(500).json({ error: error.message });
    await logAudit(req.user.id, req.user.email, 'ADMIN_DELETE_APPOINTMENT', `Deleted appointment #${id}`, req);
    res.json({ success: true });
});
app.get('/api/admin/audit-logs', authenticateToken, isAdmin, async (req, res) => { const { data: logs } = await supabase.from('audit_logs').select('*').order('created_at', { ascending: false }).limit(100); res.json(logs || []); });

// ============ SERVICE MANAGEMENT ROUTES (with image upload and dye price) ============
app.get('/api/admin/services', authenticateToken, isAdmin, async (req, res) => { const { data: services } = await supabase.from('services').select('*').order('name'); res.json(services || []); });
app.get('/api/admin/services/:id', authenticateToken, isAdmin, async (req, res) => { const { id } = req.params; const { data: service } = await supabase.from('services').select('*').eq('id', id).single(); res.json(service); });
app.post('/api/admin/services', authenticateToken, isAdmin, upload.single('image'), async (req, res) => {
    const { name, description, category, price_no_dye, price_with_dye, has_dye, is_active } = req.body;
    const image_url = req.file ? `/uploads/services/${req.file.filename}` : null;
    if (!name || !price_no_dye) return res.status(400).json({ error: 'Name and price are required' });
    try {
        const { data: newService, error } = await supabase.from('services').insert([{ name, description: description || null, category: category || null, price_no_dye: parseFloat(price_no_dye), price_with_dye: price_with_dye ? parseFloat(price_with_dye) : null, has_dye: has_dye === 'true' || has_dye === true, is_active: is_active !== undefined ? (is_active === 'true' || is_active === true) : true, image_url }]).select().single();
        if (error) throw error;
        await logAudit(req.user.id, req.user.email, 'ADMIN_CREATE_SERVICE', `Created service ${name} with image`, req);
        res.json({ success: true, service: newService });
    } catch (err) { console.error(err); res.status(500).json({ error: err.message }); }
});
app.put('/api/admin/services/:id', authenticateToken, isAdmin, upload.single('image'), async (req, res) => {
    const { id } = req.params;
    const { name, description, category, price_no_dye, price_with_dye, has_dye, is_active, existing_image } = req.body;
    let image_url = existing_image || null;
    if (req.file) image_url = `/uploads/services/${req.file.filename}`;
    try {
        const { data: updatedService, error } = await supabase.from('services').update({ name, description, category, price_no_dye: parseFloat(price_no_dye), price_with_dye: price_with_dye ? parseFloat(price_with_dye) : null, has_dye: has_dye === 'true' || has_dye === true, is_active: is_active === 'true' || is_active === true, image_url }).eq('id', id).select().single();
        if (error) throw error;
        await logAudit(req.user.id, req.user.email, 'ADMIN_UPDATE_SERVICE', `Updated service ${name}`, req);
        res.json({ success: true, service: updatedService });
    } catch (err) { console.error(err); res.status(500).json({ error: err.message }); }
});
app.delete('/api/admin/services/:id', authenticateToken, isAdmin, async (req, res) => {
    const { id } = req.params;
    const { data: service } = await supabase.from('services').select('name, image_url').eq('id', id).single();
    if (service?.image_url) { const filePath = path.join(__dirname, service.image_url); if (fs.existsSync(filePath)) fs.unlinkSync(filePath); }
    const { error } = await supabase.from('services').delete().eq('id', id);
    if (error) return res.status(500).json({ error: error.message });
    await logAudit(req.user.id, req.user.email, 'ADMIN_DELETE_SERVICE', `Deleted service ${service?.name}`, req);
    res.json({ success: true });
});
app.patch('/api/admin/services/:id/toggle', authenticateToken, isAdmin, async (req, res) => {
    const { id } = req.params;
    const { is_active } = req.body;
    const { data: updatedService, error } = await supabase.from('services').update({ is_active }).eq('id', id).select().single();
    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true, service: updatedService });
});
app.get('/api/admin/dye-colors', authenticateToken, isAdmin, async (req, res) => { const { data: dyeColors } = await supabase.from('dye_colors').select('*').order('name'); res.json(dyeColors || []); });

// ============ BARBER PERFORMANCE REPORT ============
app.get('/api/admin/barber-performance', authenticateToken, isAdmin, async (req, res) => {
    try {
        const { data: completedServices } = await supabase.from('queue_status').select('barber_station, customer_name, service_name, actual_start_time, completed_at, created_at').eq('status', 'completed').not('barber_station', 'is', null).order('completed_at', { ascending: false });
        const barberNames = { 1: 'Michael (Station 1)', 2: 'Thabo (Station 2)', 3: 'James (Station 3)' };
        const barberStats = {};
        for (let i = 1; i <= 3; i++) {
            const barberServices = completedServices?.filter(s => s.barber_station === i) || [];
            const totalServices = barberServices.length;
            let totalMinutes = 0, validServices = 0;
            barberServices.forEach(service => {
                const startTime = service.actual_start_time || service.created_at, endTime = service.completed_at;
                if (startTime && endTime) {
                    const minutes = (new Date(endTime) - new Date(startTime)) / 60000;
                    if (minutes > 0 && minutes < 180) { totalMinutes += minutes; validServices++; }
                }
            });
            const avgTime = validServices > 0 ? Math.round(totalMinutes / validServices) : 0;
            const recentServices = barberServices.slice(0,5).map(s => {
                const startTime = s.actual_start_time || s.created_at;
                let duration = 0;
                if (startTime && s.completed_at) duration = Math.round((new Date(s.completed_at) - new Date(startTime)) / 60000);
                return { customer: s.customer_name, service: s.service_name || 'Haircut', date: s.completed_at ? new Date(s.completed_at).toLocaleDateString('en-ZA') : 'Unknown', duration };
            });
            barberStats[i] = { barber_name: barberNames[i], total_services: totalServices, avg_service_time_min: avgTime, recent_services: recentServices };
        }
        res.json(barberStats);
    } catch (err) { console.error(err); res.status(500).json({ error: err.message }); }
});

// ============ BACKUP ============
app.post('/api/admin/backup', authenticateToken, isAdmin, async (req, res) => {
    const timestamp = getSASTISOString().slice(0,19).replace(/:/g, '-');
    const filename = `backup_${timestamp}.json`;
    const backupPath = path.join(__dirname, 'backups', filename);
    if (!fs.existsSync(path.join(__dirname, 'backups'))) fs.mkdirSync(path.join(__dirname, 'backups'));
    try {
        const tables = ['users', 'appointments', 'services', 'reviews', 'chat_messages', 'queue_status', 'iot_sensors', 'audit_logs'];
        let backupData = {};
        for (const table of tables) { const { data } = await supabase.from(table).select('*'); backupData[table] = data; }
        fs.writeFileSync(backupPath, JSON.stringify(backupData, null, 2));
        const stats = fs.statSync(backupPath);
        await supabase.from('backup_logs').insert([{ backup_name: filename, backup_size: stats.size, status: 'success' }]);
        await logAudit(req.user.id, req.user.email, 'CREATE_BACKUP', `Created backup: ${filename}`, req);
        res.json({ success: true, filename, size: stats.size });
    } catch (err) { await supabase.from('backup_logs').insert([{ backup_name: filename, status: 'failed', error_message: err.message }]); res.status(500).json({ error: 'Backup failed' }); }
});
app.get('/api/admin/backups', authenticateToken, isAdmin, async (req, res) => { const { data: backups } = await supabase.from('backup_logs').select('*').order('created_at', { ascending: false }).limit(20); res.json(backups || []); });

// ============ FORGOT PASSWORD ============
const resetTokens = new Map();
app.post('/api/forgot-password', async (req, res) => {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Email is required' });
    const { data: users } = await supabase.from('users').select('*').eq('email', email);
    if (!users || users.length === 0) return res.status(404).json({ error: 'No account found' });
    const user = users[0];
    const resetToken = jwt.sign({ id: user.id, email: user.email, purpose: 'password_reset' }, process.env.JWT_SECRET || 'xclusive_secret', { expiresIn: '1h' });
    resetTokens.set(email, { token: resetToken, expires: Date.now() + 3600000 });
    res.json({ success: true, message: 'Reset link generated', demoToken: resetToken });
});
app.post('/api/reset-password', async (req, res) => {
    const { token, newPassword } = req.body;
    if (!token || !newPassword) return res.status(400).json({ error: 'Token and password required' });
    if (!isStrongPassword(newPassword)) return res.status(400).json({ error: 'Password must be at least 8 characters and include letters, numbers, and special characters' });
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'xclusive_secret');
        const storedToken = resetTokens.get(decoded.email);
        if (!storedToken || storedToken.token !== token) return res.status(400).json({ error: 'Invalid or expired reset link' });
        const hashedPassword = await bcrypt.hash(newPassword, 10);
        await supabase.from('users').update({ password: hashedPassword }).eq('id', decoded.id);
        resetTokens.delete(decoded.email);
        await logAudit(decoded.id, decoded.email, 'PASSWORD_RESET', 'Password reset successfully', req);
        res.json({ success: true, message: 'Password reset successfully!' });
    } catch (err) { return res.status(400).json({ error: 'Invalid or expired reset link' }); }
});

app.post('/api/clear-cookies', (req, res) => { res.clearCookie('token'); res.json({ success: true }); });
app.get('/barber.html', (req, res) => res.sendFile(path.join(__dirname, 'public', 'barber.html')));
app.get('/api/server-time', (req, res) => {
    const now = getSASTTime();
    res.json({ server_time_12h: now.toLocaleTimeString('en-US'), server_time_24h: getSASTTimeString(), server_date: getSASTDateString(), server_full_datetime: getSASTDateTimeForSQL(), timezone: 'Africa/Johannesburg (SAST)', timestamp: now.toISOString() });
});

startIoTSimulation();
setTimeout(() => { console.log('🚀 FORCING immediate sensor update...'); updateAllSensors(); }, 2000);

app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
app.get('/index.html', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
app.get('/login.html', (req, res) => res.sendFile(path.join(__dirname, 'public', 'login.html')));
app.get('/register.html', (req, res) => res.sendFile(path.join(__dirname, 'public', 'register.html')));
app.get('/services.html', (req, res) => res.sendFile(path.join(__dirname, 'public', 'services.html')));
app.get('/my-bookings.html', (req, res) => res.sendFile(path.join(__dirname, 'public', 'my-bookings.html')));
app.get('/admin.html', (req, res) => res.sendFile(path.join(__dirname, 'public', 'admin.html')));
app.get('/reviews.html', (req, res) => res.sendFile(path.join(__dirname, 'public', 'reviews.html')));
app.get('/scan.html', (req, res) => res.sendFile(path.join(__dirname, 'public', 'scan.html')));
app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

app.listen(PORT, '0.0.0.0', () => {
    console.log(`\n========================================`);
    console.log(`🚀 THE XCLUSIVE Barbershop Server`);
    console.log(`========================================`);
    console.log(`📍 Local access:    http://localhost:${PORT}`);
    console.log(`📱 Phone access:    http://192.168.15.191:${PORT}`);
    console.log(`========================================`);
    console.log(`📧 Admin Login:     admin@xclusive.com`);
    console.log(`🔑 Admin Password:  admin123`);
    console.log(`========================================`);
    console.log(`📡 QR Code Scanner Ready!`);
    console.log(`   • QR generation endpoint: /api/appointments/:id/generate-qr`);
    console.log(`   • Check-in endpoint: /api/check-in`);
    console.log(`   • Strong password enforcement (min 8 chars, letters, numbers, special chars)`);
    console.log(`   • Service image upload supported (JPEG/PNG/WEBP, max 5MB)`);
    console.log(`   • Barbers only serve customers assigned to them`);
    console.log(`   • Queue endpoint fixed (no more 500 errors)`);
    console.log(`========================================\n`);
});