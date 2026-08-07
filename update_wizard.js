const fs = require('fs');
const path = 'd:\\B Tracker\\src\\screens\\OpeningBalanceWizardScreen.js';
let content = fs.readFileSync(path, 'utf8');

content = content.replace("import { saveOpeningBalances } from '../services/transactionService';", "import { saveOpeningBalances, getOpeningBalancesData } from '../services/transactionService';");

const newUseEffect = `
  const [isEditMode, setIsEditMode] = useState(false);

  useEffect(() => {
    const curs = getActiveCurrencies();
    setActiveCurs(curs);
    
    const existingData = getOpeningBalancesData();
    
    if (existingData && (existingData.bankBalances.length > 0 || existingData.investments.length > 0 || existingData.loans.length > 0)) {
      setIsEditMode(true);
    }
    
    if (existingData && existingData.startDate) {
      setStartDate(new Date(existingData.startDate));
    }
    
    // Pre-populate bank balances
    const initialBankBalances = [];
    curs.forEach(c => {
      OWNERS.forEach(o => {
        const existing = existingData.bankBalances.find(b => b.currency === c && b.owner === o);
        initialBankBalances.push({ currency: c, owner: o, amount: existing ? existing.amount.toString() : '' });
      });
    });
    setBankBalances(initialBankBalances);
    
    // Pre-populate investments
    if (existingData.investments.length > 0) {
      setInvestments(existingData.investments.map(i => ({
        id: i.id,
        idStr: i.id.toString(),
        type: i.type,
        name: i.name,
        currency: i.currency,
        amount: i.amount.toString(),
        owner: i.owner
      })));
    }
    
    // Pre-populate loans
    if (existingData.loans.length > 0) {
      setLoans(existingData.loans.map(l => ({
        id: l.id,
        idStr: l.id.toString(),
        type: l.type,
        name: l.name,
        currency: l.currency,
        amount: l.amount.toString(),
        owner: l.owner
      })));
    }
  }, []);
`;

const oldUseEffectRegex = /useEffect\(\(\) => \{[\s\S]*?\}, \[\]\);/;
content = content.replace(oldUseEffectRegex, newUseEffect);

// Make sure the title reflects edit mode
content = content.replace("<Text style={styles.headerTitle}>Opening Balance Setup</Text>", "<Text style={styles.headerTitle}>{isEditMode ? 'Edit Opening Balances' : 'Opening Balance Setup'}</Text>");

// Update warning message
content = content.replace("Use this wizard only when starting fresh. It creates opening balances instead of historical transactions.", "{isEditMode ? 'You are editing your opening balances. Changes will immediately update your dashboard and reports.' : 'Use this wizard only when starting fresh. It creates opening balances without generating historical cashflow entries.'}");
content = content.replace("Use this wizard only when starting fresh. It creates opening balances without generating historical cashflow entries.", "{isEditMode ? 'You are editing your opening balances. Changes will immediately update your dashboard and reports.' : 'Use this wizard only when starting fresh. It creates opening balances without generating historical cashflow entries.'}");

fs.writeFileSync(path, content, 'utf8');
console.log("Updated OpeningBalanceWizardScreen.js");
