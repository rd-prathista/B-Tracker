import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Modal,
  TextInput,
  Alert,
  Platform,
  LayoutAnimation,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { LinearGradient } from 'expo-linear-gradient';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';
import AmbientBackground from '../components/AmbientBackground';
import GlassCard from '../components/GlassCard';
import FadeInView from '../components/FadeInView';
import Toast from '../components/Toast';
import { 
  getReminders, 
  addReminder, 
  deleteReminder, 
  toggleReminderActive,
  setupNotifications 
} from '../services/reminderService';
import { getAppSettings, getActiveCurrencies } from '../database/db';

const REPEAT_OPTIONS = ['None', 'Daily', 'Weekly', 'Monthly', 'Yearly'];

export default function RemindersScreen({ navigation }) {
  const [reminders, setReminders] = useState([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [toastVisible, setToastVisible] = useState(false);
  const [toastMessage, setToastMessage] = useState('');

  // Form State
  const [title, setTitle] = useState('');
  const [type, setType] = useState('SIP');
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState('AED');
  const [dueDate, setDueDate] = useState(new Date());
  const [repeat, setRepeat] = useState('Monthly');
  const [showDatePicker, setShowDatePicker] = useState(false);

  useEffect(() => {
    loadReminders();
    setupNotifications();

    const settings = getAppSettings();
    const active = getActiveCurrencies();
    const defaultCur = settings?.default_currency_mode;
    if (defaultCur && active.includes(defaultCur)) {
      setCurrency(defaultCur);
    } else if (active.length > 0) {
      setCurrency(active[0]);
    }
  }, []);

  const loadReminders = () => {
    setReminders(getReminders());
  };

  const handleAdd = async () => {
    if (!title || !amount || !dueDate) {
      Alert.alert('Incomplete', 'Please fill in all fields.');
      return;
    }
    
    try {
      await addReminder({
        title,
        type,
        amount: parseFloat(amount),
        currency,
        due_date: dueDate.toISOString(),
        repeat_frequency: repeat,
      });
      setShowAddModal(false);
      resetForm();
      loadReminders();
      setToastMessage('Reminder scheduled!');
      setToastVisible(true);
    } catch (e) {
      Alert.alert('Error', e.message);
    }
  };

  const resetForm = () => {
    setTitle('');
    setAmount('');
    setDueDate(new Date());
    setRepeat('Monthly');
  };

  const handleDelete = (id) => {
    Alert.alert('Delete Reminder', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        await deleteReminder(id);
        loadReminders();
      }}
    ]);
  };

  const handleToggle = async (id, currentStatus) => {
    await toggleReminderActive(id, !currentStatus);
    loadReminders();
  };

  const formatDate = (dateStr) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
  };

  return (
    <AmbientBackground>
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={styles.title}>Reminders</Text>
          <TouchableOpacity style={styles.addBtn} onPress={() => setShowAddModal(true)}>
            <Ionicons name="add" size={26} color={colors.primary} />
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.scroll}>
          {reminders.length === 0 ? (
            <View style={styles.empty}>
              <Ionicons name="notifications-off-outline" size={60} color={colors.textMuted} />
              <Text style={styles.emptyText}>No reminders set yet</Text>
              <TouchableOpacity style={styles.emptyAdd} onPress={() => setShowAddModal(true)}>
                <Text style={styles.emptyAddText}>Schedule first reminder</Text>
              </TouchableOpacity>
            </View>
          ) : (
            reminders.map((item, idx) => (
              <FadeInView key={item.id} delay={idx * 50}>
                <GlassCard style={styles.reminderCard}>
                  <View style={styles.reminderHeader}>
                    <View style={[styles.typeBadge, { backgroundColor: colors.primary + '20' }]}>
                      <Text style={[styles.typeText, { color: colors.primary }]}>{item.type}</Text>
                    </View>
                    <TouchableOpacity onPress={() => handleToggle(item.id, item.is_active)}>
                      <Ionicons 
                        name={item.is_active ? "notifications" : "notifications-off"} 
                        size={22} 
                        color={item.is_active ? colors.primary : colors.textMuted} 
                      />
                    </TouchableOpacity>
                  </View>

                  <View style={styles.reminderContent}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.reminderTitle}>{item.title}</Text>
                      <View style={styles.dueRow}>
                        <Ionicons name="calendar-outline" size={14} color={colors.textMuted} />
                        <Text style={styles.dueDate}>Due {formatDate(item.due_date)} · {item.repeat_frequency}</Text>
                      </View>
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={styles.amount}>{item.currency} {item.amount.toLocaleString()}</Text>
                      <TouchableOpacity onPress={() => handleDelete(item.id)} style={styles.delBtn}>
                        <Ionicons name="trash-outline" size={16} color={colors.danger} />
                      </TouchableOpacity>
                    </View>
                  </View>
                </GlassCard>
              </FadeInView>
            ))
          )}
        </ScrollView>

        <Modal visible={showAddModal} animationType="slide" transparent>
          <View style={styles.modalOverlay}>
            <GlassCard style={styles.modalCard} contentStyle={{ padding: 20 }}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>New Reminder</Text>
                <TouchableOpacity onPress={() => setShowAddModal(false)}>
                  <Ionicons name="close" size={24} color={colors.text} />
                </TouchableOpacity>
              </View>

              <ScrollView>
                <Text style={styles.label}>TITLE</Text>
                <TextInput 
                  style={styles.input} 
                  placeholder="e.g. Rent Payment" 
                  placeholderTextColor={colors.textMuted}
                  value={title}
                  onChangeText={setTitle}
                />

                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.label}>TYPE</Text>
                    <TextInput 
                      style={styles.input} 
                      placeholder="e.g. Rent" 
                      placeholderTextColor={colors.textMuted}
                      value={type}
                      onChangeText={setType}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.label}>AMOUNT</Text>
                    <TextInput 
                      style={styles.input} 
                      placeholder="0.00" 
                      placeholderTextColor={colors.textMuted}
                      keyboardType="decimal-pad"
                      value={amount}
                      onChangeText={setAmount}
                    />
                  </View>
                </View>

                <TouchableOpacity style={styles.pickerBtn} onPress={() => setShowDatePicker(true)}>
                  <View>
                    <Text style={styles.label}>DUE DATE</Text>
                    <Text style={styles.pickerVal}>{dueDate.toLocaleDateString()}</Text>
                  </View>
                  <Ionicons name="calendar" size={20} color={colors.primary} />
                </TouchableOpacity>

                {showDatePicker && (
                  <DateTimePicker
                    value={dueDate}
                    mode="date"
                    display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                    onChange={(event, date) => {
                      setShowDatePicker(Platform.OS === 'ios');
                      if (date) setDueDate(date);
                    }}
                  />
                )}

                <Text style={styles.label}>REPEAT</Text>
                <View style={styles.repeatGrid}>
                  {REPEAT_OPTIONS.map(opt => (
                    <TouchableOpacity 
                      key={opt} 
                      style={[styles.optBtn, repeat === opt && styles.optBtnActive]}
                      onPress={() => setRepeat(opt)}
                    >
                      <Text style={[styles.optText, repeat === opt && styles.optTextActive]}>{opt}</Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <TouchableOpacity style={styles.saveBtn} onPress={handleAdd}>
                  <LinearGradient colors={[colors.primary, colors.primaryDark]} style={styles.saveGradient}>
                    <Text style={styles.saveText}>Set Reminder</Text>
                  </LinearGradient>
                </TouchableOpacity>
              </ScrollView>
            </GlassCard>
          </View>
        </Modal>

        <Toast visible={toastVisible} message={toastMessage} onHide={() => setToastVisible(false)} type="success" />
      </SafeAreaView>
    </AmbientBackground>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 20 },
  backBtn: { width: 40, height: 40, justifyContent: 'center' },
  title: { fontSize: 20, fontFamily: 'Inter_800ExtraBold', color: colors.text },
  addBtn: { width: 40, height: 40, alignItems: 'flex-end', justifyContent: 'center' },
  scroll: { padding: 20, paddingBottom: 100 },
  
  reminderCard: { padding: 16, marginBottom: 15 },
  reminderHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  typeBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  typeText: { fontSize: 10, fontFamily: 'Inter_800ExtraBold', letterSpacing: 0.5 },
  
  reminderContent: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  reminderTitle: { fontSize: 16, fontFamily: 'Inter_700Bold', color: colors.text, marginBottom: 4 },
  dueRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dueDate: { fontSize: 12, color: colors.textMuted },
  amount: { fontSize: 16, fontFamily: 'Inter_800ExtraBold', color: colors.text, marginBottom: 4 },
  delBtn: { padding: 5 },

  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', marginTop: 100 },
  emptyText: { color: colors.textMuted, marginTop: 15, fontFamily: 'Inter_600SemiBold' },
  emptyAdd: { marginTop: 20, backgroundColor: colors.primary + '15', padding: 12, borderRadius: 12 },
  emptyAddText: { color: colors.primary, fontFamily: 'Inter_700Bold' },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  modalCard: { borderTopLeftRadius: 30, borderTopRightRadius: 30, maxHeight: '85%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle: { fontSize: 18, fontFamily: 'Inter_800ExtraBold', color: colors.text },
  label: { fontSize: 10, fontFamily: 'Inter_800ExtraBold', color: colors.textMuted, letterSpacing: 1, marginBottom: 8 },
  input: { backgroundColor: colors.cardSolid, borderRadius: 12, padding: 12, color: colors.text, borderWidth: 1, borderColor: colors.border, marginBottom: 15 },
  pickerBtn: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: colors.cardSolid, padding: 12, borderRadius: 12, borderWidth: 1, borderColor: colors.border, marginBottom: 15 },
  pickerVal: { color: colors.text, fontFamily: 'Inter_600SemiBold' },
  repeatGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 },
  optBtn: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.cardSolid },
  optBtnActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  optText: { fontSize: 12, color: colors.textSecondary, fontFamily: 'Inter_600SemiBold' },
  optTextActive: { color: '#fff', fontFamily: 'Inter_800ExtraBold' },
  saveBtn: { borderRadius: 15, overflow: 'hidden', marginTop: 10 },
  saveGradient: { padding: 16, alignItems: 'center' },
  saveText: { color: '#fff', fontFamily: 'Inter_800ExtraBold', fontSize: 16 },
});
