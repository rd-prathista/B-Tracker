import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  TextInput,
  Alert,
  ActivityIndicator,
  LayoutAnimation,
  Platform
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect } from '@react-navigation/native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';
import {
  getLoanById,
  getLoanRepayments,
  addRepayment,
  deleteRepayment,
  deleteLoan
} from '../services/loanService';
import AmbientBackground from '../components/AmbientBackground';
import GlassCard from '../components/GlassCard';
import Toast from '../components/Toast';
import { fmt } from '../utils/formatters';

export default function LoanDetailsScreen({ navigation, route }) {
  const { loanId } = route.params || {};

  const [loan, setLoan] = useState(null);
  const [repayments, setRepayments] = useState([]);
  const [loading, setLoading] = useState(true);

  // Repayment Modal state
  const [showRepaymentModal, setShowRepaymentModal] = useState(false);
  const [repayAmount, setRepayAmount] = useState('');
  const [repayDate, setRepayDate] = useState(new Date());
  const [repayNotes, setRepayNotes] = useState('');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [isSavingRepay, setIsSavingRepay] = useState(false);

  // Toast
  const [toastVisible, setToastVisible] = useState(false);
  const [toastMessage, setToastMessage] = useState('');

  const loadLoanData = () => {
    try {
      const data = getLoanById(loanId);
      if (data) {
        setLoan(data);
        const list = getLoanRepayments(loanId);
        setRepayments(list);
      } else {
        Alert.alert('Error', 'Loan not found', [{ text: 'OK', onPress: () => navigation.goBack() }]);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadLoanData();
    }, [loanId])
  );

  const handleAddRepayment = () => {
    if (!repayAmount || isNaN(repayAmount) || parseFloat(repayAmount) <= 0) {
      Alert.alert('Invalid Amount', 'Please enter a valid repayment amount.');
      return;
    }
    if (parseFloat(repayAmount) > loan.outstandingAmount) {
      Alert.alert(
        'Repayment Blocked',
        `Repayment amount cannot exceed the outstanding balance of ${loan.currency} ${fmt(loan.outstandingAmount)}.`
      );
    } else {
      executeRepayment();
    }
  };

  const executeRepayment = () => {
    setIsSavingRepay(true);
    try {
      const { outstanding, status } = addRepayment(
        loanId,
        parseFloat(repayAmount),
        repayDate.toISOString(),
        repayNotes.trim() || null
      );
      
      setShowRepaymentModal(false);
      setRepayAmount('');
      setRepayNotes('');
      setRepayDate(new Date());
      
      setToastMessage(status === 'Closed' ? '✓ Loan Closed' : '✓ Repayment Added');
      setToastVisible(true);
      loadLoanData();
    } catch (e) {
      Alert.alert('Error', e.message);
    } finally {
      setIsSavingRepay(false);
    }
  };

  const handleDeleteRepayment = (id, amount) => {
    Alert.alert(
      'Delete Repayment',
      `Are you sure you want to delete this repayment of ${loan.currency} ${fmt(amount)}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            deleteRepayment(id);
            setToastMessage('✓ Repayment Deleted');
            setToastVisible(true);
            loadLoanData();
          }
        }
      ]
    );
  };

  const handleDeleteLoan = () => {
    Alert.alert(
      'Delete Loan',
      'Are you sure you want to permanently delete this loan and all repayment records? This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            deleteLoan(loanId);
            navigation.goBack();
          }
        }
      ]
    );
  };



  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    return new Date(dateStr).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  };

  if (loading || !loan) {
    return (
      <AmbientBackground>
        <SafeAreaView style={styles.center}>
          <ActivityIndicator size="large" color="#F59E0B" />
        </SafeAreaView>
      </AmbientBackground>
    );
  }

  // Construct Timeline events sorted chronologically
  const timelineEvents = [];

  // 1. Creation event
  timelineEvents.push({
    key: 'creation',
    type: 'create',
    date: new Date(loan.start_date),
    title: 'Loan Opened',
    subtitle: `With ${loan.person_name} (${loan.source_type})`,
    amount: loan.amount,
    currency: loan.currency
  });

  // 2. Repayments
  repayments.forEach((r) => {
    timelineEvents.push({
      key: `repayment-${r.id}`,
      type: 'repayment',
      id: r.id,
      date: new Date(r.date),
      title: 'Repayment Added',
      subtitle: r.notes || 'No notes',
      amount: r.amount,
      currency: loan.currency
    });
  });

  // Sort ascending by date, then tiebreak by key creation/repayment
  timelineEvents.sort((a, b) => {
    const diff = a.date - b.date;
    if (diff !== 0) return diff;
    if (a.type === 'create') return -1;
    if (b.type === 'create') return 1;
    return 0;
  });

  // 3. Closure event if Closed
  if (loan.status === 'Closed') {
    const lastRepay = repayments[0]; // repayments sorted desc, so [0] is latest
    const closedDate = lastRepay ? new Date(lastRepay.date) : new Date();
    timelineEvents.push({
      key: 'closure',
      type: 'closed',
      date: closedDate,
      title: 'Loan Closed',
      subtitle: 'Outstanding amount cleared'
    });
  }

  const getStatusColor = (status) => {
    if (status === 'Closed') return colors.success;
    if (status === 'Overdue') return colors.danger;
    return '#F59E0B';
  };

  return (
    <AmbientBackground>
      <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
        <Toast message={toastMessage} type="success" visible={toastVisible} onHide={() => setToastVisible(false)} />

        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={22} color={colors.text} />
          </TouchableOpacity>
          <Text style={styles.title}>Loan Details</Text>
          <TouchableOpacity onPress={() => navigation.navigate('AddLoan', { loanId })} style={styles.editBtn}>
            <Ionicons name="pencil" size={20} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          <GlassCard style={{ marginBottom: 16 }} contentStyle={{ padding: 18 }}>
            <View style={styles.rowBetween}>
              <View style={styles.infoCol}>
                <Text style={styles.personName}>{loan.person_name}</Text>
                <Text style={styles.metaLabel}>
                  {loan.type} • {loan.source_type}
                </Text>
              </View>
              <View style={[styles.statusBadge, { backgroundColor: getStatusColor(loan.status) + '20', borderColor: getStatusColor(loan.status) }]}>
                <Text style={[styles.statusText, { color: getStatusColor(loan.status) }]}>
                  {loan.status}
                </Text>
              </View>
            </View>

            <View style={styles.divider} />

            <View style={styles.statsGrid}>
              <View style={styles.statBox}>
                <Text style={styles.statLabel}>Original</Text>
                <Text style={styles.statVal} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.5}>
                  {loan.currency} {fmt(loan.amount)}
                </Text>
              </View>
              <View style={styles.statBox}>
                <Text style={styles.statLabel}>Paid</Text>
                <Text style={[styles.statVal, { color: colors.success }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.5}>
                  {loan.currency} {fmt(loan.paidAmount)}
                </Text>
              </View>
              <View style={styles.statBox}>
                <Text style={styles.statLabel}>Outstanding</Text>
                <Text style={[styles.statVal, { color: getStatusColor(loan.status) }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.5}>
                  {loan.currency} {fmt(loan.outstandingAmount)}
                </Text>
              </View>
            </View>

            {/* Repayment Progress Bar */}
            <View style={styles.progressContainer}>
              <View style={styles.rowBetween}>
                <Text style={styles.progressLabel}>Repayment Progress</Text>
                <Text style={styles.progressVal}>{loan.progressPercentage}%</Text>
              </View>
              <View style={styles.progressBarTrack}>
                <View
                  style={[
                    styles.progressBarFill,
                    {
                      width: `${loan.progressPercentage}%`,
                      backgroundColor: getStatusColor(loan.status)
                    }
                  ]}
                />
              </View>
            </View>

            {loan.expected_return_date && (
              <Text style={styles.expectedReturnText}>
                Expected Return: {formatDate(loan.expected_return_date)}
              </Text>
            )}

            {loan.notes && (
              <View style={styles.notesBox}>
                <Text style={styles.notesTitle}>Notes</Text>
                <Text style={styles.notesBody}>{loan.notes}</Text>
              </View>
            )}
          </GlassCard>

          {loan.status !== 'Closed' && (
            <TouchableOpacity
              style={styles.addRepayBtn}
              onPress={() => setShowRepaymentModal(true)}
            >
              <LinearGradient
                colors={['#F59E0B', '#D97706']}
                style={styles.addRepayGrad}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              >
                <Ionicons name="cash-outline" size={18} color="#fff" />
                <Text style={styles.addRepayText}>Record Repayment</Text>
              </LinearGradient>
            </TouchableOpacity>
          )}

          {/* Timeline History */}
          <Text style={styles.sectionTitle}>LOAN TIMELINE</Text>
          <GlassCard style={{ marginBottom: 20 }} contentStyle={{ paddingVertical: 12, paddingHorizontal: 16 }}>
            {timelineEvents.map((evt, idx) => {
              const isLast = idx === timelineEvents.length - 1;
              const isRepayment = evt.type === 'repayment';

              return (
                <View key={evt.key} style={styles.timelineRow}>
                  <View style={styles.timelineLeftCol}>
                    <View
                      style={[
                        styles.timelineDot,
                        {
                          backgroundColor:
                            evt.type === 'create'
                              ? '#F59E0B'
                              : evt.type === 'closed'
                              ? colors.success
                              : colors.accentTeal
                        }
                      ]}
                    />
                    {!isLast && <View style={styles.timelineLine} />}
                  </View>

                  <View style={styles.timelineRightCol}>
                    <View style={styles.rowBetween}>
                      <View style={{ flex: 1, marginRight: 8 }}>
                        <Text style={styles.timelineTitle}>{evt.title}</Text>
                        <Text style={styles.timelineSubtitle}>{evt.subtitle}</Text>
                        <Text style={styles.timelineDate}>{formatDate(evt.date)}</Text>
                      </View>
                      {evt.amount !== undefined && (
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          <Text
                            style={[
                              styles.timelineAmount,
                              {
                                color:
                                  evt.type === 'create'
                                    ? '#F59E0B'
                                    : colors.success
                              }
                            ]}
                          >
                            {evt.type === 'create' ? '' : '+'}{evt.currency} {fmt(evt.amount)}
                          </Text>
                          {isRepayment && (
                            <TouchableOpacity
                              onPress={() => handleDeleteRepayment(evt.id, evt.amount)}
                              style={{ padding: 4 }}
                            >
                              <Ionicons name="trash-outline" size={15} color={colors.danger} />
                            </TouchableOpacity>
                          )}
                        </View>
                      )}
                    </View>
                  </View>
                </View>
              );
            })}
          </GlassCard>

          {/* Action Row */}
          <View style={styles.actionRow}>
            <TouchableOpacity 
              style={styles.actionBtn} 
              onPress={() => navigation.navigate('AllTransactions', { loanId: loan.id })}
            >
              <Ionicons name="time-outline" size={16} color={colors.textSecondary} />
              <Text style={styles.actionBtnText}>History</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionBtn, styles.actionBtnDanger]}
              onPress={handleDeleteLoan}
            >
              <Ionicons name="trash-outline" size={16} color={colors.danger} />
              <Text style={[styles.actionBtnText, { color: colors.danger }]}>Delete Loan</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>

        {/* Repayment Modal */}
        <Modal visible={showRepaymentModal} transparent animationType="fade">
          <View style={styles.modalOverlay}>
            <GlassCard style={styles.modalCard}>
              <Text style={styles.modalHeader}>Add Repayment</Text>

              <View style={{ marginTop: 14 }}>
                <Text style={styles.modalInputLabel}>REPAYMENT AMOUNT</Text>
                <TextInput
                  style={styles.modalInput}
                  placeholder="0.00"
                  placeholderTextColor={colors.textMuted}
                  keyboardType="decimal-pad"
                  value={repayAmount}
                  onChangeText={setRepayAmount}
                  autoFocus
                />

                <Text style={styles.modalInputLabel}>REPAYMENT DATE</Text>
                <TouchableOpacity
                  style={styles.datePickerBtn}
                  onPress={() => setShowDatePicker(true)}
                >
                  <Ionicons name="calendar-outline" size={16} color="#F59E0B" />
                  <Text style={styles.datePickerBtnText}>{formatDate(repayDate)}</Text>
                </TouchableOpacity>

                {showDatePicker && (
                  <DateTimePicker
                    value={repayDate}
                    mode="date"
                    display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                    maximumDate={new Date()}
                    onChange={(event, selected) => {
                      setShowDatePicker(Platform.OS === 'ios');
                      if (selected) setRepayDate(selected);
                    }}
                  />
                )}

                <Text style={styles.modalInputLabel}>NOTES (OPTIONAL)</Text>
                <TextInput
                  style={styles.modalInput}
                  placeholder="Details of repayment..."
                  placeholderTextColor={colors.textMuted}
                  value={repayNotes}
                  onChangeText={setRepayNotes}
                />
              </View>

              <View style={styles.modalBtns}>
                <TouchableOpacity
                  style={styles.modalCancelBtn}
                  onPress={() => setShowRepaymentModal(false)}
                  disabled={isSavingRepay}
                >
                  <Text style={styles.modalCancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.modalSaveBtn}
                  onPress={handleAddRepayment}
                  disabled={isSavingRepay}
                >
                  {isSavingRepay ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.modalSaveText}>Save</Text>
                  )}
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
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingTop: 8,
    paddingBottom: 14
  },
  backBtn: { width: 36, height: 36, justifyContent: 'center' },
  editBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  title: { ...typography.h2, flex: 1, marginLeft: 8 },
  scroll: { paddingHorizontal: 18, paddingBottom: 40 },

  summaryCard: { marginBottom: 16 },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  infoCol: { flex: 1, marginRight: 8 },
  personName: { ...typography.h3, color: colors.text },
  metaLabel: { ...typography.bodySmall, color: colors.textSecondary, marginTop: 4 },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1
  },
  statusText: { fontSize: 10, fontFamily: 'Inter_700Bold' },
  divider: { height: 1, backgroundColor: colors.border, marginVertical: 14 },

  statsGrid: { flexDirection: 'row', gap: 10 },
  statBox: { flex: 1, backgroundColor: 'rgba(255, 255, 255, 0.02)', paddingVertical: 10, paddingHorizontal: 6, borderRadius: 10 },
  statLabel: { fontSize: 8, fontFamily: 'Inter_700Bold', color: colors.textMuted, textTransform: 'uppercase' },
  statVal: { fontSize: 13, fontFamily: 'Inter_700Bold', color: colors.text, marginTop: 4 },

  progressContainer: { marginTop: 14 },
  progressLabel: { fontSize: 9, fontFamily: 'Inter_700Bold', color: colors.textSecondary },
  progressVal: { fontSize: 9, fontFamily: 'Inter_700Bold', color: colors.text },
  progressBarTrack: { height: 6, backgroundColor: colors.border, borderRadius: 3, marginTop: 6, overflow: 'hidden' },
  progressBarFill: { height: '100%', borderRadius: 3 },

  expectedReturnText: { ...typography.caption, color: colors.textMuted, marginTop: 12 },

  notesBox: {
    marginTop: 14,
    padding: 10,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
    borderWidth: 1,
    borderColor: colors.border
  },
  notesTitle: { fontSize: 9, fontFamily: 'Inter_700Bold', color: colors.textMuted },
  notesBody: { ...typography.bodySmall, color: colors.textSecondary, marginTop: 4 },

  addRepayBtn: { borderRadius: 12, overflow: 'hidden', marginBottom: 20 },
  addRepayGrad: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 12 },
  addRepayText: { color: '#fff', fontFamily: 'Inter_700Bold', fontSize: 13 },

  sectionTitle: { ...typography.label, color: colors.textMuted, letterSpacing: 1, marginBottom: 8 },
  timelineCard: { marginBottom: 20 },
  timelineRow: { flexDirection: 'row', minHeight: 55 },
  timelineLeftCol: { width: 16, alignItems: 'center' },
  timelineDot: { width: 10, height: 10, borderRadius: 5, zIndex: 2, marginTop: 4 },
  timelineLine: { width: 2, flex: 1, backgroundColor: colors.border, zIndex: 1, marginVertical: -2 },
  timelineRightCol: { flex: 1, paddingLeft: 12, paddingBottom: 10 },
  timelineTitle: { fontSize: 12, fontFamily: 'Inter_700Bold', color: colors.text },
  timelineSubtitle: { fontSize: 10, color: colors.textSecondary, marginTop: 2 },
  timelineDate: { fontSize: 8, color: colors.textMuted, marginTop: 2 },
  timelineAmount: { fontSize: 12, fontFamily: 'Inter_700Bold' },

  actionRow: { flexDirection: 'row', gap: 10 },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.cardSolid
  },
  actionBtnDanger: { borderColor: colors.danger + '30' },
  actionBtnText: { fontSize: 11, fontFamily: 'Inter_700Bold', color: colors.textSecondary },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', padding: 20 },
  modalCard: { padding: 20 },
  modalHeader: { ...typography.h3, color: colors.text },
  modalInputLabel: {
    color: colors.textMuted,
    fontSize: 9,
    fontFamily: 'Inter_700Bold',
    letterSpacing: 1,
    marginTop: 14,
    marginBottom: 6
  },
  modalInput: {
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: colors.text,
    fontFamily: 'Inter_500Medium',
    fontSize: 14
  },
  datePickerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 12
  },
  datePickerBtnText: { color: colors.text, fontSize: 14, fontFamily: 'Inter_500Medium' },
  modalBtns: { flexDirection: 'row', gap: 10, marginTop: 20 },
  modalCancelBtn: {
    flex: 1,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center'
  },
  modalCancelText: { color: colors.textSecondary, fontFamily: 'Inter_600SemiBold', fontSize: 13 },
  modalSaveBtn: { flex: 1, padding: 12, borderRadius: 10, backgroundColor: '#F59E0B', alignItems: 'center' },
  modalSaveText: { color: '#fff', fontFamily: 'Inter_700Bold', fontSize: 13 }
});
