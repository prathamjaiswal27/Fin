# Expense Tracker

A web-based expense tracking application built with Streamlit and SQLite.

## Features

- Dashboard with financial overview
- Transaction management (add, view, delete)
- Multiple account support
- Category-based expense tracking
- Merchant tracking
- Visual analytics with charts
- Monthly summaries

## Installation

1. Install dependencies:
```bash
pip install -r requirements.txt
```

2. Run the application:
```bash
streamlit run app.py
```

## Default Login

- Email: test@example.com
- Password: password

## Database

The application uses SQLite with the following main tables:
- users
- accounts
- categories
- merchants
- transactions
- budgets

Sample data is automatically created on first run.

## Usage

Navigate through the sidebar to:
- View dashboard with financial summary
- Add new transactions
- Manage accounts and categories
- View analytics and reports
