import sqlite3
from contextlib import contextmanager
from datetime import datetime, date
import bcrypt

DB_NAME = "budgeting.db"

@contextmanager
def get_db():
    conn = sqlite3.connect(DB_NAME)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()

def init_db():
    with get_db() as conn:
        with open('schema.sql', 'r') as f:
            conn.executescript(f.read())
        
        # Check if test user exists
        cursor = conn.execute("SELECT user_id FROM users WHERE email = ?", ('test@example.com',))
        if not cursor.fetchone():
            # Insert sample data
            password_hash = bcrypt.hashpw('password'.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
            cursor = conn.execute(
                "INSERT INTO users (email, full_name, password_hash) VALUES (?, ?, ?)",
                ('test@example.com', 'Test User', password_hash)
            )
            user_id = cursor.lastrowid
            
            # Insert sample categories
            categories = [
                (user_id, 'Groceries', 'expense'),
                (user_id, 'Salary', 'income'),
                (user_id, 'Rent', 'expense'),
                (user_id, 'Utilities', 'expense'),
                (user_id, 'Entertainment', 'expense'),
                (user_id, 'Transportation', 'expense'),
                (user_id, 'Dining', 'expense'),
                (user_id, 'Shopping', 'expense'),
                (user_id, 'Healthcare', 'expense'),
                (user_id, 'Education', 'expense')
            ]
            conn.executemany("INSERT INTO categories (user_id, name, kind) VALUES (?, ?, ?)", categories)
            
            # Insert sample accounts
            accounts = [
                (user_id, 'Main Checking', 'checking', 5000.00, 'INR'),
                (user_id, 'Savings Account', 'savings', 15000.00, 'INR'),
                (user_id, 'Credit Card', 'credit_card', -1200.00, 'INR')
            ]
            conn.executemany(
                "INSERT INTO accounts (user_id, name, type, balance, currency) VALUES (?, ?, ?, ?, ?)",
                accounts
            )
            
            # Insert sample merchants
            merchants = [
                (user_id, 'Walmart'),
                (user_id, 'Amazon'),
                (user_id, 'Netflix'),
                (user_id, 'Electric Company'),
                (user_id, 'Local Supermarket'),
                (user_id, 'Gas Station'),
                (user_id, 'Restaurant'),
                (user_id, 'Pharmacy'),
                (user_id, 'Book Store'),
                (user_id, 'Employer Inc.')
            ]
            conn.executemany("INSERT INTO merchants (user_id, name) VALUES (?, ?)", merchants)
            
            # Insert sample transactions
            from datetime import datetime, timedelta
            today = datetime.now().date()
            
            transactions = [
                (user_id, 1, 1, 5, 'expense', 150.50, 'INR', today - timedelta(days=2), 'Weekly grocery shopping'),
                (user_id, 1, 7, 7, 'expense', 45.75, 'INR', today - timedelta(days=5), 'Dinner with friends'),
                (user_id, 1, 2, 10, 'income', 3500.00, 'INR', today - timedelta(days=10), 'Monthly salary'),
                (user_id, 1, 4, 4, 'expense', 120.00, 'INR', today - timedelta(days=15), 'Electric bill'),
                (user_id, 1, 5, 3, 'expense', 15.99, 'INR', today - timedelta(days=20), 'Netflix subscription'),
                (user_id, 1, 6, 6, 'expense', 35.25, 'INR', today - timedelta(days=22), 'Gas fill-up'),
                (user_id, 1, 8, 2, 'expense', 89.99, 'INR', today - timedelta(days=25), 'Amazon purchase'),
                (user_id, 1, 9, 8, 'expense', 28.50, 'INR', today - timedelta(days=28), 'Prescription refill'),
                (user_id, 1, 3, None, 'expense', 1200.00, 'INR', today - timedelta(days=30), 'Monthly rent'),
            ]
            
            conn.executemany("""
                INSERT INTO transactions 
                (user_id, account_id, category_id, merchant_id, txn_type, amount, currency, txn_date, description)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, transactions)

# User operations
def get_user_by_email(email):
    with get_db() as conn:
        cursor = conn.execute("SELECT * FROM users WHERE email = ?", (email,))
        return cursor.fetchone()

# Account operations
def get_accounts(user_id):
    with get_db() as conn:
        cursor = conn.execute(
            "SELECT * FROM accounts WHERE user_id = ? ORDER BY name",
            (user_id,)
        )
        return cursor.fetchall()

def add_account(user_id, name, account_type, balance, currency='INR'):
    with get_db() as conn:
        cursor = conn.execute(
            "INSERT INTO accounts (user_id, name, type, balance, currency) VALUES (?, ?, ?, ?, ?)",
            (user_id, name, account_type, balance, currency)
        )
        return cursor.lastrowid

def delete_account(account_id, user_id):
    with get_db() as conn:
        # Check if account has transactions
        cursor = conn.execute(
            "SELECT COUNT(*) as count FROM transactions WHERE account_id = ?",
            (account_id,)
        )
        count = cursor.fetchone()['count']
        
        if count > 0:
            return False
        
        # Delete account
        conn.execute(
            "DELETE FROM accounts WHERE account_id = ? AND user_id = ?",
            (account_id, user_id)
        )
        return True

# Category operations
def get_categories(user_id, kind=None):
    with get_db() as conn:
        if kind:
            cursor = conn.execute(
                "SELECT * FROM categories WHERE user_id = ? AND kind = ? ORDER BY name",
                (user_id, kind)
            )
        else:
            cursor = conn.execute(
                "SELECT * FROM categories WHERE user_id = ? ORDER BY name",
                (user_id,)
            )
        return cursor.fetchall()

def add_category(user_id, name, kind='expense'):
    with get_db() as conn:
        cursor = conn.execute(
            "INSERT INTO categories (user_id, name, kind) VALUES (?, ?, ?)",
            (user_id, name, kind)
        )
        return cursor.lastrowid

def delete_category(category_id, user_id):
    with get_db() as conn:
        # Check if category has transactions
        cursor = conn.execute(
            "SELECT COUNT(*) as count FROM transactions WHERE category_id = ?",
            (category_id,)
        )
        count = cursor.fetchone()['count']
        
        if count > 0:
            return False
        
        # Delete category
        conn.execute(
            "DELETE FROM categories WHERE category_id = ? AND user_id = ?",
            (category_id, user_id)
        )
        return True

# Merchant operations
def get_merchants(user_id):
    with get_db() as conn:
        cursor = conn.execute(
            "SELECT * FROM merchants WHERE user_id = ? ORDER BY name",
            (user_id,)
        )
        return cursor.fetchall()

def add_merchant(user_id, name):
    with get_db() as conn:
        cursor = conn.execute(
            "INSERT INTO merchants (user_id, name) VALUES (?, ?)",
            (user_id, name)
        )
        return cursor.lastrowid

# Transaction operations
def get_transactions(user_id, limit=100, offset=0):
    with get_db() as conn:
        cursor = conn.execute("""
            SELECT t.*, a.name as account_name, c.name as category_name, m.name as merchant_name
            FROM transactions t
            LEFT JOIN accounts a ON t.account_id = a.account_id
            LEFT JOIN categories c ON t.category_id = c.category_id
            LEFT JOIN merchants m ON t.merchant_id = m.merchant_id
            WHERE t.user_id = ?
            ORDER BY t.txn_date DESC, t.created_at DESC
            LIMIT ? OFFSET ?
        """, (user_id, limit, offset))
        return cursor.fetchall()

def add_transaction(user_id, account_id, txn_type, amount, txn_date, 
                   category_id=None, merchant_id=None, description=None, notes=None):
    with get_db() as conn:
        cursor = conn.execute("""
            INSERT INTO transactions 
            (user_id, account_id, category_id, merchant_id, txn_type, amount, txn_date, description, notes)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (user_id, account_id, category_id, merchant_id, txn_type, amount, txn_date, description, notes))
        
        # Update account balance
        if txn_type == 'expense':
            conn.execute("UPDATE accounts SET balance = balance - ? WHERE account_id = ?", (amount, account_id))
        elif txn_type == 'income':
            conn.execute("UPDATE accounts SET balance = balance + ? WHERE account_id = ?", (amount, account_id))
        
        return cursor.lastrowid

def delete_transaction(transaction_id, user_id):
    with get_db() as conn:
        # Get transaction details to reverse balance
        cursor = conn.execute(
            "SELECT account_id, txn_type, amount FROM transactions WHERE transaction_id = ? AND user_id = ?",
            (transaction_id, user_id)
        )
        txn = cursor.fetchone()
        
        if txn:
            # Reverse the balance change
            if txn['txn_type'] == 'expense':
                conn.execute("UPDATE accounts SET balance = balance + ? WHERE account_id = ?", 
                           (txn['amount'], txn['account_id']))
            elif txn['txn_type'] == 'income':
                conn.execute("UPDATE accounts SET balance = balance - ? WHERE account_id = ?", 
                           (txn['amount'], txn['account_id']))
            
            # Delete transaction
            conn.execute("DELETE FROM transactions WHERE transaction_id = ? AND user_id = ?", 
                        (transaction_id, user_id))
            return True
        return False

# Analytics
def get_spending_by_category(user_id, start_date=None, end_date=None):
    with get_db() as conn:
        query = """
            SELECT c.name, SUM(t.amount) as total
            FROM transactions t
            JOIN categories c ON t.category_id = c.category_id
            WHERE t.user_id = ? AND t.txn_type = 'expense'
        """
        params = [user_id]
        
        if start_date:
            query += " AND t.txn_date >= ?"
            params.append(start_date)
        if end_date:
            query += " AND t.txn_date <= ?"
            params.append(end_date)
        
        query += " GROUP BY c.category_id, c.name ORDER BY total DESC"
        
        cursor = conn.execute(query, params)
        return cursor.fetchall()

def get_monthly_summary(user_id, year, month):
    with get_db() as conn:
        cursor = conn.execute("""
            SELECT 
                txn_type,
                SUM(amount) as total
            FROM transactions
            WHERE user_id = ? 
            AND strftime('%Y', txn_date) = ? 
            AND strftime('%m', txn_date) = ?
            GROUP BY txn_type
        """, (user_id, str(year), f"{month:02d}"))
        return cursor.fetchall()
