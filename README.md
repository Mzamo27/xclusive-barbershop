# THE XCLUSIVE Barbershop - Digital Management System

## Project Overview
A complete digital management system for The Xclusive Barbershop that transforms manual operations into an efficient digital enterprise.

## Features

### 👥 User System
- User Registration & Login with JWT Authentication
- Cookie-based "Remember Me" functionality
- Password Reset via Email

### 💇 Appointment Booking
- Online appointment booking (24/7)
- Max 5 clients per time slot
- No double booking prevention
- Real-time availability check
- Edit/Cancel appointments

### 🎨 Service Management
- Professional haircut services including:
  - Fades (Low/Mid/High/Taper/Burst)
  - Dreadlocks (Installation/Retwist/Styling)
  - Beard grooming (Trim/Hot Towel)
  - Brush Cut & Blade Cut
- Custom hair dye options (Burgundy, Platinum Blonde, Black)
- Rotating service images

### 🤖 AI Chatbot
- 24/7 automated customer support
- Answers questions about services, prices, booking, location
- Smart keyword recognition

### ⭐ Reviews & Ratings
- Customer feedback system
- 5-star rating system
- Comment section

### 📊 Admin Dashboard
- Real-time statistics
- Manage all appointments
- User management
- Revenue tracking
- Status updates (Pending/Confirmed/Completed/Cancelled)

### 🔒 Security Features
- Password hashing (bcrypt)
- JWT tokens with cookies
- HTTPS-ready
- SQL injection prevention

## Tech Stack

| Technology | Purpose |
|------------|---------|
| **Node.js** | Backend runtime |
| **Express.js** | Web framework |
| **MySQL** | Database |
| **JWT** | Authentication |
| **bcrypt** | Password encryption |
| **HTML5/CSS3** | Frontend |
| **JavaScript** | Client-side logic |

## Installation

### Prerequisites
- Node.js (v14+)
- MySQL (v8+)
- npm or yarn

### Setup Instructions

1. **Clone the repository**
```bash
git clone https://github.com/YOUR_USERNAME/xclusive-barbershop.git
cd xclusive-barbershop