# Agent Guidelines for Collaborative Dev Platform

## Build/Test Commands
- `cd backend && npm install` - Install backend dependencies
- `npm start` - Start production server (from backend/)
- `npm run dev` - Start development server with nodemon (from backend/)
- `npm test` - Run all tests with coverage (from backend/)
- `npm test -- path/to/test.js` - Run single test file
- `psql -U postgres -d platform_db -f database/schema.sql` - Initialize database

## Code Style
- **Imports**: CommonJS (require/module.exports), group by: external → internal configs → routes/models → utils
- **Formatting**: 2-space indent, single quotes, semicolons required, max 100 char line length
- **Naming**: camelCase (variables/functions), PascalCase (classes), UPPER_SNAKE_CASE (constants), kebab-case (files)
- **Error Handling**: Always use try-catch for async, return structured JSON `{success, message, data}`, log errors with context
- **API Routes**: RESTful conventions, use Express Router, validate inputs with express-validator
- **Database**: Use parameterized queries via pool.query(), wrap multi-step ops in transactions
- **Frontend**: Vanilla JS + Bootstrap 5, no frameworks, use AppState for global state, apiRequest() for all API calls
- **Comments**: JSDoc for functions, section dividers with `// ======`, explain why not what
- **Security**: Use helmet, validate/sanitize inputs, bcrypt for passwords, JWT for auth, never commit secrets
