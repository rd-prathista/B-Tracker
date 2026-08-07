import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
  LayoutAnimation
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';
import { addLoan, updateLoan, getLoanById } from '../services/loanService';
import { getDashboardBalances } from '../services/transactionService';
import { getAppSettings, getActiveCurrencies } from '../database/db';
import FadeInView from '../components/FadeInView';
import AmbientBackground from '../components/AmbientBackground';
import GlassCard from '../components/GlassCard';
import Toast from '../components/Toast';

const SOURCE_TYPES = ['Person', 'Friend', 'Family', 'Bank', 'Company', 'Other'];
const LOAN_TYPES = ['I Gave', 'I Borrowed'];
const SUPPORTED_CURRENCIES = ['AED', 'INR'];

export default function AddLoanScreen({ navigation, route }) {
  const routeParams = route.params || {};
  const loanId = routeParams.loanId;
  const isEdit = loanId != null;

  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState(null);
  const [personName, setPersonName] = useState('');
  const [loanType, setLoanType] = useState('I Gave');
  const [sourceType, setSourceType] = useState('Person');
  const [startDate, setStartDate] = useState(new Date());
  const [expectedReturnDate, setExpectedReturnDate] = useState(null);
  const [notes, setNotes] = useState('');
  const [ownership, setOwnership] = useState('OTHER');
  const [isExistingRecord, setIsExistingRecord] = useState(false);
  const [monthlyEmi, setMonthlyEmi] = useState('');

  const [showStartDatePicker, setShowStartDatePicker] = useState(false);
  const [showExpectedDatePicker, setShowExpectedDatePicker] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [toastVisible, setToastVisible] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const saveLockRef = useRef(false);

  useEffect(() => {
    // Load currency preference
    const settings = getAppSettings();
    const active = getActiveCurrencies();
    const defaultCur = settings?.default_currency_mode;
    if (defaultCur === 'ask') {
      setCurrency(null);
    } else if (defaultCur && active.includes(defaultCur)) {
      setCurrency(defaultCur);
    } else if (active.length > 0) {
      setCurrency(active[0]);
    }

    if (isEdit) {
      const loan = getLoanById(loanId);
      if (loan) {
        setAmount(String(loan.amount));
        setCurrency(loan.currency);
        setPersonName(loan.person_name);
        setLoanType(loan.type);
        setSourceType(loan.source_type);
        setStartDate(new Date(loan.start_date));
        setExpectedReturnDate(loan.expected_return_date ? new Date(loan.expected_return_date) : null);
        setNotes(loan.notes || '');
        setOwnership(loan.funded_by || 'OTHER');
        setIsExistingRecord(loan.is_opening_balance === 1);
        setMonthlyEmi(loan.monthly_emi ? String(loan.monthly_emi) : '');
      } else {
        Alert.alert('Error', 'Loan not found.', [{ text: 'OK', onPress: () => navigation.goBack() }]);
      }
    }
  }, [isEdit, loanId]);

  const handleSave = () => {
    if (saveLockRef.current || isSaving) return;

    if (!amount || isNaN(amount) || parseFloat(amount) <= 0) {
      Alert.alert('Invalid Amount', 'Please enter a valid amount.');
      return;
    }

    if (!personName.trim()) {
      Alert.alert('Missing Name', 'Please enter the person or entity name.');
      return;
    }

    if (!currency) {
      Alert.alert('Missing Currency', 'Please select a currency.');
      return;
    }

    // Balance validation for 'I Gave' loan
    if (loanType === 'I Gave' && !isExistingRecord) {
      const balances = getDashboardBalances();
      const currentBalance = balances[currency]?.balance || 0;

      let needsValidation = true;
      let validationAmount = parseFloat(amount);

      if (isEdit) {
        const originalLoan = getLoanById(loanId);
        if (originalLoan && originalLoan.currency === currency && originalLoan.type === 'I Gave') {
          const oldAmount = originalLoan.amount;
          const newAmount = parseFloat(amount);
          if (newAmount <= oldAmount) {
            needsValidation = false;
          } else {
            validationAmount = newAmount - oldAmount;
          }
        }
      }

      if (needsValidation) {
        if (currentBalance < 0) {
          Alert.alert(
            'Insufficient Balance',
            'Available balance is negative. Cannot create or increase a loan amount.'
          );
          return;
        } else if (validationAmount > currentBalance) {
          if (isEdit) {
            Alert.alert(
              'Insufficient Balance',
              `Insufficient available balance for the additional loan amount. Maximum allowed increase is ${currency} ${currentBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}.`
            );
          } else {
            Alert.alert(
              'Insufficient Balance',
              `You do not have enough available balance. Maximum allowed is ${currency} ${currentBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}.`
            );
          }
          return;
        }
      }
    }

    saveLockRef.current = true;
    setIsSaving(true);

    try {
      const loanData = {
        personName: personName.trim(),
        type: loanType,
        sourceType,
        amount: parseFloat(amount),
        currency,
        startDate: startDate.toISOString(),
        expectedReturnDate: expectedReturnDate ? expectedReturnDate.toISOString() : null,
        notes: notes.trim() || null,
        fundedBy: ownership,
        isExisting: isExistingRecord,
        monthlyEmi: monthlyEmi
      };

      if (isEdit) {
        updateLoan(loanId, loanData);
        setToastMessage('✓ Loan Updated');
      } else {
        addLoan(loanData);
        setToastMessage('✓ Loan Created');
      }

      setToastVisible(true);
      setTimeout(() => {
        saveLockRef.current = false;
        setIsSaving(false);
        navigation.goBack();
      }, 2000);
    } catch (e) {
      saveLockRef.current = false;
      setIsSaving(false);
      Alert.alert('Error', 'Failed to save loan: ' + e.message);
    }
  };

  const formatDate = (d) =>
    d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });

  return (
    <AmbientBackground>
      <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
        <Toast message={toastMessage} type="success" visible={toastVisible} onHide={() => setToastVisible(false)} />

        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.container}>
          <View style={styles.header}>
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
              <Ionicons name="arrow-back" size={22} color={colors.text} />
            </TouchableOpacity>
            <Text style={styles.title}>{isEdit ? 'Edit Loan' : 'Create Loan'}</Text>
            <View style={styles.headerSpacer} />
          </View>

          <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
            <FadeInView delay={0}>
              <GlassCard style={styles.amountCard}>
                <LinearGradient
                  colors={['rgba(245, 158, 11, 0.18)', 'rgba(30, 41, 59, 0.05)']}
                  style={StyleSheet.absoluteFillObject}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                />
                <Text style={styles.fieldLabel}>{isExistingRecord ? 'OUTSTANDING AMOUNT' : 'LOAN AMOUNT'}</Text>
                <TextInput
                  style={styles.amountInput}
                  placeholder="0.00"
                  placeholderTextColor={colors.textMuted}
                  keyboardType="decimal-pad"
                  value={amount}
                  onChangeText={setAmount}
                  autoFocus={!isEdit}
                  editable={!isSaving}
                />
                <View style={styles.currencyRow}>
                  {getActiveCurrencies().map((cur) => {
                    const isSelected = currency === cur;
                    return (
                      <TouchableOpacity
                        key={cur}
                        activeOpacity={0.7}
                        style={[
                          styles.currencyBtn,
                          isSelected && styles.currencyBtnActive
                        ]}
                        onPress={() => {
                          LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                          setCurrency(cur);
                        }}
                        disabled={isSaving}
                      >
                        <Text style={[styles.currencyBtnText, isSelected && styles.currencyBtnTextActive]}>{cur}</Text>
                        {isSelected && <View style={styles.activeDot} />}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </GlassCard>
            </FadeInView>

            <FadeInView delay={50}>
              <Text style={styles.sectionLabel}>PERSON / ENTITY NAME</Text>
              <TextInput
                style={styles.textInput}
                placeholder="Who is this loan with?"
                placeholderTextColor={colors.textMuted}
                value={personName}
                onChangeText={setPersonName}
                editable={!isSaving}
              />
            </FadeInView>

            <FadeInView delay={100}>
              <Text style={styles.sectionLabel}>LOAN TYPE</Text>
              <View style={styles.toggleRow}>
                {LOAN_TYPES.map((type) => {
                  const isSelected = loanType === type;
                  return (
                    <TouchableOpacity
                      key={type}
                      style={[styles.toggleBtn, isSelected && styles.toggleBtnActive]}
                      onPress={() => setLoanType(type)}
                    >
                      <Text style={[styles.toggleBtnText, isSelected && styles.toggleBtnTextActive]}>
                        {type}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </FadeInView>

            {!isEdit && (
              <FadeInView delay={120} style={{ marginTop: 14 }}>
                <View style={styles.toggleRow}>
                  <TouchableOpacity
                    style={[styles.toggleBtn, isExistingRecord && styles.toggleBtnActive, { flex: undefined, paddingHorizontal: 20 }]}
                    onPress={() => {
                      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                      setIsExistingRecord(!isExistingRecord);
                    }}
                    disabled={isSaving}
                  >
                    <Text style={[styles.toggleBtnText, isExistingRecord && styles.toggleBtnTextActive]}>
                      {isExistingRecord ? 'Existing Record (Yes)' : 'Existing Record (No)'}
                    </Text>
                  </TouchableOpacity>
                </View>
                {isExistingRecord && (
                  <View style={{ marginTop: 8, padding: 12, backgroundColor: 'rgba(245, 158, 11, 0.1)', borderRadius: 8, borderWidth: 1, borderColor: 'rgba(245, 158, 11, 0.3)' }}>
                    <Text style={{ color: '#D97706', fontSize: 11, fontFamily: 'Inter_500Medium' }}>
                      This loan already existed before you started tracking. The outstanding amount will not reduce your current dashboard balance. Only future repayments will be tracked.
                    </Text>
                  </View>
                )}
              </FadeInView>
            )}

            {isExistingRecord && loanType === 'I Borrowed' && (
              <FadeInView delay={130} style={{ marginTop: 14 }}>
                <Text style={styles.sectionLabel}>MONTHLY EMI</Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="0.00 (Optional)"
                  placeholderTextColor={colors.textMuted}
                  keyboardType="decimal-pad"
                  value={monthlyEmi}
                  onChangeText={setMonthlyEmi}
                  editable={!isSaving}
                />
              </FadeInView>
            )}

            <FadeInView delay={150}>
              <Text style={styles.sectionLabel}>SOURCE TYPE</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.sourceScroll}>
                {SOURCE_TYPES.map((type) => {
                  const isSelected = sourceType === type;
                  return (
                    <TouchableOpacity
                      key={type}
                      style={[styles.sourceBtn, isSelected && styles.sourceBtnActive]}
                      onPress={() => setSourceType(type)}
                    >
                      <Text style={[styles.sourceBtnText, isSelected && styles.sourceBtnTextActive]}>
                        {type}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </FadeInView>

            <View style={{ flexDirection: 'row', gap: 12, marginTop: 14 }}>
              <View style={{ flex: 1 }}>
                <TouchableOpacity
                  style={styles.dateRow}
                  activeOpacity={0.7}
                  onPress={() => !isSaving && setShowStartDatePicker(true)}
                  disabled={isSaving}
                >
                  <Ionicons name="calendar-outline" size={16} color="#F59E0B" />
                  <View>
                    <Text style={styles.dateLabel}>START DATE</Text>
                    <Text style={styles.dateValue}>{formatDate(startDate)}</Text>
                  </View>
                </TouchableOpacity>
                {showStartDatePicker && (
                  <DateTimePicker
                    value={startDate}
                    mode="date"
                    display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                    onChange={(event, selected) => {
                      setShowStartDatePicker(Platform.OS === 'ios');
                      if (selected) setStartDate(selected);
                    }}
                  />
                )}
              </View>

              <View style={{ flex: 1 }}>
                <TouchableOpacity
                  style={styles.dateRow}
                  activeOpacity={0.7}
                  onPress={() => !isSaving && setShowExpectedDatePicker(true)}
                  disabled={isSaving}
                >
                  <Ionicons name="time-outline" size={16} color="#F59E0B" />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.dateLabel}>EXPECTED RETURN</Text>
                    <Text style={styles.dateValue} numberOfLines={1}>
                      {expectedReturnDate ? formatDate(expectedReturnDate) : 'Optional'}
                    </Text>
                  </View>
                  {expectedReturnDate && (
                    <TouchableOpacity
                      onPress={(e) => {
                        e.stopPropagation();
                        setExpectedReturnDate(null);
                      }}
                    >
                      <Ionicons name="close-circle" size={14} color={colors.textMuted} />
                    </TouchableOpacity>
                  )}
                </TouchableOpacity>
                {showExpectedDatePicker && (
                  <DateTimePicker
                    value={expectedReturnDate || new Date()}
                    mode="date"
                    display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                    minimumDate={startDate}
                    onChange={(event, selected) => {
                      setShowExpectedDatePicker(Platform.OS === 'ios');
                      if (selected) setExpectedReturnDate(selected);
                    }}
                  />
                )}
              </View>
            </View>

             <FadeInView delay={180} style={{ marginTop: 14 }}>
               <Text style={styles.sectionLabel}>FUNDED BY</Text>
               <View style={styles.toggleRow}>
                 {[
                   { label: 'Prathista', value: 'SELF' },
                   { label: 'Praveen', value: 'SPOUSE' },
                   { label: 'Other', value: 'OTHER' }
                 ].map((opt) => {
                   const isSelected = ownership === opt.value;
                   return (
                     <TouchableOpacity
                       key={opt.value}
                       style={[styles.toggleBtn, isSelected && styles.toggleBtnActive]}
                       onPress={() => {
                         LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                         setOwnership(opt.value);
                       }}
                       disabled={isSaving}
                     >
                       <Text style={[styles.toggleBtnText, isSelected && styles.toggleBtnTextActive]}>
                         {opt.label}
                       </Text>
                     </TouchableOpacity>
                   );
                 })}
               </View>
             </FadeInView>

             <FadeInView delay={200} style={{ marginTop: 14 }}>
               <Text style={styles.sectionLabel}>NOTES (OPTIONAL)</Text>
              <TextInput
                style={styles.notesInput}
                placeholder="Details or specific conditions..."
                placeholderTextColor={colors.textMuted}
                value={notes}
                onChangeText={setNotes}
                multiline
                numberOfLines={2}
                editable={!isSaving}
              />
            </FadeInView>

            <FadeInView delay={250}>
              <TouchableOpacity
                style={[styles.saveBtn, isSaving && { opacity: 0.92 }]}
                activeOpacity={0.85}
                onPress={handleSave}
                disabled={isSaving}
              >
                <LinearGradient
                  colors={['#F59E0B', '#D97706']}
                  style={styles.saveGradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                >
                  {isSaving ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <Ionicons name="checkmark-circle-outline" size={20} color="#fff" />
                  )}
                  <Text style={styles.saveText}>
                    {isSaving ? 'Saving…' : isEdit ? 'Save Changes' : 'Create Loan'}
                  </Text>
                </LinearGradient>
              </TouchableOpacity>
            </FadeInView>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </AmbientBackground>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingTop: 4,
    paddingBottom: 12,
  },
  backBtn: { width: 36, height: 36, justifyContent: 'center' },
  headerSpacer: { width: 36 },
  title: { fontSize: 18, color: colors.text, fontFamily: 'Inter_700Bold' },
  scroll: { paddingHorizontal: 18, paddingBottom: 36 },

  amountCard: { padding: 20, marginBottom: 16, overflow: 'hidden' },
  fieldLabel: {
    color: colors.textMuted,
    fontSize: 10,
    fontFamily: 'Inter_700Bold',
    letterSpacing: 1,
    marginBottom: 6,
  },
  amountInput: {
    fontSize: 40,
    fontFamily: 'Inter_800ExtraBold',
    color: '#F59E0B',
    marginBottom: 14,
  },
  currencyRow: { flexDirection: 'row', gap: 8 },
  currencyBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  currencyBtnActive: {
    borderColor: '#F59E0B',
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
  },
  currencyBtnText: {
    color: colors.textSecondary,
    fontFamily: 'Inter_600SemiBold',
    fontSize: 13,
  },
  currencyBtnTextActive: {
    color: '#F59E0B',
    fontFamily: 'Inter_800ExtraBold',
  },
  activeDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: '#F59E0B',
  },

  sectionLabel: {
    color: colors.textMuted,
    fontSize: 10,
    fontFamily: 'Inter_700Bold',
    letterSpacing: 1,
    marginTop: 14,
    marginBottom: 8,
  },
  textInput: {
    backgroundColor: colors.cardSolid,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: colors.text,
    fontFamily: 'Inter_500Medium',
    fontSize: 14,
  },

  toggleRow: { flexDirection: 'row', gap: 10 },
  toggleBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.cardSolid,
    alignItems: 'center',
  },
  toggleBtnActive: {
    borderColor: '#F59E0B',
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
  },
  toggleBtnText: {
    color: colors.textSecondary,
    fontSize: 13,
    fontFamily: 'Inter_600SemiBold',
  },
  toggleBtnTextActive: {
    color: '#F59E0B',
    fontFamily: 'Inter_700Bold',
  },

  sourceScroll: { gap: 8 },
  sourceBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.cardSolid,
  },
  sourceBtnActive: {
    borderColor: '#F59E0B',
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
  },
  sourceBtnText: {
    color: colors.textSecondary,
    fontSize: 12,
    fontFamily: 'Inter_600SemiBold',
  },
  sourceBtnTextActive: {
    color: '#F59E0B',
    fontFamily: 'Inter_700Bold',
  },

  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.cardSolid,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  dateLabel: {
    fontSize: 8,
    fontFamily: 'Inter_700Bold',
    color: colors.textMuted,
  },
  dateValue: {
    fontSize: 13,
    color: colors.text,
    fontFamily: 'Inter_600SemiBold',
    marginTop: 2,
  },

  notesInput: {
    backgroundColor: colors.cardSolid,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: colors.text,
    fontFamily: 'Inter_500Medium',
    fontSize: 14,
    height: 60,
    textAlignVertical: 'top',
  },

  saveBtn: {
    marginTop: 24,
    borderRadius: 14,
    overflow: 'hidden',
  },
  saveGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 15,
  },
  saveText: {
    color: '#fff',
    fontFamily: 'Inter_700Bold',
    fontSize: 15,
  },
});
