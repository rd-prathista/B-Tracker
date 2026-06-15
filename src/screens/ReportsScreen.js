import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Modal, Platform, TextInput, LayoutAnimation, UIManager, Alert } from 'react-native';

import { SafeAreaView } from 'react-native-safe-area-context';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';
import { getReportData, getCategoryTrends, getSavingsTrends, getInvestmentAnalytics, clearAllInvestments, deleteInvestment } from '../services/transactionService';
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
  const [categoryTrends, setCategoryTrends] = useState({});
  const [savingsTrends, setSavingsTrends] = useState({});
  const [investmentData, setInvestmentData] = useState({ activeInvestments: [], archivedInvestments: [], totalInvested: 0 });

  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [archiveMode, setArchiveMode] = useState('Active');
  const [expandedId, setExpandedId] = useState(null);
  const [investFilter, setInvestFilter] = useState('Active'); // 'Active', 'Completed', 'Archived'

  const [loanSummary, setLoanSummary] = useState({ totalGiven: 0, totalBorrowed: 0, totalRecovered: 0, outstandingGiven: 0, outstandingBorrowed: 0 });
  const [loans, setLoans] = useState([]);
  const [loanSubTab, setLoanSubTab] = useState('I Gave');

  const loadData = () => {
    const { start, end } = getDatesForFilter(dateFilter, customStart, customEnd);
    if (activeTab === 'Overview') {
      setOverviewData(getReportData(currency, start, end, searchQuery, archiveMode, ownerFilter));
      setInvestmentData(getInvestmentAnalytics(currency, ownerFilter));
    } else if (activeTab === 'Expense') {
      setCategoryTrends(getCategoryTrends(currency, archiveMode, ownerFilter));
    } else if (activeTab === 'Savings') {
      setSavingsTrends(getSavingsTrends(archiveMode, ownerFilter));
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
      { label: 'Prathista', value: breakdownData.SELF || 0, color: colors.successLight || colors.success },
      { label: 'Praveen', value: breakdownData.SPOUSE || 0, color: colors.accentTeal },
      { label: 'Other', value: breakdownData.OTHER || 0, color: colors.textMuted }
    ];
    items.sort((a, b) => b.value - a.value);

    return (
      <View style={{ marginTop: 20 }}>
        <Text style={[typography.sectionLabel, { marginBottom: 12 }]}>{title}</Text>
        <GlassCard style={styles.breakdownCard}>
          {items.map((item, idx) => {
            const pct = total > 0 ? (item.value / total) * 100 : 0;
            return (
              <View key={item.label} style={[styles.breakdownRow, idx === 0 && { marginTop: 4 }]}>
                <View style={styles.bRowTop}>
                  <View style={[styles.bIconWrap, { backgroundColor: item.color + '15' }]}>
                    <Ionicons name="person-outline" size={12} color={item.color} />
                  </View>
                  <Text style={styles.bCategory}>{item.label}</Text>
                  <Text style={styles.bAmount} numberOfLines={1} adjustsFontSizeToFit>
                    {currency} {fmt(item.value)}
                  </Text>
                </View>
                <View style={styles.bBarTrack}>
                  <View style={[styles.bBarFill, { width: `${pct}%`, backgroundColor: item.color }]} />
                </View>
              </View>
            );
          })}
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
        {overviewData.totalIncome > 0 && renderOwnershipBreakdown(overviewData.incomeBySource, overviewData.totalIncome, 'INCOME BY SOURCE')}
        {overviewData.totalExpense > 0 && renderOwnershipBreakdown(overviewData.expenseByFunding, overviewData.totalExpense, 'EXPENSES BY FUNDING SOURCE')}
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
        {months.length === 0 ? (
          <View style={styles.emptyWrap}><Text style={typography.bodySmall}>No trend data available</Text></View>
        ) : (
          renderTrendsTable()
        )}
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
                  <Text style={[styles.tdText, { flex: 1.2, textAlign: 'left', fontFamily: 'Inter_700Bold', color: colors.textSecondary }]}>{monthName(m)}</Text>
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
          <GlassCard style={styles.unifiedSummaryCard}>
            <LinearGradient colors={[colors.accentIndigo + '10', 'transparent']} style={StyleSheet.absoluteFillObject} start={{x:0, y:0}} end={{x:1, y:1}} />
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 14 }}>
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
                <GlassCard key={inv.id} style={{ padding: 16, marginBottom: 12 }}>
                  <TouchableOpacity onPress={() => toggleExpand(inv.id)} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <View style={{ flex: 1, marginRight: 10 }}>
                      <Text style={{ ...typography.bodyMedium, fontFamily: 'Inter_700Bold', color: colors.text }}>{inv.name}</Text>
                      <Text style={{ ...typography.caption, color: colors.textMuted, marginTop: 4 }}>
                        {inv.type} · {inv.tenure_value} {inv.tenure_type}
                      </Text>
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={{ ...typography.bodyMedium, fontFamily: 'Inter_700Bold', color: colors.accentIndigo }}>
                        {inv.currency} {fmt(inv.total_invested)}
                      </Text>
                      <Text style={{ ...typography.caption, color: colors.textSecondary, marginTop: 4 }}>
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
          <GlassCard style={{ marginBottom: 8, borderRadius: 12 }} contentStyle={{ paddingVertical: 10, paddingHorizontal: 14 }}>
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
  unifiedSummaryCard: { paddingHorizontal: 16, paddingVertical: 14, marginBottom: 18, borderRadius: 16, overflow: 'hidden' },
  usRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 2 },
  usIconWrap: { width: 24, height: 24, borderRadius: 7, alignItems: 'center', justifyContent: 'center' },
  usLabel: { ...typography.bodySmall, fontSize: 11, fontFamily: 'Inter_600SemiBold', color: colors.textSecondary },
  usVal: { ...typography.h3, fontSize: 16, textAlign: 'right' },
  usDivider: { height: 1, backgroundColor: colors.border, marginVertical: 8 },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },

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
