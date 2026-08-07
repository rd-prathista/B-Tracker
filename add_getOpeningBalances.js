const fs = require('fs');
const path = 'd:\\B Tracker\\src\\services\\transactionService.js';
let content = fs.readFileSync(path, 'utf8');

const newCode = `
export const getOpeningBalancesData = () => {
  const db = getDb();
  
  // Get start date
  const appSettings = db.getFirstSync(\`SELECT tracking_start_date FROM app_settings\`) || {};
  const startDate = appSettings.tracking_start_date || new Date().toISOString().split('T')[0];

  // Investments (Only fetch those that were created as opening balances)
  const investmentsRows = db.getAllSync(\`
    SELECT inv.*, ic.amount as opening_amount, ic.currency as opening_currency 
    FROM investments inv
    JOIN investment_contributions ic ON inv.id = ic.investment_id
    WHERE ic.is_opening_balance = 1
  \`);
  const investments = investmentsRows.map(r => ({
    id: r.id,
    type: r.type,
    name: r.name,
    amount: r.opening_amount,
    currency: r.opening_currency,
    owner: r.funded_by
  }));

  // Loans
  const loansRows = db.getAllSync(\`SELECT * FROM loans WHERE is_opening_balance = 1\`);
  const loans = loansRows.map(r => ({
    id: r.id,
    type: r.type,
    name: r.person_name,
    amount: r.amount,
    currency: r.currency,
    owner: r.funded_by
  }));

  return { startDate, investments, loans };
};

export const saveOpeningBalances = (data) => {
  const db = getDb();
  
  if (data.startDate) {
    db.runSync(\`UPDATE app_settings SET tracking_start_date = ?\`, [data.startDate]);
  }

  // Handle Investments
  const existingInvestments = db.getAllSync(\`SELECT investment_id as id FROM investment_contributions WHERE is_opening_balance = 1\`).map(r => r.id);
  const newInvestmentIds = data.investments ? data.investments.filter(i => i.id).map(i => i.id) : [];
  const investmentsToDelete = existingInvestments.filter(id => !newInvestmentIds.includes(id));
  
  for (const invId of investmentsToDelete) {
    const count = db.getFirstSync(\`SELECT COUNT(*) as count FROM investment_contributions WHERE investment_id = ? AND is_opening_balance = 0\`, [invId])?.count || 0;
    if (count === 0) {
      db.runSync(\`DELETE FROM investments WHERE id = ?\`, [invId]);
    } else {
      // Just delete the opening contribution if there are other contributions
      db.runSync(\`DELETE FROM investment_contributions WHERE investment_id = ? AND is_opening_balance = 1\`, [invId]);
    }
  }

  // Handle Loans
  const existingLoans = db.getAllSync(\`SELECT id FROM loans WHERE is_opening_balance = 1\`).map(r => r.id);
  const newLoanIds = data.loans ? data.loans.filter(l => l.id).map(l => l.id) : [];
  const loansToDelete = existingLoans.filter(id => !newLoanIds.includes(id));

  for (const loanId of loansToDelete) {
    const count = db.getFirstSync(\`SELECT COUNT(*) as count FROM loan_repayments WHERE loan_id = ?\`, [loanId])?.count || 0;
    if (count === 0) {
      db.runSync(\`DELETE FROM loans WHERE id = ?\`, [loanId]);
    } else {
      // Un-mark as opening balance or just leave it? A loan must have an amount.
      // We can't delete a loan if it has repayments, so we shouldn't allow deleting it from opening balances if it has repayments.
      // We just update amount to 0 or leave it. We will leave it.
    }
  }

  // Insert or Update Investments
  if (data.investments && data.investments.length > 0) {
    for (const inv of data.investments) {
      if (inv.amount > 0) {
        if (inv.id && existingInvestments.includes(inv.id)) {
          // Update Master
          db.runSync(\`UPDATE investments SET type = ?, name = ?, currency = ?, start_date = ?, funded_by = ? WHERE id = ?\`, 
            [inv.type, inv.name, inv.currency, data.startDate, inv.owner, inv.id]);
          // Update Opening Contribution
          db.runSync(\`UPDATE investment_contributions SET amount = ?, currency = ?, contribution_date = ? WHERE investment_id = ? AND is_opening_balance = 1\`,
            [inv.amount, inv.currency, data.startDate, inv.id]);
        } else {
          // Insert
          db.runSync(\`
            INSERT INTO investments (type, name, currency, recurring_amount, tenure_value, tenure_type, start_date, funded_by, total_invested)
            VALUES (?, ?, ?, 0, 1, 'Years', ?, ?, ?)
          \`, [inv.type, inv.name, inv.currency, data.startDate, inv.owner, inv.amount]);
          const invId = db.getFirstSync(\`SELECT last_insert_rowid() as id\`)?.id;
          if (invId) {
            db.runSync(\`
              INSERT INTO investment_contributions (investment_id, amount, currency, contribution_date, is_opening_balance)
              VALUES (?, ?, ?, ?, 1)
            \`, [invId, inv.amount, inv.currency, data.startDate]);
          }
        }
      }
    }
  }

  // Insert or Update Loans
  if (data.loans && data.loans.length > 0) {
    for (const loan of data.loans) {
      if (loan.amount > 0) {
        if (loan.id && existingLoans.includes(loan.id)) {
          db.runSync(\`UPDATE loans SET person_name = ?, type = ?, amount = ?, currency = ?, start_date = ?, funded_by = ? WHERE id = ?\`,
            [loan.name, loan.type, loan.amount, loan.currency, data.startDate, loan.owner, loan.id]);
        } else {
          db.runSync(\`
            INSERT INTO loans (person_name, type, source_type, amount, currency, start_date, funded_by, is_opening_balance)
            VALUES (?, ?, 'Cash', ?, ?, ?, ?, 1)
          \`, [loan.name, loan.type, loan.amount, loan.currency, data.startDate, loan.owner]);
        }
      }
    }
  }
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
    db.runSync(\`UPDATE investments SET \${sets.join(', ')} WHERE id = ?\`, params);
  }
};
`;

content = content + "\n" + newCode;
fs.writeFileSync(path, content, 'utf8');
console.log("Done adding getOpeningBalancesData and updating saveOpeningBalances");
