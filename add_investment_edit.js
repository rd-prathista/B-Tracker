const fs = require('fs');
const path = 'd:\\B Tracker\\src\\screens\\ReportsScreen.js';
let content = fs.readFileSync(path, 'utf8');

// Add updateMasterInvestment to imports
content = content.replace("deleteInvestment, getOwnerBalances, getCreditCardSpending } from '../services/transactionService';", "deleteInvestment, getOwnerBalances, getCreditCardSpending, updateMasterInvestment } from '../services/transactionService';");

// Insert modal state and UI
const stateHookPos = content.indexOf("const [expandedId, setExpandedId] = useState(null);");

const modalStateCode = `
  const [editMasterInv, setEditMasterInv] = useState(null);
  const [editInvName, setEditInvName] = useState('');
  const [editInvType, setEditInvType] = useState('');
  const [editInvTarget, setEditInvTarget] = useState('');
  const [editInvRecurring, setEditInvRecurring] = useState('');
  const [editInvTenureVal, setEditInvTenureVal] = useState('');
  const [editInvTenureType, setEditInvTenureType] = useState('Years');
  const [editInvStartDate, setEditInvStartDate] = useState(new Date());
  const [showEditInvDate, setShowEditInvDate] = useState(false);

  const openEditMasterInv = (inv) => {
    setEditMasterInv(inv);
    setEditInvName(inv.name || '');
    setEditInvType(inv.type || '');
    setEditInvTarget(inv.target_amount ? inv.target_amount.toString() : '');
    setEditInvRecurring(inv.recurring_amount ? inv.recurring_amount.toString() : '');
    setEditInvTenureVal(inv.tenure_value ? inv.tenure_value.toString() : '');
    setEditInvTenureType(inv.tenure_type || 'Years');
    setEditInvStartDate(inv.start_date ? new Date(inv.start_date) : new Date());
  };

  const saveEditMasterInv = () => {
    if (!editMasterInv) return;
    updateMasterInvestment(editMasterInv.id, {
      name: editInvName,
      type: editInvType,
      targetAmount: editInvTarget ? parseFloat(editInvTarget) : null,
      recurringAmount: editInvRecurring ? parseFloat(editInvRecurring) : 0,
      tenureValue: editInvTenureVal ? parseInt(editInvTenureVal) : 1,
      tenureType: editInvTenureType,
      startDate: editInvStartDate.toISOString()
    });
    setEditMasterInv(null);
    loadData();
  };
`;

content = content.substring(0, stateHookPos) + modalStateCode + content.substring(stateHookPos);

const modalUICode = `
      {/* Edit Master Investment Modal */}
      <Modal visible={!!editMasterInv} transparent animationType="fade">
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', padding: 20 }}>
          <GlassCard style={{ borderRadius: 16, padding: 20 }}>
            <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 18, color: colors.text, marginBottom: 16 }}>Edit Investment Details</Text>
            
            <Text style={{ color: colors.textMuted, fontSize: 12, marginBottom: 4 }}>Name</Text>
            <TextInput style={{ backgroundColor: 'rgba(0,0,0,0.2)', color: colors.text, padding: 12, borderRadius: 8, marginBottom: 12 }} value={editInvName} onChangeText={setEditInvName} />
            
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.textMuted, fontSize: 12, marginBottom: 4 }}>Tenure Value</Text>
                <TextInput style={{ backgroundColor: 'rgba(0,0,0,0.2)', color: colors.text, padding: 12, borderRadius: 8, marginBottom: 12 }} value={editInvTenureVal} onChangeText={setEditInvTenureVal} keyboardType="numeric" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.textMuted, fontSize: 12, marginBottom: 4 }}>Tenure Type</Text>
                <View style={{ flexDirection: 'row', backgroundColor: 'rgba(0,0,0,0.2)', borderRadius: 8, overflow: 'hidden' }}>
                  <TouchableOpacity onPress={() => setEditInvTenureType('Months')} style={{ flex: 1, padding: 12, backgroundColor: editInvTenureType === 'Months' ? colors.primary : 'transparent' }}>
                    <Text style={{ color: editInvTenureType === 'Months' ? '#fff' : colors.textMuted, textAlign: 'center', fontSize: 12 }}>Months</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => setEditInvTenureType('Years')} style={{ flex: 1, padding: 12, backgroundColor: editInvTenureType === 'Years' ? colors.primary : 'transparent' }}>
                    <Text style={{ color: editInvTenureType === 'Years' ? '#fff' : colors.textMuted, textAlign: 'center', fontSize: 12 }}>Years</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>

            <View style={{ flexDirection: 'row', gap: 10 }}>
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.textMuted, fontSize: 12, marginBottom: 4 }}>Target Amount</Text>
                <TextInput style={{ backgroundColor: 'rgba(0,0,0,0.2)', color: colors.text, padding: 12, borderRadius: 8, marginBottom: 12 }} value={editInvTarget} onChangeText={setEditInvTarget} keyboardType="numeric" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.textMuted, fontSize: 12, marginBottom: 4 }}>Recurring Amount</Text>
                <TextInput style={{ backgroundColor: 'rgba(0,0,0,0.2)', color: colors.text, padding: 12, borderRadius: 8, marginBottom: 12 }} value={editInvRecurring} onChangeText={setEditInvRecurring} keyboardType="numeric" />
              </View>
            </View>

            <View style={{ flexDirection: 'row', gap: 12, marginTop: 10 }}>
              <TouchableOpacity onPress={() => setEditMasterInv(null)} style={{ flex: 1, padding: 14, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 8 }}>
                <Text style={{ color: colors.text, textAlign: 'center', fontFamily: 'Inter_600SemiBold' }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={saveEditMasterInv} style={{ flex: 1, padding: 14, backgroundColor: colors.primary, borderRadius: 8 }}>
                <Text style={{ color: '#fff', textAlign: 'center', fontFamily: 'Inter_600SemiBold' }}>Save</Text>
              </TouchableOpacity>
            </View>
          </GlassCard>
        </View>
      </Modal>
`;

// Insert the modal into the UI (before the last closing tag of the component)
const endOfComponent = content.lastIndexOf("</View>");
content = content.substring(0, endOfComponent) + modalUICode + content.substring(endOfComponent);

// Add the Edit button to the card
const deleteBtnRegex = /<TouchableOpacity[\s\S]*?onPress=\{\(\) => handleDeleteInvestment\(inv\.id, inv\.name\)\}[\s\S]*?<\/TouchableOpacity>/;

const editBtnCode = `
                        <TouchableOpacity 
                          onPress={() => openEditMasterInv(inv)}
                          style={{ 
                            flex: 1, 
                            flexDirection: 'row', 
                            alignItems: 'center', 
                            justifyContent: 'center',
                            gap: 6, 
                            backgroundColor: colors.cardSolid, 
                            borderWidth: 1,
                            borderColor: colors.border,
                            paddingVertical: 8, 
                            borderRadius: 8 
                          }}
                        >
                          <Ionicons name="pencil-outline" size={14} color={colors.primary} />
                          <Text style={{ ...typography.bodySmall, color: colors.primary, fontFamily: 'Inter_700Bold' }}>Edit</Text>
                        </TouchableOpacity>
`;

content = content.replace(deleteBtnRegex, (match) => editBtnCode + '\n' + match);

fs.writeFileSync(path, content, 'utf8');
console.log("Updated ReportsScreen.js with Edit Master Investment UI");
