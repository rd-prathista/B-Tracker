import { getDb, getActiveCurrencies, isCurrencyActive } from '../database/db';

export const SUPPORTED_CURRENCIES = ['AED', 'INR'];

/**
 * Add a new transaction (income or expense) with its own currency
 */
export const addTransaction = (type, amount, currency, date, category, notes = '', attachmentUri = null, owner = 'OTHER', paymentSource = 'Debit Card', creditCardId = null) => {
  const db = getDb();
  
  if (type === 'income') {
    db.runSync(`INSERT INTO income (amount, currency, date, category, notes, attachment_uri, is_archived, income_source) VALUES (?, ?, ?, ?, ?, ?, 0, ?)`, [
      parseFloat(amount),
      currency,
      date,
      category,
      notes,
      attachmentUri,
      owner || 'OTHER'
    ]);
  } else if (type === 'expense') {
    db.runSync(`INSERT INTO expenses (amount, currency, date, category, notes, attachment_uri, is_archived, funded_by, payment_source, credit_card_id) VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?, ?)`, [
      parseFloat(amount),
      currency,
      date,
      category,
      notes,
      attachmentUri,
      owner || 'OTHER',
      paymentSource,
      creditCardId
    ]);
  }
};

/**
 * INVESTMENT MANAGEMENT (Advanced)
 */

export const getNextDueDate = (dateStr, tenureType) => {
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return null;

  if (tenureType === 'Years') {
    date.setFullYear(date.getFullYear() + 1);
  } else {
    // Months - Handle edge cases like Jan 31 -> Feb 28
    const currentMonth = date.getMonth();
    date.setMonth(currentMonth + 1);
    if (date.getMonth() !== (currentMonth + 1) % 12) {
      date.setDate(0); 
    }
  }
  return date.toISOString().split('T')[0];
};

/**
 * Calculate the next due date for an EXISTING investment by advancing
 * the start date by (completedInstallments) full periods.
 * Supports Months, Years, and Quarters.
 */
export const getExistingNextDueDate = (startDateStr, completedInstallments, tenureType) => {
  const date = new Date(startDateStr);
  if (isNaN(date.getTime()) || completedInstallments <= 0) return startDateStr;

  const n = parseInt(completedInstallments, 10);

  if (tenureType === 'Years') {
    date.setFullYear(date.getFullYear() + n);
  } else if (tenureType === 'Quarters') {
    // Each quarter = 3 months
    const targetMonth = date.getMonth() + n * 3;
    date.setMonth(targetMonth);
  } else {
    // Default: Months
    const targetMonth = date.getMonth() + n;
    date.setMonth(targetMonth);
    // Fix month overflow (e.g. Jan 31 + 1 month)
    if (date.getDate() < new Date(startDateStr).getDate()) {
      date.setDate(0);
    }
  }
  return date.toISOString().split('T')[0];
};

export const addInvestment = (data) => {
  const { type, name, currency, recurring_amount, tenure_value, tenure_type, target_amount, start_date, notes, funded_by, is_existing, completed_installments, already_invested, payment_source, credit_card_id } = data;
  const db = getDb();

  if (is_existing) {
    // --- EXISTING INVESTMENT PATH ---
    // Already-paid installments do not affect cash flow.
    // We record them as an OB contribution for portfolio value only.
    const completedN = parseInt(completed_installments, 10) || 0;
    const alreadyInvestedAmt = parseFloat(already_invested) || 0;
    const nextDue = getExistingNextDueDate(start_date, completedN, tenure_type);

    // 1. Create master record with completed state
    const result = db.runSync(
      `INSERT INTO investments (type, name, currency, recurring_amount, tenure_value, tenure_type, target_amount, installments_paid, total_invested, next_due_date, start_date, notes, funded_by, completed_installments)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [type, name, currency, parseFloat(recurring_amount), parseInt(tenure_value), tenure_type,
       target_amount ? parseFloat(target_amount) : null,
       completedN, alreadyInvestedAmt, nextDue, start_date, notes, funded_by || 'OTHER', completedN]
    );
    const masterId = result.lastInsertRowId;

    // 2. OB contribution — for portfolio display only, excluded from cash-flow queries
    if (alreadyInvestedAmt > 0) {
      db.runSync(
        `INSERT INTO investment_contributions (investment_id, amount, currency, contribution_date, notes, is_opening_balance) VALUES (?, ?, ?, ?, ?, 1)`,
        [masterId, alreadyInvestedAmt, currency, start_date, 'Existing Investment (pre-tracking)', 1]
      );
    }
    return masterId;
  }

  // --- NEW INVESTMENT PATH ---
  const nextDue = getNextDueDate(start_date, tenure_type);
  
  // 1. Create Master Record
  const result = db.runSync(
    `INSERT INTO investments (type, name, currency, recurring_amount, tenure_value, tenure_type, target_amount, installments_paid, total_invested, next_due_date, start_date, notes, funded_by) 
     VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?, ?)`,
    [type, name, currency, parseFloat(recurring_amount), parseInt(tenure_value), tenure_type, target_amount ? parseFloat(target_amount) : null, parseFloat(recurring_amount), nextDue, start_date, notes, funded_by || 'OTHER']
  );
  
  const masterId = result.lastInsertRowId;
  
  // 2. Add 1st Contribution
  db.runSync(
    `INSERT INTO investment_contributions (investment_id, amount, currency, contribution_date, notes, payment_source, credit_card_id, funded_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [masterId, parseFloat(recurring_amount), currency, start_date, 'Initial Contribution', payment_source || 'Debit Card', credit_card_id || null, funded_by || 'OTHER']
  );

  return masterId;
};

export const addContribution = (investmentId, amount, date, notes = '', attachmentUri = null, paymentSource = 'Debit Card', creditCardId = null, fundedBy = 'OTHER') => {
  const db = getDb();
  
  // 1. Get current status
  const master = db.getFirstSync(`SELECT * FROM investments WHERE id = ?`, [investmentId]);
  if (!master) return;

  // 2. Insert contribution
  db.runSync(
    `INSERT INTO investment_contributions (investment_id, amount, currency, contribution_date, notes, attachment_uri, payment_source, credit_card_id, is_archived, funded_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?)`,
    [investmentId, parseFloat(amount), master.currency, date, notes, attachmentUri, paymentSource, creditCardId, fundedBy || 'OTHER']
  );

  // 3. Update master record
  const newCount = master.installments_paid + 1;
  const newTotal = master.total_invested + parseFloat(amount);
  const newNextDue = getNextDueDate(master.next_due_date || date, master.tenure_type);
  
  const tenureInMonths = master.tenure_type === 'Years' ? master.tenure_value * 12 : master.tenure_value;
  const status = newCount >= tenureInMonths ? 'Completed' : 'Active';

  db.runSync(
    `UPDATE investments SET installments_paid = ?, total_invested = ?, next_due_date = ?, status = ? WHERE id = ?`,
    [newCount, newTotal, newNextDue, status, investmentId]
  );
};

export const updateContribution = (id, { amount, date, notes, attachmentUri, paymentSource, creditCardId, funded_by, masterUpdates }) => {
  const db = getDb();
  const contribution = db.getFirstSync(`SELECT * FROM investment_contributions WHERE id = ?`, [id]);
  if (!contribution) return;

  const sets = [];
  const params = [];
  if (amount !== undefined) { sets.push('amount = ?'); params.push(parseFloat(amount)); }
  if (date !== undefined) { sets.push('contribution_date = ?'); params.push(date); }
  if (notes !== undefined) { sets.push('notes = ?'); params.push(notes); }
  if (attachmentUri !== undefined) { sets.push('attachment_uri = ?'); params.push(attachmentUri); }
  if (paymentSource !== undefined) { sets.push('payment_source = ?'); params.push(paymentSource); }
  if (creditCardId !== undefined) { sets.push('credit_card_id = ?'); params.push(creditCardId); }
  if (funded_by !== undefined) { sets.push('funded_by = ?'); params.push(funded_by || 'OTHER'); }

  if (sets.length > 0) {
    params.push(id);
    db.runSync(`UPDATE investment_contributions SET ${sets.join(', ')} WHERE id = ?`, params);
  }

  // 2. Recalculate Master Total & Update Master Fields
  const all = db.getAllSync(`SELECT amount FROM investment_contributions WHERE investment_id = ?`, [contribution.investment_id]);
  const newTotal = all.reduce((sum, c) => sum + c.amount, 0);
  
  let mUpdateSql = 'total_invested = ?';
  const mParams = [newTotal];

  if (masterUpdates) {
    const { name, category, tenure_value, tenure_type, target_amount } = masterUpdates;
    if (name) { mUpdateSql += ', name = ?'; mParams.push(name); }
    if (category) { mUpdateSql += ', type = ?'; mParams.push(category); }
    if (tenure_value) { mUpdateSql += ', tenure_value = ?'; mParams.push(parseInt(tenure_value)); }
    if (tenure_type) { mUpdateSql += ', tenure_type = ?'; mParams.push(tenure_type); }
    if (target_amount !== undefined) { mUpdateSql += ', target_amount = ?'; mParams.push(target_amount ? parseFloat(target_amount) : null); }
  }

  mParams.push(contribution.investment_id);
  db.runSync(`UPDATE investments SET ${mUpdateSql} WHERE id = ?`, mParams);
};

export const deleteContribution = (id) => {
  const db = getDb();
  const contribution = db.getFirstSync(`SELECT * FROM investment_contributions WHERE id = ?`, [id]);
  if (!contribution) return;

  const invId = contribution.investment_id;

  // 1. Delete
  db.runSync(`DELETE FROM investment_contributions WHERE id = ?`, [id]);

  // 2. Recalculate Master
  const all = db.getAllSync(`SELECT amount FROM investment_contributions WHERE investment_id = ?`, [invId]);
  const newTotal = all.reduce((sum, c) => sum + c.amount, 0);
  const newCount = all.length;
  
  if (newCount === 0) {
    db.runSync(`DELETE FROM investments WHERE id = ?`, [invId]);
  } else {
    db.runSync(`UPDATE investments SET total_invested = ?, installments_paid = ? WHERE id = ?`, [newTotal, newCount, invId]);
  }
};

export const getInvestmentContributions = (investmentId) => {
  const db = getDb();
  return db.getAllSync(
    `SELECT * FROM investment_contributions WHERE investment_id = ? ORDER BY contribution_date DESC`,
    [investmentId]
  );
};

const appendTransactionFilters = (alias, dateField = 'date') => {
  let clause = '';
  const params = [];
  const add = (sql, ...vals) => {
    clause += sql;
    params.push(...vals);
  };
  return {
    clause: () => clause,
    paramList: () => params,
    withCurrency: (currency) => {
      if (currency && currency !== 'all') {
        add(` AND ${alias}.currency = ?`, currency);
      } else {
        const activeCurs = getActiveCurrencies();
        if (activeCurs.length === 0) {
          add(` AND 1=0`);
        } else {
          const placeholders = activeCurs.map(() => '?').join(', ');
          add(` AND ${alias}.currency IN (${placeholders})`, ...activeCurs);
        }
      }
    },
    withStartDate: (startDate) => {
      if (!startDate) return;
      add(` AND ${alias}.${dateField} >= ?`, startDate);
    },
    withEndDate: (endDate) => {
      if (!endDate) return;
      add(` AND ${alias}.${dateField} <= ?`, endDate);
    },
    withInvestmentId: (id) => {
      if (!id) return;
      add(` AND ${alias}.investment_id = ?`, id);
    },
    withSearch: (query) => {
      if (!query) return;
      const q = `%${query}%`;
      const searchAlias = alias === 'ic' ? 'inv.name' : `${alias}.category`;
      add(` AND (${searchAlias} LIKE ? OR ${alias}.notes LIKE ? OR CAST(${alias}.amount AS TEXT) LIKE ? OR ${alias}.currency LIKE ? OR strftime('%m', ${alias}.${dateField}) LIKE ? OR strftime('%B', ${alias}.${dateField}) LIKE ?)`, q, q, q, q, q, q);
    },
    withArchived: (archiveMode) => {
      if (archiveMode === 'Archived') add(` AND ${alias}.is_archived = 1`);
      else if (archiveMode === 'Active') add(` AND ${alias}.is_archived = 0`);
    },
    withPaymentSource: (paymentSource, tableHasPs) => {
      if (!paymentSource || paymentSource === 'all') return;
      if (!tableHasPs) {
        add(` AND 1=0`);
      } else {
        add(` AND ${alias}.payment_source = ?`, paymentSource);
      }
    },
    withFundedBy: (fundedBy, ownerCol) => {
      if (!fundedBy || fundedBy === 'all') return;
      if (!ownerCol) {
        add(` AND 1=0`);
      } else {
        add(` AND ${alias}.${ownerCol} = ?`, fundedBy);
      }
    },
  };
};

export const updateTransaction = (type, id, data) => {
  const db = getDb();
  let table = type === 'income' ? 'income' : type === 'expense' ? 'expenses' : 'investment_contributions';
  
  const sets = [];
  const params = [];
  if (data.amount !== undefined) { sets.push('amount = ?'); params.push(parseFloat(data.amount)); }
  if (data.currency) { sets.push('currency = ?'); params.push(data.currency); }
  if (data.date) { sets.push('date = ?'); params.push(data.date); }
  if (data.category) { sets.push('category = ?'); params.push(data.category); }
  if (data.notes !== undefined) { sets.push('notes = ?'); params.push(data.notes); }
  if (data.attachmentUri !== undefined) { sets.push('attachment_uri = ?'); params.push(data.attachmentUri); }

  if (type === 'income' && data.owner !== undefined) {
    sets.push('income_source = ?');
    params.push(data.owner || 'OTHER');
  } else if (type === 'expense') {
    if (data.owner !== undefined) {
      sets.push('funded_by = ?');
      params.push(data.owner || 'OTHER');
    }
    if (data.paymentSource !== undefined) {
      sets.push('payment_source = ?');
      params.push(data.paymentSource);
    }
    if (data.creditCardId !== undefined) {
      sets.push('credit_card_id = ?');
      params.push(data.paymentSource === 'Credit Card' ? data.creditCardId : null);
    }
  }

  if (sets.length === 0) return;
  params.push(id);
  db.runSync(`UPDATE ${table} SET ${sets.join(', ')} WHERE id = ?`, params);
};

export const getTransactions = (filters = {}) => {
  const { limit = 100, currency, type, startDate, endDate, search, investmentId, archiveMode = 'Active', paymentSource, fundedBy } = filters;
  const db = getDb();

  let income = [];
  let expenses = [];
  let investments = [];

  if ((!type || type === 'income') && !investmentId) {
    const b = appendTransactionFilters('i');
    b.withCurrency(currency);
    b.withStartDate(startDate);
    b.withEndDate(endDate);
    b.withSearch(search);
    b.withArchived(archiveMode);
    
    if (paymentSource && paymentSource !== 'all') {
      // income rows don't have payment_source; skip them entirely
    } else {
      if (fundedBy && fundedBy !== 'all') {
        b.withFundedBy(fundedBy, 'income_source');
      }
      const q = `SELECT i.id, i.amount, i.currency, i.date, i.category, i.notes, i.attachment_uri, i.is_archived, 'income' as type, COALESCE(c.icon, 'ellipse-outline') as icon 
                 FROM income i LEFT JOIN categories c ON i.category = c.name AND c.type = 'income' WHERE 1=1${b.clause()}`;
      income = db.getAllSync(q, b.paramList());
    }
  }

  if ((!type || type === 'expense') && !investmentId) {
    const b = appendTransactionFilters('e');
    b.withCurrency(currency);
    b.withStartDate(startDate);
    b.withEndDate(endDate);
    b.withSearch(search);
    b.withArchived(archiveMode);
    
    if (paymentSource && paymentSource !== 'all') {
      b.withPaymentSource(paymentSource, true);
    }
    if (fundedBy && fundedBy !== 'all') {
      b.withFundedBy(fundedBy, 'funded_by');
    }
    const q = `SELECT e.id, e.amount, e.currency, e.date, e.category, e.notes, e.attachment_uri, e.is_archived, e.payment_source, e.credit_card_id, 'expense' as type, COALESCE(c.icon, 'ellipse-outline') as icon 
               FROM expenses e LEFT JOIN categories c ON e.category = c.name AND c.type = 'expense' WHERE 1=1${b.clause()}`;
    expenses = db.getAllSync(q, b.paramList());
  }

  if (!type || type === 'investment' || investmentId) {
    const b = appendTransactionFilters('ic', 'contribution_date');
    b.withCurrency(currency);
    b.withStartDate(startDate);
    b.withEndDate(endDate);
    b.withSearch(search);
    b.withInvestmentId(investmentId);
    b.withArchived(archiveMode);
    
    if (paymentSource && paymentSource !== 'all') {
      b.withPaymentSource(paymentSource, true);
    }
    if (fundedBy && fundedBy !== 'all') {
      b.withFundedBy(fundedBy, 'funded_by');
    }
    
    const q = `SELECT ic.id, ic.amount, ic.currency, ic.contribution_date as date, inv.name as category, ic.notes, ic.attachment_uri, ic.is_archived, 'investment' as type, COALESCE(cat.icon, 'briefcase-outline') as icon 
               FROM investment_contributions ic 
               JOIN investments inv ON ic.investment_id = inv.id 
               LEFT JOIN categories cat ON inv.type = cat.name AND cat.type = 'investment'
               WHERE ic.is_opening_balance = 0${b.clause()}`;
    investments = db.getAllSync(q, b.paramList());
  }

  return [...income, ...expenses, ...investments]
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .slice(0, limit);
};

export const getDashboardBalances = () => {
  const db = getDb();

  // [DB PRE-DASHBOARD CHECK] Verify column presence on the exact same DB connection
  try {
    const tableInfo = db.getAllSync(`PRAGMA table_info(loans);`);
    const hasOpeningCol = tableInfo.some(c => c.name === 'is_opening_balance');
    console.log(`[DB PRE-DASHBOARD CHECK] loans.is_opening_balance exists = ${hasOpeningCol ? 'YES' : 'NO'}`);
    
    if (!hasOpeningCol) {
      throw new Error(`[DB PRE-DASHBOARD CHECK] loans.is_opening_balance exists = NO. Database initialization has not completed.`);
    }
  } catch (e) {
    console.error('Pre-Dashboard audit check error:', e);
    throw e;
  }

  const getByCode = (code) => {
    if (!isCurrencyActive(code)) {
      return { income: 0, expense: 0, investment: 0, balance: 0 };
    }
    const income = db.getFirstSync(`SELECT SUM(amount) as total FROM income WHERE currency = ? AND is_archived = 0`, [code])?.total || 0;
    const expense = db.getFirstSync(`SELECT SUM(amount) as total FROM expenses WHERE currency = ? AND is_archived = 0`, [code])?.total || 0;
    const investment = db.getFirstSync(`SELECT SUM(amount) as total FROM investment_contributions WHERE currency = ? AND is_archived = 0 AND is_opening_balance = 0`, [code])?.total || 0;
    
    // --- Real (new) loans: full outstanding calculation ---
    const totalGiven = db.getFirstSync(
      `SELECT SUM(amount) as total FROM loans WHERE type = 'I Gave' AND currency = ? AND is_opening_balance = 0`,
      [code]
    )?.total || 0;

    const totalBorrowed = db.getFirstSync(
      `SELECT SUM(amount) as total FROM loans WHERE type = 'I Borrowed' AND currency = ? AND is_opening_balance = 0`,
      [code]
    )?.total || 0;

    const totalRecovered = db.getFirstSync(
      `SELECT SUM(r.amount) as total 
       FROM loan_repayments r 
       JOIN loans l ON r.loan_id = l.id 
       WHERE l.type = 'I Gave' AND l.currency = ? AND l.is_opening_balance = 0`,
      [code]
    )?.total || 0;

    const totalPaid = db.getFirstSync(
      `SELECT SUM(r.amount) as total 
       FROM loan_repayments r 
       JOIN loans l ON r.loan_id = l.id 
       WHERE l.type = 'I Borrowed' AND l.currency = ? AND l.is_opening_balance = 0`,
      [code]
    )?.total || 0;

    // --- Existing loans: only repayments/recoveries flow through balance ---
    const recoveredFromExisting = db.getFirstSync(
      `SELECT SUM(r.amount) as total FROM loan_repayments r JOIN loans l ON r.loan_id = l.id WHERE l.type = 'I Gave' AND l.currency = ? AND l.is_opening_balance = 1`, [code]
    )?.total || 0;
    const paidOnExisting = db.getFirstSync(
      `SELECT SUM(r.amount) as total FROM loan_repayments r JOIN loans l ON r.loan_id = l.id WHERE l.type = 'I Borrowed' AND l.currency = ? AND l.is_opening_balance = 1`, [code]
    )?.total || 0;

    const outstandingGiven = Math.max(0, totalGiven - totalRecovered);
    const outstandingBorrowed = Math.max(0, totalBorrowed - totalPaid);

    return { 
      income, 
      expense, 
      investment, 
      balance: income + outstandingBorrowed + recoveredFromExisting - expense - investment - outstandingGiven - paidOnExisting
    };
  };
  return { AED: getByCode('AED'), INR: getByCode('INR') };
};

export const getOwnerBalances = () => {
  const db = getDb();
  const getByCode = (code) => {
    if (!isCurrencyActive(code)) {
      return { SELF: 0, SPOUSE: 0, OTHER: 0 };
    }
    const owners = ['SELF', 'SPOUSE', 'OTHER'];
    const balances = { SELF: 0, SPOUSE: 0, OTHER: 0 };

    owners.forEach(owner => {
      const income = db.getFirstSync(`SELECT SUM(amount) as total FROM income WHERE currency = ? AND is_archived = 0 AND income_source = ?`, [code, owner])?.total || 0;
      const expense = db.getFirstSync(`SELECT SUM(amount) as total FROM expenses WHERE currency = ? AND is_archived = 0 AND funded_by = ?`, [code, owner])?.total || 0;
      
      const investment = db.getFirstSync(`SELECT SUM(ic.amount) as total FROM investment_contributions ic JOIN investments inv ON ic.investment_id = inv.id WHERE ic.currency = ? AND ic.is_archived = 0 AND ic.is_opening_balance = 0 AND inv.funded_by = ?`, [code, owner])?.total || 0;

      // Real loans
      const totalGiven = db.getFirstSync(`SELECT SUM(amount) as total FROM loans WHERE type = 'I Gave' AND currency = ? AND is_opening_balance = 0 AND funded_by = ?`, [code, owner])?.total || 0;
      const totalBorrowed = db.getFirstSync(`SELECT SUM(amount) as total FROM loans WHERE type = 'I Borrowed' AND currency = ? AND is_opening_balance = 0 AND funded_by = ?`, [code, owner])?.total || 0;

      const totalRecovered = db.getFirstSync(`SELECT SUM(r.amount) as total FROM loan_repayments r JOIN loans l ON r.loan_id = l.id WHERE l.type = 'I Gave' AND l.currency = ? AND l.funded_by = ? AND l.is_opening_balance = 0`, [code, owner])?.total || 0;
      const totalPaid = db.getFirstSync(`SELECT SUM(r.amount) as total FROM loan_repayments r JOIN loans l ON r.loan_id = l.id WHERE l.type = 'I Borrowed' AND l.currency = ? AND l.funded_by = ? AND l.is_opening_balance = 0`, [code, owner])?.total || 0;

      // Existing loans: only repayments/recoveries flow through balance
      const recoveredFromExisting = db.getFirstSync(`SELECT SUM(r.amount) as total FROM loan_repayments r JOIN loans l ON r.loan_id = l.id WHERE l.type = 'I Gave' AND l.currency = ? AND l.funded_by = ? AND l.is_opening_balance = 1`, [code, owner])?.total || 0;
      const paidOnExisting = db.getFirstSync(`SELECT SUM(r.amount) as total FROM loan_repayments r JOIN loans l ON r.loan_id = l.id WHERE l.type = 'I Borrowed' AND l.currency = ? AND l.funded_by = ? AND l.is_opening_balance = 1`, [code, owner])?.total || 0;

      const outstandingGiven = Math.max(0, totalGiven - totalRecovered);
      const outstandingBorrowed = Math.max(0, totalBorrowed - totalPaid);

      balances[owner] = income + outstandingBorrowed + recoveredFromExisting - expense - investment - outstandingGiven - paidOnExisting;
    });
    return balances;
  };
  return { AED: getByCode('AED'), INR: getByCode('INR') };
};

export const getActiveInvestmentsSummary = () => {
  const db = getDb();
  const activeCurs = getActiveCurrencies();
  if (activeCurs.length === 0) return [];
  const placeholders = activeCurs.map(() => '?').join(', ');
  return db.getAllSync(`
    SELECT * FROM investments 
    WHERE status = 'Active' AND currency IN (${placeholders})
    ORDER BY created_at DESC
  `, activeCurs);
};

export const getInvestmentAnalytics = (currency, ownerFilter) => {
  const db = getDb();
  
  let activeInvestments, completedInvestments, archivedInvestments;
  
  if (ownerFilter && ownerFilter !== 'ALL') {
    const query = (statusClause) => `
      SELECT inv.id, inv.type, inv.name, inv.currency, inv.recurring_amount, inv.tenure_value, inv.tenure_type, inv.target_amount, inv.installments_paid,
             SUM(ic.amount) as total_invested, inv.next_due_date, inv.status, inv.start_date, inv.notes, inv.created_at,
             COALESCE(cat.icon, 'briefcase-outline') as icon
      FROM investments inv
      JOIN investment_contributions ic ON ic.investment_id = inv.id
      LEFT JOIN categories cat ON inv.type = cat.name AND cat.type = 'investment'
      WHERE inv.currency = ? AND ${statusClause} AND ic.is_archived = 0 AND ic.funded_by = ?
      GROUP BY inv.id
      ORDER BY inv.created_at DESC
    `;
    
    activeInvestments = db.getAllSync(query("(inv.status = 'Active' OR inv.status IS NULL)"), [currency, ownerFilter]);
    completedInvestments = db.getAllSync(query("inv.status = 'Completed'"), [currency, ownerFilter]);
    archivedInvestments = db.getAllSync(query("inv.status = 'Archived'"), [currency, ownerFilter]);
  } else {
    const query = (statusClause) => `
      SELECT inv.*, COALESCE(cat.icon, 'briefcase-outline') as icon 
      FROM investments inv 
      LEFT JOIN categories cat ON inv.type = cat.name AND cat.type = 'investment'
      WHERE inv.currency = ? AND ${statusClause} 
      ORDER BY inv.created_at DESC
    `;
    
    activeInvestments = db.getAllSync(query("(inv.status = 'Active' OR inv.status IS NULL)"), [currency]);
    completedInvestments = db.getAllSync(query("inv.status = 'Completed'"), [currency]);
    archivedInvestments = db.getAllSync(query("inv.status = 'Archived'"), [currency]);
  }

  const totalInvested = db.getFirstSync(
    `SELECT SUM(ic.amount) as total 
     FROM investment_contributions ic
     JOIN investments inv ON ic.investment_id = inv.id
     WHERE ic.currency = ? AND ic.is_archived = 0${ownerFilter && ownerFilter !== 'ALL' ? ' AND ic.funded_by = ?' : ''}`,
    ownerFilter && ownerFilter !== 'ALL' ? [currency, ownerFilter] : [currency]
  )?.total || 0;

  const investmentBreakdown = db.getAllSync(`
    SELECT ic.funded_by as funded_by, SUM(ic.amount) as total 
    FROM investment_contributions ic
    JOIN investments inv ON ic.investment_id = inv.id
    WHERE ic.currency = ? AND ic.is_archived = 0
    GROUP BY ic.funded_by
  `, [currency]);

  const investmentByFunding = { SELF: 0, SPOUSE: 0, OTHER: 0 };
  investmentBreakdown.forEach(row => {
    investmentByFunding[row.funded_by || 'OTHER'] = row.total;
  });

  return {
    activeInvestments,
    completedInvestments,
    archivedInvestments,
    totalInvested,
    investmentByFunding
  };
};

export const archiveInvestment = (id) => {
  const db = getDb();
  db.runSync(`UPDATE investments SET status = 'Archived' WHERE id = ?`, [id]);
};

export const deleteInvestment = (id) => {
  const db = getDb();
  db.runSync(`DELETE FROM investments WHERE id = ?`, [id]);
  db.runSync(`DELETE FROM investment_contributions WHERE investment_id = ?`, [id]);
};

export const clearAllInvestments = () => {
  const db = getDb();
  db.runSync(`DELETE FROM investment_contributions`);
  db.runSync(`DELETE FROM investments`);
};

export const getInvestments = (status = 'Active') => {
  const db = getDb();
  if (status === 'All') {
    return db.getAllSync(`SELECT * FROM investments ORDER BY name ASC`);
  }
  return db.getAllSync(`SELECT * FROM investments WHERE status = ? ORDER BY name ASC`, [status]);
};

export const getTransactionById = (type, id) => {
  const db = getDb();
  let table = type === 'income' ? 'income' : type === 'expense' ? 'expenses' : 'investment_contributions';
  const row = db.getFirstSync(`SELECT * FROM ${table} WHERE id = ?`, [id]);
  if (!row) return null;
  return { ...row, type };
};

export const deleteTransaction = (type, id) => {
  const db = getDb();
  if (type === 'income') {
    db.runSync(`DELETE FROM income WHERE id = ?`, [id]);
  } else if (type === 'expense') {
    db.runSync(`DELETE FROM expenses WHERE id = ?`, [id]);
  } else if (type === 'investment') {
    deleteContribution(id);
  }
};

export const getRecentTransactions = (limit = 8) => {
  return getTransactions({ limit });
};

export const getCategories = (type) => {
  const db = getDb();
  return db.getAllSync('SELECT id, name, icon FROM categories WHERE type = ? ORDER BY is_custom ASC, name ASC', [type]);
};

export const addCategory = (name, type, icon = 'ellipse-outline') => {
  const db = getDb();
  const trimmed = name.trim();
  if (!trimmed) throw new Error('Category name cannot be empty');
  const existing = db.getFirstSync('SELECT id FROM categories WHERE name = ? AND type = ?', [trimmed, type]);
  if (existing) throw new Error(`Category "${trimmed}" already exists`);
  db.runSync('INSERT INTO categories (name, type, icon, is_custom) VALUES (?, ?, ?, 1)', [trimmed, type, icon]);
};

export const getCategoryUsage = (name, type) => {
  const db = getDb();
  const table = type === 'income' ? 'income' : 'expenses';
  if (type !== 'income' && type !== 'expense') return { count: 0, total: 0 };
  const res = db.getFirstSync(`SELECT COUNT(*) as count, SUM(amount) as total FROM ${table} WHERE category = ?`, [name]);
  return { count: res?.count || 0, total: res?.total || 0 };
};

export const getCategoryTransactions = (name, type) => {
  const db = getDb();
  const table = type === 'income' ? 'income' : 'expenses';
  if (type !== 'income' && type !== 'expense') return [];
  return db.getAllSync(`SELECT *, '${type}' as type FROM ${table} WHERE category = ? ORDER BY date DESC`, [name]);
};

export const reassignTransactionCategory = (type, transactionId, newCategory) => {
  const db = getDb();
  const table = type === 'income' ? 'income' : 'expenses';
  db.runSync(`UPDATE ${table} SET category = ? WHERE id = ?`, [newCategory, transactionId]);
};

export const bulkReassignCategory = (type, oldCategory, newCategory) => {
  const db = getDb();
  const table = type === 'income' ? 'income' : 'expenses';
  db.runSync(`UPDATE ${table} SET category = ? WHERE category = ?`, [newCategory, oldCategory]);
};

export const safeDeleteCategory = (id) => {
  const db = getDb();
  db.runSync('DELETE FROM categories WHERE id = ?', [id]);
};

export const updateCategory = (id, oldName, newName, type, icon) => {
  const db = getDb();
  const trimmedNew = newName.trim();
  if (!trimmedNew) throw new Error('Category name cannot be empty');
  const existing = db.getFirstSync('SELECT id FROM categories WHERE name = ? AND type = ? AND id != ?', [trimmedNew, type, id]);
  if (existing) throw new Error(`Category "${trimmedNew}" already exists`);
  db.runSync('UPDATE categories SET name = ?, icon = ? WHERE id = ?', [trimmedNew, icon, id]);
  if (trimmedNew !== oldName) {
    if (type === 'income') db.runSync('UPDATE income SET category = ? WHERE category = ?', [trimmedNew, oldName]);
    else if (type === 'expense') db.runSync('UPDATE expenses SET category = ? WHERE category = ?', [trimmedNew, oldName]);
  }
};

export const getArchivableCount = (monthsAgo = 6) => {
  const db = getDb();
  const dateLimit = new Date();
  dateLimit.setMonth(dateLimit.getMonth() - monthsAgo);
  const isoLimit = dateLimit.toISOString().split('T')[0];

  const incomeCount = db.getFirstSync(`SELECT COUNT(*) as count FROM income WHERE is_archived = 0 AND date < ?`, [isoLimit])?.count || 0;
  const expenseCount = db.getFirstSync(`SELECT COUNT(*) as count FROM expenses WHERE is_archived = 0 AND date < ?`, [isoLimit])?.count || 0;
  const invCount = db.getFirstSync(`SELECT COUNT(*) as count FROM investment_contributions WHERE is_archived = 0 AND contribution_date < ?`, [isoLimit])?.count || 0;

  return incomeCount + expenseCount + invCount;
};

export const getArchivableTransactions = (monthsAgo = 6) => {
  const db = getDb();
  const dateLimit = new Date();
  dateLimit.setMonth(dateLimit.getMonth() - monthsAgo);
  const isoLimit = dateLimit.toISOString().split('T')[0];

  const income = db.getAllSync(`SELECT id, amount, currency, date, category, notes, 'income' as type FROM income WHERE is_archived = 0 AND date < ?`, [isoLimit]);
  const expenses = db.getAllSync(`SELECT id, amount, currency, date, category, notes, 'expense' as type FROM expenses WHERE is_archived = 0 AND date < ?`, [isoLimit]);
  
  const investRows = db.getAllSync(`
    SELECT ic.id, ic.amount, ic.currency, ic.contribution_date as date, inv.name as category, ic.notes, 'investment' as type 
    FROM investment_contributions ic
    JOIN investments inv ON ic.investment_id = inv.id
    WHERE ic.is_archived = 0 AND ic.contribution_date < ?
  `, [isoLimit]);

  return [...income, ...expenses, ...investRows].sort((a, b) => new Date(b.date) - new Date(a.date));
};

export const archiveOldTransactions = (monthsAgo = 6) => {
  const db = getDb();
  const dateLimit = new Date();
  dateLimit.setMonth(dateLimit.getMonth() - monthsAgo);
  const isoLimit = dateLimit.toISOString().split('T')[0];

  db.runSync(`UPDATE income SET is_archived = 1 WHERE is_archived = 0 AND date < ?`, [isoLimit]);
  db.runSync(`UPDATE expenses SET is_archived = 1 WHERE is_archived = 0 AND date < ?`, [isoLimit]);
  db.runSync(`UPDATE investment_contributions SET is_archived = 1 WHERE is_archived = 0 AND contribution_date < ?`, [isoLimit]);
};

export const toggleArchiveStatus = (type, id, isArchived) => {
  const db = getDb();
  let table = type === 'income' ? 'income' : type === 'expense' ? 'expenses' : 'investment_contributions';
  db.runSync(`UPDATE ${table} SET is_archived = ? WHERE id = ?`, [isArchived ? 1 : 0, id]);
};

export const getReportData = (currency, startDate, endDate, search, archiveMode = 'Active', ownerFilter) => {
  const db = getDb();
  const baseParams = [currency, startDate, endDate];
  let searchClause = '';
  let searchParams = [];
  if (search) {
    const q = `%${search}%`;
    searchClause = ` AND (category LIKE ? OR notes LIKE ? OR CAST(amount AS TEXT) LIKE ? OR currency LIKE ? OR strftime('%m', date) LIKE ? OR strftime('%B', date) LIKE ?)`;
    searchParams = [q, q, q, q, q, q];
  }
  
  const arch = archiveMode === 'Archived' ? ' AND is_archived = 1' : archiveMode === 'Active' ? ' AND is_archived = 0' : '';
  const archE = archiveMode === 'Archived' ? ' AND e.is_archived = 1' : archiveMode === 'Active' ? ' AND e.is_archived = 0' : '';

  const ownerClauseI = ownerFilter && ownerFilter !== 'ALL' ? ' AND income_source = ?' : '';
  const ownerClauseE = ownerFilter && ownerFilter !== 'ALL' ? ' AND funded_by = ?' : '';
  const ownerClauseIc = ownerFilter && ownerFilter !== 'ALL' ? ' AND ic.funded_by = ?' : '';
  const ownerClauseEB = ownerFilter && ownerFilter !== 'ALL' ? ' AND e.funded_by = ?' : '';
  const ownerParams = ownerFilter && ownerFilter !== 'ALL' ? [ownerFilter] : [];

  const incomeRes = db.getFirstSync(`SELECT SUM(amount) as total FROM income WHERE currency = ? AND date >= ? AND date <= ?${searchClause}${arch}${ownerClauseI}`, [...baseParams, ...searchParams, ...ownerParams]);
  const totalIncome = incomeRes?.total || 0;
  
  const expenseRes = db.getFirstSync(`SELECT SUM(amount) as total FROM expenses WHERE currency = ? AND date >= ? AND date <= ?${searchClause}${arch}${ownerClauseE}`, [...baseParams, ...searchParams, ...ownerParams]);
  const totalExpense = expenseRes?.total || 0;

  const investRes = db.getFirstSync(`
    SELECT SUM(ic.amount) as total 
    FROM investment_contributions ic
    JOIN investments inv ON ic.investment_id = inv.id
    WHERE ic.currency = ? AND ic.contribution_date >= ? AND ic.contribution_date <= ? AND (ic.is_opening_balance IS NULL OR ic.is_opening_balance = 0)${searchClause.replace(/date/g, 'ic.contribution_date')}${arch.replace(/is_archived/g, 'ic.is_archived')}${ownerClauseIc}`, 
    [...baseParams, ...searchParams, ...ownerParams]
  );
  const totalInvestment = investRes?.total || 0;

  const loanGivenRes = db.getFirstSync(`SELECT SUM(amount) as total FROM loans WHERE type = 'I Gave' AND currency = ? AND start_date >= ? AND start_date <= ? AND (is_opening_balance IS NULL OR is_opening_balance = 0)${searchClause.replace(/category/g, 'person_name').replace(/date/g, 'start_date')}${ownerClauseE}`, [...baseParams, ...searchParams, ...ownerParams]);
  const totalLoanGiven = loanGivenRes?.total || 0;

  const loanRecoveredRes = db.getFirstSync(`SELECT SUM(r.amount) as total FROM loan_repayments r JOIN loans l ON r.loan_id = l.id WHERE l.type = 'I Gave' AND l.currency = ? AND r.date >= ? AND r.date <= ?${searchClause.replace(/category/g, 'l.person_name').replace(/date/g, 'r.date').replace(/amount/g, 'r.amount').replace(/notes/g, 'r.notes').replace(/currency/g, 'l.currency')}${ownerClauseE.replace(/funded_by/g, 'l.funded_by')}`, [...baseParams, ...searchParams, ...ownerParams]);
  const totalLoanRecovered = loanRecoveredRes?.total || 0;

  const breakdown = db.getAllSync(`
    SELECT e.category, SUM(e.amount) as total, c.icon 
    FROM expenses e
    LEFT JOIN categories c ON e.category = c.name AND c.type = 'expense'
    WHERE e.currency = ? AND e.date >= ? AND e.date <= ?${searchClause.replace(/category/g, 'e.category').replace(/notes/g, 'e.notes').replace(/amount/g, 'e.amount').replace(/currency/g, 'e.currency').replace(/date/g, 'e.date')}${archE}${ownerClauseEB}
    GROUP BY e.category
    ORDER BY total DESC
  `, [...baseParams, ...searchParams, ...ownerParams]);

  const incomeBreakdown = db.getAllSync(`
    SELECT income_source, SUM(amount) as total 
    FROM income 
    WHERE currency = ? AND date >= ? AND date <= ?${searchClause}${arch}${ownerClauseI}
    GROUP BY income_source
  `, [...baseParams, ...searchParams, ...ownerParams]);

  const expenseBreakdown = db.getAllSync(`
    SELECT funded_by, SUM(amount) as total 
    FROM expenses 
    WHERE currency = ? AND date >= ? AND date <= ?${searchClause}${arch}${ownerClauseE}
    GROUP BY funded_by
  `, [...baseParams, ...searchParams, ...ownerParams]);

  const incomeBySource = { SELF: 0, SPOUSE: 0, OTHER: 0 };
  incomeBreakdown.forEach(row => {
    incomeBySource[row.income_source || 'OTHER'] = row.total;
  });

  const expenseByFunding = { SELF: 0, SPOUSE: 0, OTHER: 0 };
  expenseBreakdown.forEach(row => {
    expenseByFunding[row.funded_by || 'OTHER'] = row.total;
  });
  
  return {
    totalIncome,
    totalExpense,
    totalInvestment,
    totalLoanGiven,
    totalLoanRecovered,
    savings: totalIncome + totalLoanRecovered - totalExpense - totalInvestment - totalLoanGiven,
    breakdown: breakdown.map(b => ({ ...b, percentage: totalExpense > 0 ? (b.total / totalExpense) * 100 : 0 })),
    incomeBySource,
    expenseByFunding
  };
};

export const getCreditCardSpending = (currency, startDate, endDate, archiveMode = 'Active', ownerFilter) => {
  const db = getDb();
  
  const archE = archiveMode === 'Archived' ? ' AND e.is_archived = 1' : archiveMode === 'Active' ? ' AND e.is_archived = 0' : '';
  const ownerClauseE = ownerFilter && ownerFilter !== 'ALL' ? ' AND e.funded_by = ?' : '';
  
  const archIC = archiveMode === 'Archived' ? ' AND ic.is_archived = 1' : archiveMode === 'Active' ? ' AND ic.is_archived = 0' : '';
  const ownerClauseIC = ownerFilter && ownerFilter !== 'ALL' ? ' AND inv.funded_by = ?' : '';
  
  const archL = archiveMode === 'Archived' ? ' AND l.is_archived = 1' : archiveMode === 'Active' ? ' AND l.is_archived = 0' : '';
  const ownerClauseL = ownerFilter && ownerFilter !== 'ALL' ? ' AND l.funded_by = ?' : '';

  const ownerParam = ownerFilter && ownerFilter !== 'ALL' ? [ownerFilter] : [];
  
  // We need 3 sets of params for the 3 UNIONed queries
  const unionParams = [
    currency, startDate, endDate, ...ownerParam,
    currency, startDate, endDate, ...ownerParam,
    currency, startDate, endDate, ...ownerParam
  ];

  const cteQuery = `
    WITH CombinedSpending AS (
      SELECT e.amount, e.credit_card_id, e.category
      FROM expenses e
      WHERE e.currency = ? AND e.date >= ? AND e.date <= ?${archE}${ownerClauseE}
      
      UNION ALL
      
      SELECT ic.amount, NULL as credit_card_id, inv.name as category
      FROM investment_contributions ic 
      JOIN investments inv ON ic.investment_id = inv.id
      WHERE ic.currency = ? AND ic.contribution_date >= ? AND ic.contribution_date <= ? AND ic.is_opening_balance = 0${archIC}${ownerClauseIC}
      
      UNION ALL
      
      SELECT r.amount, NULL as credit_card_id, 'Loan Repayment' as category
      FROM loan_repayments r 
      JOIN loans l ON r.loan_id = l.id
      WHERE l.currency = ? AND r.date >= ? AND r.date <= ? AND l.type = 'I Borrowed' AND l.is_opening_balance = 0${archL}${ownerClauseL}
    )
  `;

  const debitRes = db.getFirstSync(`${cteQuery} SELECT SUM(amount) as total FROM CombinedSpending WHERE credit_card_id IS NULL`, unionParams);
  const totalDebit = debitRes?.total || 0;

  const ccRes = db.getFirstSync(`${cteQuery} SELECT SUM(amount) as total FROM CombinedSpending WHERE credit_card_id IS NOT NULL`, unionParams);
  const totalCC = ccRes?.total || 0;

  const cards = db.getAllSync(`${cteQuery} 
    SELECT cc.id as credit_card_id, cc.name, cc.bank_name as bank, SUM(s.amount) as total
    FROM CombinedSpending s
    JOIN credit_cards cc ON s.credit_card_id = cc.id
    GROUP BY cc.id
    ORDER BY total DESC
  `, unionParams);

  // Rebuild the cards array with categories if needed (like previously done in analyticsService, wait, getCreditCardSpending didn't return categories before?
  // Let me just return cards. Wait, ReportsScreen uses cc.categories: cc.categories.slice(0, 2).
  // So I also need to get categories for each card.
  
  // Fetch top categories for each card
  const cardsWithCategories = cards.map(c => {
    const cats = db.getAllSync(`${cteQuery}
      SELECT category, SUM(amount) as catTotal
      FROM CombinedSpending
      WHERE credit_card_id = ?
      GROUP BY category
      ORDER BY catTotal DESC
    `, [...unionParams, c.credit_card_id]);
    return { ...c, categories: cats };
  });

  return { totalCC, totalDebit, cards: cardsWithCategories };
};

export const getCategoryTrends = (currency, archiveMode = 'Active', ownerFilter) => {
  const db = getDb();
  const archE = archiveMode === 'Archived' ? ' AND e.is_archived = 1' : archiveMode === 'Active' ? ' AND e.is_archived = 0' : '';
  const ownerClause = ownerFilter && ownerFilter !== 'ALL' ? ' AND e.funded_by = ?' : '';
  const ownerParams = ownerFilter && ownerFilter !== 'ALL' ? [ownerFilter] : [];

  const rows = db.getAllSync(`
    SELECT e.category, strftime('%Y-%m', e.date) as month, SUM(e.amount) as total, c.icon
    FROM expenses e
    LEFT JOIN categories c ON e.category = c.name AND c.type = 'expense'
    WHERE e.currency = ? AND e.date >= date('now', 'start of month', '-5 months')${archE}${ownerClause}
    GROUP BY e.category, month
    ORDER BY month DESC, total DESC
  `, [currency, ...ownerParams]);
  const trends = {};
  rows.forEach(row => {
    if (!trends[row.month]) trends[row.month] = [];
    trends[row.month].push({ category: row.category, total: row.total, icon: row.icon });
  });
  return trends;
};

export const getCashflowTrends = (currency, ownerFilter) => {
  const db = getDb();
  
  const archInc = ' AND is_archived = 0';
  const archExp = ' AND is_archived = 0';
  const archInv = ' AND ic.is_archived = 0';

  const ownerClauseInc = ownerFilter && ownerFilter !== 'ALL' ? ' AND income_source = ?' : '';
  const ownerClauseExp = ownerFilter && ownerFilter !== 'ALL' ? ' AND funded_by = ?' : '';
  const ownerClauseInv = ownerFilter && ownerFilter !== 'ALL' ? ' AND inv.funded_by = ?' : '';
  const ownerClauseL   = ownerFilter && ownerFilter !== 'ALL' ? ' AND funded_by = ?' : '';
  const ownerClauseLJ  = ownerFilter && ownerFilter !== 'ALL' ? ' AND l.funded_by = ?' : '';

  // Slots in order of UNION ALL appearance:
  //  1. income_source      (ownerClauseInc)
  //  2. expense funded_by  (ownerClauseExp)
  //  3. inv.funded_by      (ownerClauseInv)
  //  4. loan_given         (ownerClauseL  ) — I Gave creation
  //  5. loan_borrowed      (ownerClauseL  ) — I Borrowed creation
  //  6. loan_recovered_new (ownerClauseLJ ) — I Gave repayments (new)
  //  7. loan_repaid_new    (ownerClauseLJ ) — I Borrowed repayments (new)
  //  8. existing_recovered (ownerClauseLJ ) — I Gave repayments (existing)
  //  9. existing_repaid    (ownerClauseLJ ) — I Borrowed repayments (existing)
  const ownerParams = ownerFilter && ownerFilter !== 'ALL'
    ? Array(9).fill(ownerFilter)
    : [];

  const queryParams = [...ownerParams, currency];

  // This mirrors getDashboardBalances exactly, month by month:
  //   balance = income
  //           + totalBorrowed (new)          — money received when borrowing
  //           + totalRecovered (new I Gave)  — money received back from people we gave to
  //           + recoveredFromExisting         — money received from existing I Gave loans
  //           - expense
  //           - investment
  //           - totalGiven (new)              — money paid out when giving loans
  //           - totalPaid (new I Borrowed)    — money paid back on new borrowed loans
  //           - paidOnExisting                — money paid back on existing borrowed loans
  const rows = db.getAllSync(`
    SELECT strftime('%Y-%m', date) as month,
           SUM(CASE WHEN type = 'income'             THEN amount ELSE 0 END) as totalIncome,
           SUM(CASE WHEN type = 'expense'            THEN amount ELSE 0 END) as totalExpense,
           SUM(CASE WHEN type = 'investment'         THEN amount ELSE 0 END) as totalInvestment,
           SUM(CASE WHEN type = 'loan_given'         THEN amount ELSE 0 END) as totalLoanGiven,
           SUM(CASE WHEN type = 'loan_borrowed'      THEN amount ELSE 0 END) as totalLoanBorrowed,
           SUM(CASE WHEN type = 'loan_recovered_new' THEN amount ELSE 0 END) as totalLoanRecoveredNew,
           SUM(CASE WHEN type = 'loan_repaid_new'    THEN amount ELSE 0 END) as totalLoanRepaidNew,
           SUM(CASE WHEN type = 'loan_recovered_ex'  THEN amount ELSE 0 END) as totalLoanRecoveredEx,
           SUM(CASE WHEN type = 'loan_repaid_ex'     THEN amount ELSE 0 END) as totalLoanRepaidEx
    FROM (
      SELECT amount, currency, date, 'income' as type
        FROM income WHERE 1=1${archInc}${ownerClauseInc}
      UNION ALL
      SELECT amount, currency, date, 'expense' as type
        FROM expenses WHERE 1=1${archExp}${ownerClauseExp}
      UNION ALL
      SELECT ic.amount, ic.currency, ic.contribution_date as date, 'investment' as type
        FROM investment_contributions ic JOIN investments inv ON ic.investment_id = inv.id
        WHERE ic.is_opening_balance = 0${archInv}${ownerClauseInv}
      UNION ALL
      -- New I Gave creation → cash outflow
      SELECT amount, currency, start_date as date, 'loan_given' as type
        FROM loans WHERE type = 'I Gave' AND is_opening_balance = 0${ownerClauseL}
      UNION ALL
      -- New I Borrowed creation → cash inflow (money received)
      SELECT amount, currency, start_date as date, 'loan_borrowed' as type
        FROM loans WHERE type = 'I Borrowed' AND is_opening_balance = 0${ownerClauseL}
      UNION ALL
      -- Recovery on new I Gave loans → cash inflow
      SELECT r.amount, l.currency, r.date, 'loan_recovered_new' as type
        FROM loan_repayments r JOIN loans l ON r.loan_id = l.id
        WHERE l.type = 'I Gave' AND l.is_opening_balance = 0${ownerClauseLJ}
      UNION ALL
      -- Repayment on new I Borrowed loans → cash outflow
      SELECT r.amount, l.currency, r.date, 'loan_repaid_new' as type
        FROM loan_repayments r JOIN loans l ON r.loan_id = l.id
        WHERE l.type = 'I Borrowed' AND l.is_opening_balance = 0${ownerClauseLJ}
      UNION ALL
      -- Recovery on existing I Gave loans → cash inflow
      SELECT r.amount, l.currency, r.date, 'loan_recovered_ex' as type
        FROM loan_repayments r JOIN loans l ON r.loan_id = l.id
        WHERE l.type = 'I Gave' AND l.is_opening_balance = 1${ownerClauseLJ}
      UNION ALL
      -- Repayment on existing I Borrowed loans → cash outflow
      SELECT r.amount, l.currency, r.date, 'loan_repaid_ex' as type
        FROM loan_repayments r JOIN loans l ON r.loan_id = l.id
        WHERE l.type = 'I Borrowed' AND l.is_opening_balance = 1${ownerClauseLJ}
    )
    WHERE date >= date('now', 'start of month', '-5 months') AND currency = ?
    GROUP BY month
    ORDER BY month DESC
  `, queryParams);

  const trends = {};
  rows.forEach(row => {
    const inc = row.totalIncome          || 0;
    const exp = row.totalExpense         || 0;
    const inv = row.totalInvestment      || 0;
    const loanGiven     = row.totalLoanGiven        || 0;
    const loanBorrowed  = row.totalLoanBorrowed     || 0;
    const recoveredNew  = row.totalLoanRecoveredNew || 0;
    const repaidNew     = row.totalLoanRepaidNew    || 0;
    const recoveredEx   = row.totalLoanRecoveredEx  || 0;
    const repaidEx      = row.totalLoanRepaidEx     || 0;

    // Exactly mirrors getDashboardBalances:
    // balance = income + totalBorrowed + totalRecovered + recoveredFromExisting
    //         - expense - investment - totalGiven - totalPaid - paidOnExisting
    const savings = inc + loanBorrowed + recoveredNew + recoveredEx
                  - exp - inv - loanGiven - repaidNew - repaidEx;

    trends[row.month] = {
      savings,
      income:        inc,
      expense:       exp,
      investment:    inv,
      loanGiven,
      loanBorrowed,
      loanRecovered: recoveredNew + recoveredEx,
      loanRepaid:    repaidNew + repaidEx,
    };
  });
  return trends;
};

// --- CREDIT CARDS ---
export const getCreditCards = (activeOnly = false) => {
  const db = getDb();
  if (activeOnly) {
    return db.getAllSync(`SELECT * FROM credit_cards WHERE status = 'Active' ORDER BY name ASC`);
  }
  return db.getAllSync(`SELECT * FROM credit_cards ORDER BY status ASC, name ASC`);
};

export const addCreditCard = (name, last_4, bank_name, credit_limit, color, status = 'Active') => {
  const db = getDb();
  db.runSync(`
    INSERT INTO credit_cards (name, last_4, bank_name, credit_limit, color, status)
    VALUES (?, ?, ?, ?, ?, ?)
  `, [name, last_4, bank_name, credit_limit, color, status]);
};

export const updateCreditCard = (id, name, last_4, bank_name, credit_limit, color, status) => {
  const db = getDb();
  db.runSync(`
    UPDATE credit_cards 
    SET name = ?, last_4 = ?, bank_name = ?, credit_limit = ?, color = ?, status = ?
    WHERE id = ?
  `, [name, last_4, bank_name, credit_limit, color, status, id]);
};

export const deleteCreditCard = (id) => {
  const db = getDb();
  db.runSync(`DELETE FROM credit_cards WHERE id = ?`, [id]);
};

export const checkCreditCardInUse = (id) => {
  const db = getDb();
  const count = db.getFirstSync(`SELECT COUNT(*) as count FROM expenses WHERE credit_card_id = ?`, [id])?.count || 0;
  return count > 0;
};

export const getSavingsTrends = (archiveMode = 'Active', ownerFilter) => {
  const db = getDb();
  const archInc = archiveMode === 'Archived' ? ' AND is_archived = 1' : archiveMode === 'Active' ? ' AND is_archived = 0' : '';
  const archExp = archiveMode === 'Archived' ? ' AND is_archived = 1' : archiveMode === 'Active' ? ' AND is_archived = 0' : '';

  const ownerClauseInc = ownerFilter && ownerFilter !== 'ALL' ? ' AND income_source = ?' : '';
  const ownerClauseExp = ownerFilter && ownerFilter !== 'ALL' ? ' AND funded_by = ?' : '';
  const ownerParams = ownerFilter && ownerFilter !== 'ALL' ? [ownerFilter, ownerFilter] : [];

  const activeCurs = getActiveCurrencies();
  const safeCurs = (Array.isArray(activeCurs) && activeCurs.length > 0) ? activeCurs : ['AED', 'INR'];
  const placeholders = safeCurs.map(() => '?').join(', ');
  const queryParams = [...ownerParams, ...safeCurs];

  const rows = db.getAllSync(`
    SELECT strftime('%Y-%m', date) as month, currency, SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END) as totalIncome, SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END) as totalExpense
    FROM (
      SELECT amount, currency, date, 'income' as type FROM income WHERE 1=1${archInc}${ownerClauseInc}
      UNION ALL 
      SELECT amount, currency, date, 'expense' as type FROM expenses WHERE 1=1${archExp}${ownerClauseExp}
    )
    WHERE date >= date('now', 'start of month', '-5 months') AND currency IN (${placeholders})
    GROUP BY month, currency
    ORDER BY month DESC
  `, queryParams);
  const trends = {};
  rows.forEach(row => {
    if (!trends[row.month]) trends[row.month] = { AED: { savings: 0 }, INR: { savings: 0 } };
    trends[row.month][row.currency] = { savings: row.totalIncome - row.totalExpense, income: row.totalIncome, expense: row.totalExpense };
  });
  return trends;
};

export const getOwnershipBalanceBreakdown = (currency) => {
  const db = getDb();
  
  // Helper to get total income
  const getIncome = (owner) => {
    if (owner === 'TOTAL') {
      return db.getFirstSync(`SELECT SUM(amount) as total FROM income WHERE currency = ? AND is_archived = 0`, [currency])?.total || 0;
    } else {
      return db.getFirstSync(`SELECT SUM(amount) as total FROM income WHERE currency = ? AND is_archived = 0 AND income_source = ?`, [currency, owner])?.total || 0;
    }
  };

  // Helper to get total expense
  const getExpense = (owner) => {
    if (owner === 'TOTAL') {
      return db.getFirstSync(`SELECT SUM(amount) as total FROM expenses WHERE currency = ? AND is_archived = 0`, [currency])?.total || 0;
    } else {
      return db.getFirstSync(`SELECT SUM(amount) as total FROM expenses WHERE currency = ? AND is_archived = 0 AND funded_by = ?`, [currency, owner])?.total || 0;
    }
  };

  // Helper to get total investment
  const getInvestment = (owner) => {
    if (owner === 'TOTAL') {
      return db.getFirstSync(`SELECT SUM(amount) as total FROM investment_contributions WHERE currency = ? AND is_archived = 0`, [currency])?.total || 0;
    } else {
      return db.getFirstSync(`SELECT SUM(amount) as total FROM investment_contributions WHERE currency = ? AND is_archived = 0 AND funded_by = ?`, [currency, owner])?.total || 0;
    }
  };

  // Helper to get loan totals
  const getLoansData = (owner) => {
    let totalGiven = 0;
    let totalRecovered = 0;
    let totalBorrowed = 0;
    let totalPaid = 0;

    if (owner === 'TOTAL') {
      totalGiven = db.getFirstSync(`SELECT SUM(amount) as total FROM loans WHERE type = 'I Gave' AND currency = ?`, [currency])?.total || 0;
      totalRecovered = db.getFirstSync(`SELECT SUM(r.amount) as total FROM loan_repayments r JOIN loans l ON r.loan_id = l.id WHERE l.type = 'I Gave' AND l.currency = ?`, [currency])?.total || 0;
      totalBorrowed = db.getFirstSync(`SELECT SUM(amount) as total FROM loans WHERE type = 'I Borrowed' AND currency = ?`, [currency])?.total || 0;
      totalPaid = db.getFirstSync(`SELECT SUM(r.amount) as total FROM loan_repayments r JOIN loans l ON r.loan_id = l.id WHERE l.type = 'I Borrowed' AND l.currency = ?`, [currency])?.total || 0;
    } else {
      totalGiven = db.getFirstSync(`SELECT SUM(amount) as total FROM loans WHERE type = 'I Gave' AND currency = ? AND funded_by = ?`, [currency, owner])?.total || 0;
      totalRecovered = db.getFirstSync(`SELECT SUM(r.amount) as total FROM loan_repayments r JOIN loans l ON r.loan_id = l.id WHERE l.type = 'I Gave' AND l.currency = ? AND l.funded_by = ?`, [currency, owner])?.total || 0;
      totalBorrowed = db.getFirstSync(`SELECT SUM(amount) as total FROM loans WHERE type = 'I Borrowed' AND currency = ? AND funded_by = ?`, [currency, owner])?.total || 0;
      totalPaid = db.getFirstSync(`SELECT SUM(r.amount) as total FROM loan_repayments r JOIN loans l ON r.loan_id = l.id WHERE l.type = 'I Borrowed' AND l.currency = ? AND l.funded_by = ?`, [currency, owner])?.total || 0;
    }

    const outstandingGiven = Math.max(0, totalGiven - totalRecovered);
    const outstandingBorrowed = Math.max(0, totalBorrowed - totalPaid);
    const loanImpact = outstandingBorrowed - outstandingGiven;

    return { outstandingGiven, outstandingBorrowed, loanImpact };
  };

  const totalInc = getIncome('TOTAL');
  const totalExp = getExpense('TOTAL');
  const totalInv = getInvestment('TOTAL');
  const totalLoans = getLoansData('TOTAL');
  const totalBal = totalInc + totalLoans.outstandingBorrowed - totalExp - totalInv - totalLoans.outstandingGiven;

  const prathistaInc = getIncome('SELF');
  const prathistaExp = getExpense('SELF');
  const prathistaInv = getInvestment('SELF');
  const prathistaLoans = getLoansData('SELF');
  const prathistaBal = prathistaInc + prathistaLoans.outstandingBorrowed - prathistaExp - prathistaInv - prathistaLoans.outstandingGiven;

  const praveenInc = getIncome('SPOUSE');
  const praveenExp = getExpense('SPOUSE');
  const praveenInv = getInvestment('SPOUSE');
  const praveenLoans = getLoansData('SPOUSE');
  const praveenBal = praveenInc + praveenLoans.outstandingBorrowed - praveenExp - praveenInv - praveenLoans.outstandingGiven;

  // Calculate Other by subtraction to ensure perfect balance alignment down to the cent
  const otherInc = totalInc - prathistaInc - praveenInc;
  const otherExp = totalExp - prathistaExp - praveenExp;
  const otherInv = totalInv - prathistaInv - praveenInv;
  const otherLoans = {
    loanImpact: totalLoans.loanImpact - prathistaLoans.loanImpact - praveenLoans.loanImpact
  };
  const otherBal = totalBal - prathistaBal - praveenBal;

  return {
    prathista: {
      income: prathistaInc,
      expense: prathistaExp,
      investment: prathistaInv,
      loanImpact: prathistaLoans.loanImpact,
      balance: prathistaBal
    },
    praveen: {
      income: praveenInc,
      expense: praveenExp,
      investment: praveenInv,
      loanImpact: praveenLoans.loanImpact,
      balance: praveenBal
    },
    other: {
      income: otherInc,
      expense: otherExp,
      investment: otherInv,
      loanImpact: otherLoans.loanImpact,
      balance: otherBal
    },
    totalBalance: totalBal
  };
};

export const updateMasterInvestment = (id, data) => {
  const db = getDb();
  const sets = [];
  const params = [];
  
  if (data.name !== undefined) { sets.push('name = ?'); params.push(data.name); }
  if (data.type !== undefined) { sets.push('type = ?'); params.push(data.type); }
  if (data.startDate !== undefined) { sets.push('start_date = ?'); params.push(data.startDate); }
  if (data.tenureValue !== undefined) { sets.push('tenure_value = ?'); params.push(data.tenureValue); }
  if (data.tenureType !== undefined) { sets.push('tenure_type = ?'); params.push(data.tenureType); }
  if (data.targetAmount !== undefined) { sets.push('target_amount = ?'); params.push(data.targetAmount); }
  if (data.recurringAmount !== undefined) { sets.push('recurring_amount = ?'); params.push(data.recurringAmount); }

  if (sets.length > 0) {
    params.push(id);
    db.runSync(`UPDATE investments SET ${sets.join(', ')} WHERE id = ?`, params);
  }
};
