# 🎬 YouTube Watch Party

A real-time collaborative YouTube watching experience with synchronized playback, live chat, and role-based access control.

![Tech Stack](https://img.shields.io/badge/React-18-61DAFB?style=flat-square&logo=react)
![Tech Stack](https://img.shields.io/badge/Node.js-Express-339933?style=flat-square&logo=node.js)
![Tech Stack](https://img.shields.io/badge/Socket.IO-4.7-010101?style=flat-square&logo=socket.io)
![Tech Stack](https://img.shields.io/badge/MongoDB-Mongoose-47A248?style=flat-square&logo=mongodb)

---

## ✨ Features

- **Real-time Video Sync** — Play, pause, and seek synced across all participants
- **Live Chat** — Instant messaging within watch party rooms
- **Role-Based Access Control (RBAC)** — 5 roles: Admin, Host, Moderator, Participant, Viewer
- **Room Management** — Create, join, and share rooms via unique codes
- **Host Transfer** — Seamlessly transfer host privileges
- **Kick/Mute** — Moderators and admins can manage participants
- **Premium Dark UI** — Glassmorphism design with smooth animations

---

## 🏗️ Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18 + Vite |
| Backend | Node.js + Express |
| Real-time | Socket.IO |
| Database | MongoDB + Mongoose |
| Auth | JWT (JSON Web Tokens) |
| Styling | Custom CSS (Glassmorphism) |

---

## 🚀 Quick Start (3 Steps)

### Prerequisites
- **Node.js** v18+ installed ([download](https://nodejs.org))
- **MongoDB Atlas** free account ([signup](https://www.mongodb.com/cloud/atlas/register))

### Step 1: Setup MongoDB Atlas (2 minutes)
1. Go to [MongoDB Atlas](https://www.mongodb.com/cloud/atlas)
2. Create a free cluster
3. Create a database user (remember username/password)
4. Go to Network Access → Add `0.0.0.0/0` (allow from anywhere)
5. Go to Clusters → Connect → Get connection string

### Step 2: Setup & Run Server
```bash
cd server
cp .env.example .env
# Edit .env and paste your MongoDB connection string
npm install
npm run dev
```

Your `.env` should look like:
```
MONGO_URI=mongodb+srv://youruser:yourpass@cluster0.xxxxx.mongodb.net/watchparty?retryWrites=true&w=majority
JWT_SECRET=my_super_secret_key_123
PORT=5000
CLIENT_URL=http://localhost:5173
```

### Step 3: Setup & Run Client
```bash
cd client
npm install
npm run dev
```

### 🎉 Done!
- Frontend: http://localhost:5173
- Backend: http://localhost:5000
- API Health: http://localhost:5000/api/health

---

## 📋 API Endpoints

### Auth
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/register` | Register new user |
| POST | `/api/auth/login` | Login user |
| GET | `/api/auth/me` | Get current user |

### Rooms
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/rooms` | Create room |
| GET | `/api/rooms` | List active rooms |
| GET | `/api/rooms/:code` | Get room details |
| POST | `/api/rooms/:code/join` | Join room |
| POST | `/api/rooms/:code/leave` | Leave room |
| PUT | `/api/rooms/:code/role` | Change user role |
| DELETE | `/api/rooms/:code/kick/:userId` | Kick user |
| PUT | `/api/rooms/:code/video` | Update video |
| POST | `/api/rooms/:code/transfer-host` | Transfer host |

### WebSocket Events
| Event | Direction | Description |
|-------|-----------|-------------|
| `join-room` | Client → Server | Join a room |
| `leave-room` | Client → Server | Leave a room |
| `video-state-change` | Bidirectional | Sync video state |
| `send-message` | Client → Server | Send chat message |
| `chat-message` | Server → Client | Receive message |
| `user-joined` | Server → Client | User joined notification |
| `user-left` | Server → Client | User left notification |
| `sync-request` | Client → Server | Request video sync |
| `sync-response` | Server → Client | Receive video sync |

---

## 🔐 Role-Based Access Control

| Role | Permissions |
|------|------------|
| **Admin** | Full control — manage rooms, kick users, assign roles |
| **Host** | Play/pause, seek, change video, manage participants |
| **Moderator** | Mute/kick users, moderate chat |
| **Participant** | Watch video, send chat messages |
| **Viewer** | Watch only (read-only) |

---

## 📁 Project Structure

```
youtube-watch-party/
├── client/                    # React Frontend
│   ├── public/
│   ├── src/
│   │   ├── components/
│   │   │   ├── Chat.jsx
│   │   │   ├── Navbar.jsx
│   │   │   ├── ParticipantList.jsx
│   │   │   └── VideoPlayer.jsx
│   │   ├── context/
│   │   │   └── AuthContext.jsx
│   │   ├── pages/
│   │   │   ├── Home.jsx
│   │   │   ├── Login.jsx
│   │   │   ├── Register.jsx
│   │   │   └── Room.jsx
│   │   ├── App.jsx
│   │   ├── index.css
│   │   ├── main.jsx
│   │   └── socket.js
│   ├── index.html
│   ├── package.json
│   └── vite.config.js
│
├── server/                    # Node.js Backend
│   ├── middleware/
│   │   └── auth.js
│   ├── models/
│   │   ├── Message.js
│   │   ├── Room.js
│   │   └── User.js
│   ├── routes/
│   │   ├── auth.js
│   │   └── rooms.js
│   ├── socket/
│   │   └── index.js
│   ├── .env.example
│   ├── index.js
│   └── package.json
│
└── README.md
```

---

## 🎨 Design Philosophy

- **Glassmorphism** — Frosted glass effects with backdrop blur
- **Dark Mode** — Easy on the eyes for extended watch sessions
- **Gradient Accents** — Purple → Cyan gradient for interactive elements
- **Micro-animations** — Smooth transitions for a premium feel
- **Responsive** — Works on desktop and mobile

---

## 📄 License

MIT License — Built for internship assessment.
