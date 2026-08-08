import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Modal, Platform, TextInput, LayoutAnimation, UIManager, Alert } from 'react-native';

import { SafeAreaView } from 'react-native-safe-area-context';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';
import { getReportData, getCategoryTrends, getCashflowTrends, getInvestmentAnalytics, clearAllInvestments, deleteInvestment, getOwnershipBalanceBreakdown, getCreditCardSpending, getOwnerBalances } from '../services/transactionService';
import { getLoans, getLoanSummary } from '../services/loanService';
import { getActiveCurrencies } from '../database/db';

import AmbientBackground from '../components/AmbientBackground';
import GlassCard from '../components/GlassCard';
import FadeInView from '../components/FadeInView';
import { fmt } from '../utils/formatters';

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

const monthName = (yyyyMM) => {
  const [y, m] = yyyyMM.split('-');
  return new Date(y, m - 1).toLocaleString('default', { month: 'short', year: 'numeric' });
};
const formatDate = (d) => d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}


export default function ReportsScreen({ navigation }) {
  const [activeTab, setActiveTab] = useState('Overview');
  const [currency, setCurrency] = useState('AED');
  const [dateFilter, setDateFilter] = useState('This Month');
  const [ownerFilter, setOwnerFilter] = useState('ALL');
  
  // Custom Date Modal State
  const [showCustomModal, setShowCustomModal] = useState(false);
  const [customStart, setCustomStart] = useState(new Date(new Date().setMonth(new Date().getMonth() - 1)));
  const [customEnd, setCustomEnd] = useState(new Date());
  const [pickerMode, setPickerMode] = useState(null); // 'start' or 'end'

  const [overviewData, setOverviewData] = useState({ totalIncome: 0, totalExpense: 0, savings: 0, breakdown: [] });
  const [ownerBalances, setOwnerBalances] = useState({ SELF: 0, SPOUSE: 0, OTHER: 0 });
  const [categoryTrends, setCategoryTrends] = useState({});
  const [savingsTrends, setSavingsTrends] = useState({});
  const [ccSpending, setCcSpending] = useState({ totalCC: 0, totalDebit: 0, cards: [] });
  const [investmentData, setInvestmentData] = useState({ activeInvestments: [], archivedInvestments: [], totalInvested: 0 });

  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [archiveMode, setArchiveMode] = useState('Active');
  
  const openEditMasterInv = (inv) => {
    navigation.navigate('AddTransaction', { type: 'investment', mode: 'editSetup', investmentId: inv.id });
  };
const [expandedId, setExpandedId] = useState(null);
  const [expandedCats, setExpandedCats] = useState(false);
  const [expandedTrends, setExpandedTrends] = useState(false);
  const [expandedChanges, setExpandedChanges] = useState(false);
  const [expenseChanges, setExpenseChanges] = useState({ changes: [], isValidMonth: false });
  const [investFilter, setInvestFilter] = useState('Active'); // 'Active', 'Completed', 'Archived'
  const [expandedCCId, setExpandedCCId] = useState(null);

  const [loanSummary, setLoanSummary] = useState({ totalGiven: 0, totalBorrowed: 0, totalRecovered: 0, outstandingGiven: 0, outstandingBorrowed: 0 });
  const [loans, setLoans] = useState([]);
  const [loanSubTab, setLoanSubTab] = useState('I Gave');
  
  const [ownershipBalanceData, setOwnershipBalanceData] = useState(null);
  const [expandedOwners, setExpandedOwners] = useState({ prathista: false, praveen: false, other: false });

  const loadData = () => {
    const { start, end } = getDatesForFilter(dateFilter, customStart, customEnd);
    if (activeTab === 'Overview') {
      setOverviewData(getReportData(currency, start, end, searchQuery, archiveMode, ownerFilter));
      setInvestmentData(getInvestmentAnalytics(currency, ownerFilter));
      setOwnershipBalanceData(getOwnershipBalanceBreakdown(currency));
    } else if (activeTab === 'Expense') {
      const currentOverview = getReportData(currency, start, end, searchQuery, archiveMode, ownerFilter);
      setOverviewData(currentOverview);
      setCategoryTrends(getCategoryTrends(currency, archiveMode, ownerFilter));
      setCcSpending(getCreditCardSpending(currency, start, end, archiveMode, ownerFilter));
      
      // Expense Changes Comparison Logic
      let isValidMonth = false;
      let prevStart, prevEnd;
      const now = new Date();
      const isCurrentOngoingMonth = (dateFilter === 'This Month') || 
        (dateFilter === 'Custom' && customStart && customStart.getFullYear() === now.getFullYear() && customStart.getMonth() === now.getMonth());

      if (dateFilter === 'This Month') {
        isValidMonth = true;
        const prevDates = getDatesForFilter('Last Month');
        prevStart = prevDates.start;
        prevEnd = prevDates.end;
      } else if (dateFilter === 'Last Month') {
        isValidMonth = true;
        const pStart = new Date(now.getFullYear(), now.getMonth() - 2, 1);
        const pEnd = new Date(now.getFullYear(), now.getMonth() - 1, 0, 23, 59, 59);
        prevStart = pStart.toISOString();
        prevEnd = pEnd.toISOString();
      } else if (dateFilter === 'Custom' && customStart && customEnd) {
        if (customStart.getDate() === 1) {
          const expectedEnd = new Date(customStart.getFullYear(), customStart.getMonth() + 1, 0);
          if (customEnd.getFullYear() === expectedEnd.getFullYear() && 
              customEnd.getMonth() === expectedEnd.getMonth() && 
              customEnd.getDate() === expectedEnd.getDate()) {
            isValidMonth = true;
            const pStart = new Date(customStart.getFullYear(), customStart.getMonth() - 1, 1);
            const pEnd = new Date(customStart.getFullYear(), customStart.getMonth(), 0, 23, 59, 59);
            prevStart = pStart.toISOString();
            prevEnd = pEnd.toISOString();
          }
        }
      }
      
      if (isValidMonth) {
        const prevOverview = getReportData(currency, prevStart, prevEnd, searchQuery, archiveMode, ownerFilter);
        const currentBreakdown = currentOverview.breakdown || [];
        const prevBreakdown = prevOverview.breakdown || [];
        
        const catMap = {};
        currentBreakdown.forEach(item => {
          catMap[item.category] = { current: Number(item.total) || 0, prev: 0, icon: item.icon };
        });
        prevBreakdown.forEach(item => {
          if (catMap[item.category]) {
            catMap[item.category].prev = Number(item.total) || 0;
          } else {
            catMap[item.category] = { current: 0, prev: Number(item.total) || 0, icon: item.icon };
          }
        });
        
        const changes = [];
        Object.keys(catMap).forEach(cat => {
          const currentAmt = Math.round((catMap[cat].current || 0) * 100) / 100;
          const prevAmt = Math.round((catMap[cat].prev || 0) * 100) / 100;
          const diff = Math.round((currentAmt - prevAmt) * 100) / 100;
          
          // Rule 1: Exclude zero differences (same category + same amount in both months)
          if (Math.abs(diff) < 0.01) {
            return;
          }

          // Rule 4: Previous-month category with 0 in CURRENT ONGOING month -> EXCLUDE!
          // Avoid showing misleading 0 decrease for current ongoing month when expense isn't recorded yet.
          if (isCurrentOngoingMonth && currentAmt === 0 && prevAmt > 0) {
            return;
          }
          
          changes.push({ 
            category: cat, 
            diff: diff, 
            prev: prevAmt,
            current: currentAmt,
            icon: catMap[cat].icon 
          });
        });
        
        changes.sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff));
        
        let compareLabel = 'Previous Month';
        if (dateFilter === 'This Month') compareLabel = 'Last Month';
        else if (dateFilter === 'Last Month') compareLabel = 'Month Before Last';
        
        setExpenseChanges({ changes, isValidMonth: true, compareLabel });
      } else {
        setExpenseChanges({ changes: [], isValidMonth: false, compareLabel: '' });
      }
    } else if (activeTab === 'Savings') {
      setSavingsTrends(getCashflowTrends(currency, ownerFilter));
      setCategoryTrends(getCategoryTrends(currency, archiveMode, ownerFilter));
      setOwnerBalances(getOwnerBalances()[currency] || { SELF: 0, SPOUSE: 0, OTHER: 0 });
    } else if (activeTab === 'Invest') {
      setInvestmentData(getInvestmentAnalytics(currency, ownerFilter));
    } else if (activeTab === 'Loan') {
      setLoanSummary(getLoanSummary(currency, ownerFilter));
      setLoans(getLoans({ currency, ownerFilter }));
    }
  };

  const toggleExpand = (id) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpandedId(expandedId === id ? null : id);
  };

  useFocusEffect(useCallback(() => {
    const active = getActiveCurrencies();
    if (active.length > 0 && !active.includes(currency)) {
      setCurrency(active[0]);
    }
    loadData();
  }, [activeTab, currency, dateFilter, customStart, customEnd, archiveMode, searchQuery, ownerFilter]));


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

  const toggleSearch = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    if (showSearch) {
      setSearchQuery('');
    }
    setShowSearch(!showSearch);
  };


  const renderCurrencyToggle = () => {
    const active = getActiveCurrencies();
    if (active.length <= 1) return null;
    return (
      <View style={styles.currencyToggle}>
        {active.map((cur) => (
<TouchableOpacity key={cur} style={[styles.curBtn, currency === cur && { backgroundColor: cur === 'AED' ? colors.primary : colors.accentTeal }]} onPress={() => setCurrency(cur)}>
            <Text style={[styles.curText, currency === cur && styles.curTextActive]}>{cur}</Text>
          </TouchableOpacity>
        ))}
      </View>
    );
  };

  const renderArchiveSelector = () => (
    <View style={{ flexDirection: 'row', paddingHorizontal: 18, marginBottom: 16, gap: 10 }}>
      {['Active', 'Archived', 'All'].map((mode) => (
        <TouchableOpacity
          key={mode}
          style={[
            styles.tabBtn,
            archiveMode === mode && { backgroundColor: colors.accentIndigo + '15', borderColor: colors.accentIndigo },
            { flex: 1 }
          ]}
          onPress={() => {
            setArchiveMode(mode);
            if (mode === 'Archived') {
              setDateFilter('All Time');
            } else if (dateFilter === 'All Time') {
              setDateFilter('This Month');
            }
          }}
        >
          <Text style={[
            styles.tabText,
            archiveMode === mode && { color: colors.accentIndigo, fontFamily: 'Inter_700Bold' }
          ]}>
            {mode === 'Active' ? 'Active Data' : mode === 'Archived' ? 'Archived Data' : 'All Data'}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );

  const renderOwnershipBreakdown = (breakdownData, total, title) => {
    if (!breakdownData) return null;
    const items = [
      { label: 'Prathista', value: breakdownData.SELF || 0 },
      { label: 'Praveen', value: breakdownData.SPOUSE || 0 },
      { label: 'Other', value: breakdownData.OTHER || 0 }
    ];
    items.sort((a, b) => b.value - a.value);

    return (
      <View style={{ marginTop: 12 }}>
        <Text style={[typography.sectionLabel, { marginBottom: 8 }]}>{title}</Text>
        <GlassCard style={{ borderRadius: 16 }} contentStyle={{ padding: 12 }}>
          {/* Table Header */}
          <View style={{ flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: colors.border, paddingBottom: 6, marginBottom: 6 }}>
            <Text style={{ flex: 1.2, fontFamily: 'Inter_700Bold', fontSize: 12, color: colors.textSecondary }}>OWNER</Text>
            <Text style={{ flex: 2, fontFamily: 'Inter_700Bold', fontSize: 12, color: colors.textSecondary, textAlign: 'right', paddingRight: 12 }}>AMOUNT</Text>
            <Text style={{ flex: 0.8, fontFamily: 'Inter_700Bold', fontSize: 12, color: colors.textSecondary, textAlign: 'right' }}>SHARE</Text>
          </View>
          {/* Table Rows */}
          {items.map((item, idx) => {
            const pct = total > 0 ? (item.value / total) * 100 : 0;
            return (
              <View key={item.label} style={{ flexDirection: 'row', paddingVertical: 8, borderBottomWidth: idx < 2 ? 1 : 0, borderBottomColor: colors.border + '15', alignItems: 'center' }}>
                <Text style={{ flex: 1.2, fontFamily: 'Inter_700Bold', fontSize: 13, color: colors.text }}>{item.label}</Text>
                <Text style={{ flex: 2, fontFamily: 'Inter_600SemiBold', fontSize: 13, color: colors.text, textAlign: 'right', paddingRight: 12 }}>
                  {currency} {fmt(item.value)}
                </Text>
                <Text style={{ flex: 0.8, fontFamily: 'Inter_700Bold', fontSize: 13, color: colors.textSecondary, textAlign: 'right' }}>
                  {pct.toFixed(0)}%
                </Text>
              </View>
            );
          })}
        </GlassCard>
      </View>
    );
  };


  const toggleOwnerExpand = (ownerKey) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpandedOwners(prev => ({
      ...prev,
      [ownerKey]: !prev[ownerKey]
    }));
  };

  const renderOwnershipBalanceBreakdown = () => {
    if (!ownershipBalanceData) return null;

    const owners = [
      { key: 'prathista', label: 'Prathista', emoji: '👩', color: colors.primary, data: ownershipBalanceData.prathista },
      { key: 'praveen', label: 'Praveen', emoji: '👨', color: colors.accentTeal, data: ownershipBalanceData.praveen },
      { key: 'other', label: 'Other', emoji: '👤', color: colors.textSecondary, data: ownershipBalanceData.other }
    ];

    return (
      <View style={{ marginTop: 12, marginBottom: 4 }}>
        <Text style={[typography.sectionLabel, { marginBottom: 8 }]}>OWNERSHIP BALANCE BREAKDOWN</Text>
        <GlassCard style={{ borderRadius: 16 }} contentStyle={{ padding: 14 }}>
          {owners.map((owner, idx) => {
            const isExpanded = expandedOwners[owner.key];
            const balanceColor = owner.data.balance >= 0 ? colors.text : colors.danger;
            
            return (
              <View key={owner.key} style={{ borderBottomWidth: idx < 2 ? 1 : 0, borderBottomColor: colors.border + '15', paddingVertical: 10 }}>
                <TouchableOpacity 
                  onPress={() => toggleOwnerExpand(owner.key)} 
                  activeOpacity={0.7}
                  style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Text style={{ fontSize: 16 }}>{owner.emoji}</Text>
                    <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 14, color: colors.text }}>{owner.label}</Text>
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 14, color: balanceColor }}>
                      {owner.data.balance < 0 ? '-' : ''}{currency} {fmt(Math.abs(owner.data.balance))}
                    </Text>
                    <Ionicons name={isExpanded ? 'chevron-up' : 'chevron-down'} size={16} color={colors.textMuted} />
                  </View>
                </TouchableOpacity>

                {isExpanded && (
                  <View style={{ marginTop: 10, paddingLeft: 24, gap: 6 }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                      <Text style={{ fontFamily: 'Inter_500Medium', fontSize: 12, color: colors.textMuted }}>Income</Text>
                      <Text style={{ fontFamily: 'Inter_600SemiBold', fontSize: 12, color: colors.success }}>{currency} {fmt(owner.data.income)}</Text>
                    </View>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                      <Text style={{ fontFamily: 'Inter_500Medium', fontSize: 12, color: colors.textMuted }}>Expense</Text>
                      <Text style={{ fontFamily: 'Inter_600SemiBold', fontSize: 12, color: colors.danger }}>-{currency} {fmt(owner.data.expense)}</Text>
                    </View>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                      <Text style={{ fontFamily: 'Inter_500Medium', fontSize: 12, color: colors.textMuted }}>Investment</Text>
                      <Text style={{ fontFamily: 'Inter_600SemiBold', fontSize: 12, color: colors.accentIndigo }}>-{currency} {fmt(owner.data.investment)}</Text>
                    </View>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                      <Text style={{ fontFamily: 'Inter_500Medium', fontSize: 12, color: colors.textMuted }}>Loan Impact</Text>
                      <Text style={{ fontFamily: 'Inter_600SemiBold', fontSize: 12, color: owner.data.loanImpact >= 0 ? colors.success : colors.danger }}>
                        {owner.data.loanImpact >= 0 ? '+' : ''}{currency} {fmt(owner.data.loanImpact)}
                      </Text>
                    </View>
                  </View>
                )}
              </View>
            );
          })}

          {/* Total Summary Footer Row */}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 10, marginTop: 6, alignItems: 'center' }}>
            <Text style={{ fontFamily: 'Inter_800ExtraBold', fontSize: 13, color: colors.textSecondary }}>Total</Text>
            <Text style={{ fontFamily: 'Inter_800ExtraBold', fontSize: 14, color: accentColor }}>
              {ownershipBalanceData.totalBalance < 0 ? '-' : ''}{currency} {fmt(Math.abs(ownershipBalanceData.totalBalance))}
            </Text>
          </View>
        </GlassCard>
      </View>
    );
  };

  const renderCombinedOwnershipOverview = () => {
    const items = [
      { label: 'Prathista', income: ownershipBalanceData.prathista.income, expense: ownershipBalanceData.prathista.expense },
      { label: 'Praveen', income: ownershipBalanceData.praveen.income, expense: ownershipBalanceData.praveen.expense },
      { label: 'Other', income: ownershipBalanceData.other.income, expense: ownershipBalanceData.other.expense }
    ];

    return (
      <View style={{ marginTop: 12, marginBottom: 12 }}>
        <Text style={[typography.sectionLabel, { marginBottom: 8 }]}>OWNERSHIP BREAKDOWN</Text>
        <GlassCard style={{ borderRadius: 16 }} contentStyle={{ padding: 12 }}>
          {/* Table Header */}
          <View style={{ flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: colors.border, paddingBottom: 6, marginBottom: 6 }}>
            <Text style={{ flex: 1, fontFamily: 'Inter_700Bold', fontSize: 12, color: colors.textSecondary }}>OWNER</Text>
            <Text style={{ flex: 1.5, fontFamily: 'Inter_700Bold', fontSize: 12, color: colors.success, textAlign: 'right', paddingRight: 10 }}>INCOME</Text>
            <Text style={{ flex: 1.5, fontFamily: 'Inter_700Bold', fontSize: 12, color: colors.danger, textAlign: 'right' }}>EXPENSE</Text>
          </View>
          {/* Table Rows */}
          {items.map((item, idx) => (
            <View key={item.label} style={{ flexDirection: 'row', paddingVertical: 8, borderBottomWidth: idx < 2 ? 1 : 0, borderBottomColor: colors.border + '15', alignItems: 'center' }}>
              <Text style={{ flex: 1, fontFamily: 'Inter_700Bold', fontSize: 13, color: colors.text }}>{item.label}</Text>
              <Text style={{ flex: 1.5, fontFamily: 'Inter_600SemiBold', fontSize: 13, color: colors.text, textAlign: 'right', paddingRight: 10 }}>
                {currency} {fmt(item.income)}
              </Text>
              <Text style={{ flex: 1.5, fontFamily: 'Inter_600SemiBold', fontSize: 13, color: colors.text, textAlign: 'right' }}>
                {currency} {fmt(item.expense)}
              </Text>
            </View>
          ))}
        </GlassCard>
      </View>
    );
  };

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
        <GlassCard style={styles.unifiedSummaryCard} contentStyle={styles.unifiedSummaryCardContent}>
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
              <Text style={styles.usLabel}>AVAILABLE SAVINGS</Text>
            </View>
            <Text style={[styles.usVal, { color: overviewData.savings >= 0 ? colors.text : colors.danger }]} numberOfLines={1} adjustsFontSizeToFit>
              {overviewData.savings < 0 ? '-' : ''}{fmt(Math.abs(overviewData.savings))}
            </Text>
          </View>
          
          <View style={styles.usDivider} />
          
          <View style={styles.usRow}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <View style={[styles.usIconWrap, { backgroundColor: (overviewData.savings >= 0 ? colors.success : colors.danger) + '20' }]}>
                <Ionicons name="pie-chart-outline" size={14} color={overviewData.savings >= 0 ? colors.success : colors.danger} />
              </View>
              <Text style={styles.usLabel}>SAVINGS %</Text>
            </View>
            <Text style={[styles.usVal, { color: overviewData.savings >= 0 ? colors.success : colors.danger }]} numberOfLines={1} adjustsFontSizeToFit>
              {overviewData.totalIncome > 0 ? ((overviewData.savings / overviewData.totalIncome) * 100).toFixed(1) + '%' : '--'}
            </Text>
          </View>
        </GlassCard>

        {/* Ownership Balance Breakdown */}
        {renderOwnershipBalanceBreakdown()}

        {/* Combined Ownership Table above Spending Insights */}
        {(overviewData.totalIncome > 0 || overviewData.totalExpense > 0) && renderCombinedOwnershipOverview()}

        <Text style={[typography.sectionLabel, { marginBottom: 14, marginTop: 10 }]}>SPENDING INSIGHTS</Text>
        {overviewData.breakdown.length === 0 ? (
          <View style={styles.emptyWrap}><Text style={typography.bodySmall}>No expenses in this period</Text></View>
        ) : (
          <GlassCard style={styles.breakdownCard} contentStyle={styles.breakdownCardContent}>
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

    const renderTrendsTable = () => {
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
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 18, paddingBottom: 20 }}>
          <GlassCard style={styles.tableCard} contentStyle={styles.tableCardContent}>
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
                    <Text style={[styles.tdText, { textAlign: 'left' }, isTop && { color: accentColor, fontFamily: 'Inter_700Bold' }]} numberOfLines={1}>{cat}</Text>
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
      );
    };

    return (
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

        <View style={{ paddingHorizontal: 18, marginBottom: 14 }}>
          <GlassCard style={{ borderRadius: 12 }} contentStyle={{ paddingVertical: 12, paddingHorizontal: 16 }}>
            <Text style={{ fontFamily: 'Inter_500Medium', fontSize: 12, color: colors.textSecondary }}>{dateFilter === 'Custom' ? 'Custom Period' : dateFilter} Total Expense</Text>
            <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 20, color: colors.danger, marginTop: 4 }}>{currency} {fmt(overviewData.totalExpense)}</Text>
          </GlassCard>
        </View>

        <Text style={[typography.sectionLabel, { marginBottom: 14, marginTop: 10, paddingHorizontal: 18 }]}>SPENDING BREAKDOWN</Text>
        {overviewData.breakdown.length === 0 ? (
          <View style={styles.emptyWrap}><Text style={typography.bodySmall}>No expenses in this period</Text></View>
        ) : (
          <View style={{ paddingHorizontal: 18 }}>
            <GlassCard style={styles.breakdownCard} contentStyle={styles.breakdownCardContent}>
              {overviewData.breakdown.slice(0, 5).map((item) => (
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
          </View>
        )}

        <View style={{ paddingHorizontal: 18, marginBottom: 14, marginTop: 10 }}>
          <Text style={typography.sectionLabel}>
            {expenseChanges.isValidMonth ? `COMPARED WITH ${expenseChanges.compareLabel.toUpperCase()}` : 'EXPENSE CHANGES'}
          </Text>
        </View>
        {!expenseChanges.isValidMonth ? (
          <View style={[styles.emptyWrap, { paddingHorizontal: 32 }]}>
            <Text style={[typography.bodySmall, { textAlign: 'center', lineHeight: 20 }]}>Expense Changes are available only for single-month views. Please select a monthly filter to compare category changes.</Text>
          </View>
        ) : expenseChanges.changes.length === 0 ? (
          <View style={styles.emptyWrap}>
            <Text style={typography.bodySmall}>No category changes compared to the previous month.</Text>
          </View>
        ) : (
          <View style={{ paddingHorizontal: 18 }}>
            <GlassCard style={styles.breakdownCard} contentStyle={styles.breakdownCardContent}>
              {(expandedChanges ? expenseChanges.changes : expenseChanges.changes.slice(0, 5)).map((item, index) => {
                const isIncrease = item.diff > 0;
                return (
                  <View key={item.category} style={[styles.breakdownRow, index > 0 && { marginTop: 16 }]}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', flex: 1 }}>
                      <View style={{ flex: 1 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                          <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: isIncrease ? colors.danger : colors.success }} />
                          <Text style={[styles.bCategory, { color: isIncrease ? colors.danger : colors.success }]} numberOfLines={1}>{item.category}</Text>
                        </View>
                        <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 12, color: colors.textSecondary }}>
                          {currency} {fmt(item.prev)}  →  {currency} {fmt(item.current)}
                        </Text>
                      </View>
                      
                      <View style={{ alignItems: 'flex-end', justifyContent: 'center', paddingLeft: 10, flexShrink: 0 }}>
                        <Text style={[styles.bAmount, { color: isIncrease ? colors.danger : colors.success }]}>
                          {isIncrease ? '+' : '-'}{currency} {fmt(Math.abs(item.diff))}
                        </Text>
                      </View>
                    </View>
                  </View>
                );
              })}
              {expenseChanges.changes.length > 5 && (
                <TouchableOpacity 
                  onPress={() => {
                    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                    setExpandedChanges(!expandedChanges);
                  }}
                  style={{ marginTop: 16, paddingTop: 12, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.05)', alignItems: 'center' }}
                >
                  <Text style={{ fontFamily: 'Inter_600SemiBold', fontSize: 13, color: colors.primary }}>
                    {expandedChanges ? 'View Less' : 'View Full Comparison'}
                  </Text>
                </TouchableOpacity>
              )}
            </GlassCard>
          </View>
        )}

        {/* Payment Analysis Card */}
        {ccSpending && (ccSpending.totalCC > 0 || ccSpending.totalDebit > 0) && (
          <View style={{ paddingHorizontal: 18, marginTop: 14 }}>
            <GlassCard style={{ borderRadius: 12 }} noPadding>
              <TouchableOpacity
                onPress={() => toggleExpand('payment_analysis')}
                style={{ paddingHorizontal: 16, paddingVertical: 10, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}
              >
                <Text style={{ fontFamily: 'Inter_600SemiBold', fontSize: 13, color: colors.textSecondary }}>Payment Analysis</Text>
                <Ionicons name={expandedId === 'payment_analysis' ? "chevron-up" : "chevron-down"} size={18} color={colors.textSecondary} />
              </TouchableOpacity>
              
              {expandedId === 'payment_analysis' && (
                <View style={{ paddingHorizontal: 16, paddingBottom: 12, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.05)' }}>
                  
                  {/* Totals */}
                  <View style={{ marginTop: 8, marginBottom: 12 }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                      <Text style={{ fontFamily: 'Inter_500Medium', fontSize: 12, color: colors.textMuted }}>Total Card Payments</Text>
                      <Text style={{ fontFamily: 'Inter_600SemiBold', fontSize: 13, color: colors.text }}>{currency} {fmt(ccSpending.totalDebit + ccSpending.totalCC)}</Text>
                    </View>
                    
                    {(() => {
                      const total = (ccSpending.totalDebit + ccSpending.totalCC) || 1;
                      const debitPct = Math.round((ccSpending.totalDebit / total) * 100) || 0;
                      const ccPct = Math.round((ccSpending.totalCC / total) * 100) || 0;
                      return (
                        <>
                          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                            <Text style={{ fontFamily: 'Inter_500Medium', fontSize: 12, color: colors.textMuted }}>Debit Card</Text>
                            <Text style={{ fontFamily: 'Inter_600SemiBold', fontSize: 13, color: colors.text }}>{currency} {fmt(ccSpending.totalDebit)} ({debitPct}%)</Text>
                          </View>
                          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                            <Text style={{ fontFamily: 'Inter_500Medium', fontSize: 12, color: colors.textMuted }}>Credit Card</Text>
                            <Text style={{ fontFamily: 'Inter_600SemiBold', fontSize: 13, color: colors.text }}>{currency} {fmt(ccSpending.totalCC)} ({ccPct}%)</Text>
                          </View>
                        </>
                      );
                    })()}
                  </View>

                  {/* Credit Card Breakdown */}
                  {ccSpending.cards.length > 0 && (
                    <View style={{ borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.05)', paddingTop: 8 }}>
                      <Text style={{ fontFamily: 'Inter_600SemiBold', fontSize: 12, color: colors.textSecondary, marginBottom: 8 }}>Credit Card Spending</Text>
                      {ccSpending.cards.map((cc, idx) => {
                        const isExpanded = expandedCCId === cc.credit_card_id;
                        const top2 = cc.categories.slice(0, 2).map(c => c.category).join(' • ');
                        
                        return (
                          <View 
                            key={cc.credit_card_id} 
                            style={{ 
                              marginBottom: idx === ccSpending.cards.length - 1 ? 0 : 8,
                              backgroundColor: 'rgba(255,255,255,0.02)',
                              borderRadius: 12,
                              padding: 10,
                              borderWidth: 1,
                              borderColor: isExpanded ? colors.primary + '50' : 'transparent'
                            }}
                          >
                            {!isExpanded ? (
                              <View>
                                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                                  <Text style={{ fontFamily: 'Inter_600SemiBold', fontSize: 14, color: colors.text }}>{cc.name}</Text>
                                  <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 13, color: colors.text }}>{currency} {fmt(cc.total)}</Text>
                                </View>
                                {top2 ? <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 11, color: colors.textMuted, marginTop: 4 }}>{top2}</Text> : null}
                                <TouchableOpacity 
                                  style={{ flexDirection: 'row', alignItems: 'center', marginTop: 8 }}
                                  onPress={() => {
                                    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                                    setExpandedCCId(cc.credit_card_id);
                                  }}
                                >
                                  <Ionicons name="chevron-down" size={14} color={colors.primary} />
                                  <Text style={{ fontFamily: 'Inter_500Medium', fontSize: 11, color: colors.primary, marginLeft: 4 }}>View Details</Text>
                                </TouchableOpacity>
                              </View>
                            ) : (
                              <View>
                                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                                  <Text style={{ fontFamily: 'Inter_600SemiBold', fontSize: 14, color: colors.text }}>{cc.name}</Text>
                                  <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 13, color: colors.text }}>Total: {currency} {fmt(cc.total)}</Text>
                                </View>
                                <View style={{ paddingLeft: 8, borderLeftWidth: 1, borderLeftColor: colors.primary + '30', marginBottom: 8 }}>
                                  {cc.categories.slice(0, 5).map(c => (
                                    <View key={c.category} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                                      <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 12, color: colors.textSecondary }}>{c.category}</Text>
                                      <Text style={{ fontFamily: 'Inter_500Medium', fontSize: 12, color: colors.text }}>{fmt(c.total)}</Text>
                                    </View>
                                  ))}
                                </View>
                                <TouchableOpacity 
                                  style={{ flexDirection: 'row', alignItems: 'center' }}
                                  onPress={() => {
                                    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                                    setExpandedCCId(null);
                                  }}
                                >
                                  <Ionicons name="chevron-up" size={14} color={colors.textMuted} />
                                  <Text style={{ fontFamily: 'Inter_500Medium', fontSize: 11, color: colors.textMuted, marginLeft: 4 }}>Hide Details</Text>
                                </TouchableOpacity>
                              </View>
                            )}
                          </View>
                        );
                      })}
                    </View>
                  )}
                </View>
              )}
            </GlassCard>
          </View>
        )}

        <View style={{ marginBottom: 14 }} />

        <TouchableOpacity 
          onPress={() => {
            LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
            setExpandedTrends(!expandedTrends);
          }} 
          style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: 'rgba(255,255,255,0.03)', marginHorizontal: 18, borderRadius: 12, marginBottom: 14, borderWidth: 1, borderColor: colors.border }}
        >
          <Text style={{ fontFamily: 'Inter_600SemiBold', color: colors.text, fontSize: 13 }}>Category Trend Comparison</Text>
          <Ionicons name={expandedTrends ? 'chevron-up' : 'chevron-down'} size={18} color={colors.textMuted} />
        </TouchableOpacity>

        {expandedTrends && (
          months.length === 0 ? (
            <View style={styles.emptyWrap}><Text style={typography.bodySmall}>No trend data available</Text></View>
          ) : (
            renderTrendsTable()
          )
        )}
      </FadeInView>
    );
  };

  const renderSavingsTrends = () => {
    const months = Object.keys(savingsTrends).sort().reverse();
    if (months.length === 0) return <View style={styles.emptyWrap}><Text style={typography.bodySmall}>No savings data available</Text></View>;

    const allTimeSavings = ownerFilter === 'ALL' || !ownerFilter 
      ? (ownerBalances.SELF || 0) + (ownerBalances.SPOUSE || 0) + (ownerBalances.OTHER || 0)
      : (ownerBalances[ownerFilter] || 0);

    return (
      <FadeInView delay={0}>
        <View style={{ paddingHorizontal: 18, marginBottom: 14 }}>{renderCurrencyToggle()}</View>
        
        <View style={{ paddingHorizontal: 18, marginBottom: 14 }}>
          <GlassCard style={{ borderRadius: 12 }} contentStyle={{ paddingVertical: 12, paddingHorizontal: 16 }}>
            <Text style={{ fontFamily: 'Inter_500Medium', fontSize: 12, color: colors.textSecondary }}>All Time Available Savings</Text>
            <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 20, color: allTimeSavings >= 0 ? colors.success : colors.danger, marginTop: 4 }}>
              {allTimeSavings < 0 ? '-' : ''}{currency} {fmt(Math.abs(allTimeSavings))}
            </Text>
          </GlassCard>
        </View>

        <ScrollView contentContainerStyle={{ paddingHorizontal: 18, paddingBottom: 20 }}>
          {months.map((m, index) => {
            const data = savingsTrends[m] || { savings: 0, income: 0, expense: 0 };
            const prevM = months[index + 1];
            const prevData = prevM ? (savingsTrends[prevM] || { savings: 0, income: 0, expense: 0 }) : null;

            const savingsPct = data.income > 0 ? ((data.savings / data.income) * 100).toFixed(1) + '%' : '--';
            const savingsDiff = prevData ? data.savings - prevData.savings : null;

            // Calculate category differences
            const catDiffs = [];
            if (prevM) {
              const currCats = categoryTrends[m] || [];
              const prevCats = categoryTrends[prevM] || [];
              const catMap = {};
              currCats.forEach(c => catMap[c.category] = { ...c, prevTotal: 0 });
              prevCats.forEach(c => {
                if (!catMap[c.category]) catMap[c.category] = { category: c.category, icon: c.icon, total: 0, prevTotal: c.total };
                else catMap[c.category].prevTotal = c.total;
              });

              Object.values(catMap).forEach(c => {
                const diff = c.total - c.prevTotal;
                if (diff !== 0) catDiffs.push({ category: c.category, icon: c.icon, diff });
              });
              catDiffs.sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff));
            }

            const top5 = catDiffs.slice(0, 5);
            const isCatsExpanded = expandedId === m + '_cats';

            return (
              <GlassCard key={m} style={{ marginBottom: 12, borderRadius: 16 }} contentStyle={{ padding: 14 }}>
                <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 16, color: colors.text, marginBottom: 10 }}>{monthName(m)}</Text>
                
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontFamily: 'Inter_500Medium', fontSize: 12, color: colors.textMuted }}>Income</Text>
                    <Text style={{ fontFamily: 'Inter_600SemiBold', fontSize: 14, color: colors.success }}>{fmt(data.income)}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontFamily: 'Inter_500Medium', fontSize: 12, color: colors.textMuted }}>Expense</Text>
                    <Text style={{ fontFamily: 'Inter_600SemiBold', fontSize: 14, color: colors.danger }}>{fmt(data.expense)}</Text>
                  </View>
                  <View style={{ flex: 1.2, alignItems: 'flex-end' }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                      <Text style={{ fontFamily: 'Inter_500Medium', fontSize: 12, color: colors.textMuted }}>Available Savings</Text>
                      <View style={{ paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, backgroundColor: data.savings >= 0 ? colors.success + '20' : colors.danger + '20' }}>
                        <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 10, color: data.savings >= 0 ? colors.success : colors.danger }}>{savingsPct}</Text>
                      </View>
                    </View>
                    <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 14, color: data.savings >= 0 ? colors.text : colors.danger }}>
                      {data.savings < 0 ? '-' : ''}{fmt(Math.abs(data.savings))}
                    </Text>
                  </View>
                </View>

                <View style={{ marginTop: 12, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 10 }}>
                  <Text style={{ fontFamily: 'Inter_600SemiBold', fontSize: 12, color: colors.textSecondary, marginBottom: 8 }}>Compared with Previous Month</Text>
                  {!prevData ? (
                    <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 13, color: colors.textMuted }}>No previous month available.</Text>
                  ) : (
                    <>
                      <Text style={{ fontFamily: 'Inter_600SemiBold', fontSize: 14, color: savingsDiff >= 0 ? colors.success : colors.danger, marginBottom: 12 }}>
                        {savingsDiff > 0 ? '+' : '-'}{currency} {fmt(Math.abs(savingsDiff))} vs {monthName(prevM).split(' ')[0]}
                      </Text>
                      
                      {top5.length > 0 && (
                        <View>
                          <Text style={{ fontFamily: 'Inter_500Medium', fontSize: 12, color: colors.textMuted, marginBottom: 6 }}>Major Reasons (Top Changes)</Text>
                          {top5.map(c => (
                            <View key={c.category} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                <Ionicons name={c.icon || 'ellipse-outline'} size={14} color={colors.textSecondary} />
                                <Text style={{ fontFamily: 'Inter_500Medium', fontSize: 13, color: colors.text }}>{c.category}</Text>
                              </View>
                              <Text style={{ fontFamily: 'Inter_600SemiBold', fontSize: 13, color: c.diff > 0 ? colors.danger : colors.success }}>
                                {c.diff > 0 ? '+' : '-'}{currency} {fmt(Math.abs(c.diff))}
                              </Text>
                            </View>
                          ))}

                          {catDiffs.length > 5 && (
                            <View>
                              <TouchableOpacity onPress={() => toggleExpand(m + '_cats')} style={{ paddingVertical: 8, marginTop: 4 }}>
                                <Text style={{ fontFamily: 'Inter_600SemiBold', fontSize: 12, color: accentColor }}>
                                  {isCatsExpanded ? 'Hide Full Comparison' : 'View Full Category Comparison'}
                                </Text>
                              </TouchableOpacity>
                              
                              {isCatsExpanded && (
                                <View style={{ marginTop: 6, paddingTop: 6, borderTopWidth: 1, borderTopColor: colors.border + '15' }}>
                                  {catDiffs.slice(5).map(c => (
                                    <View key={c.category} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                        <Ionicons name={c.icon || 'ellipse-outline'} size={14} color={colors.textSecondary} />
                                        <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 13, color: colors.text }}>{c.category}</Text>
                                      </View>
                                      <Text style={{ fontFamily: 'Inter_500Medium', fontSize: 13, color: c.diff > 0 ? colors.danger : colors.success }}>
                                        {c.diff > 0 ? '+' : '-'}{currency} {fmt(Math.abs(c.diff))}
                                      </Text>
                                    </View>
                                  ))}
                                </View>
                              )}
                            </View>
                          )}
                        </View>
                      )}
                    </>
                  )}
                </View>
              </GlassCard>
            );
          })}
        </ScrollView>
      </FadeInView>
    );
  };
  const handleClearAllInvestments = () => {
    Alert.alert(
      'Clear All Investments',
      'Are you sure you want to permanently clear all investments and contribution history? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Clear All', 
          style: 'destructive',
          onPress: () => {
            clearAllInvestments();
            loadData();
            Alert.alert('Success', 'All investments and contributions cleared successfully.');
          }
        }
      ]
    );
  };
  const handleDeleteInvestment = (id, name) => {
    Alert.alert(
      'Delete Investment',
      `Are you sure you want to permanently delete "${name}" and all its contribution history? This action cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Delete', 
          style: 'destructive',
          onPress: () => {
            deleteInvestment(id);
            loadData();
            Alert.alert('Success', `Investment "${name}" deleted successfully.`);
          }
        }
      ]
    );
  };

  const renderInvestments = () => {
    let list = [];
    if (investFilter === 'Active') {
      list = investmentData.activeInvestments || [];
    } else {
      list = [
        ...(investmentData.archivedInvestments || []),
        ...(investmentData.completedInvestments || [])
      ];
    }

    return (
      <FadeInView delay={0}>
        <View style={{ paddingHorizontal: 18, marginBottom: 14 }}>{renderCurrencyToggle()}</View>
        
        <View style={{ paddingHorizontal: 18 }}>
          <GlassCard style={styles.unifiedSummaryCard} contentStyle={styles.unifiedSummaryCardContent}>
            <LinearGradient colors={[colors.accentIndigo + '10', 'transparent']} style={StyleSheet.absoluteFillObject} start={{x:0, y:0}} end={{x:1, y:1}} />
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
                <View style={[styles.usIconWrap, { backgroundColor: colors.accentIndigo + '20' }]}>
                  <Ionicons name="briefcase-outline" size={14} color={colors.accentIndigo} />
                </View>
                <Text style={[styles.usLabel, { flexShrink: 1 }]} numberOfLines={1}>TOTAL WEALTH ALLOCATION</Text>
              </View>
              <View style={{ width: 10 }} />
              <Text style={[styles.usVal, { color: colors.accentIndigo, textAlign: 'right' }]}>{currency} {fmt(investmentData.totalInvested)}</Text>
            </View>
          </GlassCard>

          {investmentData.totalInvested > 0 && renderOwnershipBreakdown(investmentData.investmentByFunding, investmentData.totalInvested, 'INVESTMENTS BY FUNDING SOURCE')}

          {/* Section Header */}
          <Text style={[styles.sectionLabel, { marginTop: 16, marginBottom: 12 }]}>
            {investFilter === 'Active' ? 'ACTIVE ENTRIES' : 'ARCHIVED ENTRIES'} ({list.length})
          </Text>

          {/* Large Side-by-Side Action Buttons */}
          <View style={{ flexDirection: 'row', gap: 12, marginBottom: 16 }}>
            {investFilter === 'Active' ? (
              <TouchableOpacity 
                onPress={() => setInvestFilter('Archived')} 
                style={{ 
                  flex: 1,
                  flexDirection: 'row', 
                  alignItems: 'center', 
                  justifyContent: 'center',
                  gap: 8, 
                  backgroundColor: colors.success + '10', 
                  paddingVertical: 12, 
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: colors.success + '35'
                }}
              >
                <Ionicons name="archive-outline" size={16} color={colors.success} />
                <Text style={{ ...typography.bodyMedium, color: colors.success, fontFamily: 'Inter_700Bold' }}>View Archived</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity 
                onPress={() => setInvestFilter('Active')} 
                style={{ 
                  flex: 1,
                  flexDirection: 'row', 
                  alignItems: 'center', 
                  justifyContent: 'center',
                  gap: 8, 
                  backgroundColor: colors.accentIndigo + '10', 
                  paddingVertical: 12, 
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: colors.accentIndigo + '35'
                }}
              >
                <Ionicons name="list-outline" size={16} color={colors.accentIndigo} />
                <Text style={{ ...typography.bodyMedium, color: colors.accentIndigo, fontFamily: 'Inter_700Bold' }}>View Active</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity 
              onPress={handleClearAllInvestments} 
              style={{ 
                flex: 1,
                flexDirection: 'row', 
                alignItems: 'center', 
                justifyContent: 'center',
                gap: 8, 
                backgroundColor: colors.danger + '10', 
                paddingVertical: 12, 
                borderRadius: 12,
                borderWidth: 1,
                borderColor: colors.danger + '35'
              }}
            >
              <Ionicons name="trash-outline" size={16} color={colors.danger} />
              <Text style={{ ...typography.bodyMedium, color: colors.danger, fontFamily: 'Inter_700Bold' }}>Clear All</Text>
            </TouchableOpacity>
          </View>

          {list.length === 0 ? (
            <View style={styles.emptyWrap}>
              <Text style={typography.bodySmall}>
                No {investFilter.toLowerCase()} investments found
              </Text>
            </View>
          ) : (
            list.map((inv) => {
              const isExpanded = expandedId === inv.id;
              const tenureMonths = inv.tenure_type === 'Years' ? inv.tenure_value * 12 : inv.tenure_value;
              const progress = Math.min(100, (inv.total_invested / (inv.target_amount || inv.total_invested || 1)) * 100);

              return (
                <GlassCard key={inv.id} style={{ marginBottom: 8, borderRadius: 12 }} contentStyle={{ paddingVertical: 8, paddingHorizontal: 12 }}>
                  <TouchableOpacity onPress={() => toggleExpand(inv.id)} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <View style={{ flex: 1, marginRight: 10 }}>
                      <Text style={{ fontSize: 13, fontFamily: 'Inter_700Bold', color: colors.text }}>{inv.name}</Text>
                      <Text style={{ fontSize: 10, fontFamily: 'Inter_500Medium', color: colors.textMuted, marginTop: 2 }}>
                        {inv.type} · {inv.tenure_value} {inv.tenure_type}
                      </Text>
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={{ fontSize: 13, fontFamily: 'Inter_700Bold', color: colors.accentIndigo }}>
                        {inv.currency} {fmt(inv.total_invested)}
                      </Text>
                      <Text style={{ fontSize: 9, fontFamily: 'Inter_400Regular', color: colors.textSecondary, marginTop: 2 }}>
                        {progress.toFixed(0)}% Target
                      </Text>
                    </View>
                  </TouchableOpacity>

                  {isExpanded && (
                    <View style={{ marginTop: 14, paddingTop: 14, borderTopWidth: 1, borderTopColor: colors.border }}>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
                        <Text style={{ ...typography.caption, color: colors.textMuted }}>Target Amount</Text>
                        <Text style={{ ...typography.bodySmall, color: colors.text }}>
                          {inv.currency} {inv.target_amount ? fmt(inv.target_amount) : '---'}
                        </Text>
                      </View>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
                        <Text style={{ ...typography.caption, color: colors.textMuted }}>Status</Text>
                        <Text style={{ ...typography.bodySmall, color: inv.status === 'Active' || !inv.status ? colors.success : inv.status === 'Completed' ? colors.accentTeal : colors.textMuted }}>
                          {inv.status || 'Active'}
                        </Text>
                      </View>
                      {inv.notes && (
                        <View style={{ marginTop: 6, marginBottom: 4 }}>
                          <Text style={{ ...typography.caption, color: colors.textMuted }}>Notes</Text>
                          <Text style={{ ...typography.bodySmall, color: colors.textSecondary, marginTop: 2 }}>{inv.notes}</Text>
                        </View>
                      )}

                      {/* Card Action Buttons (History, Delete & Add Invest) */}
                      <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
                        <TouchableOpacity 
                          onPress={() => navigation.navigate('AllTransactions', { investmentId: inv.id })}
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
                          <Ionicons name="time-outline" size={14} color={colors.textSecondary} />
                          <Text style={{ ...typography.bodySmall, color: colors.textSecondary, fontFamily: 'Inter_700Bold' }}>History</Text>
                        </TouchableOpacity>

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

                        <TouchableOpacity 
                          onPress={() => handleDeleteInvestment(inv.id, inv.name)}
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
                          <Ionicons name="trash-outline" size={14} color={colors.danger} />
                          <Text style={{ ...typography.bodySmall, color: colors.danger, fontFamily: 'Inter_700Bold' }}>Delete</Text>
                        </TouchableOpacity>

                        {inv.status !== 'Completed' && inv.status !== 'Archived' && (
                          <TouchableOpacity 
                            onPress={() => navigation.navigate('AddTransaction', { type: 'investment', investmentId: inv.id, mode: 'contribution' })}
                            style={{ 
                              flex: 1.2, 
                              flexDirection: 'row', 
                              alignItems: 'center', 
                              justifyContent: 'center',
                              gap: 6, 
                              backgroundColor: colors.accentIndigo, 
                              paddingVertical: 8, 
                              borderRadius: 8 
                            }}
                          >
                            <Ionicons name="add-circle-outline" size={14} color="#fff" />
                            <Text style={{ ...typography.bodySmall, color: '#fff', fontFamily: 'Inter_700Bold' }}>Add Invest</Text>
                          </TouchableOpacity>
                        )}
                      </View>

                    </View>
                  )}
                </GlassCard>
              );
            })
          )}
        </View>
      </FadeInView>
    );
  };

  const renderLoans = () => {
    const activeLoansList = loans.filter(l => l.type === loanSubTab && (l.status === 'Active' || l.status === 'Overdue'));
    const closedLoansList = loans.filter(l => l.type === loanSubTab && l.status === 'Closed');
    
    const repaidBorrowed = Math.max(0, loanSummary.totalBorrowed - loanSummary.outstandingBorrowed);

    const renderLoanItem = (l) => {
      const isOverdue = l.status === 'Overdue';
      return (
        <TouchableOpacity
          key={l.id}
          onPress={() => navigation.navigate('LoanDetails', { loanId: l.id })}
        >
          <GlassCard style={{ marginBottom: 8, borderRadius: 12 }} contentStyle={{ paddingVertical: 8, paddingHorizontal: 12 }}>
            <View style={styles.rowBetween}>
              <View style={{ flex: 1, marginRight: 8 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text style={{ fontSize: 13, fontFamily: 'Inter_700Bold', color: l.status === 'Closed' ? colors.textSecondary : colors.text }}>
                    {l.person_name}
                  </Text>
                  {isOverdue && (
                    <View style={{ backgroundColor: colors.danger + '20', paddingHorizontal: 6, paddingVertical: 1, borderRadius: 4, borderWidth: 0.5, borderColor: colors.danger }}>
                      <Text style={{ fontSize: 8, fontFamily: 'Inter_700Bold', color: colors.danger }}>OVERDUE</Text>
                    </View>
                  )}
                </View>
                <Text style={{ fontSize: 10, fontFamily: 'Inter_500Medium', color: colors.textSecondary, marginTop: 2 }}>
                  {l.source_type} {l.expected_return_date ? `• Return: ${formatDate(new Date(l.expected_return_date))}` : ''}
                </Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={{ fontSize: 13, fontFamily: 'Inter_700Bold', color: l.status === 'Closed' ? colors.textMuted : (l.type === 'I Gave' ? '#F59E0B' : colors.dangerLight), textDecorationLine: l.status === 'Closed' ? 'line-through' : 'none' }}>
                  {l.currency} {fmt(l.status === 'Closed' ? l.amount : l.outstandingAmount)}
                </Text>
                {l.status !== 'Closed' && (
                  <Text style={{ fontSize: 9, fontFamily: 'Inter_400Regular', color: colors.textMuted, marginTop: 1 }}>
                    Original: {fmt(l.amount)}
                  </Text>
                )}
              </View>
            </View>
          </GlassCard>
        </TouchableOpacity>
      );
    };

    return (
      <FadeInView delay={0}>
        <View style={{ paddingHorizontal: 18, marginBottom: 14 }}>
          {renderCurrencyToggle()}
        </View>

        {/* Separated Summary Cards at the top */}
        <View style={{ paddingHorizontal: 18, gap: 10, marginBottom: 14 }}>
          {loanSubTab === 'I Gave' ? (
            /* I Gave Summary Card */
            <GlassCard contentStyle={{ padding: 12 }}>
              <Text style={{ fontSize: 10, fontFamily: 'Inter_700Bold', color: '#F59E0B', letterSpacing: 0.5, marginBottom: 8 }}>
                I GAVE (LENDING SUMMARY)
              </Text>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <View style={{ flex: 1, backgroundColor: 'rgba(255,255,255,0.02)', padding: 8, borderRadius: 8 }}>
                  <Text style={{ fontSize: 7, fontFamily: 'Inter_700Bold', color: colors.textMuted }}>TOTAL GIVEN</Text>
                  <Text style={{ fontSize: 12, fontFamily: 'Inter_700Bold', color: colors.text, marginTop: 4 }} numberOfLines={1} adjustsFontSizeToFit>
                    {currency} {fmt(loanSummary.totalGiven)}
                  </Text>
                </View>
                <View style={{ flex: 1, backgroundColor: 'rgba(255,255,255,0.02)', padding: 8, borderRadius: 8 }}>
                  <Text style={{ fontSize: 7, fontFamily: 'Inter_700Bold', color: colors.textMuted }}>TOTAL RECOVERED</Text>
                  <Text style={{ fontSize: 12, fontFamily: 'Inter_700Bold', color: colors.success, marginTop: 4 }} numberOfLines={1} adjustsFontSizeToFit>
                    {currency} {fmt(loanSummary.totalRecovered)}
                  </Text>
                </View>
                <View style={{ flex: 1, backgroundColor: 'rgba(255,255,255,0.02)', padding: 8, borderRadius: 8 }}>
                  <Text style={{ fontSize: 7, fontFamily: 'Inter_700Bold', color: colors.textMuted }}>OUTSTANDING</Text>
                  <Text style={{ fontSize: 12, fontFamily: 'Inter_700Bold', color: '#F59E0B', marginTop: 4 }} numberOfLines={1} adjustsFontSizeToFit>
                    {currency} {fmt(loanSummary.outstandingGiven)}
                  </Text>
                </View>
              </View>
            </GlassCard>
          ) : (
            /* I Borrowed Summary Card */
            <GlassCard contentStyle={{ padding: 12 }}>
              <Text style={{ fontSize: 10, fontFamily: 'Inter_700Bold', color: colors.dangerLight, letterSpacing: 0.5, marginBottom: 8 }}>
                I BORROWED (DEBT SUMMARY)
              </Text>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <View style={{ flex: 1, backgroundColor: 'rgba(255,255,255,0.02)', padding: 8, borderRadius: 8 }}>
                  <Text style={{ fontSize: 7, fontFamily: 'Inter_700Bold', color: colors.textMuted }}>TOTAL BORROWED</Text>
                  <Text style={{ fontSize: 12, fontFamily: 'Inter_700Bold', color: colors.text, marginTop: 4 }} numberOfLines={1} adjustsFontSizeToFit>
                    {currency} {fmt(loanSummary.totalBorrowed)}
                  </Text>
                </View>
                <View style={{ flex: 1, backgroundColor: 'rgba(255,255,255,0.02)', padding: 8, borderRadius: 8 }}>
                  <Text style={{ fontSize: 7, fontFamily: 'Inter_700Bold', color: colors.textMuted }}>TOTAL REPAID</Text>
                  <Text style={{ fontSize: 12, fontFamily: 'Inter_700Bold', color: colors.success, marginTop: 4 }} numberOfLines={1} adjustsFontSizeToFit>
                    {currency} {fmt(repaidBorrowed)}
                  </Text>
                </View>
                <View style={{ flex: 1, backgroundColor: 'rgba(255,255,255,0.02)', padding: 8, borderRadius: 8 }}>
                  <Text style={{ fontSize: 7, fontFamily: 'Inter_700Bold', color: colors.textMuted }}>OUTSTANDING</Text>
                  <Text style={{ fontSize: 12, fontFamily: 'Inter_700Bold', color: colors.dangerLight, marginTop: 4 }} numberOfLines={1} adjustsFontSizeToFit>
                    {currency} {fmt(loanSummary.outstandingBorrowed)}
                  </Text>
                </View>
              </View>
            </GlassCard>
          )}
        </View>

        {(loanSummary.totalGiven + loanSummary.totalBorrowed) > 0 && (
          <View style={{ paddingHorizontal: 18, marginBottom: 14 }}>
            {renderOwnershipBreakdown(loanSummary.loansByFunding, loanSummary.totalGiven + loanSummary.totalBorrowed, 'LOANS BY FUNDING SOURCE')}
          </View>
        )}

        {/* Sub-tab Switch for I Gave / I Borrowed */}
        <View style={{ flexDirection: 'row', paddingHorizontal: 18, marginBottom: 14, gap: 10 }}>
          {['I Gave', 'I Borrowed'].map((tab) => (
            <TouchableOpacity
              key={tab}
              style={[
                styles.tabBtn,
                loanSubTab === tab && { backgroundColor: '#F59E0B' + '15', borderColor: '#F59E0B' },
                { flex: 1, paddingVertical: 8, borderRadius: 8, borderWidth: 1.5, alignItems: 'center' }
              ]}
              onPress={() => setLoanSubTab(tab)}
            >
              <Text style={{
                fontFamily: loanSubTab === tab ? 'Inter_700Bold' : 'Inter_600SemiBold',
                fontSize: 13,
                color: loanSubTab === tab ? '#F59E0B' : colors.textSecondary
              }}>
                {tab === 'I Gave' ? 'I Gave (Lending)' : 'I Borrowed (Debt)'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Lists grouped into Active and Closed sections directly */}
        <View style={{ paddingHorizontal: 18 }}>
          {activeLoansList.length > 0 && (
            <View style={{ marginBottom: 16 }}>
              <Text style={{ fontSize: 10, fontFamily: 'Inter_700Bold', color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>
                ACTIVE ({activeLoansList.length})
              </Text>
              {activeLoansList.map(l => renderLoanItem(l))}
            </View>
          )}

          {closedLoansList.length > 0 && (
            <View style={{ marginBottom: 16 }}>
              <Text style={{ fontSize: 10, fontFamily: 'Inter_700Bold', color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8, marginTop: 8 }}>
                CLOSED ({closedLoansList.length})
              </Text>
              {closedLoansList.map(l => renderLoanItem(l))}
            </View>
          )}

          {activeLoansList.length === 0 && closedLoansList.length === 0 && (
            <View style={[styles.emptyWrap, { paddingVertical: 20 }]}>
              <Text style={{ ...typography.bodySmall, fontFamily: 'Inter_400Regular' }}>
                No loans found
              </Text>
            </View>
          )}
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
          
          {!showSearch ? (
            <>
              <Text style={styles.title}>Analytics</Text>
              <TouchableOpacity onPress={toggleSearch} style={styles.headerBtn}>
                <Ionicons name="search" size={22} color={colors.text} />
              </TouchableOpacity>
            </>
          ) : (
            <View style={styles.searchBarContainer}>
              <TextInput
                style={styles.searchBarInput}
                placeholder="Search reports..."
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


        <View style={styles.tabsRow}>
          {['Overview', 'Expense', 'Savings', 'Invest', 'Loan'].map(tab => (
            <TouchableOpacity 
              key={tab} 
              style={[styles.tabBtn, activeTab === tab && styles.tabBtnActive, { flex: 1 }]} 
              onPress={() => setActiveTab(tab)}
            >
              <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>{tab}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={{ flexDirection: 'row', paddingHorizontal: 18, marginBottom: 16, gap: 8 }}>
          {[
            { label: 'All', value: 'ALL' },
            { label: 'Prathista', value: 'SELF' },
            { label: 'Praveen', value: 'SPOUSE' },
            { label: 'Other', value: 'OTHER' }
          ].map(opt => (
            <TouchableOpacity
              key={opt.value}
              style={[
                styles.tabBtn,
                ownerFilter === opt.value && { backgroundColor: accentColor + '15', borderColor: accentColor },
                { flex: 1, paddingVertical: 8 }
              ]}
              onPress={() => {
                LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                setOwnerFilter(opt.value);
              }}
            >
              <Text style={[
                styles.tabText,
                ownerFilter === opt.value && { color: accentColor, fontFamily: 'Inter_700Bold' }
              ]}>
                {opt.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Archive selectors hidden */}

        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          {activeTab === 'Overview' && renderOverview()}
          {activeTab === 'Expense' && renderCategoryTrends()}
          {activeTab === 'Savings' && renderSavingsTrends()}
          {activeTab === 'Invest' && renderInvestments()}
          {activeTab === 'Loan' && renderLoans()}
        </ScrollView>


        {/* Custom Date Modal */}
        <Modal visible={showCustomModal} transparent animationType="fade">
          <View style={styles.overlay}>
            <GlassCard style={styles.modalCard} contentStyle={styles.modalCardContent}>
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
  headerBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  title: { ...typography.h2, flex: 1, marginLeft: 8 },

  searchBarContainer: { flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: colors.cardSolid, borderRadius: 12, paddingHorizontal: 12, marginLeft: 10, borderWidth: 1, borderColor: colors.border },
  searchBarInput: { flex: 1, paddingVertical: 8, color: colors.text, fontSize: 14 },

  
  tabsRow: { flexDirection: 'row', paddingHorizontal: 18, marginBottom: 16, gap: 10 },
  tabBtn: { paddingVertical: 10, borderRadius: 10, alignItems: 'center', backgroundColor: colors.cardSolid, borderWidth: 1, borderColor: colors.border },
  tabBtnActive: { backgroundColor: colors.border, borderColor: colors.primary + '40' },
  tabText: { ...typography.bodySmall, fontFamily: 'Inter_600SemiBold', color: colors.textSecondary, fontSize: 11 },
  tabTextActive: { color: colors.text, fontFamily: 'Inter_700Bold' },
  
  sectionLabel: { ...typography.label, color: colors.textMuted, letterSpacing: 1 },
  catNameText: { ...typography.bodySmall, fontFamily: 'Inter_600SemiBold' },
  catValText: { ...typography.caption, color: colors.textSecondary },
  progressBarBg: { height: 6, backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 3, overflow: 'hidden' },
  progressBarFill: { height: '100%', borderRadius: 3 },


  currencyToggle: { flexDirection: 'row', backgroundColor: colors.cardSolid, borderRadius: 10, padding: 3, borderWidth: 1, borderColor: colors.border },
  curBtn: { flex: 1, paddingVertical: 6, borderRadius: 7, alignItems: 'center' },
  curText: { ...typography.bodySmall, fontFamily: 'Inter_600SemiBold', fontSize: 12 },
  curTextActive: { color: '#fff', fontFamily: 'Inter_700Bold' },

  dateFilterBtn: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, backgroundColor: colors.cardSolid, borderWidth: 1, borderColor: colors.border },
  dateFilterText: { ...typography.bodySmall, fontFamily: 'Inter_600SemiBold', fontSize: 12 },

  scroll: { paddingBottom: 40 },

  // Unified Summary - Vertical Rows (Reduced Height)
  unifiedSummaryCard: { marginBottom: 12, borderRadius: 16, overflow: 'hidden' },
  unifiedSummaryCardContent: { paddingHorizontal: 16, paddingVertical: 12 },
  usRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 2 },
  usIconWrap: { width: 24, height: 24, borderRadius: 7, alignItems: 'center', justifyContent: 'center' },
  usLabel: { ...typography.bodySmall, fontSize: 11, fontFamily: 'Inter_600SemiBold', color: colors.textSecondary },
  usVal: { ...typography.h3, fontSize: 16, textAlign: 'right' },
  usDivider: { height: 1, backgroundColor: colors.border, marginVertical: 8 },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },

  // Breakdown
  breakdownCard: { marginBottom: 16, borderRadius: 24 },
  breakdownCardContent: { paddingHorizontal: 16, paddingBottom: 16, paddingTop: 10 },
  breakdownRow: { marginTop: 14 },
  bRowTop: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  bIconWrap: { width: 24, height: 24, borderRadius: 6, backgroundColor: colors.border, alignItems: 'center', justifyContent: 'center', marginRight: 8 },
  bCategory: { ...typography.bodyMedium, flex: 1 },
  bAmount: { ...typography.h3, fontSize: 13, width: 80, textAlign: 'right' },
  bBarTrack: { height: 6, backgroundColor: colors.border, borderRadius: 3, overflow: 'hidden' },
  bBarFill: { height: '100%', borderRadius: 3 },

  // Trend Table
  tableCard: { marginBottom: 16, borderRadius: 16 },
  tableCardContent: { padding: 14 },
  tr: { flexDirection: 'row', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.border, alignItems: 'center' },
  trHeader: { borderBottomWidth: 2, paddingVertical: 8 },
  th: { ...typography.label, width: 80, textAlign: 'right' },
  td: { justifyContent: 'center' },
  tdText: { ...typography.bodySmall, width: 80, textAlign: 'right' },

  emptyWrap: { alignItems: 'center', paddingVertical: 40 },

  // Modal
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'center', padding: 20 },
  modalCard: { borderRadius: 24 },
  modalCardContent: { padding: 20 },
  modalTitle: { color: colors.text, fontSize: 17, fontFamily: 'Inter_700Bold', marginBottom: 20 },
  datePickerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 },
  datePickerBtn: { flex: 1, padding: 12, borderRadius: 12, backgroundColor: colors.cardSolid, borderWidth: 1, borderColor: colors.border, alignItems: 'center' },
  datePickerLabel: { ...typography.label, marginBottom: 4 },
  datePickerVal: { ...typography.bodyMedium },
  modalBtns: { flexDirection: 'row', gap: 10, marginTop: 10 },
  cancelBtn: { flex: 1, padding: 12, borderRadius: 12, borderWidth: 1, borderColor: colors.border, alignItems: 'center' },
  cancelText: { color: colors.textSecondary, fontFamily: 'Inter_600SemiBold', fontSize: 14 },
  applyBtn: { flex: 1, padding: 12, borderRadius: 12, alignItems: 'center' },
  applyText: { color: '#fff', fontFamily: 'Inter_700Bold', fontSize: 14 },
});
