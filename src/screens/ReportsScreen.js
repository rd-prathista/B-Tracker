import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Modal, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';
import { getReportData, getCategoryTrends, getSavingsTrends } from '../services/transactionService';
import AmbientBackground from '../components/AmbientBackground';
import GlassCard from '../components/GlassCard';
import FadeInView from '../components/FadeInView';

const FILTERS = ['All Time', 'Custom', 'This Month', 'Last Month', '3 Months'];

const getDatesForFilter = (filter, customStart, customEnd) => {
  const now = new Date();
  let start = new Date(0), end = new Date('2099-12-31');
  
  if (filter === 'This Month') {
    start = new Date(now.getFullYear(), now.getMonth(), 1);
    end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
  } else if (filter === 'Last Month') {
    start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    end = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
  } else if (filter === '3 Months') {
    start = new Date(now.getFullYear(), now.getMonth() - 2, 1);
    end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
  } else if (filter === 'Custom') {
    start = new Date(customStart.getFullYear(), customStart.getMonth(), customStart.getDate());
    end = new Date(customEnd.getFullYear(), customEnd.getMonth(), customEnd.getDate(), 23, 59, 59);
  }
  return { start: start.toISOString(), end: end.toISOString() };
};

const fmt = (n) => parseFloat(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const monthName = (yyyyMM) => {
  const [y, m] = yyyyMM.split('-');
  return new Date(y, m - 1).toLocaleString('default', { month: 'short', year: 'numeric' });
};
const formatDate = (d) => d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });

export default function ReportsScreen({ navigation }) {
  const [activeTab, setActiveTab] = useState('Overview');
  const [currency, setCurrency] = useState('AED');
  const [dateFilter, setDateFilter] = useState('This Month');
  
  // Custom Date Modal State
  const [showCustomModal, setShowCustomModal] = useState(false);
  const [customStart, setCustomStart] = useState(new Date(new Date().setMonth(new Date().getMonth() - 1)));
  const [customEnd, setCustomEnd] = useState(new Date());
  const [pickerMode, setPickerMode] = useState(null); // 'start' or 'end'

  const [overviewData, setOverviewData] = useState({ totalIncome: 0, totalExpense: 0, savings: 0, breakdown: [] });
  const [categoryTrends, setCategoryTrends] = useState({});
  const [savingsTrends, setSavingsTrends] = useState({});

  const loadData = () => {
    if (activeTab === 'Overview') {
      const { start, end } = getDatesForFilter(dateFilter, customStart, customEnd);
      setOverviewData(getReportData(currency, start, end));
    } else if (activeTab === 'Expense') {
      setCategoryTrends(getCategoryTrends(currency));
    } else if (activeTab === 'Savings') {
      setSavingsTrends(getSavingsTrends());
    }
  };

  useFocusEffect(useCallback(() => { loadData(); }, [activeTab, currency, dateFilter, customStart, customEnd]));

  const accentColor = currency === 'AED' ? colors.primary : colors.accentTeal;

  const handleFilterSelect = (f) => {
    if (f === 'Custom') setShowCustomModal(true);
    else setDateFilter(f);
  };

  const applyCustomDate = () => {
    setDateFilter('Custom');
    setShowCustomModal(false);
    loadData();
  };

  const renderCurrencyToggle = () => (
    <View style={styles.currencyToggle}>
      {['AED', 'INR'].map((cur) => (
        <TouchableOpacity key={cur} style={[styles.curBtn, currency === cur && { backgroundColor: cur === 'AED' ? colors.primary : colors.accentTeal }]} onPress={() => setCurrency(cur)}>
          <Text style={[styles.curText, currency === cur && styles.curTextActive]}>{cur}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );

  const renderOverview = () => (
    <FadeInView delay={0}>
      <View style={{ paddingHorizontal: 18, marginBottom: 14 }}>{renderCurrencyToggle()}</View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 18, gap: 8, paddingBottom: 16 }}>
        {FILTERS.map((f) => (
          <TouchableOpacity key={f} style={[styles.dateFilterBtn, dateFilter === f && { borderColor: accentColor, backgroundColor: accentColor + '15' }]} onPress={() => handleFilterSelect(f)}>
            <Text style={[styles.dateFilterText, dateFilter === f && { color: accentColor }]}>
              {f === 'Custom' && dateFilter === 'Custom' ? `${formatDate(customStart)} - ${formatDate(customEnd)}` : f}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <View style={{ paddingHorizontal: 18 }}>
        <GlassCard style={styles.unifiedSummaryCard}>
          <LinearGradient colors={[accentColor + '10', 'transparent']} style={StyleSheet.absoluteFillObject} start={{x:0, y:0}} end={{x:1, y:1}} />
          
          <View style={styles.usRow}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <View style={[styles.usIconWrap, { backgroundColor: colors.success + '20' }]}>
                <Ionicons name="arrow-down" size={14} color={colors.success} />
              </View>
              <Text style={styles.usLabel}>INCOME</Text>
            </View>
            <Text style={[styles.usVal, { color: colors.success }]} numberOfLines={1} adjustsFontSizeToFit>{fmt(overviewData.totalIncome)}</Text>
          </View>
          
          <View style={styles.usDivider} />
          
          <View style={styles.usRow}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <View style={[styles.usIconWrap, { backgroundColor: colors.danger + '20' }]}>
                <Ionicons name="arrow-up" size={14} color={colors.danger} />
              </View>
              <Text style={styles.usLabel}>EXPENSE</Text>
            </View>
            <Text style={[styles.usVal, { color: colors.danger }]} numberOfLines={1} adjustsFontSizeToFit>{fmt(overviewData.totalExpense)}</Text>
          </View>
          
          <View style={styles.usDivider} />
          
          <View style={styles.usRow}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <View style={[styles.usIconWrap, { backgroundColor: accentColor + '20' }]}>
                <Ionicons name="wallet-outline" size={14} color={accentColor} />
              </View>
              <Text style={styles.usLabel}>NET SAVINGS</Text>
            </View>
            <Text style={[styles.usVal, { color: overviewData.savings >= 0 ? colors.text : colors.danger }]} numberOfLines={1} adjustsFontSizeToFit>
              {overviewData.savings < 0 ? '-' : ''}{fmt(Math.abs(overviewData.savings))}
            </Text>
          </View>
        </GlassCard>

        <Text style={[typography.sectionLabel, { marginBottom: 14, marginTop: 10 }]}>SPENDING INSIGHTS</Text>
        {overviewData.breakdown.length === 0 ? (
          <View style={styles.emptyWrap}><Text style={typography.bodySmall}>No expenses in this period</Text></View>
        ) : (
          <GlassCard style={styles.breakdownCard}>
            {overviewData.breakdown.map((item) => (
              <View key={item.category} style={styles.breakdownRow}>
                <View style={styles.bRowTop}>
                  <View style={styles.bIconWrap}><Ionicons name={item.icon || 'ellipse-outline'} size={14} color={colors.text} /></View>
                  <Text style={styles.bCategory}>{item.category}</Text>
                  <Text style={styles.bAmount} numberOfLines={1} adjustsFontSizeToFit>{fmt(item.total)}</Text>
                </View>
                <View style={styles.bBarTrack}>
                  <View style={[styles.bBarFill, { width: `${item.percentage}%`, backgroundColor: colors.dangerLight }]} />
                </View>
              </View>
            ))}
          </GlassCard>
        )}
      </View>
    </FadeInView>
  );

  const renderCategoryTrends = () => {
    const months = Object.keys(categoryTrends).sort().reverse();
    if (months.length === 0) return <View style={styles.emptyWrap}><Text style={typography.bodySmall}>No trend data available</Text></View>;

    const catMap = {};
    months.forEach(m => {
      categoryTrends[m].forEach(item => {
        if (!catMap[item.category]) catMap[item.category] = { icon: item.icon, totals: {}, sum: 0 };
        catMap[item.category].totals[m] = item.total;
        catMap[item.category].sum += item.total;
      });
    });

    const sortedCats = Object.keys(catMap).sort((a,b) => catMap[b].sum - catMap[a].sum);
    const topCat = sortedCats[0];

    return (
      <FadeInView delay={0}>
        <View style={{ paddingHorizontal: 18, marginBottom: 14 }}>{renderCurrencyToggle()}</View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 18, paddingBottom: 20 }}>
          <GlassCard style={styles.tableCard}>
            <View style={[styles.tr, styles.trHeader]}>
              <Text style={[styles.th, { width: 100, textAlign: 'left' }]}>Category</Text>
              {months.map(m => <Text key={m} style={styles.th}>{monthName(m)}</Text>)}
            </View>
            {sortedCats.map(cat => {
              const isTop = cat === topCat;
              return (
                <View key={cat} style={[styles.tr, isTop && { backgroundColor: accentColor + '10' }]}>
                  <View style={[styles.td, { width: 100, flexDirection: 'row', alignItems: 'center', gap: 6 }]}>
                    <Ionicons name={catMap[cat].icon} size={14} color={isTop ? accentColor : colors.textMuted} />
                    <Text style={[styles.tdText, { textAlign: 'left' }, isTop && { color: accentColor, fontWeight: '700' }]} numberOfLines={1}>{cat}</Text>
                  </View>
                  {months.map(m => (
                    <Text key={m} style={styles.tdText} numberOfLines={1} adjustsFontSizeToFit>
                      {catMap[cat].totals[m] ? fmt(catMap[cat].totals[m]) : '-'}
                    </Text>
                  ))}
                </View>
              );
            })}
          </GlassCard>
        </ScrollView>
      </FadeInView>
    );
  };

  const renderSavingsTrends = () => {
    const months = Object.keys(savingsTrends).sort().reverse();
    if (months.length === 0) return <View style={styles.emptyWrap}><Text style={typography.bodySmall}>No savings data available</Text></View>;

    return (
      <FadeInView delay={0}>
        <View style={{ paddingHorizontal: 18, paddingBottom: 20 }}>
          <GlassCard style={styles.tableCard}>
            <View style={[styles.tr, styles.trHeader]}>
              <Text style={[styles.th, { flex: 1.2, textAlign: 'left' }]}>Month</Text>
              <Text style={[styles.th, { flex: 1, textAlign: 'right' }]}>AED</Text>
              <Text style={[styles.th, { flex: 1, textAlign: 'right' }]}>INR</Text>
            </View>
            {months.map(m => {
              const data = savingsTrends[m];
              return (
                <View key={m} style={styles.tr}>
                  <Text style={[styles.tdText, { flex: 1.2, textAlign: 'left', fontWeight: '700', color: colors.textSecondary }]}>{monthName(m)}</Text>
                  <Text style={[styles.tdText, { flex: 1, color: data.AED.savings >= 0 ? colors.success : colors.danger }]} numberOfLines={1} adjustsFontSizeToFit>
                    {data.AED.savings > 0 ? '+' : ''}{fmt(data.AED.savings)}
                  </Text>
                  <Text style={[styles.tdText, { flex: 1, color: data.INR.savings >= 0 ? colors.accentTeal : colors.danger }]} numberOfLines={1} adjustsFontSizeToFit>
                    {data.INR.savings > 0 ? '+' : ''}{fmt(data.INR.savings)}
                  </Text>
                </View>
              );
            })}
          </GlassCard>
        </View>
      </FadeInView>
    );
  };

  return (
    <AmbientBackground>
      <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={22} color={colors.text} />
          </TouchableOpacity>
          <Text style={styles.title}>Analytics</Text>
          <View style={{ width: 36 }} />
        </View>

        <View style={styles.tabsRow}>
          {['Overview', 'Expense', 'Savings'].map(tab => (
            <TouchableOpacity key={tab} style={[styles.tabBtn, activeTab === tab && styles.tabBtnActive]} onPress={() => setActiveTab(tab)}>
              <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>{tab}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          {activeTab === 'Overview' && renderOverview()}
          {activeTab === 'Expense' && renderCategoryTrends()}
          {activeTab === 'Savings' && renderSavingsTrends()}
        </ScrollView>

        {/* Custom Date Modal */}
        <Modal visible={showCustomModal} transparent animationType="fade">
          <View style={styles.overlay}>
            <GlassCard style={styles.modalCard}>
              <Text style={styles.modalTitle}>Custom Date Range</Text>
              
              <View style={styles.datePickerRow}>
                <TouchableOpacity style={styles.datePickerBtn} onPress={() => setPickerMode('start')}>
                  <Text style={styles.datePickerLabel}>From Date</Text>
                  <Text style={styles.datePickerVal}>{formatDate(customStart)}</Text>
                </TouchableOpacity>
                <Ionicons name="arrow-forward" size={16} color={colors.textMuted} />
                <TouchableOpacity style={styles.datePickerBtn} onPress={() => setPickerMode('end')}>
                  <Text style={styles.datePickerLabel}>To Date</Text>
                  <Text style={styles.datePickerVal}>{formatDate(customEnd)}</Text>
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
                <TouchableOpacity style={[styles.applyBtn, { backgroundColor: accentColor }]} onPress={applyCustomDate}>
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
  safe: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 18, paddingTop: 8, paddingBottom: 14 },
  backBtn: { width: 36, height: 36, justifyContent: 'center' },
  title: { ...typography.h2 },
  
  tabsRow: { flexDirection: 'row', paddingHorizontal: 18, marginBottom: 16, gap: 10 },
  tabBtn: { flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: 'center', backgroundColor: colors.cardSolid, borderWidth: 1, borderColor: colors.border },
  tabBtnActive: { backgroundColor: colors.border },
  tabText: { ...typography.bodySmall, fontFamily: 'Inter_600SemiBold', fontSize: 12 },
  tabTextActive: { color: colors.text, fontFamily: 'Inter_700Bold' },

  currencyToggle: { flexDirection: 'row', backgroundColor: colors.cardSolid, borderRadius: 10, padding: 3, borderWidth: 1, borderColor: colors.border },
  curBtn: { flex: 1, paddingVertical: 6, borderRadius: 7, alignItems: 'center' },
  curText: { ...typography.bodySmall, fontFamily: 'Inter_600SemiBold', fontSize: 12 },
  curTextActive: { color: '#fff', fontFamily: 'Inter_700Bold' },

  dateFilterBtn: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, backgroundColor: colors.cardSolid, borderWidth: 1, borderColor: colors.border },
  dateFilterText: { ...typography.bodySmall, fontFamily: 'Inter_600SemiBold', fontSize: 12 },

  scroll: { paddingBottom: 40 },

  // Unified Summary - Vertical Rows (Reduced Height)
  unifiedSummaryCard: { paddingHorizontal: 16, paddingVertical: 14, marginBottom: 18, borderRadius: 16, overflow: 'hidden' },
  usRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 2 },
  usIconWrap: { width: 24, height: 24, borderRadius: 7, alignItems: 'center', justifyContent: 'center' },
  usLabel: { ...typography.bodySmall, fontSize: 11, fontFamily: 'Inter_600SemiBold', color: colors.textSecondary },
  usVal: { ...typography.h3, fontSize: 16, textAlign: 'right' },
  usDivider: { height: 1, backgroundColor: colors.border, marginVertical: 8 },

  // Breakdown
  breakdownCard: { padding: 16, paddingTop: 10 },
  breakdownRow: { marginTop: 14 },
  bRowTop: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  bIconWrap: { width: 24, height: 24, borderRadius: 6, backgroundColor: colors.border, alignItems: 'center', justifyContent: 'center', marginRight: 8 },
  bCategory: { ...typography.bodyMedium, flex: 1 },
  bAmount: { ...typography.h3, fontSize: 13, width: 80, textAlign: 'right' },
  bBarTrack: { height: 6, backgroundColor: colors.border, borderRadius: 3, overflow: 'hidden' },
  bBarFill: { height: '100%', borderRadius: 3 },

  // Trend Table
  tableCard: { padding: 14, borderRadius: 16 },
  tr: { flexDirection: 'row', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.border, alignItems: 'center' },
  trHeader: { borderBottomWidth: 2, paddingVertical: 8 },
  th: { ...typography.label, width: 80, textAlign: 'right' },
  td: { justifyContent: 'center' },
  tdText: { ...typography.bodySmall, width: 80, textAlign: 'right' },

  emptyWrap: { alignItems: 'center', paddingVertical: 40 },

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
