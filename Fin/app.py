import streamlit as st
import pandas as pd
from datetime import datetime, date, timedelta
import plotly.express as px
import plotly.graph_objects as go
import database as db

# Page config
st.set_page_config(
    page_title="Expense Tracker",
    page_icon="💰",
    layout="wide"
)

# Initialize database
db.init_db()

# Session state for user
if 'user_id' not in st.session_state:
    user = db.get_user_by_email('test@example.com')
    if user:
        st.session_state.user_id = user['user_id']
        st.session_state.user_name = user['full_name']

# Sidebar navigation
st.sidebar.title("💰 Expense Tracker")
st.sidebar.write(f"Welcome, {st.session_state.user_name}!")

page = st.sidebar.radio(
    "Navigation",
    ["Dashboard", "Transactions", "Add Transaction", "Accounts", "Categories", "Analytics"]
)

# Helper function to format currency
def format_currency(amount):
    return f"₹{amount:,.2f}"

# Dashboard Page
if page == "Dashboard":
    st.title("📊 Dashboard")
    
    # Get current month data
    today = date.today()
    first_day = date(today.year, today.month, 1)
    
    # Summary cards
    col1, col2, col3, col4 = st.columns(4)
    
    # Get accounts
    accounts = db.get_accounts(st.session_state.user_id)
    total_balance = sum(acc['balance'] for acc in accounts)
    
    # Get monthly summary
    monthly_data = db.get_monthly_summary(st.session_state.user_id, today.year, today.month)
    monthly_income = 0
    monthly_expense = 0
    
    for row in monthly_data:
        if row['txn_type'] == 'income':
            monthly_income = row['total']
        elif row['txn_type'] == 'expense':
            monthly_expense = row['total']
    
    with col1:
        st.metric("Total Balance", format_currency(total_balance))
    
    with col2:
        st.metric("Monthly Income", format_currency(monthly_income))
    
    with col3:
        st.metric("Monthly Expenses", format_currency(monthly_expense))
    
    with col4:
        net = monthly_income - monthly_expense
        st.metric("Net This Month", format_currency(net), delta=format_currency(net))
    
    st.divider()
    
    # Charts
    col1, col2 = st.columns(2)
    
    with col1:
        st.subheader("Spending by Category")
        spending_data = db.get_spending_by_category(
            st.session_state.user_id,
            start_date=first_day,
            end_date=today
        )
        
        if spending_data:
            df = pd.DataFrame(spending_data)
            fig = px.pie(df, values='total', names='name', title='Current Month')
            st.plotly_chart(fig, use_container_width=True)
        else:
            st.info("No expense data for this month")
    
    with col2:
        st.subheader("Account Balances")
        if accounts:
            df_accounts = pd.DataFrame([dict(acc) for acc in accounts])
            fig = px.bar(df_accounts, x='name', y='balance', title='All Accounts')
            st.plotly_chart(fig, use_container_width=True)
        else:
            st.info("No accounts found")
    
    # Recent transactions
    st.subheader("Recent Transactions")
    transactions = db.get_transactions(st.session_state.user_id, limit=10)
    
    if transactions:
        df_txn = pd.DataFrame([dict(t) for t in transactions])
        df_txn['amount_display'] = df_txn.apply(
            lambda x: f"-{format_currency(x['amount'])}" if x['txn_type'] == 'expense' 
            else format_currency(x['amount']), axis=1
        )
        st.dataframe(
            df_txn[['txn_date', 'description', 'category_name', 'account_name', 'amount_display']],
            use_container_width=True,
            hide_index=True
        )
    else:
        st.info("No transactions found")

# Transactions Page
elif page == "Transactions":
    st.title("📝 Transactions")
    
    # Filters
    col1, col2, col3 = st.columns(3)
    
    with col1:
        txn_type_filter = st.selectbox("Type", ["All", "expense", "income", "transfer"])
    
    # Get transactions
    transactions = db.get_transactions(st.session_state.user_id, limit=100)
    
    if transactions:
        df = pd.DataFrame([dict(t) for t in transactions])
        
        # Apply filters
        if txn_type_filter != "All":
            df = df[df['txn_type'] == txn_type_filter]
        
        # Display
        df['amount_display'] = df.apply(
            lambda x: f"-{format_currency(x['amount'])}" if x['txn_type'] == 'expense' 
            else format_currency(x['amount']), axis=1
        )
        
        # Add delete button column
        for idx, row in df.iterrows():
            col1, col2, col3, col4, col5, col6 = st.columns([2, 2, 2, 2, 2, 1])
            
            with col1:
                st.write(row['txn_date'])
            with col2:
                st.write(row['description'] or '-')
            with col3:
                st.write(row['category_name'] or '-')
            with col4:
                st.write(row['account_name'])
            with col5:
                st.write(row['amount_display'])
            with col6:
                if st.button("🗑️", key=f"del_{row['transaction_id']}"):
                    if db.delete_transaction(row['transaction_id'], st.session_state.user_id):
                        st.success("Deleted!")
                        st.rerun()
    else:
        st.info("No transactions found")

# Add Transaction Page
elif page == "Add Transaction":
    st.title("➕ Add Transaction")
    
    with st.form("add_transaction"):
        col1, col2 = st.columns(2)
        
        with col1:
            txn_type = st.selectbox("Type", ["expense", "income"])
            
            accounts = db.get_accounts(st.session_state.user_id)
            account_options = {f"{acc['name']}": acc['account_id'] for acc in accounts}
            account_name = st.selectbox("Account", list(account_options.keys()))
            
            categories = db.get_categories(st.session_state.user_id, kind=txn_type)
            category_options = {"None": None}
            category_options.update({cat['name']: cat['category_id'] for cat in categories})
            category_name = st.selectbox("Category", list(category_options.keys()))
            
            merchants = db.get_merchants(st.session_state.user_id)
            merchant_options = {"None": None}
            merchant_options.update({m['name']: m['merchant_id'] for m in merchants})
            merchant_name = st.selectbox("Merchant", list(merchant_options.keys()))
        
        with col2:
            amount = st.number_input("Amount (₹)", min_value=0.01, value=10.0, step=0.01)
            txn_date = st.date_input("Date", value=date.today())
            description = st.text_input("Description")
            notes = st.text_area("Notes")
        
        submitted = st.form_submit_button("Add Transaction")
        
        if submitted:
            account_id = account_options[account_name]
            category_id = category_options[category_name]
            merchant_id = merchant_options[merchant_name]
            
            txn_id = db.add_transaction(
                st.session_state.user_id,
                account_id,
                txn_type,
                amount,
                txn_date,
                category_id=category_id,
                merchant_id=merchant_id,
                description=description,
                notes=notes
            )
            
            if txn_id:
                st.success("Transaction added successfully!")
                st.balloons()
            else:
                st.error("Failed to add transaction")

# Accounts Page
elif page == "Accounts":
    st.title("🏦 Accounts")
    
    accounts = db.get_accounts(st.session_state.user_id)
    
    if accounts:
        for acc in accounts:
            col1, col2, col3, col4 = st.columns([2, 2, 1, 0.5])
            with col1:
                st.subheader(acc['name'])
            with col2:
                st.write(f"Type: {acc['type']}")
            with col3:
                balance_color = "green" if acc['balance'] >= 0 else "red"
                st.markdown(f"<h3 style='color: {balance_color}'>{format_currency(acc['balance'])}</h3>", 
                          unsafe_allow_html=True)
            with col4:
                if st.button("🗑️", key=f"del_acc_{acc['account_id']}"):
                    if db.delete_account(acc['account_id'], st.session_state.user_id):
                        st.success("Deleted!")
                        st.rerun()
                    else:
                        st.error("Cannot delete account with transactions")
            st.divider()
    
    st.subheader("Add New Account")
    with st.form("add_account"):
        col1, col2 = st.columns(2)
        
        with col1:
            name = st.text_input("Account Name")
            account_type = st.selectbox("Type", 
                ["checking", "savings", "credit_card", "cash", "investment", "other"])
        
        with col2:
            balance = st.number_input("Initial Balance (₹)", value=0.0, step=0.01)
            currency = st.text_input("Currency", value="INR", disabled=True)
        
        submitted = st.form_submit_button("Add Account")
        
        if submitted and name:
            acc_id = db.add_account(st.session_state.user_id, name, account_type, balance, currency)
            if acc_id:
                st.success("Account added!")
                st.rerun()

# Categories Page
elif page == "Categories":
    st.title("📂 Categories")
    
    col1, col2 = st.columns(2)
    
    with col1:
        st.subheader("Expense Categories")
        expense_cats = db.get_categories(st.session_state.user_id, kind='expense')
        for cat in expense_cats:
            col_a, col_b = st.columns([4, 1])
            with col_a:
                st.write(f"• {cat['name']}")
            with col_b:
                if st.button("🗑️", key=f"del_cat_exp_{cat['category_id']}"):
                    if db.delete_category(cat['category_id'], st.session_state.user_id):
                        st.success("Deleted!")
                        st.rerun()
                    else:
                        st.error("Cannot delete category with transactions")
    
    with col2:
        st.subheader("Income Categories")
        income_cats = db.get_categories(st.session_state.user_id, kind='income')
        for cat in income_cats:
            col_a, col_b = st.columns([4, 1])
            with col_a:
                st.write(f"• {cat['name']}")
            with col_b:
                if st.button("🗑️", key=f"del_cat_inc_{cat['category_id']}"):
                    if db.delete_category(cat['category_id'], st.session_state.user_id):
                        st.success("Deleted!")
                        st.rerun()
                    else:
                        st.error("Cannot delete category with transactions")
    
    st.divider()
    st.subheader("Add New Category")
    
    with st.form("add_category"):
        col1, col2 = st.columns(2)
        
        with col1:
            name = st.text_input("Category Name")
        
        with col2:
            kind = st.selectbox("Type", ["expense", "income"])
        
        submitted = st.form_submit_button("Add Category")
        
        if submitted and name:
            cat_id = db.add_category(st.session_state.user_id, name, kind)
            if cat_id:
                st.success("Category added!")
                st.rerun()

# Analytics Page
elif page == "Analytics":
    st.title("📈 Analytics")
    
    # Date range selector
    col1, col2 = st.columns(2)
    with col1:
        start_date = st.date_input("Start Date", value=date.today() - timedelta(days=30))
    with col2:
        end_date = st.date_input("End Date", value=date.today())
    
    # Get all transactions in date range
    all_txns = db.get_transactions(st.session_state.user_id, limit=1000)
    
    if all_txns:
        df_all = pd.DataFrame([dict(t) for t in all_txns])
        df_all['txn_date'] = pd.to_datetime(df_all['txn_date'])
        
        # Filter by date range
        mask = (df_all['txn_date'].dt.date >= start_date) & (df_all['txn_date'].dt.date <= end_date)
        df_filtered = df_all[mask]
        
        if len(df_filtered) > 0:
            # Summary metrics
            col1, col2, col3 = st.columns(3)
            
            total_income = df_filtered[df_filtered['txn_type'] == 'income']['amount'].sum()
            total_expense = df_filtered[df_filtered['txn_type'] == 'expense']['amount'].sum()
            net = total_income - total_expense
            
            with col1:
                st.metric("Total Income", format_currency(total_income))
            with col2:
                st.metric("Total Expenses", format_currency(total_expense))
            with col3:
                st.metric("Net", format_currency(net), delta=format_currency(net))
            
            st.divider()
            
            # Spending by category
            st.subheader("Spending by Category")
            expense_df = df_filtered[df_filtered['txn_type'] == 'expense'].copy()
            
            if len(expense_df) > 0:
                # Group by category
                category_spending = expense_df.groupby('category_name')['amount'].sum().reset_index()
                category_spending = category_spending.sort_values('amount', ascending=False)
                category_spending.columns = ['Category', 'Amount']
                
                col1, col2 = st.columns(2)
                
                with col1:
                    fig = px.pie(category_spending, values='Amount', names='Category', 
                               title='Expense Distribution')
                    st.plotly_chart(fig, use_container_width=True)
                
                with col2:
                    fig = px.bar(category_spending, x='Category', y='Amount', 
                               title='Expenses by Category')
                    fig.update_xaxis(tickangle=-45)
                    st.plotly_chart(fig, use_container_width=True)
                
                # Show table
                category_spending['Amount'] = category_spending['Amount'].apply(format_currency)
                st.dataframe(category_spending, use_container_width=True, hide_index=True)
            else:
                st.info("No expense transactions in selected date range")
            
            st.divider()
            
            # Spending over time
            st.subheader("Spending Trend")
            daily_spending = expense_df.groupby(expense_df['txn_date'].dt.date)['amount'].sum().reset_index()
            daily_spending.columns = ['Date', 'Amount']
            
            fig = px.line(daily_spending, x='Date', y='Amount', title='Daily Spending')
            st.plotly_chart(fig, use_container_width=True)
            
            # Top merchants
            st.subheader("Top Merchants")
            merchant_spending = expense_df[expense_df['merchant_name'].notna()].groupby('merchant_name')['amount'].sum().reset_index()
            merchant_spending = merchant_spending.sort_values('amount', ascending=False).head(10)
            merchant_spending.columns = ['Merchant', 'Amount']
            
            if len(merchant_spending) > 0:
                fig = px.bar(merchant_spending, x='Merchant', y='Amount', title='Top 10 Merchants')
                fig.update_xaxis(tickangle=-45)
                st.plotly_chart(fig, use_container_width=True)
            else:
                st.info("No merchant data available")
        else:
            st.info("No transactions found in selected date range")
    else:
        st.info("No transactions available. Add some transactions to see analytics!")
