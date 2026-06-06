// ============ FLOATING CHAT WIDGET ============

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
                width: 350px;
                height: 500px;
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
                
                <!-- Quick Questions (FIXED: Prices button now asks about prices) -->
                <div style="
                    padding: 10px;
                    background: #0a0a0e;
                    border-top: 1px solid rgba(212, 175, 55, 0.1);
                    display: flex;
                    flex-wrap: wrap;
                    gap: 5px;
                ">
                    <button class="quickQuestionBtn" data-question="What are your prices?" style="
                        background: rgba(212,175,55,0.15);
                        border: none;
                        color: #d4af37;
                        padding: 4px 10px;
                        border-radius: 15px;
                        font-size: 10px;
                        cursor: pointer;
                    ">💰 Prices</button>
                    <button class="quickQuestionBtn" data-question="How to book appointment?" style="
                        background: rgba(212,175,55,0.15);
                        border: none;
                        color: #d4af37;
                        padding: 4px 10px;
                        border-radius: 15px;
                        font-size: 10px;
                        cursor: pointer;
                    ">📅 Booking</button>
                    <button class="quickQuestionBtn" data-question="What are your opening hours?" style="
                        background: rgba(212,175,55,0.15);
                        border: none;
                        color: #d4af37;
                        padding: 4px 10px;
                        border-radius: 15px;
                        font-size: 10px;
                        cursor: pointer;
                    ">🕐 Hours</button>
                    <button class="quickQuestionBtn" data-question="Where is the shop located?" style="
                        background: rgba(212,175,55,0.15);
                        border: none;
                        color: #d4af37;
                        padding: 4px 10px;
                        border-radius: 15px;
                        font-size: 10px;
                        cursor: pointer;
                    ">📍 Location</button>
                    <button class="quickQuestionBtn" data-question="How to cancel appointment?" style="
                        background: rgba(212,175,55,0.15);
                        border: none;
                        color: #d4af37;
                        padding: 4px 10px;
                        border-radius: 15px;
                        font-size: 10px;
                        cursor: pointer;
                    ">❌ Cancel</button>
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
                        padding: 10px;
                        border: 1px solid rgba(212, 175, 55, 0.3);
                        border-radius: 25px;
                        background: #1a1a2e;
                        color: white;
                        font-size: 13px;
                    ">
                    <button id="sendChatBtn" style="
                        background: linear-gradient(135deg, #d4af37 0%, #b8941a 100%);
                        border: none;
                        padding: 10px 15px;
                        border-radius: 25px;
                        cursor: pointer;
                        font-weight: bold;
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
        
        .scrollbar-widget::-webkit-scrollbar {
            width: 4px;
        }
        
        .scrollbar-widget::-webkit-scrollbar-track {
            background: #1a1a2e;
        }
        
        .scrollbar-widget::-webkit-scrollbar-thumb {
            background: #d4af37;
            border-radius: 10px;
        }
    `;
    document.head.appendChild(style);
}

// Chat widget functionality
let chatWidgetVisible = false;
let isWaitingForChatResponse = false;

function formatChatTime() {
    const now = new Date();
    return now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function escapeChatHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function addChatMessage(name, message, type) {
    const container = document.getElementById('chatMessagesWidget');
    if (!container) return;
    
    // Remove welcome message if it's the first real message
    const welcomeDiv = container.querySelector('.welcome-placeholder');
    if (welcomeDiv && (type === 'user' || type === 'bot')) {
        welcomeDiv.remove();
    }
    
    const messageDiv = document.createElement('div');
    messageDiv.className = `message-widget message-${type}-widget`;
    
    let displayName = type === 'user' ? name : 'XCLUSIVE Bot 🤖';
    let icon = type === 'user' ? '<i class="fas fa-user" style="font-size: 10px; margin-right: 4px;"></i>' : '<i class="fas fa-robot" style="font-size: 10px; margin-right: 4px;"></i>';
    
    messageDiv.innerHTML = `
        <div style="font-size: 10px; margin-bottom: 3px; opacity: 0.7;">${icon} ${displayName}</div>
        <div style="white-space: pre-line;">${escapeChatHtml(message)}</div>
        <div class="message-time-widget">${formatChatTime()}</div>
    `;
    
    container.appendChild(messageDiv);
    container.scrollTop = container.scrollHeight;
}

function showTypingIndicator() {
    const container = document.getElementById('chatMessagesWidget');
    if (!container) return;
    
    // Remove existing typing indicator
    hideTypingIndicator();
    
    const typingDiv = document.createElement('div');
    typingDiv.className = 'typing-indicator-widget';
    typingDiv.id = 'chatTypingIndicator';
    typingDiv.innerHTML = `
        <div class="typing-dot-widget"></div>
        <div class="typing-dot-widget"></div>
        <div class="typing-dot-widget"></div>
        <span style="margin-left: 8px; font-size: 11px;">AI is typing...</span>
    `;
    container.appendChild(typingDiv);
    container.scrollTop = container.scrollHeight;
}

function hideTypingIndicator() {
    const indicator = document.getElementById('chatTypingIndicator');
    if (indicator) indicator.remove();
}

async function sendChatMessage() {
    const user = typeof getCurrentUser === 'function' ? getCurrentUser() : null;
    if (!user) {
        alert('Please login to chat with us');
        window.location.href = 'login.html';
        return;
    }
    
    const input = document.getElementById('chatInputWidget');
    const message = input.value.trim();
    
    if (!message) return;
    if (isWaitingForChatResponse) return;
    
    addChatMessage(user.name, message, 'user');
    input.value = '';
    
    isWaitingForChatResponse = true;
    showTypingIndicator();
    
    const token = typeof getToken === 'function' ? getToken() : null;
    try {
        const response = await fetch('/api/chat', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...(token && { 'Authorization': `Bearer ${token}` })
            },
            body: JSON.stringify({ message })
        });
        
        const data = await response.json();
        hideTypingIndicator();
        
        if (response.ok && data.botReply) {
            addChatMessage('XCLUSIVE Bot', data.botReply, 'bot');
        } else {
            addChatMessage('XCLUSIVE Bot', 'Sorry, I encountered an error. Please try again.', 'bot');
        }
    } catch (error) {
        console.error('Error:', error);
        hideTypingIndicator();
        addChatMessage('XCLUSIVE Bot', 'Network error. Please try again.', 'bot');
    }
    
    isWaitingForChatResponse = false;
}

async function loadChatMessages() {
    const user = typeof getCurrentUser === 'function' ? getCurrentUser() : null;
    if (!user) return;
    
    const token = typeof getToken === 'function' ? getToken() : null;
    if (!token) return;
    
    try {
        const response = await fetch('/api/chat', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const messages = await response.json();
        
        const container = document.getElementById('chatMessagesWidget');
        if (!container) return;
        
        // Clear existing messages but keep welcome if no messages
        const existingMessages = container.querySelectorAll('.message-widget');
        existingMessages.forEach(msg => msg.remove());
        
        const welcomeDiv = container.querySelector('.welcome-placeholder');
        
        if (!messages || messages.length === 0) {
            if (!welcomeDiv) {
                container.innerHTML = `
                    <div class="welcome-placeholder" style="text-align: center; color: #9ca3af; padding: 20px;">
                        <i class="fas fa-comment-dots" style="font-size: 40px; margin-bottom: 10px; display: block;"></i>
                        <p>Hello! 👋 I'm your AI assistant.</p>
                        <p style="font-size: 12px;">Ask me about services, prices, booking, or location!</p>
                    </div>
                `;
            }
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
            
            addChatMessage(name, msg.message, type);
        });
    } catch (error) {
        console.error('Error loading messages:', error);
    }
}

// Clear chat messages - UI only, no API call
function clearChatMessages() {
    const container = document.getElementById('chatMessagesWidget');
    if (!container) return;
    
    // Clear all messages
    const existingMessages = container.querySelectorAll('.message-widget');
    existingMessages.forEach(msg => msg.remove());
    
    // Reset to welcome message
    container.innerHTML = `
        <div class="welcome-placeholder" style="text-align: center; color: #9ca3af; padding: 20px;">
            <i class="fas fa-comment-dots" style="font-size: 40px; margin-bottom: 10px; display: block;"></i>
            <p>Chat cleared! ✨ Ask me anything!</p>
            <p style="font-size: 12px;">Ask me about services, prices, booking, or location!</p>
        </div>
    `;
}

// Initialize chat widget
function initChatWidget() {
    // Check if already initialized
    if (document.getElementById('chatWidget')) return;
    
    createChatWidget();
    
    // Event listeners
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
                loadChatMessages();
            }
        });
    }
    
    if (closeChatBtn) {
        closeChatBtn.addEventListener('click', () => {
            chatWindow.style.display = 'none';
        });
    }
    
    if (clearChatBtn) {
        clearChatBtn.addEventListener('click', clearChatMessages);
    }
    
    if (sendBtn) {
        sendBtn.addEventListener('click', sendChatMessage);
    }
    
    if (chatInput) {
        chatInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') sendChatMessage();
        });
    }
    
    // Quick question buttons - use event delegation
    document.addEventListener('click', (e) => {
        if (e.target.classList && e.target.classList.contains('quickQuestionBtn')) {
            const question = e.target.getAttribute('data-question');
            const input = document.getElementById('chatInputWidget');
            if (input) {
                input.value = question;
                sendChatMessage();
            }
        }
    });
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initChatWidget);
} else {
    setTimeout(initChatWidget, 100);
}