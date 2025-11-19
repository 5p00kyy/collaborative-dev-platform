# Collaborative Development Platform

A Git-like project management and collaboration platform built for developers. Manage multiple projects, collaborate in real-time, and maintain code consistency with intelligent self-learning rules.

## Features

### Core Functionality
- **Project Management**: Organize and track multiple projects with comprehensive status management
- **Real-Time Collaboration**: WebSocket-based collaborative editing with presence awareness
- **Version Control**: Git-like fork/merge workflow with approval process
- **Knowledge Base**: Markdown-powered notes with version history
- **Ticket System**: Track bugs, features, tasks, and ideas
- **Self-Learning Rules**: AI-powered code structure suggestions based on your coding patterns
- **Secure Credentials**: Encrypted storage for API keys and credentials

### Technical Highlights
- Bootstrap 5 + Vanilla JavaScript (no heavy frameworks)
- Node.js/Express backend
- PostgreSQL database
- Redis for caching and real-time features
- WebSocket support for live collaboration
- Cloud storage integration (AWS S3, Azure Blob, GCP)

## Quick Start

### Prerequisites
- Node.js >= 18.0.0
- PostgreSQL >= 14
- Redis >= 6.0
- npm >= 9.0.0

### Installation

1. **Clone the repository**
   ```bash
   git clone <your-repo-url>
   cd platform
   ```

2. **Install backend dependencies**
   ```bash
   cd backend
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

4. **Create database**
   ```bash
   createdb platform_db
   psql -U postgres -d platform_db -f ../database/schema.sql
   ```

5. **Start Redis**
   ```bash
   redis-server
   ```

6. **Run the backend**
   ```bash
   npm run dev
   ```

7. **Serve the frontend**
   ```bash
   # Use any static file server, for example:
   cd ../frontend
   python -m http.server 8080
   # Or use Live Server extension in VS Code
   ```

8. **Access the application**
   - Frontend: http://localhost:8080
   - Backend API: http://localhost:3000
   - Health check: http://localhost:3000/health

## Project Structure

```
platform/
├── backend/                 # Node.js backend
│   ├── src/
│   │   ├── config/         # Configuration files
│   │   ├── middleware/     # Express middleware
│   │   ├── models/         # Database models
│   │   ├── controllers/    # Request handlers
│   │   ├── services/       # Business logic
│   │   ├── websocket/      # WebSocket server
│   │   ├── utils/          # Utility functions
│   │   └── routes/         # API routes
│   ├── tests/              # Test files
│   └── server.js           # Entry point
├── frontend/               # Bootstrap 5 + Vanilla JS
│   ├── assets/
│   │   ├── css/           # Stylesheets
│   │   └── js/            # JavaScript files
│   ├── pages/             # HTML pages
│   └── components/        # Reusable components
├── database/              # Database files
│   ├── migrations/        # Schema migrations
│   └── seeds/            # Sample data
├── docs/                 # Documentation
└── docker/              # Docker configuration
```

## Development Roadmap

### Phase 1: Foundation (Weeks 1-10) ✓ In Progress
- [x] Project setup and infrastructure
- [ ] User authentication system
- [ ] Core project management
- [ ] Basic ticket system
- [ ] Simple note-taking

### Phase 2: Collaboration (Weeks 11-20)
- [ ] Real-time sync
- [ ] Fork/merge workflow
- [ ] Version history
- [ ] Multi-user collaboration

### Phase 3: Self-Learning Rules (Weeks 21-32)
- [ ] Pattern detection engine
- [ ] Rule generation
- [ ] Code validation
- [ ] Auto-fix capabilities

### Phase 4: Advanced Features (Weeks 33-42)
- [ ] Asset management
- [ ] Credential management
- [ ] Analytics dashboard
- [ ] External integrations

## API Documentation

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - User login
- `POST /api/auth/logout` - User logout
- `POST /api/auth/refresh` - Refresh access token

### Projects
- `GET /api/projects` - List all projects
- `POST /api/projects` - Create new project
- `GET /api/projects/:id` - Get project details
- `PUT /api/projects/:id` - Update project
- `DELETE /api/projects/:id` - Delete project

### Notes
- `GET /api/notes` - List notes
- `POST /api/notes` - Create note
- `GET /api/notes/:id` - Get note
- `PUT /api/notes/:id` - Update note
- `DELETE /api/notes/:id` - Delete note

### Tickets
- `GET /api/tickets` - List tickets
- `POST /api/tickets` - Create ticket
- `GET /api/tickets/:id` - Get ticket
- `PUT /api/tickets/:id` - Update ticket
- `DELETE /api/tickets/:id` - Delete ticket

See full API documentation in `docs/API.md`

## Architecture

See detailed architecture documentation in `docs/ARCHITECTURE.md`

### Key Technologies
- **Frontend**: Bootstrap 5, Vanilla JavaScript, WebSockets
- **Backend**: Node.js, Express, JWT authentication
- **Database**: PostgreSQL with JSONB support
- **Cache**: Redis for sessions and real-time state
- **Storage**: Cloud storage (S3/Azure/GCP)

## Contributing

This is currently in active development. Contributions welcome!

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'feat: add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

MIT License - see LICENSE file for details

## Support

For issues, questions, or suggestions, please open an issue on GitHub.

---

**Built with ❤️ for developers, by developers**
