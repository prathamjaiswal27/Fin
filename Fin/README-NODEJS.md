# Expense Tracker - Enhanced Node.js UI

A modern, responsive web interface for the Expense Tracker application built with Node.js, Express, and vanilla JavaScript.

## Features

✨ **Modern UI/UX**
- Clean, responsive design that works on all devices
- Smooth animations and transitions
- Interactive charts using Chart.js
- Intuitive navigation

📊 **Dashboard**
- Real-time financial overview
- Visual spending analytics
- Account balance summaries
- Recent transaction feed

💰 **Transaction Management**
- Add, view, and delete transactions
- Filter by type (income/expense/transfer)
- Category and merchant tracking
- Date-based organization

🏦 **Account Management**
- Multiple account support
- Real-time balance tracking
- Support for various account types

📈 **Analytics**
- Custom date range analysis
- Spending by category breakdown
- Daily spending trends
- Top merchants report

## Installation

1. **Install Node.js dependencies:**
```bash
npm install
```

2. **Start the server:**
```bash
npm start
```

3. **Open your browser:**
Navigate to `http://localhost:3001`

## Development

For development with auto-reload:
```bash
npm run dev
```

## Tech Stack

- **Backend:** Node.js + Express
- **Database:** SQLite (better-sqlite3)
- **Frontend:** Vanilla JavaScript
- **Charts:** Chart.js
- **Icons:** Font Awesome
- **Styling:** Custom CSS with modern design

## API Endpoints

- `GET /api/dashboard` - Dashboard summary
- `GET /api/transactions` - List transactions
- `POST /api/transactions` - Add transaction
- `DELETE /api/transactions/:id` - Delete transaction
- `GET /api/accounts` - List accounts
- `POST /api/accounts` - Add account
- `GET /api/categories` - List categories
- `POST /api/categories` - Add category
- `GET /api/merchants` - List merchants
- `GET /api/analytics` - Analytics data

## Project Structure

```
├── server.js           # Express server & API routes
├── package.json        # Node.js dependencies
├── public/
│   ├── index.html     # Main HTML file
│   ├── styles.css     # Styling
│   └── app.js         # Frontend JavaScript
└── budgeting.db       # SQLite database
```

## Browser Support

- Chrome (latest)
- Firefox (latest)
- Safari (latest)
- Edge (latest)

## Notes

- The app uses the existing SQLite database from the Python version
- Default user ID is set to 1 (test@example.com)
- All transactions are automatically reflected in account balances
