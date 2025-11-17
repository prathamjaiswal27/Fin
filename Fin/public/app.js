const API_URL = 'http://localhost:3001/api';

// State
let currentPage = 'dashboard';
let accounts = [];
let categories = [];
let merchants = [];

// Utility Functions
function formatCurrency(amount) {
    return new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR'
    }).format(amount);
}

function formatDate(dateString) {
    return new Date(dateString).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    });
}

// API Functions
async function fetchAPI(endpoint, options = {}) {
    try {
        const response = await fetch(`${API_URL}${endpoint}`, options);
        if (!response.ok) throw new Error('API request failed');
        return await response.json();
    } catch (error) {
        console.error('API Error:', error);
        alert('An error occurred. Please try again.');
        return null;
    }
}

// Navigation
function setupNavigation() {
    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const page = item.dataset.page;
            navigateToPage(page);
        });
    });
}

function navigateToPage(page) {
    // Update nav items
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.toggle('active', item.dataset.page === page);
    });

    // Update pages
    document.querySelectorAll('.page').forEach(p => {
        p.classList.toggle('active', p.id === `${page}-page`);
    });

    currentPage = page;

    // Load page data
    switch(page) {
        case 'dashboard':
            loadDashboard();
            break;
        case 'transactions':
            loadTransactions();
            break;
        case 'add-transaction':
            loadAddTransactionForm();
            break;
        case 'accounts':
            loadAccounts();
            break;
        case 'categories':
            loadCategories();
            break;
        case 'analytics':
            loadAnalytics();
            break;
    }
}

// Dashboard
async function loadDashboard() {
    const data = await fetchAPI('/dashboard');
    if (!data) return;

    // Update metrics
    document.getElementById('totalBalance').textContent = formatCurrency(data.totalBalance);
    document.getElementById('monthlyIncome').textContent = formatCurrency(data.monthlyIncome);
    document.getElementById('monthlyExpense').textContent = formatCurrency(data.monthlyExpense);
    document.getElementById('netMonth').textContent = formatCurrency(data.net);

    // Category Chart
    if (data.spendingByCategory.length > 0) {
        const ctx = document.getElementById('categoryChart');
        if (window.categoryChartInstance) window.categoryChartInstance.destroy();
        
        window.categoryChartInstance = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: data.spendingByCategory.map(c => c.name),
                datasets: [{
                    data: data.spendingByCategory.map(c => c.total),
                    backgroundColor: [
                        '#ef4444', '#f59e0b', '#10b981', '#3b82f6', 
                        '#6366f1', '#8b5cf6', '#ec4899', '#14b8a6'
                    ]
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                plugins: {
                    legend: { position: 'bottom' }
                }
            }
        });
    }

    // Account Chart
    if (data.accounts.length > 0) {
        const ctx = document.getElementById('accountChart');
        if (window.accountChartInstance) window.accountChartInstance.destroy();
        
        window.accountChartInstance = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: data.accounts.map(a => a.name),
                datasets: [{
                    label: 'Balance',
                    data: data.accounts.map(a => a.balance),
                    backgroundColor: '#6366f1'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                plugins: {
                    legend: { display: false }
                },
                scales: {
                    y: { beginAtZero: true }
                }
            }
        });
    }

    // Recent Transactions
    const transactions = await fetchAPI('/transactions?limit=10');
    if (transactions) {
        displayTransactions(transactions, 'recentTransactions', false);
    }
}

// Transactions
async function loadTransactions() {
    const type = document.getElementById('txnTypeFilter').value;
    const transactions = await fetchAPI(`/transactions?type=${type}&limit=100`);
    if (transactions) {
        displayTransactions(transactions, 'transactionsList', true);
    }
}

function displayTransactions(transactions, containerId, showDelete) {
    const container = document.getElementById(containerId);
    
    if (transactions.length === 0) {
        container.innerHTML = '<div class="empty-state"><i class="fas fa-inbox"></i><p>No transactions found</p></div>';
        return;
    }

    container.innerHTML = transactions.map(txn => `
        <div class="transaction-item">
            <div class="transaction-icon ${txn.txn_type}">
                <i class="fas fa-${txn.txn_type === 'income' ? 'arrow-up' : txn.txn_type === 'expense' ? 'arrow-down' : 'exchange-alt'}"></i>
            </div>
            <div class="transaction-details">
                <div class="transaction-description">${txn.description || txn.category_name || 'Transaction'}</div>
                <div class="transaction-meta">
                    ${formatDate(txn.txn_date)} • ${txn.account_name}
                    ${txn.category_name ? ` • ${txn.category_name}` : ''}
                </div>
            </div>
            <div class="transaction-amount ${txn.txn_type}">
                ${txn.txn_type === 'expense' ? '-' : '+'}${formatCurrency(txn.amount)}
            </div>
            ${showDelete ? `
                <div class="transaction-actions">
                    <button class="btn btn-danger" onclick="deleteTransaction(${txn.transaction_id})">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            ` : ''}
        </div>
    `).join('');
}

async function deleteTransaction(id) {
    if (!confirm('Are you sure you want to delete this transaction?')) return;
    
    const result = await fetchAPI(`/transactions/${id}`, { method: 'DELETE' });
    if (result && result.success) {
        loadTransactions();
    }
}

async function deleteAccount(id) {
    if (!confirm('Are you sure you want to delete this account? This will only work if the account has no transactions.')) return;
    
    const result = await fetchAPI(`/accounts/${id}`, { method: 'DELETE' });
    if (result) {
        if (result.success) {
            alert('Account deleted successfully!');
            loadAccounts();
        } else if (result.error) {
            alert(result.error);
        }
    }
}

async function deleteCategory(id) {
    if (!confirm('Are you sure you want to delete this category? This will only work if the category has no transactions.')) return;
    
    const result = await fetchAPI(`/categories/${id}`, { method: 'DELETE' });
    if (result) {
        if (result.success) {
            alert('Category deleted successfully!');
            loadCategories();
        } else if (result.error) {
            alert(result.error);
        }
    }
}

// Add Transaction
async function loadAddTransactionForm() {
    // Load accounts
    accounts = await fetchAPI('/accounts');
    const accountSelect = document.getElementById('account');
    accountSelect.innerHTML = accounts.map(a => 
        `<option value="${a.account_id}">${a.name}</option>`
    ).join('');

    // Load merchants
    merchants = await fetchAPI('/merchants');
    const merchantSelect = document.getElementById('merchant');
    merchantSelect.innerHTML = '<option value="">None</option>' + merchants.map(m => 
        `<option value="${m.merchant_id}">${m.name}</option>`
    ).join('');

    // Set today's date
    document.getElementById('txnDate').valueAsDate = new Date();

    // Load categories based on type
    await updateCategoryOptions();
}

async function updateCategoryOptions() {
    const type = document.getElementById('txnType').value;
    categories = await fetchAPI(`/categories?kind=${type}`);
    
    const categorySelect = document.getElementById('category');
    categorySelect.innerHTML = '<option value="">None</option>' + categories.map(c => 
        `<option value="${c.category_id}">${c.name}</option>`
    ).join('');
}

function setupAddTransactionForm() {
    const form = document.getElementById('addTransactionForm');
    const typeSelect = document.getElementById('txnType');
    
    typeSelect.addEventListener('change', updateCategoryOptions);
    
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const formData = {
            account_id: parseInt(document.getElementById('account').value),
            txn_type: document.getElementById('txnType').value,
            amount: parseFloat(document.getElementById('amount').value),
            txn_date: document.getElementById('txnDate').value,
            category_id: document.getElementById('category').value || null,
            merchant_id: document.getElementById('merchant').value || null,
            description: document.getElementById('description').value,
            notes: document.getElementById('notes').value
        };

        const result = await fetchAPI('/transactions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(formData)
        });

        if (result && result.success) {
            alert('Transaction added successfully!');
            form.reset();
            document.getElementById('txnDate').valueAsDate = new Date();
        }
    });
}

// Accounts
async function loadAccounts() {
    accounts = await fetchAPI('/accounts');
    const container = document.getElementById('accountsList');
    
    if (accounts.length === 0) {
        container.innerHTML = '<div class="empty-state"><i class="fas fa-university"></i><p>No accounts found</p></div>';
        return;
    }

    container.innerHTML = accounts.map(acc => `
        <div class="account-card">
            <div class="account-header">
                <div>
                    <div class="account-name">${acc.name}</div>
                    <div class="account-type">${acc.type.replace('_', ' ')}</div>
                </div>
                <button class="btn btn-danger btn-sm" onclick="deleteAccount(${acc.account_id})" title="Delete Account">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
            <div class="account-balance ${acc.balance >= 0 ? 'positive' : 'negative'}">
                ${formatCurrency(acc.balance)}
            </div>
        </div>
    `).join('');
}

function setupAddAccountForm() {
    const form = document.getElementById('addAccountForm');
    
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const formData = {
            name: document.getElementById('accountName').value,
            type: document.getElementById('accountType').value,
            balance: parseFloat(document.getElementById('initialBalance').value),
            currency: 'INR'
        };

        const result = await fetchAPI('/accounts', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(formData)
        });

        if (result && result.success) {
            alert('Account added successfully!');
            form.reset();
            loadAccounts();
        }
    });
}

// Categories
async function loadCategories() {
    const expenseCategories = await fetchAPI('/categories?kind=expense');
    const incomeCategories = await fetchAPI('/categories?kind=income');
    
    displayCategoryList(expenseCategories, 'expenseCategories');
    displayCategoryList(incomeCategories, 'incomeCategories');
}

function displayCategoryList(categories, containerId) {
    const container = document.getElementById(containerId);
    
    if (categories.length === 0) {
        container.innerHTML = '<div class="empty-state"><p>No categories found</p></div>';
        return;
    }

    container.innerHTML = categories.map(cat => `
        <div class="category-item">
            <div class="category-info">
                <i class="fas fa-tag"></i>
                <span>${cat.name}</span>
            </div>
            <button class="btn btn-danger btn-sm" onclick="deleteCategory(${cat.category_id})" title="Delete Category">
                <i class="fas fa-trash"></i>
            </button>
        </div>
    `).join('');
}

function setupAddCategoryForm() {
    const form = document.getElementById('addCategoryForm');
    
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const formData = {
            name: document.getElementById('categoryName').value,
            kind: document.getElementById('categoryKind').value
        };

        const result = await fetchAPI('/categories', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(formData)
        });

        if (result && result.success) {
            alert('Category added successfully!');
            form.reset();
            loadCategories();
        }
    });
}

// Analytics
async function loadAnalytics() {
    const startDate = document.getElementById('startDate').value;
    const endDate = document.getElementById('endDate').value;
    
    const data = await fetchAPI(`/analytics?start_date=${startDate}&end_date=${endDate}`);
    if (!data) return;

    // Update metrics
    document.getElementById('analyticsIncome').textContent = formatCurrency(data.totalIncome);
    document.getElementById('analyticsExpense').textContent = formatCurrency(data.totalExpense);
    document.getElementById('analyticsNet').textContent = formatCurrency(data.net);

    // Category Chart
    if (data.categorySpending.length > 0) {
        const ctx = document.getElementById('analyticsCategoryChart');
        if (window.analyticsCategoryChartInstance) window.analyticsCategoryChartInstance.destroy();
        
        window.analyticsCategoryChartInstance = new Chart(ctx, {
            type: 'pie',
            data: {
                labels: data.categorySpending.map(c => c.name),
                datasets: [{
                    data: data.categorySpending.map(c => c.amount),
                    backgroundColor: [
                        '#ef4444', '#f59e0b', '#10b981', '#3b82f6', 
                        '#6366f1', '#8b5cf6', '#ec4899', '#14b8a6'
                    ]
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                plugins: {
                    legend: { position: 'bottom' }
                }
            }
        });
    }

    // Trend Chart
    if (data.dailySpending.length > 0) {
        const ctx = document.getElementById('trendChart');
        if (window.trendChartInstance) window.trendChartInstance.destroy();
        
        window.trendChartInstance = new Chart(ctx, {
            type: 'line',
            data: {
                labels: data.dailySpending.map(d => formatDate(d.date)),
                datasets: [{
                    label: 'Daily Spending',
                    data: data.dailySpending.map(d => d.amount),
                    borderColor: '#ef4444',
                    backgroundColor: 'rgba(239, 68, 68, 0.1)',
                    tension: 0.4,
                    fill: true
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                plugins: {
                    legend: { display: false }
                },
                scales: {
                    y: { beginAtZero: true }
                }
            }
        });
    }

    // Top Merchants
    const merchantsContainer = document.getElementById('topMerchants');
    if (data.merchantSpending.length > 0) {
        merchantsContainer.innerHTML = data.merchantSpending.map(m => `
            <div class="merchant-item">
                <span class="merchant-name">${m.name}</span>
                <span class="merchant-amount">${formatCurrency(m.amount)}</span>
            </div>
        `).join('');
    } else {
        merchantsContainer.innerHTML = '<div class="empty-state"><p>No merchant data available</p></div>';
    }
}

function setupAnalyticsFilters() {
    // Set default dates (last 30 days)
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 30);
    
    document.getElementById('startDate').valueAsDate = startDate;
    document.getElementById('endDate').valueAsDate = endDate;
    
    document.getElementById('applyDateFilter').addEventListener('click', loadAnalytics);
}

// Transaction filter
function setupTransactionFilter() {
    document.getElementById('txnTypeFilter').addEventListener('change', loadTransactions);
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    setupNavigation();
    setupAddTransactionForm();
    setupAddAccountForm();
    setupAddCategoryForm();
    setupAnalyticsFilters();
    setupTransactionFilter();
    
    // Load initial page
    loadDashboard();
});
