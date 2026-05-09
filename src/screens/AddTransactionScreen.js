import React, { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, SafeAreaView, KeyboardAvoidingView, Platform,
  Modal, Alert,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { colors } from '../theme/colors';
import { addTransaction, addCategory, getCategories, SUPPORTED_CURRENCIES } from '../services/transactionService';
import FadeInView from '../components/FadeInView';
import AmbientBackground from '../components/AmbientBackground';
import GlassCard from '../components/GlassCard';
import Toast from '../components/Toast';

// Curated icon set for finance categories
const ICON_OPTIONS = [
  'briefcase-outline', 'laptop-outline', 'storefront-outline', 'gift-outline',
  'wallet-outline', 'cart-outline', 'airplane-outline', 'car-outline',
  'restaurant-outline', 'bag-handle-outline', 'medical-outline', 'home-outline',
  'receipt-outline', 'happy-outline', 'game-controller-outline', 'fitness-outline',
  'book-outline', 'school-outline', 'phone-portrait-outline', 'bus-outline',
  'cash-outline', 'trending-up-outline', 'heart-outline', 'star-outline',
  'build-outline', 'people-outline', 'paw-outline', 'pizza-outline',
  'wine-outline', 'shirt-outline', 'watch-outline', 'ellipse-outline',
];

export default function AddTransactionScreen({ navigation, route }) {
  const { type = 'expense' } = route.params || {};
  const isIncome = type === 'income';

  // Form state
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState('AED');
  const [date, setDate] = useState(new Date());
  const [category, setCategory] = useState('');
  const [notes, setNotes] = useState('');
  const [availableCategories, setAvailableCategories] = useState([]);

  // UI state
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newCategoryIcon, setNewCategoryIcon] = useState('ellipse-outline');
  const [toastVisible, setToastVisible] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const accentColor = isIncome ? colors.success : colors.danger;

  const loadCategories = () => {
    const cats = getCategories(type);
    setAvailableCategories(cats);
    if (cats.length > 0 && !category) setCategory(cats[0].name);
  };

  useEffect(() => { loadCategories(); }, [type]);

  const formatDate = (d) =>
    d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });

  const handleSave = () => {
    if (!amount || isNaN(amount) || parseFloat(amount) <= 0) {
      Alert.alert('Invalid Amount', 'Please enter a valid amount greater than 0.');
      return;
    }
    if (!category) {
      Alert.alert('No Category', 'Please select a category.');
      return;
    }
    setIsSaving(true);
    try {
      addTransaction(type, amount, currency, date.toISOString(), category, notes);
      setToastMessage(isIncome ? '✓ Income Added Successfully' : '✓ Expense Saved');
      setToastVisible(true);
      setTimeout(() => navigation.goBack(), 2400);
    } catch (e) {
      Alert.alert('Error', 'Failed to save: ' + e.message);
      setIsSaving(false);
    }
  };

  const handleAddCategory = () => {
    try {
      addCategory(newCategoryName, type, newCategoryIcon);
      setShowCategoryModal(false);
      setNewCategoryName('');
      setNewCategoryIcon('ellipse-outline');
      loadCategories();
      setCategory(newCategoryName.trim());
    } catch (e) {
      Alert.alert('Error', e.message);
    }
  };

  return (
    <AmbientBackground>
      <SafeAreaView style={styles.container}>
        <Toast message={toastMessage} type={isIncome ? 'success' : 'error'} visible={toastVisible} onHide={() => setToastVisible(false)} />

        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.container}>

          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
              <Ionicons name="arrow-back" size={22} color={colors.text} />
            </TouchableOpacity>
            <Text style={styles.title}>{isIncome ? 'Add Income' : 'Add Expense'}</Text>
            <View style={styles.headerSpacer} />
          </View>

          <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">

            {/* Amount Card */}
            <FadeInView delay={0}>
              <GlassCard style={styles.amountCard}>
                <LinearGradient
                  colors={isIncome
                    ? ['rgba(16, 185, 129, 0.18)', 'rgba(20, 184, 166, 0.05)']
                    : ['rgba(239, 68, 68, 0.18)', 'rgba(248, 113, 113, 0.05)']}
                  style={StyleSheet.absoluteFillObject}
                  start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                />
                <Text style={styles.fieldLabel}>AMOUNT</Text>
                <TextInput
                  style={[styles.amountInput, { color: accentColor }]}
                  placeholder="0.00"
                  placeholderTextColor={colors.textMuted}
                  keyboardType="decimal-pad"
                  value={amount}
                  onChangeText={setAmount}
                  autoFocus
                  adjustsFontSizeToFit
                  numberOfLines={1}
                />
                {/* Currency */}
                <View style={styles.currencyRow}>
                  {SUPPORTED_CURRENCIES.map((cur) => (
                    <TouchableOpacity
                      key={cur}
                      activeOpacity={0.7}
                      style={[styles.currencyBtn, currency === cur && { borderColor: accentColor, backgroundColor: accentColor + '25' }]}
                      onPress={() => setCurrency(cur)}
                    >
                      <Text style={[styles.currencyBtnText, { color: currency === cur ? accentColor : colors.textSecondary }]}>{cur}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </GlassCard>
            </FadeInView>

            {/* Date Row */}
            <FadeInView delay={80}>
              <TouchableOpacity style={styles.dateRow} activeOpacity={0.7} onPress={() => setShowDatePicker(true)}>
                <View style={[styles.dateIconWrap, { backgroundColor: accentColor + '20' }]}>
                  <Ionicons name="calendar-outline" size={18} color={accentColor} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.dateLabel}>DATE</Text>
                  <Text style={styles.dateValue}>{formatDate(date)}</Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
              </TouchableOpacity>
              {showDatePicker && (
                <DateTimePicker
                  value={date}
                  mode="date"
                  display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                  onChange={(event, selected) => {
                    setShowDatePicker(Platform.OS === 'ios');
                    if (selected) setDate(selected);
                  }}
                />
              )}
            </FadeInView>

            {/* Category */}
            <FadeInView delay={160}>
              <View style={styles.sectionRow}>
                <Text style={styles.sectionLabel}>CATEGORY</Text>
                <TouchableOpacity style={styles.newCatBtn} onPress={() => setShowCategoryModal(true)}>
                  <Ionicons name="add" size={14} color={accentColor} />
                  <Text style={[styles.newCatText, { color: accentColor }]}>New</Text>
                </TouchableOpacity>
              </View>
              <View style={styles.categoryGrid}>
                {availableCategories.map((cat) => {
                  const isSelected = category === cat.name;
                  return (
                    <TouchableOpacity
                      key={cat.name}
                      activeOpacity={0.7}
                      style={[styles.categoryPill, isSelected && { borderColor: accentColor, backgroundColor: accentColor + '20' }]}
                      onPress={() => setCategory(cat.name)}
                    >
                      <Ionicons name={cat.icon || 'ellipse-outline'} size={14} color={isSelected ? accentColor : colors.textMuted} />
                      <Text style={[styles.categoryText, { color: isSelected ? accentColor : colors.textSecondary }]}>{cat.name}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </FadeInView>

            {/* Notes */}
            <FadeInView delay={240}>
              <Text style={styles.sectionLabel}>NOTES (OPTIONAL)</Text>
              <TextInput
                style={styles.notesInput}
                placeholder="What was this for?"
                placeholderTextColor={colors.textMuted}
                value={notes}
                onChangeText={setNotes}
                multiline
                numberOfLines={2}
              />
            </FadeInView>

            {/* Save Button */}
            <FadeInView delay={320}>
              <TouchableOpacity style={styles.saveBtn} activeOpacity={0.85} onPress={handleSave} disabled={isSaving}>
                <LinearGradient
                  colors={isIncome ? [colors.primary, colors.primaryDark] : [colors.dangerLight, colors.danger]}
                  style={styles.saveGradient}
                  start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                >
                  <Ionicons name={isIncome ? 'arrow-down-circle-outline' : 'arrow-up-circle-outline'} size={20} color="#fff" />
                  <Text style={styles.saveText}>Save {isIncome ? 'Income' : 'Expense'}</Text>
                </LinearGradient>
              </TouchableOpacity>
            </FadeInView>

          </ScrollView>
        </KeyboardAvoidingView>

        {/* New Category Modal */}
        <Modal visible={showCategoryModal} transparent animationType="fade">
          <View style={styles.overlay}>
            <GlassCard style={styles.modalCard}>
              <Text style={styles.modalTitle}>New {isIncome ? 'Income' : 'Expense'} Category</Text>

              <TextInput
                style={styles.modalInput}
                placeholder="Category name"
                placeholderTextColor={colors.textMuted}
                value={newCategoryName}
                onChangeText={setNewCategoryName}
                autoFocus
              />

              {/* Icon Picker */}
              <Text style={[styles.sectionLabel, { marginBottom: 10 }]}>PICK AN ICON</Text>
              <ScrollView style={{ maxHeight: 200 }} nestedScrollEnabled>
                <View style={styles.iconGrid}>
                  {ICON_OPTIONS.map((iconName) => (
                    <TouchableOpacity
                      key={iconName}
                      activeOpacity={0.7}
                      style={[styles.iconOption, newCategoryIcon === iconName && { backgroundColor: accentColor + '30', borderColor: accentColor }]}
                      onPress={() => setNewCategoryIcon(iconName)}
                    >
                      <Ionicons name={iconName} size={22} color={newCategoryIcon === iconName ? accentColor : colors.textSecondary} />
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>

              <View style={styles.modalBtns}>
                <TouchableOpacity style={styles.cancelBtn} onPress={() => { setShowCategoryModal(false); setNewCategoryName(''); }}>
                  <Text style={styles.cancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.createBtn, { backgroundColor: accentColor }]} onPress={handleAddCategory}>
                  <Text style={styles.createText}>Create</Text>
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
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 18, paddingTop: 8, paddingBottom: 12,
  },
  backBtn: { width: 36, height: 36, justifyContent: 'center' },
  headerSpacer: { width: 36 },
  title: { fontSize: 18, color: colors.text, fontWeight: '700' },
  scroll: { paddingHorizontal: 18, paddingBottom: 36 },

  // Amount
  amountCard: { padding: 20, marginBottom: 12, overflow: 'hidden' },
  fieldLabel: { color: colors.textMuted, fontSize: 11, fontWeight: '700', letterSpacing: 1, marginBottom: 6 },
  amountInput: { fontSize: 46, fontWeight: '800', letterSpacing: -1, marginBottom: 14 },
  currencyRow: { flexDirection: 'row', gap: 8 },
  currencyBtn: { paddingVertical: 6, paddingHorizontal: 16, borderRadius: 16, borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.cardSolid },
  currencyBtnText: { fontWeight: '700', fontSize: 13 },

  // Date
  dateRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: colors.cardSolid, borderRadius: 14, padding: 12,
    marginBottom: 18, borderWidth: 1, borderColor: colors.border,
  },
  dateIconWrap: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  dateLabel: { color: colors.textMuted, fontSize: 10, fontWeight: '700', letterSpacing: 0.8, marginBottom: 1 },
  dateValue: { color: colors.text, fontWeight: '600', fontSize: 14 },

  // Category
  sectionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  sectionLabel: { color: colors.textMuted, fontSize: 11, fontWeight: '700', letterSpacing: 1 },
  newCatBtn: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  newCatText: { fontWeight: '700', fontSize: 12 },
  categoryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 18 },
  categoryPill: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingVertical: 8, paddingHorizontal: 12, borderRadius: 18,
    borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.cardSolid,
  },
  categoryText: { fontWeight: '600', fontSize: 13 },

  // Notes
  notesInput: {
    backgroundColor: colors.cardSolid, color: colors.text,
    padding: 14, borderRadius: 12, borderWidth: 1, borderColor: colors.border,
    fontSize: 14, textAlignVertical: 'top', minHeight: 72, marginTop: 8, marginBottom: 22,
  },

  // Save
  saveBtn: { borderRadius: 16, overflow: 'hidden', elevation: 6, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.25, shadowRadius: 8 },
  saveGradient: { flexDirection: 'row', padding: 16, alignItems: 'center', justifyContent: 'center', gap: 8 },
  saveText: { color: '#fff', fontWeight: '800', fontSize: 16, letterSpacing: 0.3 },

  // Modal
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'center', padding: 20 },
  modalCard: { padding: 20 },
  modalTitle: { color: colors.text, fontSize: 17, fontWeight: '700', marginBottom: 16 },
  modalInput: {
    backgroundColor: colors.background, color: colors.text,
    padding: 14, borderRadius: 12, borderWidth: 1, borderColor: colors.border,
    fontSize: 15, marginBottom: 16,
  },
  iconGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingBottom: 8 },
  iconOption: {
    width: 46, height: 46, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.cardSolid, borderWidth: 1.5, borderColor: colors.border,
  },
  modalBtns: { flexDirection: 'row', gap: 10, marginTop: 16 },
  cancelBtn: { flex: 1, padding: 12, borderRadius: 12, borderWidth: 1, borderColor: colors.border, alignItems: 'center' },
  cancelText: { color: colors.textSecondary, fontWeight: '600', fontSize: 14 },
  createBtn: { flex: 1, padding: 12, borderRadius: 12, alignItems: 'center' },
  createText: { color: '#fff', fontWeight: '700', fontSize: 14 },
});
