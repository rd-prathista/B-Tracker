import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Pressable, LayoutAnimation, Platform, UIManager, Alert, Modal, TextInput } from 'react-native';

import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';
import { getDashboardBalances, getRecentTransactions, deleteTransaction, getActiveInvestmentsSummary, getArchivableCount, archiveOldTransactions, getArchivableTransactions } from '../services/transactionService';
import { getUpcomingReminders, addReminder, updateReminder, deleteReminder, toggleReminder } from '../services/reminderService';
import { getLoanSummary, convertTransactionToLoanActivity, getLoanTransactionsForHistory, deleteLoan, deleteRepayment } from '../services/loanService';

import FadeInView from '../components/FadeInView';
import AmbientBackground from '../components/AmbientBackground';
import GlassCard from '../components/GlassCard';
import { TransactionActionModal, DeleteTransactionConfirmModal, ConvertToLoanModal } from '../components/TransactionMenus';
import Toast from '../components/Toast';
import ReminderModal from '../components/ReminderModal';
import { fmt, fmtDate } from '../utils/formatters';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const BalanceRow = ({ code, data, isLast }) => {
  const hasLoans = (data.outstandingGiven || 0) > 0 || (data.outstandingBorrowed || 0) > 0;
  return (
    <View style={[!isLast && styles.borderBottom, { paddingVertical: 12 }]}>
      <View style={styles.balanceRow}>
        <View style={styles.balanceInfo}>
          <Text style={styles.currencyCode}>{code} CASH BALANCE</Text>
          <Text style={styles.balanceAmt}>{fmt(data.balance)}</Text>
        </View>
        <View style={styles.balanceBreakdown}>
          <View style={styles.breakdownItem}>
            <Text style={[styles.breakdownLabel, { color: colors.success }]}>INCOME</Text>
            <Text style={styles.breakdownValue}>{fmt(data.income)}</Text>
          </View>
          <View style={styles.breakdownItem}>
            <Text style={[styles.breakdownLabel, { color: colors.danger }]}>EXPENSE</Text>
            <Text style={styles.breakdownValue}>{fmt(data.expense)}</Text>
          </View>
          <View style={styles.breakdownItem}>
            <Text style={[styles.breakdownLabel, { color: colors.accentIndigo }]}>INVESTED</Text>
            <Text style={styles.breakdownValue}>{fmt(data.investment)}</Text>
          </View>
        </View>
      </View>
      {hasLoans && (
        <View style={styles.loanRowMultiLine}>
          {(data.outstandingGiven || 0) > 0 && (
            <View style={styles.loanRowLine}>
              <Text style={styles.loanRowLabel}>Loans Given: </Text>
              <Text style={styles.loanRowValue}>{code} {fmt(data.outstandingGiven)}</Text>
            </View>
          )}
          {(data.outstandingBorrowed || 0) > 0 && (
            <View style={[styles.loanRowLine, (data.outstandingGiven || 0) > 0 && { marginTop: 4 }]}>
              <Text style={styles.loanRowLabel}>Loans Borrowed: </Text>
              <Text style={[styles.loanRowValue, { color: colors.dangerLight }]}>{code} {fmt(data.outstandingBorrowed)}</Text>
            </View>
          )}
        </View>
      )}
    </View>
  );
};


export default function DashboardScreen({ navigation }) {
  const [balances, setBalances] = useState({
    AED: { income: 0, expense: 0, investment: 0, balance: 0 },
    INR: { income: 0, expense: 0, investment: 0, balance: 0 },
  });
  const [recentTx, setRecentTx] = useState([]);
  const [activeInvestments, setActiveInvestments] = useState([]);
  const [hasData, setHasData] = useState(false);

  const [actionTx, setActionTx] = useState(null);
  const [deleteTx, setDeleteTx] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const [reminders, setReminders] = useState([]);
  const [showReminderModal, setShowReminderModal] = useState(false);
  const [reminderToEdit, setReminderToEdit] = useState(null);

  const [archivableCount, setArchivableCount] = useState(0);
  const [showArchiveSuggestion, setShowArchiveSuggestion] = useState(true);
  const [showArchivePreview, setShowArchivePreview] = useState(false);
  const [previewArchiveData, setPreviewArchiveData] = useState(null);


  const [conversionTx, setConversionTx] = useState(null);
  const [showConversionModal, setShowConversionModal] = useState(false);

  // Toast States
  const [toastVisible, setToastVisible] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [toastAction, setToastAction] = useState(null);

  const loadData = () => {
    const b = getDashboardBalances();
    
    // Enrich with outstanding loans
    const aedLoans = getLoanSummary('AED');
    const inrLoans = getLoanSummary('INR');
    b.AED.outstandingGiven = aedLoans.outstandingGiven;
    b.AED.outstandingBorrowed = aedLoans.outstandingBorrowed;
    b.INR.outstandingGiven = inrLoans.outstandingGiven;
    b.INR.outstandingBorrowed = inrLoans.outstandingBorrowed;
    
    setBalances(b);
    
    // Merge recent transactions and recent loans/repayments
    const normalTxs = getRecentTransactions(10);
    const loanTxs = getLoanTransactionsForHistory({ limit: 10 });
    const mergedRecent = [...normalTxs, ...loanTxs]
      .sort((a, b) => new Date(b.date) - new Date(a.date))
      .slice(0, 2); // display top 2
      
    setRecentTx(mergedRecent);
    setActiveInvestments(getActiveInvestmentsSummary());
    setReminders(getUpcomingReminders());
    setArchivableCount(getArchivableCount(6));
    
    setHasData(
      b.AED.income > 0 || 
      b.AED.expense > 0 || 
      b.AED.investment > 0 || 
      b.INR.income > 0 || 
      b.INR.expense > 0 || 
      b.INR.investment > 0 ||
      b.AED.outstandingGiven > 0 ||
      b.AED.outstandingBorrowed > 0 ||
      b.INR.outstandingGiven > 0 ||
      b.INR.outstandingBorrowed > 0
    );
  };


  useFocusEffect(useCallback(() => { loadData(); }, []));

  const openActions = (tx) => setActionTx(tx);

  const editFromMenu = () => {
    if (!actionTx) return;
    const tx = actionTx;
    setActionTx(null);
    if (tx.type === 'loan') {
      navigation.navigate('AddLoan', { loanId: tx.loanId });
    } else {
      navigation.navigate('AddTransaction', { type: tx.type, mode: 'edit', transactionId: tx.id });
    }
  };


  const requestDeleteFromMenu = () => {
    if (!actionTx) return;
    const tx = actionTx;
    setActionTx(null);
    setDeleteTx(tx);
  };

  const cancelDelete = () => {
    if (deleting) return;
    setDeleteTx(null);
  };

  const confirmDelete = async () => {
    if (!deleteTx) return;
    setDeleting(true);
    try {
      if (deleteTx.type === 'loan') {
        deleteLoan(deleteTx.loanId);
      } else if (deleteTx.type === 'repayment') {
        deleteRepayment(deleteTx.repaymentId);
      } else {
        deleteTransaction(deleteTx.type, deleteTx.id);
      }
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      loadData();
      setDeleteTx(null);
    } finally {
      setDeleting(false);
    }
  };

  const handleArchiveNow = () => {
    const data = getArchivableTransactions(6);
    setPreviewArchiveData(data);
    setShowArchivePreview(true);
  };

  const confirmArchive = () => {
    archiveOldTransactions(6);
    setShowArchivePreview(false);
    setShowArchiveSuggestion(false);
    setPreviewArchiveData(null);
    loadData();
  };

  const handleSaveReminder = (data) => {
    if (data.id) updateReminder(data.id, data);
    else addReminder(data);
    loadData();
  };

  const hasINR = balances.INR.income > 0 || balances.INR.expense > 0 || balances.INR.investment > 0;

  const calculateDaysLeft = (dueDate) => {
    const diff = new Date(dueDate).getTime() - new Date().getTime();
    const days = Math.ceil(diff / (1000 * 3600 * 24));
    return days < 0 ? 'Overdue' : days === 0 ? 'Today' : `In ${days} day${days > 1 ? 's' : ''}`;
  };

  return (
    <AmbientBackground>
      <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          <FadeInView delay={0}>
            <View style={styles.header}>
              <View>
                <Text style={styles.greeting}>Your Finances</Text>
                <Text style={styles.pageTitle}>Dashboard</Text>
              </View>
              <View style={styles.headerRight}>
                <TouchableOpacity onPress={() => navigation.navigate('Reports')} style={styles.headerIconBtn}>
                  <Ionicons name="pie-chart-outline" size={20} color={colors.text} />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => navigation.navigate('Settings')} style={styles.headerIconBtn}>
                  <Ionicons name="settings-outline" size={20} color={colors.textSecondary} />
                </TouchableOpacity>
              </View>
            </View>
          </FadeInView>

          {false && (
            <FadeInView delay={40}>
              <View style={styles.archiveCard}>
                <View style={styles.archiveHeader}>
                  <Ionicons name="archive-outline" size={20} color={colors.accentIndigo} />
                  <Text style={styles.archiveTitle}>You have {archivableCount} old entries eligible for archive</Text>
                </View>
                <View style={styles.archiveBtns}>
                  <TouchableOpacity style={styles.archiveBtnNow} onPress={handleArchiveNow}>
                    <Text style={styles.archiveBtnNowText}>Archive Now</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.archiveBtnLater} onPress={() => setShowArchiveSuggestion(false)}>
                    <Text style={styles.archiveBtnLaterText}>Skip</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </FadeInView>
          )}

          <FadeInView delay={80}>
            <View style={styles.buttonGrid}>
              <View style={styles.buttonGridRow}>
                <TouchableOpacity
                  style={styles.actionBtn}
                  activeOpacity={0.82}
                  onPress={() => navigation.navigate('AddTransaction', { type: 'income' })}
                >
                  <LinearGradient colors={[colors.primary, colors.primaryDark]} style={styles.actionGrad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
                    <Ionicons name="add-circle-outline" size={17} color="#fff" />
                    <Text style={styles.actionText}>Income</Text>
                  </LinearGradient>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.actionBtn}
                  activeOpacity={0.82}
                  onPress={() => navigation.navigate('AddTransaction', { type: 'expense' })}
                >
                  <LinearGradient colors={[colors.dangerLight, colors.danger]} style={styles.actionGrad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
                    <Ionicons name="remove-circle-outline" size={17} color="#fff" />
                    <Text style={styles.actionText}>Expense</Text>
                  </LinearGradient>
                </TouchableOpacity>
              </View>

              <View style={[styles.buttonGridRow, { marginTop: 10 }]}>
                <TouchableOpacity
                  style={styles.actionBtn}
                  activeOpacity={0.82}
                  onPress={() => navigation.navigate('AddTransaction', { type: 'investment' })}
                >
                  <LinearGradient colors={[colors.accentIndigo, '#4F46E5']} style={styles.actionGrad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
                    <Ionicons name="briefcase-outline" size={17} color="#fff" />
                    <Text style={styles.actionText}>Invest</Text>
                  </LinearGradient>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.actionBtn}
                  activeOpacity={0.82}
                  onPress={() => navigation.navigate('AddLoan')}
                >
                  <LinearGradient colors={['#F59E0B', '#D97706']} style={styles.actionGrad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
                    <Ionicons name="swap-horizontal-outline" size={17} color="#fff" />
                    <Text style={styles.actionText}>Loan</Text>
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            </View>
          </FadeInView>

          {!hasData ? (
            <FadeInView delay={160}>
              <View style={styles.emptyWrap}>
                <Ionicons name="wallet-outline" size={34} color={colors.textMuted} />
                <Text style={[typography.bodyMedium, { marginTop: 10 }]}>No transactions yet</Text>
                <Text style={[typography.bodySmall, { textAlign: 'center', marginTop: 4 }]}>
                  Add your first income or expense above.
                </Text>
              </View>
            </FadeInView>
          ) : (
            <FadeInView delay={160}>
              <GlassCard style={styles.balanceCard}>
                <View style={styles.balanceCardHeader}>
                  <Text style={styles.balanceCardLabel}>TOTAL BALANCES</Text>
                  <Ionicons name="stats-chart-outline" size={14} color={colors.textMuted} />
                </View>
                <BalanceRow code="AED" data={balances.AED} isLast={!hasINR} />
                {hasINR && <BalanceRow code="INR" data={balances.INR} isLast={true} />}
              </GlassCard>
            </FadeInView>
          )}

          {false && (
            <FadeInView delay={180}>
              <View style={styles.sectionRow}>
              <Text style={styles.sectionLabel}>UPCOMING REMINDERS</Text>
              <TouchableOpacity onPress={() => { setReminderToEdit(null); setShowReminderModal(true); }}>
                <Text style={styles.viewAllText}>+ Add</Text>
              </TouchableOpacity>
            </View>
            
            {reminders.length === 0 ? (
              <View style={[styles.emptyWrap, { marginTop: 0, marginBottom: 20 }]}>
                <Text style={[typography.bodySmall, { color: colors.textMuted }]}>No upcoming reminders</Text>
              </View>
            ) : (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.reminderScroll}>
                {reminders.map(r => (
                  <TouchableOpacity key={r.id} style={styles.reminderCard} onPress={() => { setReminderToEdit(r); setShowReminderModal(true); }}>
                    <View style={styles.reminderHeader}>
                      <Ionicons name="notifications-outline" size={14} color={colors.accentTeal} />
                      <Text style={styles.reminderDays}>{calculateDaysLeft(r.due_date)}</Text>
                    </View>
                    <Text style={styles.reminderTitle} numberOfLines={1}>{r.title}</Text>
                    <Text style={styles.reminderDate}>{fmtDate(r.due_date)} {r.amount ? `• ${r.currency} ${fmt(r.amount)}` : ''}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}
          </FadeInView>
          )}

          {activeInvestments.length > 0 && (
            <FadeInView delay={200}>
              <View style={styles.sectionRow}>
                <Text style={styles.sectionLabel}>INVESTMENT FOCUS</Text>
              </View>
              
              <View style={{ gap: 2, marginBottom: 20, paddingHorizontal: 18 }}>
                {activeInvestments.map((inv) => {
                  const tenureMonths = inv.tenure_type === 'Years' ? inv.tenure_value * 12 : inv.tenure_value;
                  const progress = Math.min(100, (inv.total_invested / (inv.target_amount || inv.total_invested || 1)) * 100);
                  
                  return (
                    <View key={inv.id} style={styles.focusRow}>
                      <View style={styles.focusRowHeader}>
                        <View style={styles.focusDot} />
                        <Text style={styles.focusRowName} numberOfLines={1}>{inv.name}</Text>
                      </View>
                      <View style={styles.focusRowData}>
                        <Text style={styles.focusRowProgress}>
                          {inv.currency} {fmt(inv.total_invested)} / {inv.target_amount ? fmt(inv.target_amount) : '---'}
                          <Text style={styles.focusRowTenure}> · {inv.tenure_value} {inv.tenure_type}</Text>
                        </Text>
                        <Text style={styles.focusRowPercent}>{progress.toFixed(0)}%</Text>
                      </View>
                    </View>
                  );
                })}
              </View>
            </FadeInView>
          )}


          <FadeInView delay={240}>
            <View style={styles.sectionRow}>
              <Text style={styles.sectionLabel}>RECENT ACTIVITY</Text>
              <TouchableOpacity onPress={() => navigation.navigate('AllTransactions')}>
                <Text style={styles.viewAll}>View All</Text>
              </TouchableOpacity>
            </View>

            <View style={{ paddingHorizontal: 18, marginBottom: 14 }}>
              {recentTx.length === 0 ? (
                <View style={styles.emptyTx}>
                  <Text style={[typography.bodySmall]}>No recent transactions</Text>
                </View>
              ) : (
                recentTx.map((tx, i) => {
                  const isIncome = tx.type === 'income';
                  const isInvestment = tx.type === 'investment';
                  const isLoanModule = tx.type === 'loan' || tx.type === 'repayment';
                  const icon = tx.icon || 'ellipse-outline';
                  
                  let txColor = isIncome ? colors.success : (isInvestment ? colors.accentIndigo : colors.danger);
                  let txBg = isIncome ? colors.success + '20' : (isInvestment ? colors.accentIndigo + '20' : colors.danger + '20');

                  if (isLoanModule) {
                    if (tx.type === 'loan') {
                      txColor = '#F59E0B'; // Amber
                      txBg = '#F59E0B20';
                    } else if (tx.type === 'repayment') {
                      if (tx.loanType === 'I Gave') {
                        txColor = colors.success; // Green for loan recovered
                        txBg = colors.success + '20';
                      } else {
                        txColor = colors.danger; // Red for repayment
                        txBg = colors.danger + '20';
                      }
                    }
                  }
                  
                  const isReceived = tx.type === 'income' || (tx.type === 'loan' && tx.loanType === 'I Borrowed') || (tx.type === 'repayment' && tx.loanType === 'I Gave');
                  const sign = isReceived ? '+' : '-';

                  // Descriptive Text for Loans & Repayments
                  let displayCategory = tx.category;
                  if (tx.type === 'loan') {
                    displayCategory = tx.loanType === 'I Gave' 
                      ? `Gave Loan to ${tx.personName}` 
                      : `Borrowed from ${tx.personName}`;
                  } else if (tx.type === 'repayment') {
                    displayCategory = tx.loanType === 'I Gave' 
                      ? `Loan Repaid by ${tx.personName}` 
                      : `Repayment to ${tx.personName}`;
                  }

                  return (
                    <FadeInView key={`${tx.type}-${tx.id}`} delay={280 + i * 60}>
                      <View style={styles.txRow}>
                        <Pressable
                          style={styles.txMainPress}
                          onLongPress={() => openActions(tx)}
                          onPress={() => {
                            if (isLoanModule) {
                              navigation.navigate('LoanDetails', { loanId: tx.loanId });
                            }
                          }}
                          delayLongPress={380}
                        >
                          <View style={[styles.txIcon, { backgroundColor: txBg }]}>
                            <Ionicons name={icon} size={15} color={txColor} />
                          </View>
                          <View style={styles.txInfo}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                              <Text style={styles.txCategory}>{displayCategory}</Text>
                            </View>
                            <Text style={styles.txMeta}>
                              {fmtDate(tx.date)}
                              {tx.notes ? ` · ${tx.notes}` : ''}
                            </Text>
                          </View>
                          <Text
                            style={[styles.txAmount, { color: txColor }]}
                            numberOfLines={1}
                            adjustsFontSizeToFit
                          >
                            {sign}
                            {tx.currency} {fmt(tx.amount)}
                          </Text>
                        </Pressable>
                        <TouchableOpacity
                          hitSlop={{ top: 10, bottom: 10, left: 8, right: 8 }}
                          style={styles.txMenuHit}
                          onPress={() => openActions(tx)}
                          accessibilityLabel="Transaction options"
                        >
                          <Ionicons name="ellipsis-vertical" size={18} color={colors.textMuted} />
                        </TouchableOpacity>
                      </View>
                    </FadeInView>
                  );
                })
              )}
            </View>
          </FadeInView>
        </ScrollView>

        <Modal visible={false} transparent animationType="fade" onRequestClose={() => setShowArchivePreview(false)}>
          <View style={styles.overlay}>
            <View style={styles.archiveModalCard}>
              <Text style={styles.modalTitle}>Entries to Archive</Text>
              <Text style={{ ...typography.bodySmall, color: colors.textSecondary, marginBottom: 8 }}>
                These entries are older than 6 months and will be archived. They won't appear in default active reports.
              </Text>
              <Text style={{ ...typography.caption, color: colors.textMuted, marginBottom: 10 }}>
                {previewArchiveData?.length || 0} entries found
              </Text>
              
              <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator bounces={false}>
                {previewArchiveData?.map((tx) => (
                  <View key={`${tx.type}-${tx.id}`} style={{ paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.border }}>
                    <Text style={{ ...typography.bodyMedium, color: colors.text }}>{fmtDate(tx.date)} - {tx.category}</Text>
                    <Text style={{ ...typography.bodySmall, color: colors.textSecondary, marginTop: 4 }}>
                      {tx.type.toUpperCase()} • {tx.currency} {fmt(tx.amount)}
                    </Text>
                  </View>
                ))}
              </ScrollView>

              <View style={styles.modalBtns}>
                <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowArchivePreview(false)}>
                  <Text style={styles.cancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.applyBtn, { backgroundColor: colors.accentTeal }]} onPress={confirmArchive}>
                  <Text style={styles.applyText}>Confirm Archive</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        <TransactionActionModal 
          visible={!!actionTx} 
          transaction={actionTx} 
          onClose={() => setActionTx(null)} 
          onEdit={editFromMenu} 
          onRequestDelete={requestDeleteFromMenu} 
          onStartConversion={(tx) => {
            setConversionTx(tx);
            setShowConversionModal(true);
          }}
          onGoToDetails={() => {
            if (actionTx) {
              const loanId = actionTx.loanId;
              setActionTx(null);
              navigation.navigate('LoanDetails', { loanId });
            }
          }}
        />
        <DeleteTransactionConfirmModal visible={!!deleteTx} transaction={deleteTx} onClose={cancelDelete} onConfirm={confirmDelete} deleting={deleting} />
        
        <ConvertToLoanModal
          visible={showConversionModal}
          transaction={conversionTx}
          onClose={() => {
            setShowConversionModal(false);
            setConversionTx(null);
          }}
          onConfirm={(conversionType, personName, sourceType, expectedReturnDate, selectedLoanId, notes) => {
            try {
              const loanId = convertTransactionToLoanActivity({
                txType: conversionTx.type,
                txId: conversionTx.id,
                conversionType,
                personName,
                sourceType,
                expectedReturnDate,
                selectedLoanId,
                notes
              });
              
              setShowConversionModal(false);
              setConversionTx(null);
              
              // Configure Toast
              setToastMessage('Loan Activity Converted Successfully');
              setToastAction({
                label: 'View Loan',
                onAction: () => {
                  navigation.navigate('LoanDetails', { loanId });
                }
              });
              setToastVisible(true);
              
              loadData();
            } catch (err) {
              Alert.alert('Error', err.message);
            }
          }}
        />

        <Toast
          message={toastMessage}
          visible={toastVisible}
          onHide={() => setToastVisible(false)}
          actionLabel={toastAction?.label}
          onAction={toastAction?.onAction}
        />

        <ReminderModal 
          visible={showReminderModal} 
          onClose={() => setShowReminderModal(false)} 
          onSave={handleSaveReminder} 
          reminderToEdit={reminderToEdit} 
        />
      </SafeAreaView>
    </AmbientBackground>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  scroll: { paddingBottom: 32, flexGrow: 1 },

  header: {
    paddingHorizontal: 18,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 6,
    marginBottom: 16,
  },
  greeting: { ...typography.caption, marginBottom: 2 },
  pageTitle: { ...typography.h1 },
  headerRight: { flexDirection: 'row', gap: 10 },
  headerIconBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.cardSolid,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },

  buttonRow: { flexDirection: 'row', gap: 11, marginBottom: 20, paddingHorizontal: 18 },
  actionBtn: {
    flex: 1,
    borderRadius: 13,
    overflow: 'hidden',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 5,
  },
  actionGrad: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingVertical: 12, paddingHorizontal: 6 },
  actionText: { ...typography.buttonPrimary, fontSize: 14 },

  balanceCard: { marginHorizontal: 18, marginBottom: 20 },
  balanceCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 },
  balanceCardLabel: { ...typography.label, color: colors.textSecondary },
  balanceRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12 },
  borderBottom: { borderBottomWidth: 1, borderBottomColor: colors.border },
  balanceInfo: { flex: 1 },
  currencyCode: { ...typography.caption, color: colors.textMuted, marginBottom: 2 },
  balanceAmt: { ...typography.h3, fontFamily: 'Inter_700Bold' },
  balanceBreakdown: { flexDirection: 'row', gap: 12 },
  breakdownItem: { alignItems: 'flex-end' },
  breakdownLabel: { fontSize: 8, fontFamily: 'Inter_700Bold', marginBottom: 2 },
  breakdownValue: { ...typography.caption, color: colors.text, fontFamily: 'Inter_600SemiBold' },

  emptyWrap: { alignItems: 'center', justifyContent: 'center', padding: 40, marginTop: 20 },
  sectionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 18, marginBottom: 12 },
  sectionLabel: { ...typography.sectionLabel, marginBottom: 0 },
  viewAllText: { ...typography.bodySmall, color: colors.accentTeal, fontFamily: 'Inter_700Bold' },
  viewAll: { ...typography.bodySmall, color: colors.primary, fontFamily: 'Inter_700Bold' },

  archiveCard: { marginHorizontal: 18, marginBottom: 16, backgroundColor: colors.accentIndigo + '10', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: colors.accentIndigo + '30' },
  archiveHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  archiveTitle: { ...typography.bodyMedium, color: colors.text, flex: 1, fontFamily: 'Inter_600SemiBold' },
  archiveBtns: { flexDirection: 'row', gap: 10 },
  archiveBtnNow: { flex: 1, backgroundColor: colors.accentIndigo, paddingVertical: 10, borderRadius: 10, alignItems: 'center' },
  archiveBtnNowText: { ...typography.buttonPrimary, color: '#fff', fontSize: 13 },
  archiveBtnLater: { flex: 1, backgroundColor: 'rgba(255,255,255,0.05)', paddingVertical: 10, borderRadius: 10, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  archiveBtnLaterText: { ...typography.buttonPrimary, color: colors.textMuted, fontSize: 13 },

  reminderScroll: { paddingHorizontal: 18, paddingBottom: 20, gap: 12 },
  reminderCard: { backgroundColor: colors.cardSolid, padding: 14, borderRadius: 16, width: 140, borderWidth: 1, borderColor: colors.border },
  reminderHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  reminderDays: { ...typography.caption, color: colors.accentTeal, fontFamily: 'Inter_700Bold' },
  reminderTitle: { ...typography.bodyMedium, fontFamily: 'Inter_600SemiBold', marginBottom: 4 },
  reminderDate: { ...typography.caption, color: colors.textMuted },

  emptyTx: { paddingVertical: 12, alignItems: 'center' },

  focusRow: { paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.border },
  focusRowHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  focusDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.accentIndigo },
  focusRowName: { fontSize: 13, fontFamily: 'Inter_700Bold', color: colors.text, flex: 1 },
  focusRowData: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', paddingLeft: 14 },
  focusRowProgress: { fontSize: 11, color: colors.textSecondary, fontFamily: 'Inter_500Medium' },
  focusRowTenure: { color: colors.textMuted, fontSize: 10 },
  focusRowPercent: { fontSize: 13, fontFamily: 'Inter_800ExtraBold', color: colors.accentIndigo },

  txRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.cardSolid,
    borderRadius: 12,
    marginBottom: 7,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  txMainPress: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    paddingLeft: 12,
    paddingRight: 6,
  },
  txMenuHit: { paddingVertical: 10, paddingRight: 12, paddingLeft: 4, justifyContent: 'center' },
  txIcon: { width: 32, height: 32, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  txInfo: { flex: 1 },
  txCategory: { ...typography.txCategory },
  txMeta: { ...typography.txMeta, marginTop: 1 },
  txAmount: { ...typography.txAmount },

  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  archiveModalCard: { width: '100%', height: '70%', backgroundColor: colors.cardSolid, borderRadius: 20, padding: 20, borderWidth: 1, borderColor: colors.border, flexDirection: 'column' },
  modalCard: { width: '100%', padding: 20, borderRadius: 20 },
  modalTitle: { ...typography.h3, marginBottom: 4 },
  modalBtns: { flexDirection: 'row', gap: 10, marginTop: 10 },
  cancelBtn: { flex: 1, padding: 14, borderRadius: 12, borderWidth: 1, borderColor: colors.border, alignItems: 'center', backgroundColor: colors.cardSolid, justifyContent: 'center' },
  cancelText: { color: colors.textSecondary, fontFamily: 'Inter_600SemiBold', fontSize: 14 },
  applyBtn: { flex: 1, padding: 14, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  applyText: { color: '#fff', fontFamily: 'Inter_700Bold', fontSize: 14 },
  loanRowMultiLine: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.04)',
  },
  loanRowLine: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  loanRowLabel: {
    color: colors.textMuted,
    fontSize: 10,
    fontFamily: 'Inter_700Bold',
  },
  loanRowValue: {
    color: '#F59E0B',
    fontSize: 10,
    fontFamily: 'Inter_700Bold',
  },
  buttonGrid: { paddingHorizontal: 18, marginBottom: 20 },
  buttonGridRow: { flexDirection: 'row', gap: 11 },
});
