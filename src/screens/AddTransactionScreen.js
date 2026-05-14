import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Modal,
  Alert,
  ActivityIndicator,
  LayoutAnimation,
  UIManager,
} from 'react-native';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}
import { SafeAreaView } from 'react-native-safe-area-context';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';

import {
  addTransaction,
  updateTransaction,
  getTransactionById,
  addCategory,
  getCategories,
  SUPPORTED_CURRENCIES,
} from '../services/transactionService';
import { getAppSettings } from '../database/db';
import { useFocusEffect } from '@react-navigation/native';
import FadeInView from '../components/FadeInView';
import AmbientBackground from '../components/AmbientBackground';
import GlassCard from '../components/GlassCard';
import Toast from '../components/Toast';
import { ICON_OPTIONS } from '../constants/Icons';

export default function AddTransactionScreen({ navigation, route }) {
  const routeParams = route.params || {};
  const type = routeParams.type ?? 'expense';
  const transactionId = routeParams.transactionId;
  const isEdit = routeParams.mode === 'edit' && transactionId != null;

  const isIncome = type === 'income';
  const isInvestment = type === 'investment';
  const saveLockRef = useRef(false);


  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState(null); // Changed from 'AED' to null
  const [date, setDate] = useState(new Date());

  const [category, setCategory] = useState('');
  const [notes, setNotes] = useState('');
  const [availableCategories, setAvailableCategories] = useState([]);

  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);
  const [categorySearch, setCategorySearch] = useState('');

  const [newCategoryName, setNewCategoryName] = useState('');
  const [newCategoryIcon, setNewCategoryIcon] = useState('ellipse-outline');
  const [toastVisible, setToastVisible] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [showValidation, setShowValidation] = useState(false);
  const [currencyMode, setCurrencyMode] = useState('AED');


  const accentColor = isIncome ? colors.success : (isInvestment ? colors.accentIndigo : colors.danger);


  useEffect(() => {
    setAvailableCategories(getCategories(type));
  }, [type]);



  useEffect(() => {
    if (isEdit) {
      const t = getTransactionById(type, transactionId);
      if (!t) {
        Alert.alert('Not found', 'This entry could not be loaded.', [{ text: 'OK', onPress: () => navigation.goBack() }]);
        return;
      }
      setAmount(String(t.amount));
      setCurrency(t.currency || 'AED');
      setDate(new Date(t.date));
      setCategory(t.category || '');
      setNotes(t.notes ?? '');
      return;
    }
    
    // Default / Reset Mode
    setAmount('');
    setDate(new Date());
    setCategory('');
    setNotes('');
    saveLockRef.current = false;
    setIsSaving(false);

    // Load currency preference
    const settings = getAppSettings();
    if (settings?.default_currency_mode) {
      setCurrencyMode(settings.default_currency_mode);
      if (settings.default_currency_mode === 'INR') setCurrency('INR');
      else if (settings.default_currency_mode === 'AED') setCurrency('AED');
      else setCurrency(null);
    } else {
      setCurrency('AED'); // Legacy default
    }
  }, [isEdit, transactionId, type]);


  useEffect(() => {
    if (isEdit || availableCategories.length === 0) return;
    setCategory((prev) => (prev ? prev : availableCategories[0].name));
  }, [availableCategories, isEdit]);

  const formatDate = (d) =>
    d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });

  const handleSave = () => {
    if (saveLockRef.current || isSaving) return;

    if (!amount || isNaN(amount) || parseFloat(amount) <= 0) {
      Alert.alert('Invalid Amount', 'Please enter a valid amount greater than 0.');
      return;
    }
    if (!currency) {
      setShowValidation(true);
      setToastMessage('Please select a currency');
      setToastVisible(true);
      return;
    }
    if (!category) {
      Alert.alert('No Category', 'Please select a category.');
      return;
    }

    // Prevent future dates
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    if (date > today) {
      Alert.alert('Invalid Date', 'Transactions cannot be recorded for future dates.');
      return;
    }



    saveLockRef.current = true;
    setIsSaving(true);

    try {
      const isoDate = date.toISOString();
      if (isEdit) {
        updateTransaction(type, transactionId, {
          amount,
          currency,
          date: isoDate,
          category,
          notes,
        });
        setToastMessage(isIncome ? '✓ Income updated' : '✓ Expense updated');
      } else {
        addTransaction(type, amount, currency, isoDate, category, notes);
        setToastMessage(isIncome ? '✓ Income Added Successfully' : '✓ Expense Saved');
      }
      setToastVisible(true);
      setTimeout(() => {
        saveLockRef.current = false;
        setIsSaving(false);
        navigation.goBack();
      }, 2400);
    } catch (e) {
      saveLockRef.current = false;
      setIsSaving(false);
      Alert.alert('Error', 'Failed to save: ' + e.message);
    }
  };

  const handleAddCategory = () => {
    try {
      addCategory(newCategoryName, type, newCategoryIcon);
      setShowCategoryModal(false);
      const name = newCategoryName.trim();
      setNewCategoryName('');
      setNewCategoryIcon('ellipse-outline');
      setAvailableCategories(getCategories(type));
      setCategory(name);
    } catch (e) {
      Alert.alert('Error', e.message);
    }
  };

  const screenTitle =
    type === 'income' ? (isEdit ? 'Edit Income' : 'Add Income') : (type === 'investment' ? (isEdit ? 'Edit Investment' : 'Add Investment') : (isEdit ? 'Edit Expense' : 'Add Expense'));


  return (
    <AmbientBackground>
      <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
        <Toast message={toastMessage} type={isIncome ? 'success' : 'error'} visible={toastVisible} onHide={() => setToastVisible(false)} />

        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.container}>
          <View style={styles.header}>
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
              <Ionicons name="arrow-back" size={22} color={colors.text} />
            </TouchableOpacity>
            <Text style={styles.title}>{screenTitle}</Text>
            <View style={styles.headerSpacer} />
          </View>

          <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
            <FadeInView delay={0}>
              <GlassCard style={styles.amountCard}>
                <LinearGradient
                  colors={
                    isIncome
                      ? ['rgba(16, 185, 129, 0.18)', 'rgba(20, 184, 166, 0.05)']
                      : (isInvestment ? ['rgba(99, 102, 241, 0.18)', 'rgba(79, 70, 229, 0.05)'] : ['rgba(239, 68, 68, 0.18)', 'rgba(248, 113, 113, 0.05)'])

                  }
                  style={StyleSheet.absoluteFillObject}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                />
                <Text style={styles.fieldLabel}>AMOUNT</Text>
                <TextInput
                  style={[styles.amountInput, { color: accentColor }]}
                  placeholder="0.00"
                  placeholderTextColor={colors.textMuted}
                  keyboardType="decimal-pad"
                  value={amount}
                  onChangeText={setAmount}
                  autoFocus={!isEdit}
                  editable={!isSaving}
                  adjustsFontSizeToFit
                  numberOfLines={1}
                />
                <View style={[styles.currencyRow, showValidation && !currency && styles.invalidRow]}>
                  {SUPPORTED_CURRENCIES.map((cur) => {
                    const isSelected = currency === cur;
                    return (
                      <TouchableOpacity
                        key={cur}
                        activeOpacity={0.7}
                        style={[
                          styles.currencyBtn,
                          isSelected && {
                            borderColor: accentColor,
                            backgroundColor: accentColor + '25',
                            transform: [{ scale: 1.05 }]
                          },
                        ]}
                        onPress={() => {
                          if (Platform.OS === 'android' || Platform.OS === 'ios') {
                            LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                          }
                          setCurrency(cur);
                          setShowValidation(false);
                        }}
                        disabled={isSaving}
                      >
                        <Text
                          style={[
                            styles.currencyBtnText,
                            { color: isSelected ? accentColor : colors.textSecondary },
                            isSelected && { fontWeight: '800' }
                          ]}
                        >
                          {cur}
                        </Text>
                        {isSelected && (
                          <View style={[styles.activeDot, { backgroundColor: accentColor }]} />
                        )}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </GlassCard>

            </FadeInView>

            <FadeInView delay={80}>
              <TouchableOpacity
                style={styles.dateRow}
                activeOpacity={0.7}
                onPress={() => !isSaving && setShowDatePicker(true)}
                disabled={isSaving}
              >
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
                  maximumDate={new Date()}
                  onChange={(event, selected) => {
                    setShowDatePicker(Platform.OS === 'ios');
                    if (selected) setDate(selected);
                  }}
                />

              )}
            </FadeInView>

            <FadeInView delay={160} style={{ marginBottom: 20 }}>

              <View style={styles.sectionRow}>
                <Text style={styles.sectionLabel}>CATEGORY</Text>
                <TouchableOpacity style={styles.newCatBtn} onPress={() => setShowCategoryModal(true)} disabled={isSaving}>
                  <Ionicons name="add" size={14} color={accentColor} />
                  <Text style={[styles.newCatText, { color: accentColor }]}>New</Text>
                </TouchableOpacity>
              </View>
              
              <TouchableOpacity 
                style={[styles.categorySelectBtn, !category && styles.invalidBtn]} 
                onPress={() => setShowCategoryPicker(true)}
                disabled={isSaving}
              >
                <View style={styles.categorySelectLeft}>
                  {category ? (
                    <>
                      <Ionicons 
                        name={availableCategories.find(c => c.name === category)?.icon || 'ellipse-outline'} 
                        size={18} 
                        color={accentColor} 
                      />
                      <Text style={styles.selectedCategoryText}>{category}</Text>
                    </>
                  ) : (
                    <Text style={styles.placeholderText}>Select Category</Text>
                  )}
                </View>
                <Ionicons name="chevron-down" size={18} color={colors.textMuted} />
              </TouchableOpacity>
            </FadeInView>


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
                editable={!isSaving}
              />
            </FadeInView>

            <FadeInView delay={320}>
              <TouchableOpacity
                style={[styles.saveBtn, isSaving && { opacity: 0.92 }]}
                activeOpacity={0.85}
                onPress={handleSave}
                disabled={isSaving}
              >
                <LinearGradient
                  colors={isIncome ? [colors.primary, colors.primaryDark] : (isInvestment ? [colors.accentIndigo, '#4F46E5'] : [colors.dangerLight, colors.danger])}

                  style={styles.saveGradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                >
                  {isSaving ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <Ionicons
                      name={isIncome ? 'arrow-down-circle-outline' : (isInvestment ? 'briefcase-outline' : 'arrow-up-circle-outline')}

                      size={20}
                      color="#fff"
                    />
                  )}
                  <Text style={styles.saveText}>
                    {isSaving ? 'Saving…' : isEdit ? 'Save changes' : `Save ${isIncome ? 'Income' : (isInvestment ? 'Investment' : 'Expense')}`}
                  </Text>
                </LinearGradient>
              </TouchableOpacity>
            </FadeInView>
          </ScrollView>
        </KeyboardAvoidingView>

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

              <Text style={[styles.sectionLabel, { marginBottom: 10 }]}>PICK AN ICON</Text>
              <ScrollView style={{ maxHeight: 200 }} nestedScrollEnabled>
                <View style={styles.iconGrid}>
                  {ICON_OPTIONS.map((iconName) => (
                    <TouchableOpacity
                      key={iconName}
                      activeOpacity={0.7}
                      style={[
                        styles.iconOption,
                        newCategoryIcon === iconName && {
                          backgroundColor: accentColor + '30',
                          borderColor: accentColor,
                        },
                      ]}
                      onPress={() => setNewCategoryIcon(iconName)}
                    >
                      <Ionicons
                        name={iconName}
                        size={22}
                        color={newCategoryIcon === iconName ? accentColor : colors.textSecondary}
                      />
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>

              <View style={styles.modalBtns}>
                <TouchableOpacity
                  style={styles.cancelBtn}
                  onPress={() => {
                    setShowCategoryModal(false);
                    setNewCategoryName('');
                  }}
                >
                  <Text style={styles.cancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.createBtn, { backgroundColor: accentColor }]} onPress={handleAddCategory}>
                  <Text style={styles.createText}>Create</Text>
                </TouchableOpacity>
              </View>
            </GlassCard>
          </View>
        </Modal>

        {/* Category Picker Modal */}
        <Modal visible={showCategoryPicker} transparent animationType="slide">
          <View style={styles.overlay}>
            <GlassCard style={styles.pickerModal} contentStyle={{ flex: 1 }}>

              <View style={styles.pickerHeader}>
                <Text style={styles.modalTitle}>Select Category</Text>
                <TouchableOpacity onPress={() => setShowCategoryPicker(false)}>
                  <Ionicons name="close" size={24} color={colors.text} />
                </TouchableOpacity>
              </View>

              <View style={styles.searchBar}>
                <Ionicons name="search" size={18} color={colors.textMuted} />
                <TextInput
                  style={styles.searchInput}
                  placeholder="Search categories..."
                  placeholderTextColor={colors.textMuted}
                  value={categorySearch}
                  onChangeText={setCategorySearch}
                  autoFocus
                  returnKeyType="search"
                />
              </View>


              <ScrollView style={styles.pickerList} keyboardShouldPersistTaps="handled">
                {availableCategories.filter(c => c.name.toLowerCase().includes(categorySearch.toLowerCase())).length === 0 ? (
                  <View style={{ alignItems: 'center', marginTop: 40 }}>
                    <Ionicons name="search-outline" size={40} color={colors.textMuted} />
                    <Text style={{ ...typography.bodySmall, marginTop: 10 }}>No categories found</Text>
                  </View>
                ) : (
                  availableCategories
                    .filter(c => c.name.toLowerCase().includes(categorySearch.toLowerCase()))
                    .map((cat) => (
                      <TouchableOpacity
                        key={cat.name}
                        style={[styles.pickerItem, category === cat.name && styles.pickerItemActive]}
                        onPress={() => {
                          setCategory(cat.name);
                          setShowCategoryPicker(false);
                          setCategorySearch('');
                        }}
                      >
                        <View style={[styles.pickerIcon, { backgroundColor: (category === cat.name ? accentColor : colors.textMuted) + '20' }]}>
                          <Ionicons name={cat.icon || 'ellipse-outline'} size={20} color={category === cat.name ? accentColor : colors.textMuted} />
                        </View>
                        <Text style={[styles.pickerItemText, category === cat.name && { color: accentColor, fontWeight: '700' }]}>
                          {cat.name}
                        </Text>
                        {category === cat.name && <Ionicons name="checkmark-circle" size={20} color={accentColor} />}
                      </TouchableOpacity>
                    ))
                )}
              </ScrollView>

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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingTop: 4,
    paddingBottom: 12,
  },
  backBtn: { width: 36, height: 36, justifyContent: 'center' },
  headerSpacer: { width: 36 },
  title: { fontSize: 18, color: colors.text, fontWeight: '700' },
  scroll: { paddingHorizontal: 18, paddingBottom: 36 },

  amountCard: { padding: 20, marginBottom: 12, overflow: 'hidden' },
  fieldLabel: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
    marginBottom: 6,
  },
  amountInput: {
    fontSize: 46,
    fontWeight: '800',
    letterSpacing: -1,
    marginBottom: 14,
  },
  currencyRow: { flexDirection: 'row', gap: 8 },
  currencyBtn: {
    paddingVertical: 8,
    paddingHorizontal: 20,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.cardSolid,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6
  },
  currencyBtnText: { fontWeight: '700', fontSize: 13 },
  activeDot: { width: 4, height: 4, borderRadius: 2 },
  invalidRow: { 
    borderWidth: 1, 
    borderColor: colors.danger + '80', 
    borderRadius: 18, 
    padding: 2,
    backgroundColor: colors.danger + '05'
  },


  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.cardSolid,
    borderRadius: 14,
    padding: 12,
    marginBottom: 18,
    borderWidth: 1,
    borderColor: colors.border,
  },
  dateIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dateLabel: {
    color: colors.textMuted,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.8,
    marginBottom: 1,
  },
  dateValue: { color: colors.text, fontWeight: '600', fontSize: 14 },

  sectionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  sectionLabel: { color: colors.textMuted, fontSize: 11, fontWeight: '700', letterSpacing: 1 },
  newCatBtn: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  newCatText: { fontWeight: '700', fontSize: 12 },
  categoryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 18 },
  categoryPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.cardSolid,
  },
  categoryText: { fontWeight: '600', fontSize: 13 },

  notesInput: {
    backgroundColor: colors.cardSolid,
    color: colors.text,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    fontSize: 14,
    textAlignVertical: 'top',
    minHeight: 72,
    marginTop: 8,
    marginBottom: 22,
  },

  saveBtn: {
    borderRadius: 16,
    overflow: 'hidden',
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
  },
  saveGradient: {
    flexDirection: 'row',
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  saveText: { color: '#fff', fontWeight: '800', fontSize: 16, letterSpacing: 0.3 },

  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'center',
    padding: 20,
  },
  modalCard: { padding: 20 },
  modalTitle: { color: colors.text, fontSize: 17, fontWeight: '700', marginBottom: 16 },
  modalInput: {
    backgroundColor: colors.background,
    color: colors.text,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    fontSize: 15,
    marginBottom: 16,
  },
  iconGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingBottom: 8 },
  iconOption: {
    width: 46,
    height: 46,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.cardSolid,
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  modalBtns: { flexDirection: 'row', gap: 10, marginTop: 16 },
  cancelBtn: {
    flex: 1,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  cancelText: { color: colors.textSecondary, fontWeight: '600', fontSize: 14 },
  createBtn: { flex: 1, padding: 12, borderRadius: 12, alignItems: 'center' },
  createText: { color: '#fff', fontWeight: '700', fontSize: 14 },

  categorySelectBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.cardSolid,
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderWidth: 1.5,
    borderColor: colors.border,
    marginTop: 8
  },
  categorySelectLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  selectedCategoryText: { ...typography.bodyMedium, fontWeight: '600' },
  placeholderText: { ...typography.bodyMedium, color: colors.textMuted },
  invalidBtn: { borderColor: colors.danger + '50' },

  pickerModal: { height: '80%', padding: 20 },
  pickerHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  searchBar: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    backgroundColor: 'rgba(255,255,255,0.05)', 
    borderRadius: 12, 
    paddingHorizontal: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.border
  },
  searchInput: { flex: 1, paddingVertical: 10, paddingHorizontal: 8, color: colors.text, fontSize: 15 },
  pickerList: { flex: 1 },
  pickerItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.border + '50' },
  pickerItemActive: { backgroundColor: colors.primary + '05' },
  pickerIcon: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  pickerItemText: { ...typography.bodyMedium, flex: 1 },
});

