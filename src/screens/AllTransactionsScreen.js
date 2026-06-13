import React, { useState, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Modal, Platform, Pressable, LayoutAnimation, UIManager } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';
import { getTransactions, deleteTransaction } from '../services/transactionService';
import { getLoanTransactionsForHistory, convertTransactionToLoanActivity, getLoanById, deleteLoan, deleteRepayment } from '../services/loanService';
import AmbientBackground from '../components/AmbientBackground';
import GlassCard from '../components/GlassCard';
import FadeInView from '../components/FadeInView';
import { TransactionActionModal, DeleteTransactionConfirmModal, ConvertToLoanModal } from '../components/TransactionMenus';
import Toast from '../components/Toast';
import { TextInput, Alert } from 'react-native';


if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

import { fmt, fmtDate, formatModalDate, getMonthLabel } from '../utils/formatters';

const DATES = ['All Time', 'Custom', 'This Month', 'Last Month', '3 Months'];

const getDatesForFilter = (filter, customStart, customEnd) => {
  const now = new Date();
  if (filter === 'This Month') {
    return {
      start: new Date(now.getFullYear(), now.getMonth(), 1).toISOString(),
      end: new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59).toISOString(),
    };
  } else if (filter === 'Last Month') {
    return {
      start: new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString(),
      end: new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59).toISOString(),
    };
  } else if (filter === '3 Months') {
    return {
      start: new Date(now.getFullYear(), now.getMonth() - 2, 1).toISOString(),
      end: new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59).toISOString(),
    };
  } else if (filter === 'Custom') {
    return {
      start: new Date(customStart.getFullYear(), customStart.getMonth(), customStart.getDate()).toISOString(),
      end: new Date(customEnd.getFullYear(), customEnd.getMonth(), customEnd.getDate(), 23, 59, 59).toISOString(),
    };
  }
  return { start: null, end: null };
};

export default function AllTransactionsScreen({ navigation, route }) {
  const { investmentId, loanId } = route.params || {};
  const [transactions, setTransactions] = useState([]);
  const [loanSummary, setLoanSummary] = useState(null);

  const [type, setType] = useState(investmentId ? 'investment' : (loanId ? 'loan' : 'all'));
  const [currency, setCurrency] = useState('all');
  const [dateFilter, setDateFilter] = useState('All Time');
  const [archiveMode, setArchiveMode] = useState('Active');

  const [showCustomModal, setShowCustomModal] = useState(false);
  const [customStart, setCustomStart] = useState(new Date(new Date().setMonth(new Date().getMonth() - 1)));
  const [customEnd, setCustomEnd] = useState(new Date());
  const [pickerMode, setPickerMode] = useState(null);

  const [actionTx, setActionTx] = useState(null);
  const [deleteTx, setDeleteTx] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const [conversionTx, setConversionTx] = useState(null);
  const [showConversionModal, setShowConversionModal] = useState(false);

  // Toast States
  const [toastVisible, setToastVisible] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [toastAction, setToastAction] = useState(null);


  const loadData = () => {
    const { start, end } = getDatesForFilter(dateFilter, customStart, customEnd);
    const filters = {
      limit: 500,
      type: type === 'all' ? null : type,
      currency: currency === 'all' ? null : currency,
      startDate: start,
      endDate: end,
      search: searchQuery,
      investmentId,
      loanId,
    };
    
    let list = [];
    if (loanId) {
      list = getLoanTransactionsForHistory(filters);
      setLoanSummary(getLoanById(loanId));
    } else if (type === 'loan') {
      list = getLoanTransactionsForHistory(filters);
    } else if (type === 'all' && !investmentId) {
      const normalTxs = getTransactions(filters);
      const loanTxs = getLoanTransactionsForHistory(filters);
      list = [...normalTxs, ...loanTxs].sort((a, b) => new Date(b.date) - new Date(a.date));
    } else {
      list = getTransactions(filters);
    }
    
    setTransactions(list);
  };

  useFocusEffect(useCallback(() => { loadData(); }, [type, currency, dateFilter, customStart, customEnd, searchQuery, investmentId, archiveMode]));


  const handleFilterSelect = (f) => {
    if (f === 'Custom') setShowCustomModal(true);
    else setDateFilter(f);
  };

  const applyCustomDate = () => {
    setDateFilter('Custom');
    setShowCustomModal(false);
    loadData();
  };

  const headerTitle = useMemo(() => {
    if (loanId) {
      return loanSummary ? `${loanSummary.person_name} Loan History` : 'Loan History';
    }
    return investmentId ? 'Investment Details' : 'History';
  }, [loanId, loanSummary, investmentId]);

  const groupedData = useMemo(() => {
    const groups = {};
    transactions.forEach((tx) => {
      const monthStr = getMonthLabel(tx.date);
      if (!groups[monthStr]) {
        groups[monthStr] = { transactions: [], netAED: 0, netINR: 0 };
      }
      groups[monthStr].transactions.push(tx);

      // Surplus logic: income - (expense + investment)
      // Loans and repayments must NOT affect Monthly Surplus.
      let val = 0;
      if (tx.type === 'income') {
        val = tx.amount;
      } else if (tx.type === 'expense' || tx.type === 'investment') {
        val = -tx.amount;
      }
      
      if (tx.currency === 'AED') groups[monthStr].netAED += val;
      if (tx.currency === 'INR') groups[monthStr].netINR += val;
    });

    return Object.entries(groups).map(([month, data]) => ({ month, ...data }));
  }, [transactions]);

  const summaries = useMemo(() => {
    const { start, end } = getDatesForFilter(dateFilter, customStart, customEnd);
    const filters = {
      startDate: start,
      endDate: end,
      currency: currency === 'all' ? null : currency,
    };
    
    const normalTxs = getTransactions(filters);
    const loanTxs = getLoanTransactionsForHistory(filters);
    const allTxs = [...normalTxs, ...loanTxs];

    const totals = {
      AED: { income: 0, expense: 0, investment: 0, surplus: 0, loanGiven: 0, loanRecovered: 0, loanOutstandingGiven: 0, loanBorrowed: 0, loanRepaid: 0, loanOutstandingBorrowed: 0 },
      INR: { income: 0, expense: 0, investment: 0, surplus: 0, loanGiven: 0, loanRecovered: 0, loanOutstandingGiven: 0, loanBorrowed: 0, loanRepaid: 0, loanOutstandingBorrowed: 0 }
    };

    allTxs.forEach(tx => {
      const cur = tx.currency;
      if (totals[cur]) {
        if (tx.type === 'income') {
          totals[cur].income += tx.amount;
        } else if (tx.type === 'expense') {
          totals[cur].expense += tx.amount;
        } else if (tx.type === 'investment') {
          totals[cur].investment += tx.amount;
        } else if (tx.type === 'loan') {
          if (tx.loanType === 'I Gave') {
            totals[cur].loanGiven += tx.amount;
          } else if (tx.loanType === 'I Borrowed') {
            totals[cur].loanBorrowed += tx.amount;
          }
        } else if (tx.type === 'repayment') {
          if (tx.loanType === 'I Gave') {
            totals[cur].loanRecovered += tx.amount;
          } else if (tx.loanType === 'I Borrowed') {
            totals[cur].loanRepaid += tx.amount;
          }
        }
      }
    });

    ['AED', 'INR'].forEach(cur => {
      totals[cur].surplus = totals[cur].income - totals[cur].expense - totals[cur].investment;
      totals[cur].loanOutstandingGiven = Math.max(0, totals[cur].loanGiven - totals[cur].loanRecovered);
      totals[cur].loanOutstandingBorrowed = Math.max(0, totals[cur].loanBorrowed - totals[cur].loanRepaid);
    });

    return totals;
  }, [dateFilter, customStart, customEnd, currency]);

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

  const openActions = (tx) => setActionTx(tx);

  const toggleSearch = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    if (showSearch) {
      setSearchQuery('');
    }
    setShowSearch(!showSearch);
  };


  return (
    <AmbientBackground>
      <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={22} color={colors.text} />
          </TouchableOpacity>
          
          {!showSearch ? (
            <>
              <Text style={styles.title}>{headerTitle}</Text>
              {!loanId && (
                <TouchableOpacity onPress={toggleSearch} style={styles.headerBtn}>
                  <Ionicons name="search" size={22} color={colors.text} />
                </TouchableOpacity>
              )}
            </>
          ) : (
            <View style={styles.searchBarContainer}>
              <TextInput
                style={styles.searchBarInput}
                placeholder="Search records..."
                placeholderTextColor={colors.textMuted}
                value={searchQuery}
                onChangeText={setSearchQuery}
                autoFocus
              />
              <TouchableOpacity onPress={toggleSearch} style={styles.headerBtn}>
                <Ionicons name="close" size={22} color={colors.text} />
              </TouchableOpacity>
            </View>
          )}
        </View>


        {!loanId && (
          <View style={styles.filtersWrapper}>
            <View style={styles.filterRow}>
              {!investmentId && (
                <View style={[styles.segmentedCtrl, { flex: 2.2 }]}>
                  {['all', 'income', 'expense', 'investment', 'loan'].map((t) => (
                    <TouchableOpacity key={t} style={[styles.segBtn, type === t && styles.segBtnActive]} onPress={() => setType(t)}>
                      <Text style={[styles.segText, type === t && styles.segTextActive]} numberOfLines={1}>
                        {t === 'all' ? 'All' : t === 'income' ? 'Inc' : t === 'expense' ? 'Exp' : t === 'investment' ? 'Inv' : 'Loan'}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              <View style={[styles.segmentedCtrl, investmentId && { flex: 1 }]}>
                {['all', 'AED', 'INR'].map((c) => (
                  <TouchableOpacity key={c} style={[styles.segBtn, currency === c && styles.segBtnActive]} onPress={() => setCurrency(c)}>
                    <Text style={[styles.segText, currency === c && styles.segTextActive]}>{c.toUpperCase()}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 18, gap: 8, paddingBottom: 14 }}>
              {DATES.map((f) => (
                <TouchableOpacity
                  key={f}
                  style={[styles.dateFilterBtn, dateFilter === f && { borderColor: colors.primary, backgroundColor: colors.primary + '15' }]}
                  onPress={() => handleFilterSelect(f)}
                >
                  <Text style={[styles.dateFilterText, dateFilter === f && { color: colors.primary }]}>
                    {f === 'Custom' && dateFilter === 'Custom'
                      ? `${formatModalDate(customStart)} - ${formatModalDate(customEnd)}`
                      : f}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}

        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          {loanId && loanSummary && (
            <GlassCard style={{ marginBottom: 12 }} contentStyle={{ paddingVertical: 14, paddingHorizontal: 20 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <View>
                  <Text style={{ fontSize: 14, fontFamily: 'Inter_700Bold', color: colors.text }}>{loanSummary.person_name}</Text>
                  <Text style={{ fontSize: 9, fontFamily: 'Inter_500Medium', color: colors.textSecondary, marginTop: 1 }}>{loanSummary.type} • {loanSummary.source_type}</Text>
                </View>
                <View style={{ paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, backgroundColor: loanSummary.status === 'Closed' ? colors.success + '20' : (loanSummary.status === 'Overdue' ? colors.danger + '20' : '#F59E0B20'), borderColor: loanSummary.status === 'Closed' ? colors.success : (loanSummary.status === 'Overdue' ? colors.danger : '#F59E0B'), borderWidth: 0.5 }}>
                  <Text style={{ fontSize: 8, fontFamily: 'Inter_700Bold', color: loanSummary.status === 'Closed' ? colors.success : (loanSummary.status === 'Overdue' ? colors.danger : '#F59E0B') }}>{loanSummary.status}</Text>
                </View>
              </View>
              
              <View style={{ borderTopWidth: 0.5, borderColor: colors.border, marginTop: 4, paddingTop: 4 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 }}>
                  <Text style={{ fontSize: 10, fontFamily: 'Inter_600SemiBold', color: colors.textMuted }}>Original Amount</Text>
                  <Text style={{ fontSize: 11, fontFamily: 'Inter_700Bold', color: colors.text }}>{loanSummary.currency} {fmt(loanSummary.amount)}</Text>
                </View>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4, borderTopWidth: 0.5, borderColor: 'rgba(255,255,255,0.03)' }}>
                  <Text style={{ fontSize: 10, fontFamily: 'Inter_600SemiBold', color: colors.textMuted }}>Total Repaid</Text>
                  <Text style={{ fontSize: 11, fontFamily: 'Inter_700Bold', color: colors.success }}>{loanSummary.currency} {fmt(loanSummary.paidAmount)}</Text>
                </View>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4, borderTopWidth: 0.5, borderColor: 'rgba(255,255,255,0.03)' }}>
                  <Text style={{ fontSize: 10, fontFamily: 'Inter_600SemiBold', color: colors.textMuted }}>Outstanding Balance</Text>
                  <Text style={{ fontSize: 11, fontFamily: 'Inter_700Bold', color: loanSummary.status === 'Closed' ? colors.textMuted : '#F59E0B' }}>{loanSummary.currency} {fmt(loanSummary.outstandingAmount)}</Text>
                </View>
              </View>
            </GlassCard>
          )}

          {!loanId && !investmentId && (
            <>
              {/* Monthly Summary Card */}
              <GlassCard style={{ marginBottom: 12 }} contentStyle={{ paddingVertical: 14, paddingHorizontal: 20 }}>
                <Text style={{ fontSize: 10, fontFamily: 'Inter_700Bold', color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>MONTHLY SUMMARY ({dateFilter})</Text>
                
                {/* Table Header */}
                <View style={styles.tableHeaderRow}>
                  <Text style={[styles.tableHeaderCell, { flex: 1.2 }]}>CURR</Text>
                  <Text style={[styles.tableHeaderCell, { flex: 1.5, textAlign: 'right' }]}>INCOME</Text>
                  <Text style={[styles.tableHeaderCell, { flex: 1.5, textAlign: 'right' }]}>EXPENSE</Text>
                  <Text style={[styles.tableHeaderCell, { flex: 1.5, textAlign: 'right' }]}>INVEST</Text>
                  <Text style={[styles.tableHeaderCell, { flex: 1.8, textAlign: 'right' }]}>SURPLUS</Text>
                </View>

                {/* Table Rows */}
                {(currency === 'all' ? ['AED', 'INR'] : [currency]).map((cur, idx) => {
                  const summary = summaries[cur];
                  const surplusColor = summary.surplus >= 0 ? colors.success : colors.danger;
                  return (
                    <View key={cur} style={[styles.tableBodyRow, idx > 0 && styles.tableRowDivider]}>
                      <Text style={[styles.tableBodyCellLabel, { flex: 1.2 }]}>{cur}</Text>
                      <Text style={[styles.tableBodyCellVal, { flex: 1.5, textAlign: 'right', color: colors.success }]}>{fmt(summary.income)}</Text>
                      <Text style={[styles.tableBodyCellVal, { flex: 1.5, textAlign: 'right', color: colors.danger }]}>{fmt(summary.expense)}</Text>
                      <Text style={[styles.tableBodyCellVal, { flex: 1.5, textAlign: 'right', color: colors.accentIndigo }]}>{fmt(summary.investment)}</Text>
                      <Text style={[styles.tableBodyCellVal, { flex: 1.8, textAlign: 'right', color: surplusColor, fontFamily: 'Inter_700Bold' }]}>
                        {summary.surplus >= 0 ? '+' : ''}{fmt(summary.surplus)}
                      </Text>
                    </View>
                  );
                })}
              </GlassCard>

              {/* Loan Activity Card */}
              <GlassCard style={{ marginBottom: 12 }} contentStyle={{ paddingVertical: 14, paddingHorizontal: 20 }}>
                <Text style={{ fontSize: 10, fontFamily: 'Inter_700Bold', color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>LOAN ACTIVITY ({dateFilter})</Text>

                {/* Table Header */}
                <View style={styles.tableHeaderRow}>
                  <Text style={[styles.tableHeaderCell, { flex: 2.2 }]}>FLOW</Text>
                  <Text style={[styles.tableHeaderCell, { flex: 1.8, textAlign: 'right' }]}>PRINCIPAL</Text>
                  <Text style={[styles.tableHeaderCell, { flex: 1.8, textAlign: 'right' }]}>REPAID</Text>
                  <Text style={[styles.tableHeaderCell, { flex: 2, textAlign: 'right' }]}>OUTSTANDING</Text>
                </View>

                {/* Table Rows */}
                {(() => {
                  const loanRows = [];
                  const currencies = currency === 'all' ? ['AED', 'INR'] : [currency];
                  currencies.forEach(cur => {
                    // Row: I Gave
                    loanRows.push({
                      id: `${cur}-gave`,
                      flow: `${cur} Gave`,
                      principal: summaries[cur].loanGiven,
                      repaid: summaries[cur].loanRecovered,
                      outstanding: summaries[cur].loanOutstandingGiven,
                      repaidColor: colors.success,
                    });
                    // Row: I Borrowed
                    loanRows.push({
                      id: `${cur}-borrowed`,
                      flow: `${cur} Borrowed`,
                      principal: summaries[cur].loanBorrowed,
                      repaid: summaries[cur].loanRepaid,
                      outstanding: summaries[cur].loanOutstandingBorrowed,
                      repaidColor: colors.danger,
                    });
                  });

                  return loanRows.map((row, idx) => (
                    <View key={row.id} style={[styles.tableBodyRow, idx > 0 && styles.tableRowDivider]}>
                      <Text style={[styles.tableBodyCellLabel, { flex: 2.2, color: colors.textSecondary }]}>
                        {row.flow}
                      </Text>
                      <Text style={[styles.tableBodyCellVal, { flex: 1.8, textAlign: 'right', color: colors.text }]}>
                        {fmt(row.principal)}
                      </Text>
                      <Text style={[styles.tableBodyCellVal, { flex: 1.8, textAlign: 'right', color: row.repaidColor }]}>
                        {fmt(row.repaid)}
                      </Text>
                      <Text style={[styles.tableBodyCellVal, { flex: 2, textAlign: 'right', color: '#F59E0B', fontFamily: 'Inter_700Bold' }]}>
                        {fmt(row.outstanding)}
                      </Text>
                    </View>
                  ));
                })()}
              </GlassCard>
            </>
          )}

          {groupedData.length === 0 ? (
            <FadeInView delay={0}>
              <View style={styles.emptyState}>
                <Ionicons name="receipt-outline" size={40} color={colors.textMuted} />
                <Text style={styles.emptyText}>No transactions match filters</Text>
              </View>
            </FadeInView>
          ) : (
            groupedData.map((group, groupIndex) => (
              <View key={group.month} style={styles.monthGroup}>
                <FadeInView delay={groupIndex * 100}>
                  <View style={styles.monthHeader}>
                    <Text style={styles.monthTitle}>{group.month}</Text>
                    <View style={styles.netRow}>
                      {(currency === 'all' || currency === 'AED') && (
                        <Text style={[styles.netText, { color: group.netAED >= 0 ? colors.success : colors.danger }]}>
                          AED Net: {group.netAED > 0 ? '+' : ''}
                          {fmt(group.netAED)}
                        </Text>
                      )}
                      {currency === 'all' && <Text style={{ color: colors.border }}> | </Text>}
                      {(currency === 'all' || currency === 'INR') && (
                        <Text style={[styles.netText, { color: group.netINR >= 0 ? colors.accentTeal : colors.danger }]}>
                          INR Net: {group.netINR > 0 ? '+' : ''}
                          {fmt(group.netINR)}
                        </Text>
                      )}
                    </View>
                  </View>
                </FadeInView>

                {group.transactions.map((tx, i) => {
                  const isIncome = tx.type === 'income';
                  const isInvest = tx.type === 'investment';
                  const isLoanModule = tx.type === 'loan' || tx.type === 'repayment';
                  const icon = tx.icon || 'ellipse-outline';
                  
                  let txColor = isIncome ? colors.success : (isInvest ? colors.accentIndigo : colors.danger);
                  if (isLoanModule) {
                    if (tx.type === 'loan') {
                      txColor = '#F59E0B'; // Amber for loan creation
                    } else if (tx.type === 'repayment') {
                      if (tx.loanType === 'I Gave') {
                        txColor = colors.success; // Green for recovery
                      } else {
                        txColor = colors.danger; // Red for repayment
                      }
                    }
                  }
                  
                  const isReceived = tx.type === 'income' || (tx.type === 'loan' && tx.loanType === 'I Borrowed') || (tx.type === 'repayment' && tx.loanType === 'I Gave');

                  return (
                    <FadeInView key={`${tx.type}-${tx.id}`} delay={groupIndex * 100 + (i % 10) * 30}>
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
                          <View style={[styles.txIcon, { backgroundColor: txColor + '20' }]}>
                            <Ionicons name={icon} size={17} color={txColor} />
                          </View>
                          <View style={styles.txInfo}>
                            <Text style={styles.txCategory}>{tx.category}</Text>
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
                            {isReceived ? '+' : '-'}
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
                })}
              </View>
            ))
          )}
        </ScrollView>

        <Modal visible={showCustomModal} transparent animationType="fade">
          <View style={styles.overlay}>
            <GlassCard style={styles.modalCard}>
              <Text style={styles.modalTitle}>Custom Date Range</Text>

              <View style={styles.datePickerRow}>
                <TouchableOpacity style={styles.datePickerBtn} onPress={() => setPickerMode('start')}>
                  <Text style={styles.datePickerLabel}>From Date</Text>
                  <Text style={styles.datePickerVal}>{formatModalDate(customStart)}</Text>
                </TouchableOpacity>
                <Ionicons name="arrow-forward" size={16} color={colors.textMuted} />
                <TouchableOpacity style={styles.datePickerBtn} onPress={() => setPickerMode('end')}>
                  <Text style={styles.datePickerLabel}>To Date</Text>
                  <Text style={styles.datePickerVal}>{formatModalDate(customEnd)}</Text>
                </TouchableOpacity>
              </View>

              {pickerMode && (
                <DateTimePicker
                  value={pickerMode === 'start' ? customStart : customEnd}
                  mode="date"
                  display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                  maximumDate={new Date()}
                  onChange={(event, selected) => {
                    setPickerMode(Platform.OS === 'ios' ? pickerMode : null);
                    if (selected) {
                      if (pickerMode === 'start') setCustomStart(selected);
                      else setCustomEnd(selected);
                    }
                  }}
                />
              )}

              <View style={styles.modalBtns}>
                <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowCustomModal(false)}>
                  <Text style={styles.cancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.applyBtn, { backgroundColor: colors.primary }]} onPress={applyCustomDate}>
                  <Text style={styles.applyText}>Apply Range</Text>
                </TouchableOpacity>
              </View>
            </GlassCard>
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

        <DeleteTransactionConfirmModal
          visible={!!deleteTx}
          transaction={deleteTx}
          onClose={cancelDelete}
          onConfirm={confirmDelete}
          deleting={deleting}
        />

        <Toast
          message={toastMessage}
          visible={toastVisible}
          onHide={() => setToastVisible(false)}
          actionLabel={toastAction?.label}
          onAction={toastAction?.onAction}
        />
      </SafeAreaView>
    </AmbientBackground>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 18, paddingTop: 8, paddingBottom: 14 },
  backBtn: { width: 36, height: 36, justifyContent: 'center' },
  headerBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  title: { ...typography.h2, flex: 1, marginLeft: 8 },

  searchBarContainer: { flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: colors.cardSolid, borderRadius: 12, paddingHorizontal: 12, marginLeft: 10, borderWidth: 1, borderColor: colors.border },
  searchBarInput: { flex: 1, paddingVertical: 8, color: colors.text, fontSize: 14 },


  filtersWrapper: { marginBottom: 6 },
  filterRow: { flexDirection: 'row', paddingHorizontal: 18, marginBottom: 12, gap: 10 },
  segmentedCtrl: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: colors.cardSolid,
    borderRadius: 10,
    padding: 3,
    borderWidth: 1,
    borderColor: colors.border,
  },
  segBtn: { flex: 1, paddingVertical: 6, borderRadius: 7, alignItems: 'center' },
  segBtnActive: { backgroundColor: colors.background },
  segText: { ...typography.bodySmall, fontSize: 11, fontFamily: 'Inter_600SemiBold' },
  segTextActive: { color: colors.text, fontFamily: 'Inter_700Bold' },

  dateFilterBtn: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: colors.cardSolid,
    borderWidth: 1,
    borderColor: colors.border,
  },
  dateFilterText: { ...typography.bodySmall, fontFamily: 'Inter_600SemiBold', fontSize: 12 },

  scroll: { paddingHorizontal: 18, paddingBottom: 40 },
  emptyState: { alignItems: 'center', marginTop: 60, gap: 12 },
  emptyText: { ...typography.bodySmall },

  monthGroup: { marginBottom: 20 },
  monthHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginBottom: 10,
    paddingHorizontal: 4,
  },
  monthTitle: { ...typography.h3, color: colors.textSecondary },
  netRow: { flexDirection: 'row', alignItems: 'center' },
  netText: { ...typography.label, fontSize: 10 },

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
    gap: 12,
    paddingVertical: 10,
    paddingLeft: 12,
    paddingRight: 6,
  },
  txMenuHit: { paddingVertical: 10, paddingRight: 12, paddingLeft: 4, justifyContent: 'center' },
  txIcon: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  txInfo: { flex: 1 },
  txCategory: { ...typography.txCategory },
  txMeta: { ...typography.txMeta, marginTop: 1 },
  txAmount: { ...typography.txAmount },

  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'center', padding: 20 },
  modalCard: { padding: 20 },
  modalTitle: { color: colors.text, fontSize: 17, fontFamily: 'Inter_700Bold', marginBottom: 20 },
  datePickerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 },
  datePickerBtn: {
    flex: 1,
    padding: 12,
    borderRadius: 12,
    backgroundColor: colors.cardSolid,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  datePickerLabel: { ...typography.label, marginBottom: 4 },
  datePickerVal: { ...typography.bodyMedium },
  modalBtns: { flexDirection: 'row', gap: 10, marginTop: 10 },
  cancelBtn: { flex: 1, padding: 12, borderRadius: 12, borderWidth: 1, borderColor: colors.border, alignItems: 'center' },
  cancelText: { color: colors.textSecondary, fontFamily: 'Inter_600SemiBold', fontSize: 14 },
  applyBtn: { flex: 1, padding: 12, borderRadius: 12, alignItems: 'center' },
  applyText: { color: '#fff', fontFamily: 'Inter_700Bold', fontSize: 14 },
  tableHeaderRow: {
    flexDirection: 'row',
    borderBottomWidth: 0.5,
    borderColor: colors.border,
    paddingBottom: 6,
    marginBottom: 6,
  },
  tableHeaderCell: {
    fontSize: 10,
    fontFamily: 'Inter_700Bold',
    color: colors.textMuted,
    letterSpacing: 0.3,
  },
  tableBodyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
  },
  tableRowDivider: {
    borderTopWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  tableBodyCellLabel: {
    fontSize: 12,
    fontFamily: 'Inter_700Bold',
    color: colors.textSecondary,
  },
  tableBodyCellVal: {
    fontSize: 12,
    fontFamily: 'Inter_600SemiBold',
    color: colors.text,
  },
});
