# Mzansi Prolife Backend API

Backend server for Mzansi Prolife Development Institute NPC website.

## 🚀 Quick Start

### 1. Install Dependencies
```bash
cd backend
npm install
```

### 2. Set Up Environment Variables
Create a `.env` file in the `backend` directory:
```env
PORT=5000
NODE_ENV=development
MONGODB_URI=mongodb://localhost:27017/mzansi-prolife
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
FRONTEND_URL=http://localhost:5173
```

### 3. Start MongoDB
Make sure MongoDB is running:
- **Local MongoDB**: `mongod` (if installed locally)
- **MongoDB Atlas**: Use the connection string in `.env`

### 4. Run the Server
```bash
# Development mode (with auto-reload)
npm run dev

# Production mode
npm start
```

The server will start on `http://localhost:5000`

## 📡 API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login user
- `GET /api/auth/me` - Get current user
- `PUT /api/auth/profile` - Update user profile

### Submissions
- `POST /api/submissions` - Create submission (Protected)
- `GET /api/submissions` - Get user's submissions (Protected)
- `GET /api/submissions/:id` - Get single submission (Protected)
- `PUT /api/submissions/:id` - Update submission (Protected)

### Admin
- `GET /api/admin/stats` - Get dashboard statistics (Admin)
- `GET /api/admin/submissions` - Get all submissions (Admin)
- `GET /api/admin/submissions/:id` - Get submission (Admin)
- `PUT /api/admin/submissions/:id` - Update submission (Admin)
- `GET /api/admin/conversations` - Get chat conversations (Admin)

### Chat
- `POST /api/chat/conversations` - Create/get conversation (Protected)
- `POST /api/chat/messages` - Add message (Protected)
- `GET /api/chat/conversations/:sessionId` - Get conversation (Protected)

### Health
- `GET /api/health` - Health check

## 🔐 Authentication

All protected routes require a JWT token in the Authorization header:
```
Authorization: Bearer <token>
```

## 📊 Database Models

### User
- name, email, phone, password
- role (user/admin)
- timestamps

### Submission
- submission_type, reference_number, status
- All form fields
- user reference
- timestamps

### ChatConversation
- session_id, messages
- user reference
- status, escalated
- timestamps

## 🛠️ Development

### Create Admin User
You can create an admin user by updating the role in MongoDB:
```javascript
db.users.updateOne(
  { email: "admin@example.com" },
  { $set: { role: "admin" } }
)
```

Or create one via the API and update in database.

## 📝 Notes

- JWT tokens expire in 30 days
- Passwords are hashed with bcrypt
- All user inputs are validated
- CORS is configured for frontend URL
- Error handling middleware included

## 🔒 Security

- Passwords are hashed (bcrypt)
- JWT tokens for authentication
- Input validation with express-validator
- CORS protection
- Environment variables for secrets

## 📦 Dependencies

- **express** - Web framework
- **mongoose** - MongoDB ODM
- **bcryptjs** - Password hashing
- **jsonwebtoken** - JWT tokens
- **express-validator** - Input validation
- **cors** - CORS middleware
- **dotenv** - Environment variables

