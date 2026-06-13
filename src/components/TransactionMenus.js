import React from 'react';
import { View, Text, Modal, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import GlassCard from './GlassCard';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';

import DateTimePicker from '@react-native-community/datetimepicker';
import { TextInput, Alert, ScrollView, Platform } from 'react-native';
import { getLoans } from '../services/loanService';

const fmt = (n) => parseFloat(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const SOURCE_TYPES = ['Person', 'Friend', 'Family', 'Bank', 'Company', 'Other'];

const CONVERSION_OPTIONS = [
  {
    type: 'Loan Given',
    title: 'Loan Given',
    desc: 'Lent money to a person or entity',
    icon: 'arrow-up-circle-outline',
    color: '#10B981',
    bgColor: 'rgba(16, 185, 129, 0.12)',
    borderColor: 'rgba(16, 185, 129, 0.25)',
  },
  {
    type: 'Loan Borrowed',
    title: 'Loan Borrowed',
    desc: 'Borrowed money from a person or entity',
    icon: 'arrow-down-circle-outline',
    color: '#3B82F6',
    bgColor: 'rgba(59, 130, 246, 0.12)',
    borderColor: 'rgba(59, 130, 246, 0.25)',
  },
  {
    type: 'Loan Recovery Received',
    title: 'Loan Recovery Received',
    desc: 'Received repayment for a loan I gave',
    icon: 'checkmark-circle-outline',
    color: '#06B6D4',
    bgColor: 'rgba(6, 182, 212, 0.12)',
    borderColor: 'rgba(6, 182, 212, 0.25)',
  },
  {
    type: 'Loan Repayment Paid',
    title: 'Loan Repayment Paid',
    desc: 'Paid back money I borrowed',
    icon: 'cash-outline',
    color: '#F59E0B',
    bgColor: 'rgba(245, 158, 11, 0.12)',
    borderColor: 'rgba(245, 158, 11, 0.25)',
  },
];

/** Bottom-sheet style actions: Edit / Delete entry */
export function TransactionActionModal({ visible, transaction, onClose, onEdit, onRequestDelete, onStartConversion, onGoToDetails }) {
  if (!transaction) return null;
  const isIncome = transaction.type === 'income';
  const isInvestment = transaction.type === 'investment';
  const isLoan = transaction.type === 'loan';
  const isRepayment = transaction.type === 'repayment';
  
  const accent = colors.primary; // Consistent accent for Edit across types
  const loanAccent = '#F59E0B';

  const getMetaText = () => {
    if (isLoan) return `Loan Given/Borrowed · ${transaction.currency} ${fmt(transaction.amount)}`;
    if (isRepayment) return `Loan Repayment · ${transaction.currency} ${fmt(transaction.amount)}`;
    return `${isIncome ? 'Income Entry' : isInvestment ? 'Investment Contribution' : 'Expense Entry'} · ${transaction.currency} ${fmt(transaction.amount)}`;
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <TouchableOpacity style={StyleSheet.absoluteFillObject} activeOpacity={1} onPress={onClose} />
        <GlassCard style={styles.sheetCard}>
          <Text style={styles.sheetTitle}>Transaction Options</Text>
          <Text style={styles.sheetMeta} numberOfLines={1}>
            {getMetaText()}
          </Text>
          <Text style={styles.sheetCat} numberOfLines={1}>
            {transaction.category}
          </Text>

          {/* Go to Loan Details Option */}
          {(isLoan || isRepayment) && onGoToDetails && (
            <TouchableOpacity style={[styles.sheetBtn, { borderColor: loanAccent }]} onPress={onGoToDetails} activeOpacity={0.82}>
              <Ionicons name="eye-outline" size={18} color={loanAccent} />
              <Text style={[styles.sheetBtnText, { color: loanAccent }]}>Go to Loan Details</Text>
            </TouchableOpacity>
          )}

          {/* Edit Option (not for repayments) */}
          {!isRepayment && (
            <TouchableOpacity style={[styles.sheetBtn, { borderColor: accent }]} onPress={onEdit} activeOpacity={0.82}>
              <Ionicons name="pencil-outline" size={18} color={accent} />
              <Text style={[styles.sheetBtnText, { color: accent }]}>Edit</Text>
            </TouchableOpacity>
          )}

          {!isInvestment && !isLoan && !isRepayment && onStartConversion && (
            <TouchableOpacity 
              style={[styles.sheetBtn, { borderColor: loanAccent }]} 
              onPress={() => {
                onClose();
                onStartConversion(transaction);
              }} 
              activeOpacity={0.82}
            >
              <Ionicons name="swap-horizontal-outline" size={18} color={loanAccent} />
              <Text style={[styles.sheetBtnText, { color: loanAccent }]}>Convert to Loan Activity</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity style={styles.sheetBtnDanger} onPress={onRequestDelete} activeOpacity={0.82}>
            <Ionicons name="trash-outline" size={18} color="#fff" />
            <Text style={styles.sheetBtnDangerText}>Delete</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.sheetCancelWrap} onPress={onClose} activeOpacity={0.7}>
            <Text style={styles.sheetCancelText}>Cancel</Text>
          </TouchableOpacity>
        </GlassCard>
      </View>
    </Modal>
  );
}export function ConvertToLoanModal({ visible, transaction, onClose, onConfirm }) {
  const [step, setStep] = React.useState(1);
  const [conversionType, setConversionType] = React.useState('Loan Given');
  const [personName, setPersonName] = React.useState('');
  const [sourceType, setSourceType] = React.useState('Person');
  const [expectedReturnDate, setExpectedReturnDate] = React.useState(null);
  const [showDatePicker, setShowDatePicker] = React.useState(false);
  const [isSaving, setIsSaving] = React.useState(false);

  // Repayment selection states
  const [loans, setLoans] = React.useState([]);
  const [selectedLoanId, setSelectedLoanId] = React.useState(null);
  const [searchQuery, setSearchQuery] = React.useState('');

  // Editable notes state
  const [notes, setNotes] = React.useState('');

  React.useEffect(() => {
    if (visible && transaction) {
      setStep(1);
      setConversionType('Loan Given');
      setPersonName('');
      setSourceType('Person');
      setExpectedReturnDate(null);
      setSelectedLoanId(null);
      setSearchQuery('');
      setNotes(transaction.notes || '');
      setShowDatePicker(false);
      setIsSaving(false);

      // Fetch existing loans for selector
      try {
        const loadedLoans = getLoans();
        setLoans(loadedLoans);
      } catch (err) {
        console.error('Failed to load loans:', err);
      }
    }
  }, [visible, transaction]);

  const targetType = (conversionType === 'Loan Recovery Received') ? 'I Gave' : 'I Borrowed';
  
  // Filter loans for selection by type and outstanding balance, and also match the search query
  const filteredLoans = loans.filter(l => 
    l.type === targetType && 
    l.outstandingAmount > 0 &&
    (l.person_name.toLowerCase().includes(searchQuery.toLowerCase()) || 
     l.currency.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const handleSave = () => {
    if (conversionType === 'Loan Given' || conversionType === 'Loan Borrowed') {
      if (!personName.trim()) {
        Alert.alert('Required Info', 'Please enter Person/Entity Name.');
        return;
      }
      if (!sourceType) {
        Alert.alert('Required Info', 'Please select a Source Type.');
        return;
      }
    } else {
      if (!selectedLoanId) {
        Alert.alert('Required Info', 'Please select a Loan.');
        return;
      }
      const selectedLoan = loans.find(l => l.id === selectedLoanId);
      if (selectedLoan && transaction.amount > selectedLoan.outstandingAmount) {
        Alert.alert('Validation Error', 'Repayment amount cannot exceed the outstanding balance.');
        return;
      }
    }

    Alert.alert(
      'Confirm Conversion',
      'This transaction will be removed from Income/Expense calculations and converted into a Loan Activity.\n\nContinue?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Confirm', 
          onPress: () => {
            setIsSaving(true);
            try {
              const dateStr = expectedReturnDate ? expectedReturnDate.toISOString() : null;
              onConfirm(
                conversionType,
                personName.trim(),
                sourceType,
                dateStr,
                selectedLoanId,
                notes.trim()
              );
            } catch (err) {
              setIsSaving(false);
              Alert.alert('Error', err.message);
            }
          }
        }
      ]
    );
  };

  const formatDate = (d) =>
    d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });

  if (!transaction) return null;

  const selectedOpt = CONVERSION_OPTIONS.find(o => o.type === conversionType) || CONVERSION_OPTIONS[0];

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <GlassCard style={styles.sheetCard}>
          <ScrollView contentContainerStyle={{ paddingBottom: 10 }} showsVerticalScrollIndicator={false}>
            
            {step === 1 ? (
              // STEP 1: Choose Conversion Type
              <View>
                <Text style={styles.sheetTitle}>Convert to Loan Activity</Text>
                
                {/* Read-only transaction summary */}
                <View style={styles.summaryBox}>
                  <Text style={styles.summaryBoxTitle}>ORIGINAL TRANSACTION</Text>
                  <View style={styles.summaryRow}>
                    <View style={styles.summaryCol}>
                      <Text style={styles.summaryLabel}>AMOUNT</Text>
                      <Text style={styles.summaryValue}>{transaction.currency} {fmt(transaction.amount)}</Text>
                    </View>
                    <View style={styles.summaryCol}>
                      <Text style={styles.summaryLabel}>DATE</Text>
                      <Text style={styles.summaryValue}>{formatDate(new Date(transaction.date))}</Text>
                    </View>
                  </View>
                  <View style={[styles.summaryRow, { marginTop: 10 }]}>
                    <View style={styles.summaryCol}>
                      <Text style={styles.summaryLabel}>CATEGORY</Text>
                      <Text style={styles.summaryValue}>{transaction.category}</Text>
                    </View>
                    <View style={styles.summaryCol}>
                      <Text style={styles.summaryLabel}>NOTES</Text>
                      <Text style={styles.summaryValue} numberOfLines={1}>{transaction.notes || '—'}</Text>
                    </View>
                  </View>
                </View>

                <Text style={styles.inputLabel}>SELECT CONVERSION TYPE *</Text>
                <View style={{ marginTop: 4 }}>
                  {CONVERSION_OPTIONS.map(item => (
                    <TouchableOpacity
                      key={item.type}
                      style={[
                        styles.optionCard,
                        conversionType === item.type && {
                          borderColor: item.borderColor,
                          backgroundColor: item.bgColor,
                        }
                      ]}
                      onPress={() => {
                        setConversionType(item.type);
                        setSelectedLoanId(null);
                        setStep(2);
                      }}
                      activeOpacity={0.8}
                    >
                      <View style={[styles.optionIconContainer, { backgroundColor: item.bgColor }]}>
                        <Ionicons name={item.icon} size={20} color={item.color} />
                      </View>
                      <View style={styles.optionContent}>
                        <Text style={styles.optionTitle}>{item.title}</Text>
                        <Text style={styles.optionDesc}>{item.desc}</Text>
                      </View>
                      <Ionicons
                        name="chevron-forward-outline"
                        size={16}
                        color={conversionType === item.type ? item.color : colors.textMuted}
                        style={styles.optionChevron}
                      />
                    </TouchableOpacity>
                  ))}
                </View>

                <View style={[styles.confirmRow, { marginTop: 18 }]}>
                  <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
                    <Text style={styles.cancelText}>Cancel</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              // STEP 2: Enter Details based on conversionType
              <View>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                  <Text style={styles.sheetTitle}>Enter Details</Text>
                  <View style={[styles.stepBadge, { backgroundColor: selectedOpt.bgColor, borderColor: selectedOpt.borderColor }]}>
                    <Text style={[styles.stepBadgeText, { color: selectedOpt.color }]}>{conversionType}</Text>
                  </View>
                </View>

                <Text style={styles.sheetMeta}>
                  Original: {transaction.currency} {fmt(transaction.amount)} · {transaction.category}
                </Text>

                {/* Dynamic Inputs for Loan Given / Borrowed */}
                {(conversionType === 'Loan Given' || conversionType === 'Loan Borrowed') && (
                  <View style={{ marginTop: 10 }}>
                    <Text style={styles.inputLabel}>PERSON / ENTITY NAME *</Text>
                    <TextInput
                      style={styles.textInput}
                      placeholder="e.g. John Doe, ABC Bank"
                      placeholderTextColor={colors.textMuted}
                      value={personName}
                      onChangeText={setPersonName}
                    />

                    <Text style={styles.inputLabel}>SOURCE TYPE *</Text>
                    <View style={styles.dropdownRow}>
                      {SOURCE_TYPES.map(type => (
                        <TouchableOpacity
                          key={type}
                          style={[
                            styles.dropdownBtn,
                            sourceType === type && styles.dropdownBtnActive
                          ]}
                          onPress={() => setSourceType(type)}
                          activeOpacity={0.8}
                        >
                          <Text style={[
                            styles.dropdownBtnText,
                            sourceType === type && styles.dropdownBtnTextActive
                          ]}>
                            {type}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>

                    <Text style={styles.inputLabel}>EXPECTED RETURN DATE (OPTIONAL)</Text>
                    <TouchableOpacity
                      style={styles.datePickerToggle}
                      onPress={() => setShowDatePicker(true)}
                      activeOpacity={0.8}
                    >
                      <Ionicons name="calendar-outline" size={16} color="#F59E0B" />
                      <Text style={styles.datePickerToggleText}>
                        {expectedReturnDate ? formatDate(expectedReturnDate) : 'Select Date'}
                      </Text>
                      {expectedReturnDate && (
                        <TouchableOpacity
                          onPress={(e) => {
                            e.stopPropagation();
                            setExpectedReturnDate(null);
                          }}
                          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                        >
                          <Ionicons name="close-circle" size={16} color={colors.textMuted} />
                        </TouchableOpacity>
                      )}
                    </TouchableOpacity>

                    {showDatePicker && (
                      <DateTimePicker
                        value={expectedReturnDate || new Date()}
                        mode="date"
                        display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                        minimumDate={new Date(transaction.date)}
                        onChange={(event, selected) => {
                          setShowDatePicker(Platform.OS === 'ios');
                          if (selected) {
                            setExpectedReturnDate(selected);
                          }
                        }}
                      />
                    )}
                  </View>
                )}

                {/* Dynamic Inputs for Loan Repayments */}
                {(conversionType === 'Loan Recovery Received' || conversionType === 'Loan Repayment Paid') && (
                  <View style={{ marginTop: 10 }}>
                    <Text style={styles.inputLabel}>SELECT LOAN *</Text>
                    
                    <TextInput
                      style={styles.searchBar}
                      placeholder="Search by name..."
                      placeholderTextColor={colors.textMuted}
                      value={searchQuery}
                      onChangeText={setSearchQuery}
                    />

                    {filteredLoans.length === 0 ? (
                      <Text style={styles.noLoansText}>No matching active loans found.</Text>
                    ) : (
                      <View style={styles.loanSelectorContainer}>
                        <ScrollView style={{ maxHeight: 130 }} nestedScrollEnabled>
                          {filteredLoans.map(l => (
                            <TouchableOpacity
                              key={l.id}
                              style={[
                                styles.loanOptionBtn,
                                selectedLoanId === l.id && styles.loanOptionBtnActive
                              ]}
                              onPress={() => setSelectedLoanId(l.id)}
                              activeOpacity={0.8}
                            >
                              <View style={{ flex: 1 }}>
                                <Text style={[
                                  styles.loanOptionName,
                                  selectedLoanId === l.id && styles.loanOptionNameActive
                                ]}>
                                  {l.person_name}
                                </Text>
                                <Text style={styles.loanOptionMeta}>
                                  Principal: {l.currency} {fmt(l.amount)}
                                </Text>
                              </View>
                              <View style={{ alignItems: 'flex-end' }}>
                                <Text style={[
                                  styles.loanOptionOutstanding,
                                  selectedLoanId === l.id && styles.loanOptionOutstandingActive
                                ]}>
                                  Outstanding
                                </Text>
                                <Text style={[
                                  styles.loanOptionOutstandingVal,
                                  selectedLoanId === l.id && styles.loanOptionOutstandingValActive
                                ]}>
                                  {l.currency} {fmt(l.outstandingAmount)}
                                </Text>
                              </View>
                            </TouchableOpacity>
                          ))}
                        </ScrollView>
                      </View>
                    )}
                  </View>
                )}

                {/* Editable Notes (Always Shown at bottom) */}
                <Text style={styles.inputLabel}>NOTES</Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="Add notes..."
                  placeholderTextColor={colors.textMuted}
                  value={notes}
                  onChangeText={setNotes}
                />

                <View style={[styles.confirmRow, { marginTop: 22 }]}>
                  <TouchableOpacity style={styles.cancelBtn} onPress={() => setStep(1)} disabled={isSaving}>
                    <Text style={styles.cancelText}>Back</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.deleteBtn, { backgroundColor: '#F59E0B' }]}
                    onPress={handleSave}
                    disabled={isSaving}
                  >
                    {isSaving ? (
                      <ActivityIndicator color="#fff" />
                    ) : (
                      <Text style={styles.deleteBtnText}>Save Conversion</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            )}

          </ScrollView>
        </GlassCard>
      </View>
    </Modal>
  );
}

export function DeleteTransactionConfirmModal({ visible, transaction, onClose, onConfirm, deleting }) {
  if (!transaction) return null;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={deleting ? undefined : onClose}>
      <View style={styles.overlay}>
        {!deleting ? (
          <TouchableOpacity style={StyleSheet.absoluteFillObject} activeOpacity={1} onPress={onClose} />
        ) : null}
        <GlassCard style={styles.confirmCard}>
          <Text style={styles.confirmTitle}>Delete this entry?</Text>
          <Text style={styles.confirmBody}>
            This will remove the {transaction.type === 'income' ? 'income' : transaction.type === 'investment' ? 'investment contribution' : transaction.type === 'loan' ? 'loan (and all its repayments)' : transaction.type === 'repayment' ? 'loan repayment' : 'expense'} record for{' '}
            <Text style={{ fontFamily: 'Inter_700Bold' }}>{transaction.category}</Text> ({transaction.currency}{' '}
            {fmt(transaction.amount)}). This cannot be undone.
          </Text>
          <View style={styles.confirmRow}>
            <TouchableOpacity style={styles.cancelBtn} onPress={onClose} disabled={deleting} activeOpacity={0.8}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.deleteBtn} onPress={onConfirm} disabled={deleting} activeOpacity={0.85}>
              {deleting ? <ActivityIndicator color="#fff" /> : <Text style={styles.deleteBtnText}>Delete</Text>}
            </TouchableOpacity>
          </View>
        </GlassCard>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 22,
  },
  sheetCard: { padding: 20, zIndex: 10, elevation: 12, width: '100%', maxWidth: 400 },
  sheetTitle: { ...typography.h3, marginBottom: 6 },
  sheetMeta: { ...typography.bodyMedium, color: colors.textSecondary },
  sheetCat: { ...typography.bodySmall, color: colors.textMuted, marginBottom: 16 },
  sheetBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1.5,
    backgroundColor: colors.cardSolid,
    marginBottom: 10,
  },
  sheetBtnText: { fontFamily: 'Inter_700Bold', fontSize: 15 },
  sheetBtnDanger: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: colors.danger,
    marginBottom: 6,
  },
  sheetBtnDangerText: { color: '#fff', fontFamily: 'Inter_700Bold', fontSize: 15 },
  sheetCancelWrap: { paddingVertical: 10, alignItems: 'center' },
  sheetCancelText: { ...typography.bodySmall, color: colors.textMuted, fontFamily: 'Inter_600SemiBold' },

  confirmCard: { padding: 22, zIndex: 10, elevation: 12, width: '100%', maxWidth: 400 },
  confirmTitle: { ...typography.h3, marginBottom: 10 },
  confirmBody: { ...typography.bodySmall, color: colors.textSecondary, lineHeight: 20, marginBottom: 20 },
  confirmRow: { flexDirection: 'row', gap: 10 },
  cancelBtn: {
    flex: 1,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    backgroundColor: colors.cardSolid,
  },
  cancelText: { color: colors.textSecondary, fontFamily: 'Inter_600SemiBold', fontSize: 14 },
  deleteBtn: {
    flex: 1,
    padding: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.danger,
    minHeight: 48,
  },
  deleteBtnText: { color: '#fff', fontFamily: 'Inter_700Bold', fontSize: 14 },
  inputLabel: {
    color: colors.textMuted,
    fontSize: 10,
    fontFamily: 'Inter_700Bold',
    letterSpacing: 1,
    marginTop: 14,
    marginBottom: 6,
  },
  textInput: {
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: colors.text,
    fontFamily: 'Inter_500Medium',
    fontSize: 14,
  },
  dropdownRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  dropdownBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: 'rgba(255,255,255,0.02)',
  },
  dropdownBtnActive: {
    borderColor: '#F59E0B',
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
  },
  dropdownBtnText: {
    color: colors.textSecondary,
    fontSize: 12,
    fontFamily: 'Inter_600SemiBold',
  },
  dropdownBtnTextActive: {
    color: '#F59E0B',
    fontFamily: 'Inter_700Bold',
  },
  datePickerToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  datePickerToggleText: {
    flex: 1,
    color: colors.text,
    fontSize: 14,
    fontFamily: 'Inter_500Medium',
  },
  summaryBox: {
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginTop: 8,
    marginBottom: 14,
  },
  summaryBoxTitle: {
    fontSize: 9,
    fontFamily: 'Inter_700Bold',
    color: colors.accentTeal,
    letterSpacing: 1.2,
    marginBottom: 8,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  summaryCol: {
    flex: 1,
  },
  summaryLabel: {
    fontSize: 8,
    fontFamily: 'Inter_700Bold',
    color: colors.textMuted,
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  summaryValue: {
    fontSize: 12,
    fontFamily: 'Inter_600SemiBold',
    color: colors.textSecondary,
  },
  conversionTypeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 6,
  },
  typeBtn: {
    flex: 1,
    minWidth: '45%',
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  typeBtnActive: {
    borderColor: '#F59E0B',
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
  },
  typeBtnText: {
    color: colors.textSecondary,
    fontSize: 11,
    fontFamily: 'Inter_600SemiBold',
    textAlign: 'center',
  },
  typeBtnTextActive: {
    color: '#F59E0B',
    fontFamily: 'Inter_700Bold',
  },
  searchBar: {
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    color: colors.text,
    fontFamily: 'Inter_500Medium',
    fontSize: 13,
    marginBottom: 8,
    marginTop: 2,
  },
  noLoansText: {
    color: colors.textMuted,
    fontSize: 12,
    fontFamily: 'Inter_500Medium',
    textAlign: 'center',
    paddingVertical: 18,
  },
  loanSelectorContainer: {
    backgroundColor: 'rgba(0, 0, 0, 0.25)',
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 10,
    padding: 6,
    marginBottom: 8,
  },
  loanOptionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 8,
    marginBottom: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.01)',
  },
  loanOptionBtnActive: {
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
    borderColor: 'rgba(245, 158, 11, 0.25)',
    borderWidth: 1,
  },
  loanOptionName: {
    color: colors.text,
    fontSize: 13,
    fontFamily: 'Inter_600SemiBold',
  },
  loanOptionNameActive: {
    color: '#F59E0B',
  },
  loanOptionMeta: {
    color: colors.textMuted,
    fontSize: 10,
    fontFamily: 'Inter_500Medium',
    marginTop: 1,
  },
  loanOptionOutstanding: {
    color: colors.textMuted,
    fontSize: 9,
    fontFamily: 'Inter_600SemiBold',
    textAlign: 'right',
  },
  loanOptionOutstandingActive: {
    color: 'rgba(245, 158, 11, 0.7)',
  },
  loanOptionOutstandingVal: {
    color: '#F59E0B',
    fontSize: 12,
    fontFamily: 'Inter_700Bold',
    textAlign: 'right',
    marginTop: 1,
  },
  loanOptionOutstandingValActive: {
    color: '#F59E0B',
  },
  stepBadge: {
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 1,
  },
  stepBadgeText: {
    fontSize: 10,
    fontFamily: 'Inter_700Bold',
  },
  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
    marginBottom: 10,
  },
  optionIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  optionContent: {
    flex: 1,
  },
  optionTitle: {
    color: colors.text,
    fontSize: 13,
    fontFamily: 'Inter_700Bold',
  },
  optionDesc: {
    color: colors.textSecondary,
    fontSize: 10.5,
    fontFamily: 'Inter_500Medium',
    marginTop: 2,
  },
  optionChevron: {
    marginLeft: 8,
  },
});
