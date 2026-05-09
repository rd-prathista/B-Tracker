import React, { useState, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Modal, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';
import { getTransactions } from '../services/transactionService';
import AmbientBackground from '../components/AmbientBackground';
import GlassCard from '../components/GlassCard';
import FadeInView from '../components/FadeInView';

const CATEGORY_ICONS = {
  'Salary': 'briefcase-outline', 'Freelance': 'laptop-outline', 'Business': 'storefront-outline',
  'Gift': 'gift-outline', 'Other Income': 'wallet-outline',
  'Grocery': 'cart-outline', 'Travel': 'airplane-outline', 'Fuel': 'car-outline',
  'Dining': 'restaurant-outline', 'Shopping': 'bag-handle-outline', 'Medical': 'medical-outline',
  'Rent': 'home-outline', 'Bills': 'receipt-outline', 'Baby': 'happy-outline',
  'Entertainment': 'game-controller-outline', 'Others': 'ellipse-outline',
};

const fmt = (n) => parseFloat(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtDate = (str) => new Date(str).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' });
const formatModalDate = (d) => d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
const getMonthLabel = (d) => new Date(d).toLocaleString('default', { month: 'long', year: 'numeric' });

const DATES = ['All Time', 'Custom', 'This Month', 'Last Month', '3 Months'];

const getDatesForFilter = (filter, customStart, customEnd) => {
  const now = new Date();
  if (filter === 'This Month') {
    return { start: new Date(now.getFullYear(), now.getMonth(), 1).toISOString(), end: new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59).toISOString() };
  } else if (filter === 'Last Month') {
    return { start: new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString(), end: new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59).toISOString() };
  } else if (filter === '3 Months') {
    return { start: new Date(now.getFullYear(), now.getMonth() - 2, 1).toISOString(), end: new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59).toISOString() };
  } else if (filter === 'Custom') {
    return { 
      start: new Date(customStart.getFullYear(), customStart.getMonth(), customStart.getDate()).toISOString(), 
      end: new Date(customEnd.getFullYear(), customEnd.getMonth(), customEnd.getDate(), 23, 59, 59).toISOString() 
    };
  }
  return { start: null, end: null };
};

export default function AllTransactionsScreen({ navigation }) {
  const [transactions, setTransactions] = useState([]);
  
  // Filters
  const [type, setType] = useState('all'); // all, income, expense
  const [currency, setCurrency] = useState('all'); // all, AED, INR
  const [dateFilter, setDateFilter] = useState('All Time');

  // Custom Modal
  const [showCustomModal, setShowCustomModal] = useState(false);
  const [customStart, setCustomStart] = useState(new Date(new Date().setMonth(new Date().getMonth() - 1)));
  const [customEnd, setCustomEnd] = useState(new Date());
  const [pickerMode, setPickerMode] = useState(null);

  const loadData = () => {
    const { start, end } = getDatesForFilter(dateFilter, customStart, customEnd);
    const filters = {
      limit: 500, // Load more for history grouping
      type: type === 'all' ? null : type,
      currency: currency === 'all' ? null : currency,
      startDate: start,
      endDate: end,
    };
    setTransactions(getTransactions(filters));
  };

  useFocusEffect(useCallback(() => { loadData(); }, [type, currency, dateFilter, customStart, customEnd]));

  const handleFilterSelect = (f) => {
    if (f === 'Custom') setShowCustomModal(true);
    else setDateFilter(f);
  };

  const applyCustomDate = () => {
    setDateFilter('Custom');
    setShowCustomModal(false);
    loadData();
  };

  // Group transactions by month and calculate net
  const groupedData = useMemo(() => {
    const groups = {};
    transactions.forEach(tx => {
      const monthStr = getMonthLabel(tx.date);
      if (!groups[monthStr]) {
        groups[monthStr] = { transactions: [], netAED: 0, netINR: 0 };
      }
      groups[monthStr].transactions.push(tx);
      
      const val = tx.type === 'income' ? tx.amount : -tx.amount;
      if (tx.currency === 'AED') groups[monthStr].netAED += val;
      if (tx.currency === 'INR') groups[monthStr].netINR += val;
    });

    return Object.entries(groups).map(([month, data]) => ({ month, ...data }));
  }, [transactions]);

  return (
    <AmbientBackground>
      <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={22} color={colors.text} />
          </TouchableOpacity>
          <Text style={styles.title}>History</Text>
          <View style={{ width: 36 }} />
        </View>

        {/* Filters Area */}
        <View style={styles.filtersWrapper}>
          <View style={styles.filterRow}>
            <View style={styles.segmentedCtrl}>
              {['all', 'income', 'expense'].map(t => (
                <TouchableOpacity key={t} style={[styles.segBtn, type === t && styles.segBtnActive]} onPress={() => setType(t)}>
                  <Text style={[styles.segText, type === t && styles.segTextActive]}>{t.charAt(0).toUpperCase() + t.slice(1)}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.segmentedCtrl}>
              {['all', 'AED', 'INR'].map(c => (
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
                  {f === 'Custom' && dateFilter === 'Custom' ? `${formatModalDate(customStart)} - ${formatModalDate(customEnd)}` : f}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
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
                {/* Month Header with Net Balances */}
                <FadeInView delay={groupIndex * 100}>
                  <View style={styles.monthHeader}>
                    <Text style={styles.monthTitle}>{group.month}</Text>
                    <View style={styles.netRow}>
                      {(currency === 'all' || currency === 'AED') && (
                        <Text style={[styles.netText, { color: group.netAED >= 0 ? colors.success : colors.danger }]}>
                          AED Net: {group.netAED > 0 ? '+' : ''}{fmt(group.netAED)}
                        </Text>
                      )}
                      {currency === 'all' && <Text style={{ color: colors.border }}> | </Text>}
                      {(currency === 'all' || currency === 'INR') && (
                        <Text style={[styles.netText, { color: group.netINR >= 0 ? colors.accentTeal : colors.danger }]}>
                          INR Net: {group.netINR > 0 ? '+' : ''}{fmt(group.netINR)}
                        </Text>
                      )}
                    </View>
                  </View>
                </FadeInView>

                {/* Transactions for this month */}
                {group.transactions.map((tx, i) => {
                  const isIncome = tx.type === 'income';
                  const icon = CATEGORY_ICONS[tx.category] || 'ellipse-outline';
                  return (
                    <FadeInView key={`${tx.type}-${tx.id}`} delay={groupIndex * 100 + (i % 10) * 30}>
                      <View style={styles.txRow}>
                        <View style={[styles.txIcon, { backgroundColor: isIncome ? colors.success + '20' : colors.danger + '20' }]}>
                          <Ionicons name={icon} size={17} color={isIncome ? colors.success : colors.danger} />
                        </View>
                        <View style={styles.txInfo}>
                          <Text style={styles.txCategory}>{tx.category}</Text>
                          <Text style={styles.txMeta}>{fmtDate(tx.date)}{tx.notes ? ` · ${tx.notes}` : ''}</Text>
                        </View>
                        <Text style={[styles.txAmount, { color: isIncome ? colors.success : colors.danger }]} numberOfLines={1} adjustsFontSizeToFit>
                          {isIncome ? '+' : '-'}{tx.currency} {fmt(tx.amount)}
                        </Text>
                      </View>
                    </FadeInView>
                  );
                })}
              </View>
            ))
          )}
        </ScrollView>

        {/* Custom Date Modal */}
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

      </SafeAreaView>
    </AmbientBackground>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 18, paddingTop: 8, paddingBottom: 14 },
  backBtn: { width: 36, height: 36, justifyContent: 'center' },
  title: { ...typography.h2 },

  filtersWrapper: { marginBottom: 6 },
  filterRow: { flexDirection: 'row', paddingHorizontal: 18, marginBottom: 12, gap: 10 },
  segmentedCtrl: { flex: 1, flexDirection: 'row', backgroundColor: colors.cardSolid, borderRadius: 10, padding: 3, borderWidth: 1, borderColor: colors.border },
  segBtn: { flex: 1, paddingVertical: 6, borderRadius: 7, alignItems: 'center' },
  segBtnActive: { backgroundColor: colors.background },
  segText: { ...typography.bodySmall, fontSize: 11, fontFamily: 'Inter_600SemiBold' },
  segTextActive: { color: colors.text, fontFamily: 'Inter_700Bold' },

  dateFilterBtn: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, backgroundColor: colors.cardSolid, borderWidth: 1, borderColor: colors.border },
  dateFilterText: { ...typography.bodySmall, fontFamily: 'Inter_600SemiBold', fontSize: 12 },

  scroll: { paddingHorizontal: 18, paddingBottom: 40 },
  emptyState: { alignItems: 'center', marginTop: 60, gap: 12 },
  emptyText: { ...typography.bodySmall },
  
  // Month Grouping
  monthGroup: { marginBottom: 20 },
  monthHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 10, paddingHorizontal: 4 },
  monthTitle: { ...typography.h3, color: colors.textSecondary },
  netRow: { flexDirection: 'row', alignItems: 'center' },
  netText: { ...typography.label, fontSize: 10 },

  txRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 10, paddingHorizontal: 12,
    backgroundColor: colors.cardSolid, borderRadius: 12,
    marginBottom: 7, borderWidth: 1, borderColor: colors.border,
  },
  txIcon: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  txInfo: { flex: 1 },
  txCategory: { ...typography.txCategory },
  txMeta: { ...typography.txMeta, marginTop: 1 },
  txAmount: { ...typography.txAmount },

  // Modal
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'center', padding: 20 },
  modalCard: { padding: 20 },
  modalTitle: { color: colors.text, fontSize: 17, fontWeight: '700', marginBottom: 20 },
  datePickerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 },
  datePickerBtn: { flex: 1, padding: 12, borderRadius: 12, backgroundColor: colors.cardSolid, borderWidth: 1, borderColor: colors.border, alignItems: 'center' },
  datePickerLabel: { ...typography.label, marginBottom: 4 },
  datePickerVal: { ...typography.bodyMedium },
  modalBtns: { flexDirection: 'row', gap: 10, marginTop: 10 },
  cancelBtn: { flex: 1, padding: 12, borderRadius: 12, borderWidth: 1, borderColor: colors.border, alignItems: 'center' },
  cancelText: { color: colors.textSecondary, fontWeight: '600', fontSize: 14 },
  applyBtn: { flex: 1, padding: 12, borderRadius: 12, alignItems: 'center' },
  applyText: { color: '#fff', fontWeight: '700', fontSize: 14 },
});
