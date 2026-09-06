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
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';

import {
  addTransaction,
  updateTransaction,
  getTransactionById,
  addCategory,
  getCategories,
  SUPPORTED_CURRENCIES,
  addInvestment,
  addContribution,
  getInvestments,
  updateContribution,
  getCreditCards,
  updateMasterInvestment,
} from '../services/transactionService';
import { getAppSettings, getDb, getActiveCurrencies } from '../database/db';
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
  const preSelectedInvestmentId = routeParams.investmentId;
  const isInvestment = type === 'investment';

  // Smart default for mode if not explicitly passed:
  // 1. If transactionId is present -> mode defaults to 'edit'
  // 2. If investmentId is present (and no transactionId) -> mode defaults to 'contribution'
  // 3. Otherwise for investment -> mode defaults to 'setup' (master investment setup)
  const mode = routeParams.mode || (
    transactionId != null 
      ? 'edit' 
      : (preSelectedInvestmentId != null 
          ? (isInvestment ? 'contribution' : 'create')
          : (isInvestment ? 'setup' : 'create'))
  );

  const isEdit = (mode === 'edit' || mode === 'editSetup' || mode === 'editContribution') && (transactionId != null || preSelectedInvestmentId != null);

  const isContribution = isInvestment && (
    mode === 'contribution' || 
    mode === 'editContribution' || 
    (mode === 'edit' && transactionId != null)
  );

  const isMasterSetup = isInvestment && !isContribution;

  const OWNER_OPTIONS = [
    { label: '👩🏻 Prathista', value: 'SELF' },
    { label: '👦🏻 Praveen', value: 'SPOUSE' },
    { label: '👥 Others', value: 'OTHER' }
  ];

  const isIncome = type === 'income';
  const saveLockRef = useRef(false);


  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState(null);
  const [date, setDate] = useState(new Date());

  const [category, setCategory] = useState('');
  const [notes, setNotes] = useState('');
  const [attachmentUris, setAttachmentUris] = useState([]);

  // Investment Fields
  const [invName, setInvName] = useState('');
  const [tenureValue, setTenureValue] = useState('');
  const [tenureType, setTenureType] = useState('Months');
  const [targetAmount, setTargetAmount] = useState('');
  const [selectedInvestmentId, setSelectedInvestmentId] = useState(preSelectedInvestmentId || null);
  const [activeInvestments, setActiveInvestments] = useState([]);
  
  const [isExistingRecord, setIsExistingRecord] = useState(false);
  const [completedInstallments, setCompletedInstallments] = useState('');
  const [alreadyInvested, setAlreadyInvested] = useState('');

  const [availableCategories, setAvailableCategories] = useState([]);

  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);
  const [showInvestmentPicker, setShowInvestmentPicker] = useState(false);
  const [showCreditCardPicker, setShowCreditCardPicker] = useState(false);
  const [categorySearch, setCategorySearch] = useState('');
  const [creditCardSearch, setCreditCardSearch] = useState('');

  const [newCategoryName, setNewCategoryName] = useState('');
  const [newCategoryIcon, setNewCategoryIcon] = useState('ellipse-outline');
  const [toastVisible, setToastVisible] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [showValidation, setShowValidation] = useState(false);
  const [currencyMode, setCurrencyMode] = useState('AED');
  const [ownership, setOwnership] = useState('OTHER');
  const [paymentSource, setPaymentSource] = useState('Debit Card');
  const [creditCardId, setCreditCardId] = useState(null);
  const [activeCreditCards, setActiveCreditCards] = useState([]);


  const accentColor = isIncome ? colors.success : (isInvestment ? colors.accentIndigo : colors.danger);


  useFocusEffect(
    React.useCallback(() => {
      setAvailableCategories(getCategories(type));
      if (isInvestment) {
        setActiveInvestments(getInvestments('All'));
      }
      if (!isIncome) {
        setActiveCreditCards(getCreditCards(true)); // only active cards
      }
    }, [type, isInvestment])
  );

  useEffect(() => {
    if (isExistingRecord && amount && completedInstallments) {
      const amt = parseFloat(amount) || 0;
      const comp = parseInt(completedInstallments, 10) || 0;
      setAlreadyInvested(String(amt * comp));
    }
  }, [amount, completedInstallments, isExistingRecord]);



  useEffect(() => {
    if (mode === 'editSetup' && preSelectedInvestmentId) {
      const master = getDb().getFirstSync(`SELECT * FROM investments WHERE id = ?`, [preSelectedInvestmentId]);
      if (master) {
        setInvName(master.name || '');
        setCategory(master.type || '');
        setTenureValue(String(master.tenure_value || ''));
        setTenureType(master.tenure_type || 'Months');
        setTargetAmount(master.target_amount ? String(master.target_amount) : '');
        setOwnership(master.funded_by || 'OTHER');
        setDate(new Date(master.start_date || new Date()));
        setNotes(master.notes || '');

        setAmount(String(master.recurring_amount || ''));
      }
      return;
    }

    if (isEdit) {
      const t = getTransactionById(type, transactionId);
      if (!t) {
        Alert.alert('Not found', 'This entry could not be loaded.', [{ text: 'OK', onPress: () => navigation.goBack() }]);
        return;
      }
      setAmount(String(t.amount));
      setCurrency(t.currency || 'AED');
      setDate(new Date(t.date || t.contribution_date));
      if (isInvestment) {
        setSelectedInvestmentId(t.investment_id);
        const master = getDb().getFirstSync(`SELECT * FROM investments WHERE id = ?`, [t.investment_id]);
        if (master) {
          setInvName(master.name || '');
          setCategory(master.type || '');
          setTenureValue(String(master.tenure_value || ''));
          setTenureType(master.tenure_type || 'Months');
          setTargetAmount(master.target_amount ? String(master.target_amount) : '');
          setOwnership(t.funded_by || 'OTHER');
        }
      } else {
        setCategory(t.category || '');
        setOwnership(t.income_source || t.funded_by || 'OTHER');
      }

      setPaymentSource(t.payment_source || 'Debit Card');
      setCreditCardId(t.credit_card_id || null);
      
      // If editing a credit card transaction, ensure the card is available in the list 
      // even if it's inactive now, so we need to fetch all cards just for this.
      if (t.payment_source === 'Credit Card' && t.credit_card_id) {
        const allCards = getCreditCards(false);
        const theCard = allCards.find(c => c.id === t.credit_card_id);
        if (theCard && theCard.status === 'Inactive') {
          setActiveCreditCards(prev => {
            if (!prev.find(c => c.id === theCard.id)) {
              return [...prev, theCard];
            }
            return prev;
          });
        }
      }
      setNotes(t.notes ?? '');
      try {
        if (t.attachment_uri) setAttachmentUris(JSON.parse(t.attachment_uri));
        else setAttachmentUris([]);
      } catch (e) { setAttachmentUris([]); }
      return;
    }

    // Pre-populate from master when adding a new contribution
    if (mode === 'contribution' && preSelectedInvestmentId) {
      const master = getDb().getFirstSync(`SELECT * FROM investments WHERE id = ?`, [preSelectedInvestmentId]);
      if (master) {
        setInvName(master.name || '');
        setOwnership(master.funded_by || 'OTHER');
        setCurrency(master.currency || 'AED');
        setSelectedInvestmentId(preSelectedInvestmentId);
      }
      setDate(new Date());
      setAmount('');
      setNotes('');
      setAttachmentUris([]);
      setPaymentSource('Debit Card');
      setCreditCardId(null);
      saveLockRef.current = false;
      setIsSaving(false);
      return;
    }

    // Default / Reset Mode
    setAmount('');
    setDate(new Date());
    setCategory('');
    setNotes('');
    setOwnership('OTHER');
    setAttachmentUris([]);
    saveLockRef.current = false;
    setIsSaving(false);

    // Load currency preference
    const settings = getAppSettings();
    const active = getActiveCurrencies();
    const defaultCur = settings?.default_currency_mode;
    if (defaultCur === 'ask') {
      setCurrencyMode('ask');
      setCurrency(null);
    } else if (defaultCur && active.includes(defaultCur)) {
      setCurrencyMode(defaultCur);
      setCurrency(defaultCur);
    } else if (active.length > 0) {
      setCurrencyMode(active[0]);
      setCurrency(active[0]);
    } else {
      setCurrencyMode('AED');
      setCurrency('AED');
    }
  }, [isEdit, transactionId, type]);


  useEffect(() => {
    if (isEdit || availableCategories.length === 0) return;
    if (isInvestment && (mode === 'setup' || mode === 'editSetup')) {
      setCategory('Investment'); // Default for setup
    } else {
      setCategory((prev) => (prev ? prev : availableCategories[0].name));
    }
  }, [availableCategories, isEdit, isInvestment, mode]);

  const formatDate = (d) =>
    d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });

  const pickImage = async () => {
    if (attachmentUris.length >= 3) {
      Alert.alert('Limit Reached', 'You can only add up to 3 attachments.');
      return;
    }
    
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.5,
    });

    if (!result.canceled && result.assets && result.assets.length > 0) {
      const sourceUri = result.assets[0].uri;
      const filename = sourceUri.split('/').pop();
      const destUri = FileSystem.documentDirectory + filename;
      
      try {
        await FileSystem.copyAsync({ from: sourceUri, to: destUri });
        setAttachmentUris([...attachmentUris, destUri]);
      } catch (e) {
        Alert.alert('Error', 'Failed to save image locally.');
      }
    }
  };

  const handleSave = () => {
    if (saveLockRef.current || isSaving) return;

    if (!amount || isNaN(amount) || parseFloat(amount) <= 0) {
      Alert.alert('Invalid Amount', 'Please enter a valid amount.');
      return;
    }
    if (!currency) {
      setToastMessage('Please select a currency');
      setToastVisible(true);
      return;
    }

    if (isInvestment) {
      if (mode === 'setup' || mode === 'editSetup') {
        if (!invName) { Alert.alert('Missing Name', 'Please enter investment name.'); return; }
        if (!tenureValue) { Alert.alert('Missing Tenure', 'Please enter tenure.'); return; }
      } else if (mode === 'contribution' || mode === 'edit') {
        if (!selectedInvestmentId) { Alert.alert('No Investment', 'Please select an investment.'); return; }
      }
    } else {
      if (!category) { Alert.alert('No Category', 'Please select a category.'); return; }
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
      const attachmentStr = attachmentUris.length > 0 ? JSON.stringify(attachmentUris) : null;

      if (isEdit) {
        if (isContribution) {
          updateContribution(transactionId, {
            amount,
            date: isoDate,
            notes,
            attachmentUri: attachmentStr,
            paymentSource: paymentSource,
            creditCardId: paymentSource === 'Credit Card' ? creditCardId : null,
            funded_by: ownership
          });
          setToastMessage('✓ Contribution updated successfully');
        } else if (isMasterSetup) {
          updateMasterInvestment(preSelectedInvestmentId, {
            name: invName,
            type: category,
            recurringAmount: amount ? parseFloat(amount) : 0,
            startDate: isoDate,
            tenureValue: parseInt(tenureValue),
            tenureType: tenureType,
            targetAmount: targetAmount ? parseFloat(targetAmount) : null,
            notes,
            funded_by: ownership
          });
          setToastMessage('✓ Investment updated successfully');
        } else {
          updateTransaction(type, transactionId, {
            amount,
            currency,
            date: isoDate,
            category,
            notes,
            attachmentUri: attachmentStr,
            owner: ownership,
            paymentSource: type === 'expense' ? paymentSource : undefined,
            creditCardId: type === 'expense' && paymentSource === 'Credit Card' ? creditCardId : null,
          });
          setToastMessage('✓ Entry updated successfully');
        }
      } else if (isInvestment) {
        if (isMasterSetup) {
          addInvestment({
            name: invName,
            type: category, 
            currency,
            recurring_amount: amount,
            start_date: isoDate,
            tenure_value: parseInt(tenureValue),
            tenure_type: tenureType,
            target_amount: targetAmount ? parseFloat(targetAmount) : null,
            notes,
            funded_by: ownership,
            payment_source: paymentSource,
            credit_card_id: paymentSource === 'Credit Card' ? creditCardId : null,
            is_existing: isExistingRecord,
            completed_installments: completedInstallments,
            already_invested: alreadyInvested
          });
          setToastMessage('✓ Investment saved successfully');
        } else {
          addContribution(selectedInvestmentId, amount, isoDate, notes, attachmentStr, paymentSource, paymentSource === 'Credit Card' ? creditCardId : null, ownership);
          setToastMessage('✓ Contribution added successfully');
        }
      } else {
        if (type === 'expense') {
          addTransaction(type, amount, currency, isoDate, category, notes, attachmentStr, ownership, paymentSource, paymentSource === 'Credit Card' ? creditCardId : null);
        } else {
          addTransaction(type, amount, currency, isoDate, category, notes, attachmentStr, ownership);
        }
        setToastMessage(isIncome ? '✓ Income saved successfully' : '✓ Expense saved successfully');
      }
      
      setToastVisible(true);
      setTimeout(() => {
        saveLockRef.current = false;
        setIsSaving(false);
        navigation.goBack();
      }, 2000);
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

  const screenTitle = isInvestment 
    ? (isMasterSetup ? (mode === 'editSetup' ? 'Edit Investment' : 'Setup Investment') : (isEdit ? 'Edit Contribution' : 'Add Contribution'))
    : (isIncome ? (isEdit ? 'Edit Income' : 'Add Income') : (isEdit ? 'Edit Expense' : 'Add Expense'));

  return (
    <AmbientBackground>
      <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
        <Toast message={toastMessage} type={isIncome ? 'success' : isInvestment ? 'success' : 'error'} visible={toastVisible} onHide={() => setToastVisible(false)} />

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

                <Text style={styles.fieldLabel}>
                  {isMasterSetup 
                    ? (isExistingRecord ? 'MONTHLY AMOUNT' : 'RECURRING AMOUNT') 
                    : 'AMOUNT'}
                </Text>
                <TextInput
                  style={[styles.amountInput, { color: accentColor }, isSaving && { opacity: 0.7 }]}
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
                {!isContribution && (
                  <View style={[styles.currencyRow, showValidation && !currency && styles.invalidRow]}>
                    {getActiveCurrencies().map((cur) => {
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
                            LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                            setCurrency(cur);
                            setShowValidation(false);
                          }}
                          disabled={isSaving}
                        >
                          <Text style={[styles.currencyBtnText, { color: isSelected ? accentColor : colors.textSecondary }, isSelected && { fontFamily: 'Inter_800ExtraBold' }]}>{cur}</Text>
                          {isSelected && <View style={[styles.activeDot, { backgroundColor: accentColor }]} />}
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                )}
                {isContribution && currency && (
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 8, gap: 6 }}>
                    <View style={[styles.currencyBtn, { borderColor: accentColor, backgroundColor: accentColor + '25' }]}>
                      <Text style={[styles.currencyBtnText, { color: accentColor, fontFamily: 'Inter_800ExtraBold' }]}>{currency}</Text>
                    </View>
                    <Text style={{ color: colors.textMuted, fontSize: 11, fontFamily: 'Inter_400Regular' }}>Currency inherited from investment</Text>
                  </View>
                )}
              </GlassCard>
            </FadeInView>

            {/* Investment Specific Fields */}
            {isMasterSetup && (
              <FadeInView delay={50}>
                <Text style={styles.sectionLabel}>INVESTMENT NAME</Text>
                <TextInput
                  style={styles.notesInput}
                  placeholder="e.g. Life Insurance, Mutual Fund"
                  placeholderTextColor={colors.textMuted}
                  value={invName}
                  onChangeText={setInvName}
                  editable={!isSaving}
                />

                <View style={{ flexDirection: 'row', gap: 12, marginBottom: 18 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.sectionLabel}>TENURE</Text>
                    <TextInput
                      style={[styles.notesInput, { marginTop: 8, marginBottom: 0 }]}
                      placeholder="e.g. 11"
                      placeholderTextColor={colors.textMuted}
                      keyboardType="number-pad"
                      value={tenureValue}
                      onChangeText={setTenureValue}
                      editable={!isSaving}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.sectionLabel}>TYPE</Text>
                    <View style={styles.typeToggleRow}>
                      {['Months', 'Years'].map(t => (
                        <TouchableOpacity 
                          key={t} 
                          style={[styles.typeBtn, tenureType === t && styles.typeBtnActive]}
                          onPress={() => setTenureType(t)}
                        >
                          <Text style={[styles.typeText, tenureType === t && styles.typeTextActive]}>{t}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                </View>

                {mode === 'setup' && (
                  <View style={{ marginBottom: 18 }}>
                    <View style={styles.toggleRow}>
                      <TouchableOpacity
                        style={[styles.typeBtn, isExistingRecord && styles.typeBtnActive, { flex: undefined, paddingHorizontal: 20 }]}
                        onPress={() => {
                          LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                          setIsExistingRecord(!isExistingRecord);
                        }}
                        disabled={isSaving}
                      >
                        <Text style={[styles.typeText, isExistingRecord && styles.typeTextActive]}>
                          {isExistingRecord ? 'Existing Record (Yes)' : 'Existing Record (No)'}
                        </Text>
                      </TouchableOpacity>
                    </View>
                    {isExistingRecord && (
                      <View style={{ marginTop: 8, padding: 12, backgroundColor: 'rgba(99, 102, 241, 0.1)', borderRadius: 8, borderWidth: 1, borderColor: 'rgba(99, 102, 241, 0.3)' }}>
                        <Text style={{ color: '#4F46E5', fontSize: 11, fontFamily: 'Inter_500Medium' }}>
                          Already completed installments won't affect your balance or reports. Only future installments will be tracked normally.
                        </Text>
                      </View>
                    )}
                  </View>
                )}

                {isExistingRecord && (
                  <View style={{ flexDirection: 'row', gap: 12, marginBottom: 18 }}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.sectionLabel}>COMPLETED INSTALLMENTS</Text>
                      <TextInput
                        style={[styles.notesInput, { marginTop: 8, marginBottom: 0 }]}
                        placeholder="e.g. 3"
                        placeholderTextColor={colors.textMuted}
                        keyboardType="number-pad"
                        value={completedInstallments}
                        onChangeText={setCompletedInstallments}
                        editable={!isSaving}
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.sectionLabel}>ALREADY INVESTED</Text>
                      <TextInput
                        style={[styles.notesInput, { marginTop: 8, marginBottom: 0 }]}
                        placeholder="0.00"
                        placeholderTextColor={colors.textMuted}
                        keyboardType="decimal-pad"
                        value={alreadyInvested}
                        onChangeText={setAlreadyInvested}
                        editable={!isSaving}
                      />
                    </View>
                  </View>
                )}

                <Text style={styles.sectionLabel}>TARGET AMOUNT (OPTIONAL)</Text>
                <TextInput
                  style={styles.notesInput}
                  placeholder="e.g. 50000"
                  placeholderTextColor={colors.textMuted}
                  keyboardType="decimal-pad"
                  value={targetAmount}
                  onChangeText={setTargetAmount}
                  editable={!isSaving}
                />
              </FadeInView>
            )}

            {isContribution && (
              <FadeInView delay={50}>
                <Text style={styles.sectionLabel}>INVESTMENT</Text>
                <View style={[styles.categorySelectBtn, { borderColor: 'rgba(99,102,241,0.35)', backgroundColor: 'rgba(99,102,241,0.06)' }]}>
                  <View style={styles.categorySelectLeft}>
                    <Ionicons name="briefcase-outline" size={18} color={colors.accentIndigo} />
                    <Text style={[styles.selectedCategoryText, { color: colors.text }]}>
                      {invName || (activeInvestments.find(inv => inv.id == selectedInvestmentId)?.name) || 'Investment'}
                    </Text>
                  </View>
                  <View style={{ backgroundColor: 'rgba(99,102,241,0.15)', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 }}>
                    <Text style={{ color: colors.accentIndigo, fontSize: 10, fontFamily: 'Inter_600SemiBold', letterSpacing: 0.5 }}>FIXED</Text>
                  </View>
                </View>
              </FadeInView>
            )}

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
                  <Text style={styles.dateLabel}>{isMasterSetup ? 'START DATE' : 'DATE'}</Text>
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

            {(!isInvestment || isMasterSetup) && (
              <FadeInView delay={160} style={{ marginBottom: 20 }}>
                <View style={styles.sectionRow}>
                  <Text style={styles.sectionLabel}>{isInvestment ? 'INVESTMENT TYPE' : 'CATEGORY'}</Text>
                  {!isInvestment && (
                    <TouchableOpacity style={styles.newCatBtn} onPress={() => setShowCategoryModal(true)} disabled={isSaving}>
                      <Ionicons name="add" size={14} color={accentColor} />
                      <Text style={[styles.newCatText, { color: accentColor }]}>New</Text>
                    </TouchableOpacity>
                  )}
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
                      <Text style={styles.placeholderText}>Select Type</Text>
                    )}
                  </View>
                  <Ionicons name="chevron-down" size={18} color={colors.textMuted} />
                </TouchableOpacity>
              </FadeInView>
            )}

            {(!isInvestment || isMasterSetup || isContribution) && (
              <FadeInView delay={200} style={{ marginBottom: 20 }}>
                <Text style={styles.sectionLabel}>{isIncome ? 'INCOME SOURCE' : 'FUNDED BY'}</Text>
                <View style={styles.typeToggleRow}>
                  {OWNER_OPTIONS.map((opt) => {
                    const isSelected = ownership === opt.value;
                    return (
                      <TouchableOpacity
                        key={opt.value}
                        style={[
                          styles.typeBtn,
                          isSelected && { backgroundColor: accentColor }
                        ]}
                        onPress={() => {
                          LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                          setOwnership(opt.value);
                        }}
                        disabled={isSaving}
                      >
                        <Text style={[styles.typeText, isSelected && styles.typeTextActive]}>
                          {opt.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </FadeInView>
            )}

            {!isIncome && (
              <FadeInView delay={250} style={{ marginBottom: 20 }}>
                <Text style={styles.sectionLabel}>PAYMENT SOURCE</Text>
                <View style={styles.typeToggleRow}>
                  {['Debit Card', 'Credit Card'].map((ps) => {
                    const isSelected = paymentSource === ps;
                    return (
                      <TouchableOpacity
                        key={ps}
                        style={[
                          styles.typeBtn,
                          isSelected && { backgroundColor: accentColor }
                        ]}
                        onPress={() => {
                          LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                          setPaymentSource(ps);
                          if (ps === 'Credit Card' && activeCreditCards.length > 0 && !creditCardId) {
                            setCreditCardId(activeCreditCards[0].id);
                          }
                        }}
                        disabled={isSaving}
                      >
                        <Text style={[styles.typeText, isSelected && styles.typeTextActive]}>
                          {ps}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                {paymentSource === 'Credit Card' && (
                  <View style={{ marginTop: 16 }}>
                    <Text style={styles.sectionLabel}>CREDIT CARD</Text>
                    {activeCreditCards.length === 0 ? (
                      <Text style={[styles.placeholderText, { marginLeft: 6 }]}>No active credit cards available.</Text>
                    ) : (
                      <TouchableOpacity 
                        style={[styles.categorySelectBtn, !creditCardId && styles.invalidBtn]} 
                        onPress={() => setShowCreditCardPicker(true)}
                        disabled={isSaving}
                      >
                        <View style={styles.categorySelectLeft}>
                          {creditCardId ? (
                            <>
                              <Ionicons name="card" size={18} color={accentColor} />
                              <Text style={styles.selectedCategoryText}>
                                {activeCreditCards.find(cc => cc.id === creditCardId)?.name || 'Select Credit Card'}
                              </Text>
                            </>
                          ) : (
                            <Text style={styles.placeholderText}>Select Credit Card</Text>
                          )}
                        </View>
                        <Ionicons name="chevron-down" size={18} color={colors.textMuted} />
                      </TouchableOpacity>
                    )}
                  </View>
                )}
              </FadeInView>
            )}

            <FadeInView delay={isInvestment ? 300 : (!isIncome && !isInvestment ? 300 : 250)}>
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
              {false && (
                <View style={styles.attachmentSection}>
                  <Text style={styles.sectionLabel}>ATTACHMENTS ({attachmentUris.length}/3)</Text>
                  <View style={styles.attachmentRow}>
                    {attachmentUris.map((uri, index) => (
                      <View key={index} style={styles.attachmentPreview}>
                        <Ionicons name="image" size={24} color={colors.textSecondary} />
                        <TouchableOpacity style={styles.removeAttachment} onPress={() => setAttachmentUris(prev => prev.filter((_, i) => i !== index))}>
                          <Ionicons name="close-circle" size={20} color={colors.danger} />
                        </TouchableOpacity>
                      </View>
                    ))}
                    {attachmentUris.length < 3 && (
                      <TouchableOpacity style={styles.addAttachmentBtn} onPress={pickImage}>
                        <Ionicons name="camera-outline" size={24} color={colors.textSecondary} />
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              )}

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
                    {isSaving ? 'Saving…' : (isEdit || mode === 'editSetup') ? 'Save changes' : (mode === 'setup' ? 'Create Investment' : `Save ${isIncome ? 'Income' : (isInvestment ? 'Contribution' : 'Expense')}`)}
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
                <Text style={styles.modalTitle}>Select {isInvestment ? 'Type' : 'Category'}</Text>
                <TouchableOpacity onPress={() => setShowCategoryPicker(false)}>
                  <Ionicons name="close" size={24} color={colors.text} />
                </TouchableOpacity>
              </View>

              <View style={styles.searchBar}>
                <Ionicons name="search" size={18} color={colors.textMuted} />
                <TextInput
                  style={styles.searchInput}
                  placeholder="Search..."
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
                    <Text style={{ ...typography.bodySmall, marginTop: 10 }}>No items found</Text>
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
                        <Text style={[styles.pickerItemText, category === cat.name && { color: accentColor, fontFamily: 'Inter_700Bold' }]}>
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
        {/* Credit Card Picker Modal */}
        <Modal visible={showCreditCardPicker} transparent animationType="slide">
          <View style={styles.overlay}>
            <GlassCard style={styles.pickerModal} contentStyle={{ flex: 1 }}>

              <View style={styles.pickerHeader}>
                <Text style={styles.modalTitle}>Select Credit Card</Text>
                <TouchableOpacity onPress={() => setShowCreditCardPicker(false)}>
                  <Ionicons name="close" size={24} color={colors.text} />
                </TouchableOpacity>
              </View>

              <View style={styles.searchBar}>
                <Ionicons name="search" size={18} color={colors.textMuted} />
                <TextInput
                  style={styles.searchInput}
                  placeholder="Search..."
                  placeholderTextColor={colors.textMuted}
                  value={creditCardSearch}
                  onChangeText={setCreditCardSearch}
                  autoFocus
                  returnKeyType="search"
                />
              </View>

              <ScrollView style={styles.pickerList} keyboardShouldPersistTaps="handled">
                {activeCreditCards.filter(cc => cc.name.toLowerCase().includes(creditCardSearch.toLowerCase())).length === 0 ? (
                  <View style={{ alignItems: 'center', marginTop: 40 }}>
                    <Ionicons name="search-outline" size={40} color={colors.textMuted} />
                    <Text style={{ ...typography.bodySmall, marginTop: 10 }}>No items found</Text>
                  </View>
                ) : (
                  activeCreditCards
                    .filter(cc => cc.name.toLowerCase().includes(creditCardSearch.toLowerCase()))
                    .map((cc) => (
                      <TouchableOpacity
                        key={cc.id}
                        style={[styles.pickerItem, creditCardId === cc.id && styles.pickerItemActive]}
                        onPress={() => {
                          setCreditCardId(cc.id);
                          setShowCreditCardPicker(false);
                          setCreditCardSearch('');
                        }}
                      >
                        <View style={[styles.pickerIcon, { backgroundColor: (creditCardId === cc.id ? accentColor : colors.textMuted) + '20' }]}>
                          <Ionicons name="card" size={20} color={creditCardId === cc.id ? accentColor : colors.textMuted} />
                        </View>
                        <Text style={[styles.pickerItemText, creditCardId === cc.id && { color: accentColor, fontFamily: 'Inter_700Bold' }]}>
                          {cc.name}
                        </Text>
                        {creditCardId === cc.id && <Ionicons name="checkmark-circle" size={20} color={accentColor} />}
                      </TouchableOpacity>
                    ))
                )}
              </ScrollView>
            </GlassCard>
          </View>
        </Modal>

        {/* Investment Picker Modal */}
        <Modal visible={showInvestmentPicker} transparent animationType="slide">
          <View style={styles.overlay}>
            <GlassCard style={styles.pickerModal} contentStyle={{ flex: 1 }}>
              <View style={styles.pickerHeader}>
                <Text style={styles.modalTitle}>Select Investment</Text>
                <TouchableOpacity onPress={() => setShowInvestmentPicker(false)}>
                  <Ionicons name="close" size={24} color={colors.text} />
                </TouchableOpacity>
              </View>

              <ScrollView style={styles.pickerList}>
                {activeInvestments.length === 0 ? (
                  <View style={{ alignItems: 'center', marginTop: 40 }}>
                    <Ionicons name="briefcase-outline" size={40} color={colors.textMuted} />
                    <Text style={{ ...typography.bodySmall, marginTop: 10 }}>No active investments</Text>
                  </View>
                ) : (
                  activeInvestments.map((inv) => (
                    <TouchableOpacity
                      key={inv.id}
                      style={[styles.pickerItem, selectedInvestmentId == inv.id && styles.pickerItemActive]}
                      onPress={() => {
                        setSelectedInvestmentId(inv.id);
                        setShowInvestmentPicker(false);
                        if (!amount) setAmount(String(inv.recurring_amount));
                        if (!currency) setCurrency(inv.currency);
                      }}
                    >
                      <View style={[styles.pickerIcon, { backgroundColor: colors.accentIndigo + '20' }]}>
                        <Ionicons name="briefcase" size={20} color={colors.accentIndigo} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.pickerItemText, selectedInvestmentId == inv.id && { color: colors.accentIndigo, fontFamily: 'Inter_700Bold' }]}>
                          {inv.name}
                        </Text>
                        <Text style={styles.dateLabel}>{inv.type} · {inv.currency} {inv.recurring_amount}/mo</Text>
                      </View>
                      {selectedInvestmentId == inv.id && <Ionicons name="checkmark-circle" size={20} color={colors.accentIndigo} />}
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
  title: { fontSize: 18, color: colors.text, fontFamily: 'Inter_700Bold' },
  scroll: { paddingHorizontal: 18, paddingBottom: 36 },

  amountCard: { padding: 20, marginBottom: 12, overflow: 'hidden' },
  fieldLabel: {
    color: colors.textMuted,
    fontSize: 11,
    fontFamily: 'Inter_700Bold',
    letterSpacing: 1,
    marginBottom: 6,
  },
  amountInput: {
    fontSize: 46,
    fontFamily: 'Inter_800ExtraBold',
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
  currencyBtnText: { fontFamily: 'Inter_700Bold', fontSize: 13 },
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
    fontFamily: 'Inter_700Bold',
    letterSpacing: 0.8,
    marginBottom: 1,
  },
  dateValue: { color: colors.text, fontFamily: 'Inter_600SemiBold', fontSize: 14 },

  sectionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  sectionLabel: { color: colors.textMuted, fontSize: 11, fontFamily: 'Inter_700Bold', letterSpacing: 1 },
  newCatBtn: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  newCatText: { fontFamily: 'Inter_700Bold', fontSize: 12 },

  typeToggleRow: { flexDirection: 'row', backgroundColor: colors.cardSolid, borderRadius: 10, padding: 3, borderWidth: 1, borderColor: colors.border, marginTop: 8 },
  typeBtn: { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 8 },
  typeBtnActive: { backgroundColor: colors.accentIndigo },
  typeText: { fontSize: 12, fontFamily: 'Inter_600SemiBold', color: colors.textSecondary },
  typeTextActive: { color: '#fff', fontFamily: 'Inter_800ExtraBold' },

  notesInput: {
    backgroundColor: colors.cardSolid,
    color: colors.text,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    fontSize: 14,
    textAlignVertical: 'top',
    minHeight: 52,
    marginTop: 8,
    marginBottom: 18,
  },

  attachmentSection: { marginBottom: 24 },
  attachmentRow: { flexDirection: 'row', gap: 12, marginTop: 8 },
  attachmentPreview: { width: 60, height: 60, borderRadius: 12, backgroundColor: colors.cardSolid, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  removeAttachment: { position: 'absolute', top: -8, right: -8, backgroundColor: '#000', borderRadius: 10 },
  addAttachmentBtn: { width: 60, height: 60, borderRadius: 12, backgroundColor: colors.cardSolid, borderWidth: 1, borderColor: colors.border, borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center' },

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
  saveText: { color: '#fff', fontFamily: 'Inter_800ExtraBold', fontSize: 16, letterSpacing: 0.3 },

  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'center',
    padding: 20,
  },
  modalCard: { padding: 20 },
  modalTitle: { color: colors.text, fontSize: 17, fontFamily: 'Inter_700Bold', marginBottom: 16 },
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
  cancelText: { color: colors.textSecondary, fontFamily: 'Inter_600SemiBold', fontSize: 14 },
  createBtn: { flex: 1, padding: 12, borderRadius: 12, alignItems: 'center' },
  createText: { color: '#fff', fontFamily: 'Inter_700Bold', fontSize: 14 },

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
    marginTop: 8,
    marginBottom: 18
  },
  categorySelectLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  selectedCategoryText: { ...typography.bodyMedium, fontFamily: 'Inter_600SemiBold' },
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
  pickerItemActive: { backgroundColor: colors.accentIndigo + '10' },
  pickerIcon: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  pickerItemText: { ...typography.bodyMedium, flex: 1 },
});

