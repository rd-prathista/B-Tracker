const fs = require('fs');

const path = 'd:\\B Tracker\\src\\services\\transactionService.js';
let content = fs.readFileSync(path, 'utf8');

// The file currently has:
// 771: export const getSavingsTrends = ...
// 775:   const archInv = ...
// 776: 
// 777: export const addCreditCard = ...

const missingCode = `
  const ownerClauseInc = ownerFilter && ownerFilter !== 'ALL' ? ' AND income_source = ?' : '';
  const ownerClauseExp = ownerFilter && ownerFilter !== 'ALL' ? ' AND funded_by = ?' : '';
  const ownerParams = ownerFilter && ownerFilter !== 'ALL' ? [ownerFilter, ownerFilter] : [];

  const activeCurs = getActiveCurrencies();
  const placeholders = activeCurs.map(() => '?').join(', ');
  const queryParams = [...ownerParams, ...activeCurs];

  const rows = db.getAllSync(\`
    SELECT strftime('%Y-%m', date) as month, currency, SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END) as totalIncome, SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END) as totalExpense
    FROM (
      SELECT amount, currency, date, 'income' as type FROM income WHERE 1=1\${archInc}\${ownerClauseInc}
      UNION ALL 
      SELECT amount, currency, date, 'expense' as type FROM expenses WHERE 1=1\${archExp}\${ownerClauseExp}
    )
    WHERE date >= date('now', 'start of month', '-5 months') AND currency IN (\${placeholders})
    GROUP BY month, currency
    ORDER BY month DESC
  \`, queryParams);
  const trends = {};
  rows.forEach(row => {
    if (!trends[row.month]) trends[row.month] = { AED: { savings: 0 }, INR: { savings: 0 } };
    trends[row.month][row.currency] = { savings: row.totalIncome - row.totalExpense, income: row.totalIncome, expense: row.totalExpense };
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
  const ownerClauseL = ownerFilter && ownerFilter !== 'ALL' ? ' AND funded_by = ?' : '';
  const ownerClauseLJ = ownerFilter && ownerFilter !== 'ALL' ? ' AND l.funded_by = ?' : '';

  const ownerParams = ownerFilter && ownerFilter !== 'ALL' ? [ownerFilter, ownerFilter, ownerFilter, ownerFilter, ownerFilter] : [];

  const queryParams = [...ownerParams, currency];

  const rows = db.getAllSync(\`
    SELECT strftime('%Y-%m', date) as month, 
           SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END) as totalIncome, 
           SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END) as totalExpense,
           SUM(CASE WHEN type = 'investment' THEN amount ELSE 0 END) as totalInvestment,
           SUM(CASE WHEN type = 'loan_given' THEN amount ELSE 0 END) as totalLoanGiven,
           SUM(CASE WHEN type = 'loan_recovered' THEN amount ELSE 0 END) as totalLoanRecovered
    FROM (
      SELECT amount, currency, date, 'income' as type FROM income WHERE 1=1\${archInc}\${ownerClauseInc}
      UNION ALL 
      SELECT amount, currency, date, 'expense' as type FROM expenses WHERE 1=1\${archExp}\${ownerClauseExp}
      UNION ALL
      SELECT ic.amount, ic.currency, ic.contribution_date as date, 'investment' as type 
        FROM investment_contributions ic JOIN investments inv ON ic.investment_id = inv.id 
        WHERE ic.is_opening_balance = 0\${archInv}\${ownerClauseInv}
      UNION ALL
      SELECT amount, currency, start_date as date, 'loan_given' as type FROM loans WHERE type = 'I Gave' AND is_opening_balance = 0\${ownerClauseL}
      UNION ALL
      SELECT r.amount, l.currency, r.date, 'loan_recovered' as type 
        FROM loan_repayments r JOIN loans l ON r.loan_id = l.id 
        WHERE l.type = 'I Gave'\${ownerClauseLJ}
    )
    WHERE date >= date('now', 'start of month', '-5 months') AND currency = ?
    GROUP BY month
    ORDER BY month DESC
  \`, queryParams);
  const trends = {};
  rows.forEach(row => {
    if (!trends[row.month]) trends[row.month] = { savings: 0, income: 0, expense: 0, investment: 0, loanGiven: 0, loanRecovered: 0 };
    trends[row.month] = { 
      savings: row.totalIncome + row.totalLoanRecovered - row.totalExpense - row.totalInvestment - row.totalLoanGiven, 
      income: row.totalIncome, 
      expense: row.totalExpense,
      investment: row.totalInvestment,
      loanGiven: row.totalLoanGiven,
      loanRecovered: row.totalLoanRecovered
    };
  });
  return trends;
};

/**
 * CREDIT CARD MANAGEMENT
 */
export const getCreditCards = (activeOnly = false) => {
  const db = getDb();
  if (activeOnly) {
    return db.getAllSync(\`SELECT * FROM credit_cards WHERE status = 'Active' ORDER BY name ASC\`);
  }
  return db.getAllSync(\`SELECT * FROM credit_cards ORDER BY status ASC, name ASC\`);
};

export const addCreditCard = (name, last_4, bank_name, credit_limit, color, status = 'Active') => {
`;

content = content.replace("export const addCreditCard = (name, last_4, bank_name, credit_limit, color, status = 'Active') => {", missingCode);
fs.writeFileSync(path, content, 'utf8');
console.log("Restored missing code!");
