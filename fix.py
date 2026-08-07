import re

with open(r'd:\B Tracker\src\services\transactionService.js', 'r', encoding='utf-8') as f:
    content = f.read()

# Locate getCashflowTrends function
start_marker = "export const getCashflowTrends ="
start_idx = content.find(start_marker)

end_marker = "/**\n * CREDIT CARD MANAGEMENT\n */"
end_idx = content.find(end_marker, start_idx)

if start_idx == -1 or end_idx == -1:
    print("Could not find markers")
    exit(1)

new_func = """export const getCashflowTrends = (currency, ownerFilter) => {
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

  const rows = db.getAllSync(`
    SELECT strftime('%Y-%m', date) as month, 
           SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END) as totalIncome, 
           SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END) as totalExpense,
           SUM(CASE WHEN type = 'investment' THEN amount ELSE 0 END) as totalInvestment,
           SUM(CASE WHEN type = 'loan_given' THEN amount ELSE 0 END) as totalLoanGiven,
           SUM(CASE WHEN type = 'loan_recovered' THEN amount ELSE 0 END) as totalLoanRecovered
    FROM (
      SELECT amount, currency, date, 'income' as type FROM income WHERE 1=1${archInc}${ownerClauseInc}
      UNION ALL 
      SELECT amount, currency, date, 'expense' as type FROM expenses WHERE 1=1${archExp}${ownerClauseExp}
      UNION ALL
      SELECT ic.amount, ic.currency, ic.contribution_date as date, 'investment' as type 
        FROM investment_contributions ic JOIN investments inv ON ic.investment_id = inv.id 
        WHERE ic.is_opening_balance = 0${archInv}${ownerClauseInv}
      UNION ALL
      SELECT amount, currency, start_date as date, 'loan_given' as type FROM loans WHERE type = 'I Gave' AND is_opening_balance = 0${ownerClauseL}
      UNION ALL
      SELECT r.amount, l.currency, r.date, 'loan_recovered' as type 
        FROM loan_repayments r JOIN loans l ON r.loan_id = l.id 
        WHERE l.type = 'I Gave'${ownerClauseLJ}
    )
    WHERE date >= date('now', 'start of month', '-5 months') AND currency = ?
    GROUP BY month
    ORDER BY month DESC
  `, queryParams);
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

"""

new_content = content[:start_idx] + new_func + content[end_idx:]

with open(r'd:\B Tracker\src\services\transactionService.js', 'w', encoding='utf-8') as f:
    f.write(new_content)
    
print("Fixed!")
