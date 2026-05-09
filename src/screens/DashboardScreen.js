import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';
import { getDashboardBalances, getRecentTransactions } from '../services/transactionService';
import FadeInView from '../components/FadeInView';
import AmbientBackground from '../components/AmbientBackground';
import GlassCard from '../components/GlassCard';

// Icon lookup (fallback for custom categories uses the DB icon field)
const CAT_ICONS = {
  'Salary': 'briefcase-outline', 'Freelance': 'laptop-outline', 'Business': 'storefront-outline',
  'Gift': 'gift-outline', 'Other Income': 'wallet-outline',
  'Grocery': 'cart-outline', 'Travel': 'airplane-outline', 'Fuel': 'car-outline',
  'Dining': 'restaurant-outline', 'Shopping': 'bag-handle-outline', 'Medical': 'medical-outline',
  'Rent': 'home-outline', 'Bills': 'receipt-outline', 'Baby': 'happy-outline',
  'Entertainment': 'game-controller-outline', 'Others': 'ellipse-outline',
};

const fmt = (n) => parseFloat(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtDate = (s) => new Date(s).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });

// One row inside the combined balance card
function BalanceRow({ code, data, accent, isLast }) {
  const hasData = data.income > 0 || data.expense > 0;
  if (!hasData) return null;
  return (
    <>
      <View style={styles.balanceRow}>
        <View style={[styles.currencyTag, { backgroundColor: accent + '20' }]}>
          <Text style={[styles.currencyTagText, { color: accent }]}>{code}</Text>
        </View>
        <View style={styles.balanceMiddle}>
          <View style={styles.miniStat}>
            <Ionicons name="arrow-down" size={10} color={colors.success} />
            <Text style={[styles.miniStatVal, { color: colors.success }]}>{fmt(data.income)}</Text>
          </View>
          <View style={styles.miniStat}>
            <Ionicons name="arrow-up" size={10} color={colors.danger} />
            <Text style={[styles.miniStatVal, { color: colors.danger }]}>{fmt(data.expense)}</Text>
          </View>
        </View>
        <Text style={[styles.balanceAmt, { color: data.balance < 0 ? colors.danger : colors.text }]} numberOfLines={1} adjustsFontSizeToFit>
          {data.balance < 0 ? '-' : ''}{fmt(Math.abs(data.balance))}
        </Text>
      </View>
      {!isLast && <View style={styles.balanceDivider} />}
    </>
  );
}

export default function DashboardScreen({ navigation }) {
  const [balances, setBalances] = useState({
    AED: { income: 0, expense: 0, balance: 0 },
    INR: { income: 0, expense: 0, balance: 0 },
  });
  const [recentTx, setRecentTx] = useState([]);
  const [hasData, setHasData] = useState(false);

  const loadData = () => {
    const b = getDashboardBalances();
    setBalances(b);
    setRecentTx(getRecentTransactions(2));
    setHasData(b.AED.income > 0 || b.AED.expense > 0 || b.INR.income > 0 || b.INR.expense > 0);
  };

  useFocusEffect(useCallback(() => { loadData(); }, []));

  const hasINR = balances.INR.income > 0 || balances.INR.expense > 0;

  return (
    <AmbientBackground>
      <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

          {/* Header */}
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

          {/* Action Buttons */}
          <FadeInView delay={80}>
            <View style={styles.buttonRow}>
              <TouchableOpacity style={styles.actionBtn} activeOpacity={0.82}
                onPress={() => navigation.navigate('AddTransaction', { type: 'income' })}>
                <LinearGradient colors={[colors.primary, colors.primaryDark]} style={styles.actionGrad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
                  <Ionicons name="add-circle-outline" size={17} color="#fff" />
                  <Text style={styles.actionText}>Income</Text>
                </LinearGradient>
              </TouchableOpacity>
              <TouchableOpacity style={styles.actionBtn} activeOpacity={0.82}
                onPress={() => navigation.navigate('AddTransaction', { type: 'expense' })}>
                <LinearGradient colors={[colors.dangerLight, colors.danger]} style={styles.actionGrad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
                  <Ionicons name="remove-circle-outline" size={17} color="#fff" />
                  <Text style={styles.actionText}>Expense</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </FadeInView>

          {/* Combined Balance Card */}
          {!hasData ? (
            <FadeInView delay={160}>
              <View style={styles.emptyWrap}>
                <Ionicons name="wallet-outline" size={34} color={colors.textMuted} />
                <Text style={[typography.bodyMedium, { marginTop: 10 }]}>No transactions yet</Text>
                <Text style={[typography.bodySmall, { textAlign: 'center', marginTop: 4 }]}>Add your first income or expense above.</Text>
              </View>
            </FadeInView>
          ) : (
            <FadeInView delay={160}>
              <GlassCard style={styles.balanceCard}>
                <LinearGradient
                  colors={['rgba(16, 185, 129, 0.12)', 'rgba(99, 102, 241, 0.06)']}
                  style={StyleSheet.absoluteFillObject}
                  start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                />
                <View style={styles.balanceCardHeader}>
                  <Text style={styles.balanceCardLabel}>BALANCES</Text>
                  <Ionicons name="stats-chart-outline" size={14} color={colors.textMuted} />
                </View>
                <BalanceRow code="AED" data={balances.AED} accent={colors.primary} isLast={!hasINR} />
                <BalanceRow code="INR" data={balances.INR} accent={colors.accentTeal} isLast={true} />
              </GlassCard>
            </FadeInView>
          )}

          {/* Recent Activity — 2 items only */}
          <FadeInView delay={240}>
            <View style={styles.sectionRow}>
              <Text style={styles.sectionLabel}>RECENT ACTIVITY</Text>
              <TouchableOpacity onPress={() => navigation.navigate('AllTransactions')}>
                <Text style={styles.viewAll}>View All</Text>
              </TouchableOpacity>
            </View>

            {recentTx.length === 0 ? (
              <View style={styles.emptyTx}>
                <Text style={[typography.bodySmall]}>No recent transactions</Text>
              </View>
            ) : (
              recentTx.map((tx, i) => {
                const isIncome = tx.type === 'income';
                const icon = CAT_ICONS[tx.category] || 'ellipse-outline';
                return (
                  <FadeInView key={i} delay={280 + i * 60}>
                    <View style={styles.txRow}>
                      <View style={[styles.txIcon, { backgroundColor: isIncome ? colors.success + '20' : colors.danger + '20' }]}>
                        <Ionicons name={icon} size={15} color={isIncome ? colors.success : colors.danger} />
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
              })
            )}
          </FadeInView>

        </ScrollView>
      </SafeAreaView>
    </AmbientBackground>
  );
}

const styles = StyleSheet.create({
  safe:   { flex: 1 },
  scroll: { paddingHorizontal: 18, paddingBottom: 32, flexGrow: 1 },

  // Header
  header:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 6, marginBottom: 16 },
  greeting:  { ...typography.caption, marginBottom: 2 },
  pageTitle: { ...typography.h1 },
  headerRight: { flexDirection: 'row', gap: 10 },
  headerIconBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: colors.cardSolid, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },

  // Buttons
  buttonRow: { flexDirection: 'row', gap: 11, marginBottom: 20 },
  actionBtn: { flex: 1, borderRadius: 13, overflow: 'hidden', elevation: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.2, shadowRadius: 5 },
  actionGrad: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingVertical: 12, paddingHorizontal: 6 },
  actionText: { ...typography.buttonPrimary, fontSize: 14 },

  // Combined Balance Card
  balanceCard:       { padding: 16, marginBottom: 20, overflow: 'hidden' },
  balanceCardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  balanceCardLabel:  { ...typography.sectionLabel },
  balanceRow:        { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6 },
  currencyTag:       { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 7 },
  currencyTagText:   { ...typography.label, letterSpacing: 0.5 },
  balanceMiddle:     { flex: 1, gap: 3 },
  miniStat:          { flexDirection: 'row', alignItems: 'center', gap: 4 },
  miniStatVal:       { ...typography.bodySmall, fontSize: 12, fontFamily: 'Inter_600SemiBold' },
  balanceAmt:        { ...typography.balanceMedium, fontSize: 18 },
  balanceDivider:    { height: 1, backgroundColor: colors.border, marginVertical: 4 },

  // Empty
  emptyWrap: { alignItems: 'center', paddingVertical: 28 },
  emptyTx:   { paddingVertical: 12, alignItems: 'center' },

  // Section
  sectionLabel: { ...typography.sectionLabel },
  sectionRow:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  viewAll:      { ...typography.bodySmall, color: colors.primaryLight, fontFamily: 'Inter_700Bold' },

  // Compact Tx Row
  txRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: 10, paddingHorizontal: 12,
    backgroundColor: colors.cardSolid, borderRadius: 12,
    marginBottom: 7, borderWidth: 1, borderColor: colors.border,
  },
  txIcon:     { width: 32, height: 32, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  txInfo:     { flex: 1 },
  txCategory: { ...typography.txCategory },
  txMeta:     { ...typography.txMeta, marginTop: 1 },
  txAmount:   { ...typography.txAmount },
});
