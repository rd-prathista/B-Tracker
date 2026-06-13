import { getDb } from '../database/db';

/**
 * Get current date string in local YYYY-MM-DD format
 */
const getTodayStr = () => {
  return new Date().toISOString().split('T')[0];
};

/**
 * Recalculate status and outstanding amount for a loan
 */
export const updateLoanStatusAndOutstanding = (db, loanId) => {
  const loan = db.getFirstSync('SELECT * FROM loans WHERE id = ?', [loanId]);
  if (!loan) return;

  const repaymentSum = db.getFirstSync(
    'SELECT SUM(amount) as total FROM loan_repayments WHERE loan_id = ?',
    [loanId]
  )?.total || 0;

  const outstanding = loan.amount - repaymentSum;
  let status = 'Active';

  if (outstanding <= 0) {
    status = 'Closed';
  } else if (loan.expected_return_date) {
    const today = getTodayStr();
    // Compare YYYY-MM-DD strings directly
    const expDateStr = loan.expected_return_date.split('T')[0];
    if (expDateStr < today) {
      status = 'Overdue';
    }
  }

  db.runSync(
    'UPDATE loans SET status = ? WHERE id = ?',
    [status, loanId]
  );

  return { outstanding, status };
};

/**
 * Create a new loan
 */
export const addLoan = (data) => {
  const db = getDb();
  const { personName, type, sourceType, amount, currency, startDate, expectedReturnDate, notes } = data;

  const result = db.runSync(
    `INSERT INTO loans (person_name, type, source_type, amount, currency, start_date, expected_return_date, notes, status, is_archived) 
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'Active', 0)`,
    [
      personName,
      type, // 'I Gave' or 'I Borrowed'
      sourceType, // 'Person', 'Friend', 'Family', 'Bank', 'Company'
      parseFloat(amount),
      currency,
      startDate,
      expectedReturnDate || null,
      notes || null
    ]
  );

  const loanId = result.lastInsertRowId;
  updateLoanStatusAndOutstanding(db, loanId);
  return loanId;
};

/**
 * Update loan details
 */
export const updateLoan = (id, data) => {
  const db = getDb();
  const sets = [];
  const params = [];

  if (data.personName !== undefined) { sets.push('person_name = ?'); params.push(data.personName); }
  if (data.type !== undefined) { sets.push('type = ?'); params.push(data.type); }
  if (data.sourceType !== undefined) { sets.push('source_type = ?'); params.push(data.sourceType); }
  if (data.amount !== undefined) { sets.push('amount = ?'); params.push(parseFloat(data.amount)); }
  if (data.currency !== undefined) { sets.push('currency = ?'); params.push(data.currency); }
  if (data.startDate !== undefined) { sets.push('start_date = ?'); params.push(data.startDate); }
  if (data.expectedReturnDate !== undefined) { sets.push('expected_return_date = ?'); params.push(data.expectedReturnDate || null); }
  if (data.notes !== undefined) { sets.push('notes = ?'); params.push(data.notes || null); }

  if (sets.length > 0) {
    params.push(id);
    db.runSync(`UPDATE loans SET ${sets.join(', ')} WHERE id = ?`, params);
    updateLoanStatusAndOutstanding(db, id);
  }
};

/**
 * Delete a loan
 */
export const deleteLoan = (id) => {
  const db = getDb();
  db.runSync('DELETE FROM loans WHERE id = ?', [id]);
  db.runSync('DELETE FROM loan_repayments WHERE loan_id = ?', [id]);
};

/**
 * Retrieve loans based on filters
 */
export const getLoans = (filters = {}) => {
  const db = getDb();
  const { status, currency } = filters;
  
  let query = 'SELECT * FROM loans WHERE 1=1';
  const params = [];

  if (status) {
    query += ' AND status = ?';
    params.push(status);
  }

  if (currency && currency !== 'all') {
    query += ' AND currency = ?';
    params.push(currency);
  }

  query += ' ORDER BY start_date DESC';
  
  const loans = db.getAllSync(query, params);

  // For each loan, compute calculated fields dynamically
  return loans.map(loan => {
    const repaymentSum = db.getFirstSync(
      'SELECT SUM(amount) as total FROM loan_repayments WHERE loan_id = ?',
      [loan.id]
    )?.total || 0;
    
    // Check/refresh status in case time has passed and it is now Overdue
    let computedStatus = loan.status;
    if (loan.status !== 'Closed' && loan.expected_return_date) {
      const today = getTodayStr();
      const expDateStr = loan.expected_return_date.split('T')[0];
      if (expDateStr < today) {
        computedStatus = 'Overdue';
        db.runSync('UPDATE loans SET status = ? WHERE id = ?', [computedStatus, loan.id]);
      } else if (loan.status === 'Overdue') {
        computedStatus = 'Active';
        db.runSync('UPDATE loans SET status = ? WHERE id = ?', [computedStatus, loan.id]);
      }
    }

    return {
      ...loan,
      status: computedStatus,
      paidAmount: repaymentSum,
      outstandingAmount: loan.amount - repaymentSum,
      progressPercentage: loan.amount > 0 ? Math.min(100, Math.round((repaymentSum / loan.amount) * 100)) : 0
    };
  });
};

/**
 * Retrieve a single loan by id
 */
export const getLoanById = (id) => {
  const db = getDb();
  const loan = db.getFirstSync('SELECT * FROM loans WHERE id = ?', [id]);
  if (!loan) return null;

  // Refresh status
  const repaymentSum = db.getFirstSync(
    'SELECT SUM(amount) as total FROM loan_repayments WHERE loan_id = ?',
    [id]
  )?.total || 0;

  let computedStatus = loan.status;
  if (repaymentSum >= loan.amount) {
    computedStatus = 'Closed';
  } else if (loan.expected_return_date) {
    const today = getTodayStr();
    const expDateStr = loan.expected_return_date.split('T')[0];
    if (expDateStr < today) {
      computedStatus = 'Overdue';
    } else {
      computedStatus = 'Active';
    }
  }

  if (computedStatus !== loan.status) {
    db.runSync('UPDATE loans SET status = ? WHERE id = ?', [computedStatus, id]);
  }

  return {
    ...loan,
    status: computedStatus,
    paidAmount: repaymentSum,
    outstandingAmount: Math.max(0, loan.amount - repaymentSum),
    progressPercentage: loan.amount > 0 ? Math.min(100, Math.round((repaymentSum / loan.amount) * 100)) : 0
  };
};

/**
 * Add a repayment to a loan
 */
export const addRepayment = (loanId, amount, date, notes) => {
  const db = getDb();
  db.runSync(
    'INSERT INTO loan_repayments (loan_id, amount, date, notes) VALUES (?, ?, ?, ?)',
    [loanId, parseFloat(amount), date, notes || null]
  );
  return updateLoanStatusAndOutstanding(db, loanId);
};

/**
 * Get repayments for a loan
 */
export const getLoanRepayments = (loanId) => {
  const db = getDb();
  return db.getAllSync(
    'SELECT * FROM loan_repayments WHERE loan_id = ? ORDER BY date DESC, id DESC',
    [loanId]
  );
};

/**
 * Delete a repayment
 */
export const deleteRepayment = (repaymentId) => {
  const db = getDb();
  const repayment = db.getFirstSync('SELECT loan_id FROM loan_repayments WHERE id = ?', [repaymentId]);
  if (!repayment) return;

  db.runSync('DELETE FROM loan_repayments WHERE id = ?', [repaymentId]);
  updateLoanStatusAndOutstanding(db, repayment.loan_id);
};

/**
 * Get summary of all loans for Reports or Dashboard
 */
export const getLoanSummary = (currency) => {
  const db = getDb();
  const cur = currency || 'AED';

  // 1. Total Given (I Gave loans original amount)
  const totalGiven = db.getFirstSync(
    "SELECT SUM(amount) as total FROM loans WHERE type = 'I Gave' AND currency = ?",
    [cur]
  )?.total || 0;

  // 2. Total Borrowed (I Borrowed loans original amount)
  const totalBorrowed = db.getFirstSync(
    "SELECT SUM(amount) as total FROM loans WHERE type = 'I Borrowed' AND currency = ?",
    [cur]
  )?.total || 0;

  // 3. Total Recovered (repayments received for "I Gave" loans)
  const totalRecovered = db.getFirstSync(
    `SELECT SUM(r.amount) as total 
     FROM loan_repayments r 
     JOIN loans l ON r.loan_id = l.id 
     WHERE l.type = 'I Gave' AND l.currency = ?`,
    [cur]
  )?.total || 0;

  // 4. Repaid Borrowed (repayments paid for "I Borrowed" loans)
  const totalRepaidBorrowed = db.getFirstSync(
    `SELECT SUM(r.amount) as total 
     FROM loan_repayments r 
     JOIN loans l ON r.loan_id = l.id 
     WHERE l.type = 'I Borrowed' AND l.currency = ?`,
    [cur]
  )?.total || 0;

  // Outstanding Given (I Gave outstanding)
  const outstandingGiven = Math.max(0, totalGiven - totalRecovered);

  // Outstanding Borrowed (I Borrowed outstanding)
  const outstandingBorrowed = Math.max(0, totalBorrowed - totalRepaidBorrowed);

  return {
    totalGiven,
    totalBorrowed,
    totalRecovered,
    outstandingGiven,
    outstandingBorrowed
  };
};

/**
 * Toggle archiving status for a loan
 */
export const toggleArchiveLoan = (id, isArchived) => {
  const db = getDb();
  db.runSync('UPDATE loans SET is_archived = ? WHERE id = ?', [isArchived ? 1 : 0, id]);
};

/**
 * Core Conversion Logic: Converts an existing transaction to a loan record or repayment activity
 */
export const convertTransactionToLoanActivity = (data) => {
  const db = getDb();
  const { 
    txType, // 'income' or 'expense'
    txId, 
    conversionType, // 'Loan Given', 'Loan Borrowed', 'Loan Recovery Received', 'Loan Repayment Paid'
    personName, 
    sourceType, 
    expectedReturnDate, 
    selectedLoanId, 
    notes 
  } = data;

  const table = txType === 'income' ? 'income' : 'expenses';
  let loanId = null;

  db.withTransactionSync(() => {
    // 1. Fetch original transaction
    const tx = db.getFirstSync(`SELECT * FROM ${table} WHERE id = ?`, [txId]);
    if (!tx) throw new Error('Transaction not found');

    if (conversionType === 'Loan Given' || conversionType === 'Loan Borrowed') {
      if (!personName || !personName.trim()) throw new Error('Person Name is required');
      if (!sourceType) throw new Error('Source Type is required');

      const loanType = conversionType === 'Loan Given' ? 'I Gave' : 'I Borrowed';

      const result = db.runSync(
        `INSERT INTO loans (person_name, type, source_type, amount, currency, start_date, expected_return_date, notes, status, is_archived)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'Active', 0)`,
        [
          personName.trim(),
          loanType,
          sourceType,
          tx.amount,
          tx.currency,
          tx.date,
          expectedReturnDate || null,
          notes || tx.notes || `Converted to ${conversionType}`
        ]
      );
      loanId = result.lastInsertRowId;
      updateLoanStatusAndOutstanding(db, loanId);

    } else if (conversionType === 'Loan Recovery Received' || conversionType === 'Loan Repayment Paid') {
      if (!selectedLoanId) throw new Error('Loan selection is required');

      const loan = db.getFirstSync('SELECT * FROM loans WHERE id = ?', [selectedLoanId]);
      if (!loan) throw new Error('Selected loan not found');

      // Check outstanding balance validation
      const repaymentSum = db.getFirstSync(
        'SELECT SUM(amount) as total FROM loan_repayments WHERE loan_id = ?',
        [selectedLoanId]
      )?.total || 0;
      const outstanding = loan.amount - repaymentSum;

      if (tx.amount > outstanding) {
        throw new Error('Repayment amount cannot exceed the outstanding balance.');
      }

      db.runSync(
        'INSERT INTO loan_repayments (loan_id, amount, date, notes) VALUES (?, ?, ?, ?)',
        [selectedLoanId, tx.amount, tx.date, notes || tx.notes || 'Loan Repayment']
      );
      updateLoanStatusAndOutstanding(db, selectedLoanId);
      loanId = selectedLoanId;
    } else {
      throw new Error('Invalid conversion type');
    }

    // 2. Delete original transaction
    db.runSync(`DELETE FROM ${table} WHERE id = ?`, [txId]);
  });

  return loanId;
};

/**
 * Helper to fetch loans and repayments mapped as standard transaction history list items
 */
export const getLoanTransactionsForHistory = (filters = {}) => {
  const db = getDb();
  const { startDate, endDate, currency, search, loanId } = filters;

  let loanQuery = 'SELECT * FROM loans WHERE 1=1';
  const loanParams = [];

  if (loanId) {
    loanQuery += ' AND id = ?';
    loanParams.push(loanId);
  }

  if (currency && currency !== 'all') {
    loanQuery += ' AND currency = ?';
    loanParams.push(currency);
  }
  
  if (startDate) {
    loanQuery += ' AND start_date >= ?';
    loanParams.push(startDate);
  }
  if (endDate) {
    loanQuery += ' AND start_date <= ?';
    loanParams.push(endDate);
  }

  const loans = db.getAllSync(loanQuery, loanParams);

  let repaymentQuery = `
    SELECT r.*, l.person_name, l.type as loan_type, l.currency, l.is_archived 
    FROM loan_repayments r 
    JOIN loans l ON r.loan_id = l.id 
    WHERE 1=1
  `;
  const repayParams = [];

  if (loanId) {
    repaymentQuery += ' AND r.loan_id = ?';
    repayParams.push(loanId);
  }
  if (currency && currency !== 'all') {
    repaymentQuery += ' AND l.currency = ?';
    repayParams.push(currency);
  }
  if (startDate) {
    repaymentQuery += ' AND r.date >= ?';
    repayParams.push(startDate);
  }
  if (endDate) {
    repaymentQuery += ' AND r.date <= ?';
    repayParams.push(endDate);
  }

  const repayments = db.getAllSync(repaymentQuery, repayParams);

  // Map loans
  const mappedLoans = loans.map(l => ({
    id: `loan-${l.id}`,
    loanId: l.id,
    amount: l.amount,
    currency: l.currency,
    date: l.start_date,
    category: l.type === 'I Gave' ? `Gave Loan to ${l.person_name}` : `Borrowed from ${l.person_name}`,
    personName: l.person_name,
    notes: l.notes || `Loan: ${l.type}`,
    type: 'loan',
    loanType: l.type, // 'I Gave' or 'I Borrowed'
    icon: l.type === 'I Gave' ? 'arrow-up-outline' : 'arrow-down-outline',
    is_archived: l.is_archived
  }));

  // Map repayments
  const mappedRepayments = repayments.map(r => ({
    id: `repayment-${r.id}`,
    repaymentId: r.id,
    loanId: r.loan_id,
    amount: r.amount,
    currency: r.currency,
    date: r.date,
    category: r.loan_type === 'I Gave' ? `Loan Repaid by ${r.person_name}` : `Repayment to ${r.person_name}`,
    personName: r.person_name,
    notes: r.notes || 'Loan Repayment',
    type: 'repayment',
    loanType: r.loan_type,
    icon: r.loan_type === 'I Gave' ? 'cash-outline' : 'send-outline',
    is_archived: r.is_archived
  }));

  let allLoanTxs = [...mappedLoans, ...mappedRepayments];

  if (search) {
    const q = search.toLowerCase();
    allLoanTxs = allLoanTxs.filter(item => 
      item.category.toLowerCase().includes(q) ||
      (item.notes && item.notes.toLowerCase().includes(q)) ||
      item.amount.toString().includes(q) ||
      item.currency.toLowerCase().includes(q)
    );
  }

  return allLoanTxs;
};
