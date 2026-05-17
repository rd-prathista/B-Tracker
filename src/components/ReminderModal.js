import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Modal, ScrollView, Switch, KeyboardAvoidingView, Platform } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';
import GlassCard from './GlassCard';

export default function ReminderModal({ visible, onClose, onSave, reminderToEdit = null }) {
  const [title, setTitle] = useState('');
  const [type, setType] = useState('Payment');
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState('AED');
  const [dueDate, setDueDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [repeatType, setRepeatType] = useState('One Time');

  const types = ['Payment', 'Subscription', 'Investment', 'Other'];
  const repeatOptions = ['One Time', 'Monthly', 'Yearly'];

  useEffect(() => {
    if (visible) {
      if (reminderToEdit) {
        setTitle(reminderToEdit.title);
        setType(reminderToEdit.type || 'Payment');
        setAmount(reminderToEdit.amount ? reminderToEdit.amount.toString() : '');
        setCurrency(reminderToEdit.currency || 'AED');
        setDueDate(new Date(reminderToEdit.due_date));
        setRepeatType(reminderToEdit.repeat_type || 'One Time');
      } else {
        setTitle('');
        setType('Payment');
        setAmount('');
        setCurrency('AED');
        setDueDate(new Date());
        setRepeatType('One Time');
      }
    }
  }, [visible, reminderToEdit]);

  const handleSave = () => {
    if (!title.trim()) return;
    onSave({
      id: reminderToEdit?.id,
      title: title.trim(),
      type,
      amount: amount || null,
      currency,
      dueDate: dueDate.toISOString(),
      repeatType,
      enabled: reminderToEdit ? reminderToEdit.enabled : true,
      linkedInvestmentId: reminderToEdit?.linked_investment_id || null
    });
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent={true} onRequestClose={onClose}>
      <KeyboardAvoidingView style={styles.overlay} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <View style={styles.container}>
          <GlassCard style={styles.card}>
            <View style={styles.header}>
              <Text style={styles.title}>{reminderToEdit ? 'Edit Reminder' : 'New Reminder'}</Text>
              <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
                <Ionicons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
              <Text style={styles.label}>Title</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g., Rent, SIP, Gym"
                placeholderTextColor={colors.textMuted}
                value={title}
                onChangeText={setTitle}
              />

              <Text style={styles.label}>Amount (Optional)</Text>
              <View style={styles.amountRow}>
                <TextInput
                  style={[styles.input, { flex: 1, marginRight: 10 }]}
                  placeholder="0.00"
                  placeholderTextColor={colors.textMuted}
                  keyboardType="numeric"
                  value={amount}
                  onChangeText={setAmount}
                />
                <TouchableOpacity
                  style={styles.currencyToggle}
                  onPress={() => setCurrency(c => c === 'AED' ? 'INR' : 'AED')}
                >
                  <Text style={styles.currencyText}>{currency}</Text>
                </TouchableOpacity>
              </View>

              <Text style={styles.label}>Due Date</Text>
              {Platform.OS === 'web' ? (
                <TextInput
                  style={styles.input}
                  type="date"
                  value={dueDate.toISOString().split('T')[0]}
                  onChange={(e) => setDueDate(new Date(e.target.value))}
                />
              ) : (
                <TouchableOpacity style={styles.dateBtn} onPress={() => setShowDatePicker(true)}>
                  <Ionicons name="calendar-outline" size={20} color={colors.accentTeal} />
                  <Text style={styles.dateText}>{dueDate.toLocaleDateString()}</Text>
                </TouchableOpacity>
              )}
              
              {showDatePicker && Platform.OS !== 'web' && (
                <DateTimePicker
                  value={dueDate}
                  mode="date"
                  display="default"
                  onChange={(event, selectedDate) => {
                    setShowDatePicker(false);
                    if (selectedDate) setDueDate(selectedDate);
                  }}
                />
              )}

              <Text style={styles.label}>Type</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.pillRow}>
                {types.map(t => (
                  <TouchableOpacity
                    key={t}
                    style={[styles.pill, type === t && styles.pillActive]}
                    onPress={() => setType(t)}
                  >
                    <Text style={[styles.pillText, type === t && styles.pillTextActive]}>{t}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              <Text style={styles.label}>Repeat</Text>
              <View style={styles.row}>
                {repeatOptions.map(r => (
                  <TouchableOpacity
                    key={r}
                    style={[styles.repeatBtn, repeatType === r && styles.repeatBtnActive]}
                    onPress={() => setRepeatType(r)}
                  >
                    <Text style={[styles.repeatText, repeatType === r && styles.repeatTextActive]}>{r}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <TouchableOpacity style={styles.saveBtn} onPress={handleSave}>
                <Text style={styles.saveBtnText}>Save Reminder</Text>
              </TouchableOpacity>
            </ScrollView>
          </GlassCard>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  container: { padding: 15, paddingBottom: 30 },
  card: { padding: 20, borderRadius: 24, maxHeight: '90%' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  title: { ...typography.h3 },
  closeBtn: { padding: 5 },
  scroll: { paddingBottom: 20 },
  label: { ...typography.bodyMedium, color: colors.textMuted, marginBottom: 8, marginTop: 15 },
  input: { backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 12, padding: 14, color: colors.text, fontSize: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  amountRow: { flexDirection: 'row', alignItems: 'center' },
  currencyToggle: { backgroundColor: colors.accentTeal + '20', paddingHorizontal: 15, paddingVertical: 14, borderRadius: 12, borderWidth: 1, borderColor: colors.accentTeal + '50' },
  currencyText: { color: colors.accentTeal, fontWeight: 'bold' },
  dateBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 12, padding: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  dateText: { color: colors.text, fontSize: 16, marginLeft: 10 },
  pillRow: { flexDirection: 'row', marginBottom: 5 },
  pill: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.05)', marginRight: 10, borderWidth: 1, borderColor: 'transparent' },
  pillActive: { backgroundColor: colors.accentTeal + '20', borderColor: colors.accentTeal + '50' },
  pillText: { color: colors.textMuted },
  pillTextActive: { color: colors.accentTeal, fontWeight: 'bold' },
  row: { flexDirection: 'row', gap: 10 },
  repeatBtn: { flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.05)' },
  repeatBtnActive: { backgroundColor: colors.accentTeal },
  repeatText: { color: colors.textMuted, fontSize: 13 },
  repeatTextActive: { color: '#fff', fontWeight: 'bold' },
  saveBtn: { backgroundColor: colors.accentTeal, padding: 16, borderRadius: 12, alignItems: 'center', marginTop: 30 },
  saveBtnText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
});
