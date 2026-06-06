// ============ API HELPER ============
const API_BASE = '/api';

function getToken() {
    return localStorage.getItem('token');
}

function getCurrentUser() {
    const user = localStorage.getItem('user');
    return user ? JSON.parse(user) : null;
}

function setAuth(token, user) {
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(user));
}

function clearAuth() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
}

function updateUserUI() {
    const user = getCurrentUser();
    const greeting = document.getElementById('userGreeting');
    const loginBtn = document.getElementById('loginBtn');
    const logoutBtn = document.getElementById('logoutBtn');
    const adminLink = document.getElementById('adminLink');
    
    if (user) {
        if (greeting) greeting.innerHTML = `<i class="fas fa-user-circle"></i> ${user.name}${user.role === 'admin' ? ' (Admin)' : ''}`;
        if (loginBtn) loginBtn.classList.add('hidden');
        if (logoutBtn) logoutBtn.classList.remove('hidden');
        if (adminLink && user.role === 'admin') adminLink.style.display = 'block';
    } else {
        if (greeting) greeting.innerHTML = '';
        if (loginBtn) loginBtn.classList.remove('hidden');
        if (logoutBtn) logoutBtn.classList.add('hidden');
        if (adminLink) adminLink.style.display = 'none';
    }
}

async function logout() {
    try {
        await fetch('/api/logout', { method: 'POST' });
    } catch (error) {
        console.error('Logout error:', error);
    }
    clearAuth();
    updateUserUI();
    window.location.href = 'index.html';
}

// ============ LOAD SERVICES ============
async function loadServices() {
    try {
        const response = await fetch(`${API_BASE}/services`);
        const data = await response.json();
        return { services: data.services, dyeColors: data.dyeColors };
    } catch (error) {
        console.error('Error loading services:', error);
        return { services: [], dyeColors: [] };
    }
}

// ============ LOAD MY BOOKINGS ============
async function loadMyBookings() {
    const token = getToken();
    if (!token) return [];
    
    try {
        const response = await fetch(`${API_BASE}/my-appointments`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        return await response.json();
    } catch (error) {
        console.error('Error loading bookings:', error);
        return [];
    }
}

// ============ BOOK APPOINTMENT ============
async function bookAppointment(serviceName, servicePrice, dyeColor, date, time) {
    const token = getToken();
    if (!token) {
        window.location.href = 'login.html';
        return false;
    }
    
    try {
        const response = await fetch(`${API_BASE}/appointments`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                service_name: serviceName,
                service_price: servicePrice,
                dye_color: dyeColor,
                appointment_date: date,
                appointment_time: time
            })
        });
        
        const data = await response.json();
        if (response.ok) {
            alert('✅ Appointment booked successfully!');
            return true;
        } else {
            alert('❌ ' + (data.error || 'Booking failed'));
            return false;
        }
    } catch (error) {
        console.error('Error booking:', error);
        alert('❌ Network error. Please try again.');
        return false;
    }
}

// ============ CANCEL APPOINTMENT ============
async function cancelAppointment(id) {
    if (!confirm('Are you sure you want to cancel this appointment?')) return false;
    
    const token = getToken();
    try {
        const response = await fetch(`${API_BASE}/appointments/${id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (response.ok) {
            alert('✅ Appointment cancelled');
            return true;
        } else {
            alert('❌ Failed to cancel');
            return false;
        }
    } catch (error) {
        console.error('Error:', error);
        return false;
    }
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
    updateUserUI();
});

// ============ FLOATING AI CHAT WIDGET ============

// Create chat widget HTML
function createChatWidget() {
    const chatWidgetHTML = `
        <div id="chatWidget" style="position: fixed; bottom: 20px; right: 20px; z-index: 9999;">
            <!-- Chat Button -->
            <div id="chatButton" style="
                width: 60px;
                height: 60px;
                background: linear-gradient(135deg, #d4af37 0%, #b8941a 100%);
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                cursor: pointer;
                box-shadow: 0 4px 15px rgba(0,0,0,0.3);
                transition: all 0.3s ease;
            ">
                <i class="fas fa-comment-dots" style="font-size: 28px; color: #0a0a0a;"></i>
            </div>
            
            <!-- Chat Window -->
            <div id="chatWindow" style="
                position: absolute;
                bottom: 80px;
                right: 0;
                width: 380px;
                height: 520px;
                background: #1a1a2e;
                border-radius: 20px;
                box-shadow: 0 10px 40px rgba(0,0,0,0.4);
                display: none;
                flex-direction: column;
                overflow: hidden;
                border: 1px solid rgba(212, 175, 55, 0.3);
                animation: slideUp 0.3s ease;
            ">
                <!-- Chat Header -->
                <div style="
                    background: linear-gradient(135deg, #0a0a0a 0%, #1a1a2e 100%);
                    padding: 15px;
                    border-bottom: 1px solid rgba(212, 175, 55, 0.3);
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                ">
                    <div>
                        <i class="fas fa-robot" style="color: #d4af37; margin-right: 8px;"></i>
                        <span style="font-weight: 600; color: white;">XCLUSIVE AI Assistant</span>
                        <div style="font-size: 10px; color: #22c55e; margin-top: 3px;">
                            <i class="fas fa-circle" style="font-size: 8px;"></i> Online • 24/7
                        </div>
                    </div>
                    <div>
                        <button id="clearChatBtn" style="
                            background: rgba(239,68,68,0.2);
                            border: none;
                            color: #ef4444;
                            padding: 5px 10px;
                            border-radius: 15px;
                            cursor: pointer;
                            font-size: 11px;
                            margin-right: 8px;
                        ">
                            <i class="fas fa-trash"></i> Clear
                        </button>
                        <button id="closeChatBtn" style="
                            background: none;
                            border: none;
                            color: #9ca3af;
                            cursor: pointer;
                            font-size: 18px;
                        ">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                </div>
                
                <!-- Chat Messages -->
                <div id="chatMessagesWidget" style="
                    flex: 1;
                    overflow-y: auto;
                    padding: 15px;
                    display: flex;
                    flex-direction: column;
                    gap: 10px;
                ">
                    <div class="welcome-placeholder" style="text-align: center; color: #9ca3af; padding: 20px;">
                        <i class="fas fa-comment-dots" style="font-size: 40px; margin-bottom: 10px; display: block;"></i>
                        <p>Hello! 👋 I'm your AI assistant.</p>
                        <p style="font-size: 12px;">Ask me about services, prices, booking, or location!</p>
                    </div>
                </div>
                
                <!-- Quick Questions -->
                <div style="
                    padding: 10px;
                    background: #0a0a0e;
                    border-top: 1px solid rgba(212, 175, 55, 0.1);
                    display: flex;
                    flex-wrap: wrap;
                    gap: 5px;
                ">
                    <button class="quickQuestionBtn" data-question="What services do you offer?" style="
                        background: rgba(212,175,55,0.15);
                        border: none;
                        color: #d4af37;
                        padding: 5px 12px;
                        border-radius: 20px;
                        font-size: 11px;
                        cursor: pointer;
                        transition: 0.2s;
                    ">✂️ Services</button>
                    <button class="quickQuestionBtn" data-question="How much do fades cost?" style="
                        background: rgba(212,175,55,0.15);
                        border: none;
                        color: #d4af37;
                        padding: 5px 12px;
                        border-radius: 20px;
                        font-size: 11px;
                        cursor: pointer;
                        transition: 0.2s;
                    ">💰 Prices</button>
                    <button class="quickQuestionBtn" data-question="How to book appointment?" style="
                        background: rgba(212,175,55,0.15);
                        border: none;
                        color: #d4af37;
                        padding: 5px 12px;
                        border-radius: 20px;
                        font-size: 11px;
                        cursor: pointer;
                        transition: 0.2s;
                    ">📅 Booking</button>
                    <button class="quickQuestionBtn" data-question="What are your opening hours?" style="
                        background: rgba(212,175,55,0.15);
                        border: none;
                        color: #d4af37;
                        padding: 5px 12px;
                        border-radius: 20px;
                        font-size: 11px;
                        cursor: pointer;
                        transition: 0.2s;
                    ">🕐 Hours</button>
                    <button class="quickQuestionBtn" data-question="Where is the shop located?" style="
                        background: rgba(212,175,55,0.15);
                        border: none;
                        color: #d4af37;
                        padding: 5px 12px;
                        border-radius: 20px;
                        font-size: 11px;
                        cursor: pointer;
                        transition: 0.2s;
                    ">📍 Location</button>
                    <button class="quickQuestionBtn" data-question="How to cancel appointment?" style="
                        background: rgba(212,175,55,0.15);
                        border: none;
                        color: #d4af37;
                        padding: 5px 12px;
                        border-radius: 20px;
                        font-size: 11px;
                        cursor: pointer;
                        transition: 0.2s;
                    ">❌ Cancel</button>
                    <button class="quickQuestionBtn" data-question="What dye colors are available?" style="
                        background: rgba(212,175,55,0.15);
                        border: none;
                        color: #d4af37;
                        padding: 5px 12px;
                        border-radius: 20px;
                        font-size: 11px;
                        cursor: pointer;
                        transition: 0.2s;
                    ">🎨 Dye</button>
                </div>
                
                <!-- Input Area -->
                <div style="
                    padding: 12px;
                    background: #0a0a0e;
                    border-top: 1px solid rgba(212, 175, 55, 0.1);
                    display: flex;
                    gap: 8px;
                ">
                    <input type="text" id="chatInputWidget" placeholder="Type your question..." style="
                        flex: 1;
                        padding: 10px 15px;
                        border: 1px solid rgba(212, 175, 55, 0.3);
                        border-radius: 25px;
                        background: #1a1a2e;
                        color: white;
                        font-size: 13px;
                        outline: none;
                    ">
                    <button id="sendChatBtn" style="
                        background: linear-gradient(135deg, #d4af37 0%, #b8941a 100%);
                        border: none;
                        padding: 10px 15px;
                        border-radius: 25px;
                        cursor: pointer;
                        font-weight: bold;
                        transition: 0.2s;
                    ">
                        <i class="fas fa-paper-plane"></i>
                    </button>
                </div>
            </div>
        </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', chatWidgetHTML);
    
    // Add styles
    const style = document.createElement('style');
    style.textContent = `
        @keyframes slideUp {
            from {
                opacity: 0;
                transform: translateY(20px);
            }
            to {
                opacity: 1;
                transform: translateY(0);
            }
        }
        
        @keyframes typing {
            0%, 60%, 100% { transform: translateY(0); opacity: 0.5; }
            30% { transform: translateY(-5px); opacity: 1; }
        }
        
        .message-widget {
            max-width: 85%;
            padding: 8px 12px;
            border-radius: 15px;
            font-size: 13px;
            animation: slideUp 0.2s ease;
        }
        
        .message-user-widget {
            background: linear-gradient(135deg, #d4af37 0%, #b8941a 100%);
            color: #0a0a0a;
            align-self: flex-end;
            border-bottom-right-radius: 5px;
        }
        
        .message-bot-widget {
            background: rgba(255, 255, 255, 0.1);
            color: white;
            align-self: flex-start;
            border-bottom-left-radius: 5px;
            border-left: 3px solid #d4af37;
        }
        
        .message-time-widget {
            font-size: 9px;
            margin-top: 4px;
            opacity: 0.6;
            text-align: right;
        }
        
        .typing-indicator-widget {
            display: flex;
            gap: 4px;
            padding: 8px 12px;
            background: rgba(255,255,255,0.05);
            border-radius: 15px;
            align-self: flex-start;
            border-bottom-left-radius: 5px;
        }
        
        .typing-dot-widget {
            width: 6px;
            height: 6px;
            background: #d4af37;
            border-radius: 50%;
            animation: typing 1.4s infinite;
        }
        
        .typing-dot-widget:nth-child(2) { animation-delay: 0.2s; }
        .typing-dot-widget:nth-child(3) { animation-delay: 0.4s; }
    `;
    document.head.appendChild(style);
}

// Chat widget functionality
let isWaitingForResponseWidget = false;

function formatTimeWidget() {
    const now = new Date();
    return now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function escapeHtmlWidget(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function addMessageWidget(name, message, type) {
    const container = document.getElementById('chatMessagesWidget');
    if (!container) return;
    
    const welcomeDiv = container.querySelector('.welcome-placeholder');
    if (welcomeDiv && (type === 'user' || type === 'bot')) {
        welcomeDiv.remove();
    }
    
    const messageDiv = document.createElement('div');
    messageDiv.className = `message-widget message-${type}-widget`;
    
    let icon = type === 'user' ? '<i class="fas fa-user" style="font-size: 10px; margin-right: 4px;"></i>' : '<i class="fas fa-robot" style="font-size: 10px; margin-right: 4px;"></i>';
    let displayName = type === 'user' ? name : 'XCLUSIVE Bot 🤖';
    
    messageDiv.innerHTML = `
        <div style="font-size: 10px; margin-bottom: 3px; opacity: 0.7;">${icon} ${displayName}</div>
        <div style="white-space: pre-line;">${escapeHtmlWidget(message)}</div>
        <div class="message-time-widget">${formatTimeWidget()}</div>
    `;
    
    container.appendChild(messageDiv);
    container.scrollTop = container.scrollHeight;
}

function showTypingIndicatorWidget() {
    const container = document.getElementById('chatMessagesWidget');
    if (!container) return;
    
    const typingDiv = document.createElement('div');
    typingDiv.className = 'typing-indicator-widget';
    typingDiv.id = 'typingIndicatorWidget';
    typingDiv.innerHTML = `
        <div class="typing-dot-widget"></div>
        <div class="typing-dot-widget"></div>
        <div class="typing-dot-widget"></div>
        <span style="margin-left: 8px; font-size: 11px;">AI is typing...</span>
    `;
    container.appendChild(typingDiv);
    container.scrollTop = container.scrollHeight;
}

function hideTypingIndicatorWidget() {
    const indicator = document.getElementById('typingIndicatorWidget');
    if (indicator) indicator.remove();
}

async function sendMessageWidget() {
    const user = getCurrentUser();
    if (!user) {
        alert('Please login to chat with us');
        return;
    }
    
    const input = document.getElementById('chatInputWidget');
    const message = input.value.trim();
    
    if (!message) return;
    if (isWaitingForResponseWidget) return;
    
    addMessageWidget(user.name, message, 'user');
    input.value = '';
    
    isWaitingForResponseWidget = true;
    showTypingIndicatorWidget();
    
    const token = getToken();
    try {
        const response = await fetch('/api/chat', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ message })
        });
        
        const data = await response.json();
        hideTypingIndicatorWidget();
        
        if (response.ok && data.botReply) {
            addMessageWidget('XCLUSIVE Bot', data.botReply, 'bot');
        } else if (response.ok) {
            addMessageWidget('XCLUSIVE Bot', 'Thank you for your message! I will assist you shortly.', 'bot');
        } else {
            addMessageWidget('XCLUSIVE Bot', 'Sorry, I encountered an error. Please try again.', 'bot');
        }
    } catch (error) {
        console.error('Error:', error);
        hideTypingIndicatorWidget();
        addMessageWidget('XCLUSIVE Bot', 'Network error. Please try again.', 'bot');
    }
    
    isWaitingForResponseWidget = false;
}

async function loadMessagesWidget() {
    const user = getCurrentUser();
    if (!user) return;
    
    const token = getToken();
    try {
        const response = await fetch('/api/chat', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const messages = await response.json();
        
        const container = document.getElementById('chatMessagesWidget');
        if (!container) return;
        
        const existingMessages = container.querySelectorAll('.message-widget');
        existingMessages.forEach(msg => msg.remove());
        
        if (messages.length === 0) {
            container.innerHTML = `
                <div class="welcome-placeholder" style="text-align: center; color: #9ca3af; padding: 20px;">
                    <i class="fas fa-comment-dots" style="font-size: 40px; margin-bottom: 10px; display: block;"></i>
                    <p>Hello! 👋 I'm your AI assistant.</p>
                    <p style="font-size: 12px;">Ask me about services, prices, booking, or location!</p>
                </div>
            `;
            return;
        }
        
        messages.forEach(msg => {
            let type = 'user';
            let name = msg.user_name;
            
            if (msg.is_admin_reply) {
                type = 'bot';
                name = 'XCLUSIVE Bot';
            } else {
                type = 'user';
            }
            
            addMessageWidget(name, msg.message, type);
        });
    } catch (error) {
        console.error('Error loading messages:', error);
    }
}

async function clearChatWidget() {
    const user = getCurrentUser();
    if (!user) {
        alert('Please login first');
        return;
    }
    
    if (!confirm('Clear all chat messages? This cannot be undone.')) return;
    
    const token = getToken();
    try {
        const response = await fetch('/api/chat/clear', {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (response.ok) {
            const container = document.getElementById('chatMessagesWidget');
            container.innerHTML = `
                <div class="welcome-placeholder" style="text-align: center; color: #9ca3af; padding: 20px;">
                    <i class="fas fa-comment-dots" style="font-size: 40px; margin-bottom: 10px; display: block;"></i>
                    <p>Chat cleared! ✨ Ask me anything!</p>
                </div>
            `;
            alert('✅ Chat history cleared!');
        } else {
            alert('❌ Failed to clear chat');
        }
    } catch (error) {
        alert('❌ Network error');
    }
}

// Initialize chat widget
function initChatWidget() {
    createChatWidget();
    
    const chatButton = document.getElementById('chatButton');
    const chatWindow = document.getElementById('chatWindow');
    const closeChatBtn = document.getElementById('closeChatBtn');
    const clearChatBtn = document.getElementById('clearChatBtn');
    const sendBtn = document.getElementById('sendChatBtn');
    const chatInput = document.getElementById('chatInputWidget');
    
    if (chatButton) {
        chatButton.addEventListener('click', () => {
            if (chatWindow.style.display === 'flex') {
                chatWindow.style.display = 'none';
            } else {
                chatWindow.style.display = 'flex';
                loadMessagesWidget();
            }
        });
    }
    
    if (closeChatBtn) {
        closeChatBtn.addEventListener('click', () => {
            chatWindow.style.display = 'none';
        });
    }
    
    if (clearChatBtn) {
        clearChatBtn.addEventListener('click', clearChatWidget);
    }
    
    if (sendBtn) {
        sendBtn.addEventListener('click', sendMessageWidget);
    }
    
    if (chatInput) {
        chatInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') sendMessageWidget();
        });
    }
    
    document.querySelectorAll('.quickQuestionBtn').forEach(btn => {
        btn.addEventListener('click', () => {
            const question = btn.getAttribute('data-question');
            const input = document.getElementById('chatInputWidget');
            if (input) {
                input.value = question;
                sendMessageWidget();
            }
        });
    });
}

// Initialize chat widget on page load
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initChatWidget);
} else {
    initChatWidget();
}