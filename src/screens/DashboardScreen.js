import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Pressable, LayoutAnimation, Platform, UIManager, Alert, Modal, TextInput } from 'react-native';

import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';
import { getDashboardBalances, getRecentTransactions, deleteTransaction } from '../services/transactionService';
import { getGoals, addGoal, updateGoalProgress, deleteGoal } from '../database/db';

import FadeInView from '../components/FadeInView';
import AmbientBackground from '../components/AmbientBackground';
import GlassCard from '../components/GlassCard';
import { TransactionActionModal, DeleteTransactionConfirmModal } from '../components/TransactionMenus';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const fmt = (n) => parseFloat(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtDate = (s) => new Date(s).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });

const BalanceRow = ({ code, data, accent, isLast }) => (
  <View style={[styles.balanceRow, !isLast && styles.borderBottom]}>
    <View style={styles.balanceInfo}>
      <Text style={styles.currencyCode}>{code}</Text>
      <Text style={styles.balanceAmt}>{data.balance.toLocaleString()}</Text>
    </View>
    <View style={styles.balanceBreakdown}>
      <View style={styles.breakdownItem}>
        <Text style={[styles.breakdownLabel, { color: colors.success }]}>IN</Text>
        <Text style={styles.breakdownValue}>{data.income.toLocaleString()}</Text>
      </View>
      <View style={styles.breakdownItem}>
        <Text style={[styles.breakdownLabel, { color: colors.accentIndigo }]}>INV</Text>
        <Text style={styles.breakdownValue}>{data.investment.toLocaleString()}</Text>
      </View>
      <View style={styles.breakdownItem}>
        <Text style={[styles.breakdownLabel, { color: colors.danger }]}>OUT</Text>
        <Text style={styles.breakdownValue}>{data.expense.toLocaleString()}</Text>
      </View>
    </View>
  </View>
);


const GoalsList = ({ goals, onAdd, onUpdate, onDelete }) => {
  if (goals.length === 0) {
    return (
      <GlassCard style={styles.emptyGoalCard}>
        <Ionicons name="rocket-outline" size={32} color={colors.accentIndigo} style={{ marginBottom: 10 }} />
        <Text style={styles.motivationText}>
          "A goal without a plan is just a wish."
        </Text>
        <TouchableOpacity style={styles.addGoalBtnInline} onPress={onAdd}>
          <Text style={styles.addGoalBtnText}>START YOUR FIRST GOAL</Text>
        </TouchableOpacity>
      </GlassCard>
    );
  }

  return (
    <View style={styles.goalsContainer}>
      {goals.map((goal, i) => {
        const progress = Math.min(100, (goal.current_amount / goal.target_amount) * 100);
        return (
          <GlassCard key={goal.id} style={styles.goalCard} noPadding>
            <TouchableOpacity 
              activeOpacity={0.7} 
              onLongPress={() => onDelete(goal)}
              onPress={() => onUpdate(goal)}
            >
              <View style={styles.goalContent}>
                <View style={styles.goalHeader}>
                  <Text style={styles.goalTitle}>{goal.title}</Text>
                  <Text style={styles.goalAmount}>{goal.currency} {goal.current_amount.toLocaleString()} / {goal.target_amount.toLocaleString()}</Text>
                </View>
                <View style={styles.progressBarBg}>
                  <View style={[styles.progressBarFill, { width: `${progress}%` }]} />
                </View>
              </View>
            </TouchableOpacity>
          </GlassCard>
        );
      })}
    </View>
  );
};


export default function DashboardScreen({ navigation }) {
  const [balances, setBalances] = useState({
    AED: { income: 0, expense: 0, investment: 0, balance: 0 },
    INR: { income: 0, expense: 0, investment: 0, balance: 0 },
  });
  const [goals, setGoals] = useState([]);
  const [recentTx, setRecentTx] = useState([]);

  const [hasData, setHasData] = useState(false);

  const [actionTx, setActionTx] = useState(null);
  const [deleteTx, setDeleteTx] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const [showGoalModal, setShowGoalModal] = useState(false);
  const [goalTitle, setGoalTitle] = useState('');
  const [goalTarget, setGoalTarget] = useState('');
  const [goalCurrency, setGoalCurrency] = useState('AED');
  
  const [updateGoal, setUpdateGoal] = useState(null);
  const [goalCurrent, setGoalCurrent] = useState('');


  const loadData = () => {
    const b = getDashboardBalances();
    setBalances(b);
    setRecentTx(getRecentTransactions(2));
    setGoals(getGoals());
    setHasData(b.AED.income > 0 || b.AED.expense > 0 || b.AED.investment > 0 || b.INR.income > 0 || b.INR.expense > 0 || b.INR.investment > 0);
  };


  useFocusEffect(useCallback(() => { loadData(); }, []));

  const openActions = (tx) => setActionTx(tx);

  const editFromMenu = () => {
    if (!actionTx) return;
    const tx = actionTx;
    setActionTx(null);
    navigation.navigate('AddTransaction', { type: tx.type, mode: 'edit', transactionId: tx.id });
  };

  const handleAddGoal = () => {
    if (!goalTitle || !goalTarget) return;
    addGoal(goalTitle, goalTarget, goalCurrency);
    setGoalTitle('');
    setGoalTarget('');
    setShowGoalModal(false);
    loadData();
  };

  const handleUpdateGoal = () => {
    if (!updateGoal || goalCurrent === '') return;
    updateGoalProgress(updateGoal.id, goalCurrent);
    setUpdateGoal(null);
    setGoalCurrent('');
    loadData();
  };

  const confirmDeleteGoal = (goal) => {
    Alert.alert(
      'Delete Goal',
      `Are you sure you want to delete "${goal.title}"?`,
      [
        { text: 'Cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => {
          deleteGoal(goal.id);
          loadData();
        }}
      ]
    );
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
      deleteTransaction(deleteTx.type, deleteTx.id);
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      loadData();
      setDeleteTx(null);
    } finally {
      setDeleting(false);
    }
  };

  const hasINR = balances.INR.income > 0 || balances.INR.expense > 0 || balances.INR.investment > 0;

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

          <FadeInView delay={80}>
            <View style={styles.buttonRow}>
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
                onPress={() => navigation.navigate('AddTransaction', { type: 'expense' })}
              >
                <LinearGradient colors={[colors.dangerLight, colors.danger]} style={styles.actionGrad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
                  <Ionicons name="remove-circle-outline" size={17} color="#fff" />
                  <Text style={styles.actionText}>Expense</Text>
                </LinearGradient>
              </TouchableOpacity>
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
                  <Text style={styles.balanceCardLabel}>BALANCES</Text>
                  <Ionicons name="stats-chart-outline" size={14} color={colors.textMuted} />
                </View>
                <BalanceRow code="AED" data={balances.AED} accent={colors.primary} isLast={!hasINR} />
                <BalanceRow code="INR" data={balances.INR} accent={colors.accentTeal} isLast={true} />
              </GlassCard>
            </FadeInView>
          )}

          <FadeInView delay={200}>
            <View style={styles.sectionRow}>
              <Text style={styles.sectionLabel}>YOUR GOALS</Text>
              <TouchableOpacity onPress={() => setShowGoalModal(true)}>
                <Text style={styles.viewAll}>Add New</Text>
              </TouchableOpacity>
            </View>
            <GoalsList 
              goals={goals} 
              onAdd={() => setShowGoalModal(true)}
              onUpdate={(g) => {
                setUpdateGoal(g);
                setGoalCurrent(String(g.current_amount));
              }}
              onDelete={confirmDeleteGoal}
            />
          </FadeInView>


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
                const icon = tx.icon || 'ellipse-outline';
                return (
                  <FadeInView key={`${tx.type}-${tx.id}`} delay={280 + i * 60}>
                    <View style={styles.txRow}>
                      <Pressable
                        style={styles.txMainPress}
                        onLongPress={() => openActions(tx)}
                        delayLongPress={380}
                      >
                        <View style={[styles.txIcon, { backgroundColor: isIncome ? colors.success + '20' : colors.danger + '20' }]}>
                          <Ionicons name={icon} size={15} color={isIncome ? colors.success : colors.danger} />
                        </View>
                        <View style={styles.txInfo}>
                          <Text style={styles.txCategory}>{tx.category}</Text>
                          <Text style={styles.txMeta}>
                            {fmtDate(tx.date)}
                            {tx.notes ? ` · ${tx.notes}` : ''}
                          </Text>
                        </View>
                        <Text
                          style={[styles.txAmount, { color: isIncome ? colors.success : colors.danger }]}
                          numberOfLines={1}
                          adjustsFontSizeToFit
                        >
                          {isIncome ? '+' : '-'}
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
          </FadeInView>
        </ScrollView>

        {/* Add Goal Modal */}
        <Modal visible={showGoalModal} transparent animationType="fade">
          <View style={styles.modalOverlay}>
            <GlassCard style={styles.modalCard}>
              <Text style={styles.modalTitle}>New Goal</Text>
              <TextInput 
                style={styles.input} 
                placeholder="Goal Title (e.g. New Car)" 
                placeholderTextColor={colors.textMuted}
                value={goalTitle}
                onChangeText={setGoalTitle}
              />
              <TextInput 
                style={styles.input} 
                placeholder="Target Amount" 
                placeholderTextColor={colors.textMuted}
                keyboardType="numeric"
                value={goalTarget}
                onChangeText={setGoalTarget}
              />
              <View style={styles.curSelectRow}>
                {['AED', 'INR'].map(cur => (
                  <TouchableOpacity 
                    key={cur} 
                    style={[styles.curOpt, goalCurrency === cur && styles.curOptActive]}
                    onPress={() => setGoalCurrency(cur)}
                  >
                    <Text style={[styles.curOptText, goalCurrency === cur && styles.curOptTextActive]}>{cur}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <View style={styles.modalBtns}>
                <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowGoalModal(false)}>
                  <Text style={styles.cancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.saveBtn} onPress={handleAddGoal}>
                  <Text style={styles.saveText}>Create Goal</Text>
                </TouchableOpacity>
              </View>
            </GlassCard>
          </View>
        </Modal>

        {/* Update Progress Modal */}
        <Modal visible={updateGoal !== null} transparent animationType="fade">
          <View style={styles.modalOverlay}>
            <GlassCard style={styles.modalCard}>
              <Text style={styles.modalTitle}>Update Progress</Text>
              <Text style={styles.modalSub}>Current savings for {updateGoal?.title}</Text>
              <TextInput 
                style={styles.input} 
                placeholder="Saved Amount" 
                placeholderTextColor={colors.textMuted}
                keyboardType="numeric"
                value={goalCurrent}
                onChangeText={setGoalCurrent}
                autoFocus
              />
              <View style={styles.modalBtns}>
                <TouchableOpacity style={styles.cancelBtn} onPress={() => setUpdateGoal(null)}>
                  <Text style={styles.cancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.saveBtn} onPress={handleUpdateGoal}>
                  <Text style={styles.saveText}>Update</Text>
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
        />

        <DeleteTransactionConfirmModal
          visible={!!deleteTx}
          transaction={deleteTx}
          onClose={cancelDelete}
          onConfirm={confirmDelete}
          deleting={deleting}
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
  breakdownValue: { ...typography.caption, color: colors.text, fontWeight: '600' },

  goalsContainer: { paddingHorizontal: 18, marginBottom: 20 },
  goalCard: { marginBottom: 10 },
  goalContent: { padding: 16 },
  goalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  goalTitle: { ...typography.bodyMedium, fontWeight: '700' },
  goalAmount: { ...typography.caption, color: colors.textSecondary },
  progressBarBg: { height: 6, backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 3, overflow: 'hidden' },
  progressBarFill: { height: '100%', backgroundColor: colors.accentIndigo, borderRadius: 3 },

  sectionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 18, marginBottom: 12 },
  viewAll: { ...typography.bodySmall, color: colors.primary, fontWeight: '700' },

  emptyWrap: { alignItems: 'center', paddingVertical: 28 },
  emptyTx: { paddingVertical: 12, alignItems: 'center' },
  sectionLabel: { ...typography.sectionLabel },

  emptyGoalCard: { marginHorizontal: 18, padding: 24, alignItems: 'center', borderRadius: 20 },
  motivationText: { ...typography.bodyMedium, fontStyle: 'italic', color: colors.textSecondary, textAlign: 'center', marginBottom: 18 },
  addGoalBtnInline: { backgroundColor: colors.accentIndigo + '20', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 12, borderWidth: 1, borderColor: colors.accentIndigo + '40' },
  addGoalBtnText: { ...typography.caption, color: colors.accentIndigo, fontWeight: '700', letterSpacing: 0.5 },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', padding: 20 },
  modalCard: { padding: 24, borderRadius: 24 },
  modalTitle: { ...typography.h3, marginBottom: 12 },
  modalSub: { ...typography.bodySmall, color: colors.textMuted, marginBottom: 15 },
  input: { backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 12, padding: 14, color: colors.text, marginBottom: 12, borderWidth: 1, borderColor: colors.border },
  curSelectRow: { flexDirection: 'row', gap: 10, marginBottom: 20 },
  curOpt: { flex: 1, padding: 12, borderRadius: 10, borderWidth: 1, borderColor: colors.border, alignItems: 'center' },
  curOptActive: { borderColor: colors.accentIndigo, backgroundColor: colors.accentIndigo + '20' },
  curOptText: { ...typography.bodySmall, color: colors.textSecondary },
  curOptTextActive: { color: colors.accentIndigo, fontWeight: '700' },
  modalBtns: { flexDirection: 'row', gap: 10 },
  cancelBtn: { flex: 1, padding: 14, alignItems: 'center' },
  cancelText: { color: colors.textMuted },
  saveBtn: { flex: 1, backgroundColor: colors.accentIndigo, padding: 14, borderRadius: 12, alignItems: 'center' },
  saveText: { color: '#fff', fontWeight: '700' },


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
});
