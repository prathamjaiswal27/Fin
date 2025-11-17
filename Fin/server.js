const express = require('express');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const app = express();
const PORT = 3001;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Database connection
const db = new sqlite3.Database('budgeting.db');

// Helper function to get user (using default test user)
const DEFAULT_USER_ID = 1;

// Promisify database methods
function dbAll(query, params = []) {
  return new Promise((resolve, reject) => {
    db.all(query, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

function dbGet(query, params = []) {
  return new Promise((resolve, reject) => {
    db.get(query, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
}

function dbRun(query, params = []) {
  return new Promise((resolve, reject) => {
    db.run(query, params, function(err) {
      if (err) reject(err);
      else resolve({ lastID: this.lastID, changes: this.changes });
    });
  });
}

// API Routes

// Get dashboard summary
app.get('/api/dashboard', async (req, res) => {
  try {
    const today = new Date();
    const year = today.getFullYear();
    const month = today.getMonth() + 1;

    // Get total balance
    const accounts = await dbAll('SELECT * FROM accounts WHERE user_id = ?', [DEFAULT_USER_ID]);
    const totalBalance = accounts.reduce((sum, acc) => sum + acc.balance, 0);

    // Get monthly summary
    const monthlySummary = await dbAll(`
      SELECT txn_type, SUM(amount) as total
      FROM transactions
      WHERE user_id = ? AND strftime('%Y', txn_date) = ? AND strftime('%m', txn_date) = ?
      GROUP BY txn_type
    `, [DEFAULT_USER_ID, year.toString(), month.toString().padStart(2, '0')]);

    let monthlyIncome = 0;
    let monthlyExpense = 0;

    monthlySummary.forEach(row => {
      if (row.txn_type === 'income') monthlyIncome = row.total;
      if (row.txn_type === 'expense') monthlyExpense = row.total;
    });

    // Get spending by category
    const spendingByCategory = await dbAll(`
      SELECT c.name, SUM(t.amount) as total
      FROM transactions t
      JOIN categories c ON t.category_id = c.category_id
      WHERE t.user_id = ? AND t.txn_type = 'expense'
        AND strftime('%Y-%m', t.txn_date) = ?
      GROUP BY c.category_id, c.name
      ORDER BY total DESC
    `, [DEFAULT_USER_ID, `${year}-${month.toString().padStart(2, '0')}`]);

    res.json({
      totalBalance,
      monthlyIncome,
      monthlyExpense,
      net: monthlyIncome - monthlyExpense,
      accounts,
      spendingByCategory
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get transactions
app.get('/api/transactions', async (req, res) => {
  try {
    const { type, limit = 50 } = req.query;
    
    let query = `
      SELECT t.*, 
             a.name as account_name,
             c.name as category_name,
             m.name as merchant_name
      FROM transactions t
      LEFT JOIN accounts a ON t.account_id = a.account_id
      LEFT JOIN categories c ON t.category_id = c.category_id
      LEFT JOIN merchants m ON t.merchant_id = m.merchant_id
      WHERE t.user_id = ?
    `;
    
    const params = [DEFAULT_USER_ID];
    
    if (type && type !== 'all') {
      query += ' AND t.txn_type = ?';
      params.push(type);
    }
    
    query += ' ORDER BY t.txn_date DESC, t.transaction_id DESC LIMIT ?';
    params.push(parseInt(limit));
    
    const transactions = await dbAll(query, params);
    res.json(transactions);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Add transaction
app.post('/api/transactions', async (req, res) => {
  try {
    const { account_id, txn_type, amount, txn_date, category_id, merchant_id, description, notes } = req.body;
    
    const result = await dbRun(`
      INSERT INTO transactions (user_id, account_id, txn_type, amount, txn_date, category_id, merchant_id, description, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [DEFAULT_USER_ID, account_id, txn_type, amount, txn_date, category_id || null, merchant_id || null, description || null, notes || null]);
    
    // Update account balance
    const multiplier = txn_type === 'expense' ? -1 : 1;
    await dbRun('UPDATE accounts SET balance = balance + ? WHERE account_id = ?', [amount * multiplier, account_id]);
    
    res.json({ transaction_id: result.lastID, success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete transaction
app.delete('/api/transactions/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Get transaction details first
    const txn = await dbGet('SELECT * FROM transactions WHERE transaction_id = ? AND user_id = ?', [id, DEFAULT_USER_ID]);
    
    if (!txn) {
      return res.status(404).json({ error: 'Transaction not found' });
    }
    
    // Reverse the account balance change
    const multiplier = txn.txn_type === 'expense' ? 1 : -1;
    await dbRun('UPDATE accounts SET balance = balance + ? WHERE account_id = ?', [txn.amount * multiplier, txn.account_id]);
    
    // Delete transaction
    await dbRun('DELETE FROM transactions WHERE transaction_id = ?', [id]);
    
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get accounts
app.get('/api/accounts', async (req, res) => {
  try {
    const accounts = await dbAll('SELECT * FROM accounts WHERE user_id = ?', [DEFAULT_USER_ID]);
    res.json(accounts);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Add account
app.post('/api/accounts', async (req, res) => {
  try {
    const { name, type, balance, currency } = req.body;
    
    const result = await dbRun(`
      INSERT INTO accounts (user_id, name, type, balance, currency)
      VALUES (?, ?, ?, ?, ?)
    `, [DEFAULT_USER_ID, name, type, balance || 0, currency || 'INR']);
    
    res.json({ account_id: result.lastID, success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete account
app.delete('/api/accounts/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Check if account exists and belongs to user
    const account = await dbGet('SELECT * FROM accounts WHERE account_id = ? AND user_id = ?', [id, DEFAULT_USER_ID]);
    
    if (!account) {
      return res.status(404).json({ error: 'Account not found' });
    }
    
    // Check if account has transactions
    const txnCount = await dbGet('SELECT COUNT(*) as count FROM transactions WHERE account_id = ?', [id]);
    
    if (txnCount.count > 0) {
      return res.status(400).json({ error: 'Cannot delete account with existing transactions' });
    }
    
    // Delete account
    await dbRun('DELETE FROM accounts WHERE account_id = ?', [id]);
    
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get categories
app.get('/api/categories', async (req, res) => {
  try {
    const { kind } = req.query;
    let query = 'SELECT * FROM categories WHERE user_id = ?';
    const params = [DEFAULT_USER_ID];
    
    if (kind) {
      query += ' AND kind = ?';
      params.push(kind);
    }
    
    query += ' ORDER BY name';
    const categories = await dbAll(query, params);
    res.json(categories);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Add category
app.post('/api/categories', async (req, res) => {
  try {
    const { name, kind } = req.body;
    
    const result = await dbRun(`
      INSERT INTO categories (user_id, name, kind)
      VALUES (?, ?, ?)
    `, [DEFAULT_USER_ID, name, kind]);
    
    res.json({ category_id: result.lastID, success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete category
app.delete('/api/categories/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Check if category exists and belongs to user
    const category = await dbGet('SELECT * FROM categories WHERE category_id = ? AND user_id = ?', [id, DEFAULT_USER_ID]);
    
    if (!category) {
      return res.status(404).json({ error: 'Category not found' });
    }
    
    // Check if category has transactions
    const txnCount = await dbGet('SELECT COUNT(*) as count FROM transactions WHERE category_id = ?', [id]);
    
    if (txnCount.count > 0) {
      return res.status(400).json({ error: 'Cannot delete category with existing transactions' });
    }
    
    // Delete category
    await dbRun('DELETE FROM categories WHERE category_id = ?', [id]);
    
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get merchants
app.get('/api/merchants', async (req, res) => {
  try {
    const merchants = await dbAll('SELECT * FROM merchants WHERE user_id = ? ORDER BY name', [DEFAULT_USER_ID]);
    res.json(merchants);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get analytics
app.get('/api/analytics', async (req, res) => {
  try {
    const { start_date, end_date } = req.query;
    
    // Get transactions in date range
    const transactions = await dbAll(`
      SELECT t.*, 
             c.name as category_name,
             m.name as merchant_name
      FROM transactions t
      LEFT JOIN categories c ON t.category_id = c.category_id
      LEFT JOIN merchants m ON t.merchant_id = m.merchant_id
      WHERE t.user_id = ? AND t.txn_date BETWEEN ? AND ?
      ORDER BY t.txn_date DESC
    `, [DEFAULT_USER_ID, start_date, end_date]);
    
    // Calculate summaries
    let totalIncome = 0;
    let totalExpense = 0;
    const categorySpending = {};
    const merchantSpending = {};
    const dailySpending = {};
    
    transactions.forEach(txn => {
      if (txn.txn_type === 'income') {
        totalIncome += txn.amount;
      } else if (txn.txn_type === 'expense') {
        totalExpense += txn.amount;
        
        // Category spending
        if (txn.category_name) {
          categorySpending[txn.category_name] = (categorySpending[txn.category_name] || 0) + txn.amount;
        }
        
        // Merchant spending
        if (txn.merchant_name) {
          merchantSpending[txn.merchant_name] = (merchantSpending[txn.merchant_name] || 0) + txn.amount;
        }
        
        // Daily spending
        const date = txn.txn_date.split(' ')[0];
        dailySpending[date] = (dailySpending[date] || 0) + txn.amount;
      }
    });
    
    res.json({
      totalIncome,
      totalExpense,
      net: totalIncome - totalExpense,
      categorySpending: Object.entries(categorySpending).map(([name, amount]) => ({ name, amount })).sort((a, b) => b.amount - a.amount),
      merchantSpending: Object.entries(merchantSpending).map(([name, amount]) => ({ name, amount })).sort((a, b) => b.amount - a.amount).slice(0, 10),
      dailySpending: Object.entries(dailySpending).map(([date, amount]) => ({ date, amount })).sort((a, b) => a.date.localeCompare(b.date))
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
