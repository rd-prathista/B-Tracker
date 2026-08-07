import React, { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView,
  KeyboardAvoidingView, Platform, Alert
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';
import { getActiveCurrencies } from '../database/db';
import { saveOpeningBalances, getOpeningBalancesData } from '../services/transactionService';
import AmbientBackground from '../components/AmbientBackground';
import GlassCard from '../components/GlassCard';

const OWNERS = ['SELF', 'SPOUSE', 'OTHER'];
const OWNER_LABELS = { SELF: '👩🏻 Prathista', SPOUSE: '👦🏻 Praveen', OTHER: '👥 Others' };

const OpeningBalanceWizardScreen = ({ navigation }) => {
  const [activeCurs, setActiveCurs] = useState(['AED']);
  
  const [startDate, setStartDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);

  // Data arrays
  const [investments, setInvestments] = useState([]);
  const [loans, setLoans] = useState([]);

  
  const [isEditMode, setIsEditMode] = useState(false);

  useEffect(() => {
    const curs = getActiveCurrencies();
    setActiveCurs(curs);
    
    const existingData = getOpeningBalancesData();
    
    if (existingData && (existingData.investments.length > 0 || existingData.loans.length > 0)) {
      setIsEditMode(true);
    }
    
    if (existingData && existingData.startDate) {
      setStartDate(new Date(existingData.startDate));
    }
    
    // Pre-populate investments
    if (existingData.investments.length > 0) {
      setInvestments(existingData.investments.map(i => ({
        id: i.id,
        idStr: i.id.toString(),
        type: i.type,
        name: i.name,
        currency: i.currency,
        amount: i.amount.toString(),
        owner: i.owner
      })));
    }
    
    // Pre-populate loans
    if (existingData.loans.length > 0) {
      setLoans(existingData.loans.map(l => ({
        id: l.id,
        idStr: l.id.toString(),
        type: l.type,
        name: l.name,
        currency: l.currency,
        amount: l.amount.toString(),
        owner: l.owner
      })));
    }
  }, []);


  const handleBack = () => {
    navigation.goBack();
  };

  const handleSave = () => {
    try {
      // Parse data
      const parsedInvestments = investments
        .map(i => ({ ...i, amount: parseFloat(i.amount) || 0 }))
        .filter(i => i.amount > 0 && i.name.trim() !== '');
        
      const parsedLoans = loans
        .map(l => ({ ...l, amount: parseFloat(l.amount) || 0 }))
        .filter(l => l.amount > 0 && l.name.trim() !== '');

      const data = {
        startDate: startDate.toISOString(),
        investments: parsedInvestments,
        loans: parsedLoans
      };

      saveOpeningBalances(data);
      
      Alert.alert(
        "Setup Complete",
        "Your opening balances have been successfully recorded.",
        [{ text: "OK", onPress: () => navigation.navigate('Dashboard') }]
      );
    } catch (e) {
      console.error(e);
      Alert.alert("Error", "Failed to save opening balances.");
    }
  };

  const addInvestment = () => {
    setInvestments([...investments, { name: '', type: 'Mutual Fund', amount: '', currency: activeCurs[0], owner: 'SELF' }]);
  };

  const updateInvestment = (index, field, value) => {
    const newInv = [...investments];
    newInv[index][field] = value;
    setInvestments(newInv);
  };

  const removeInvestment = (index) => {
    const newInv = [...investments];
    newInv.splice(index, 1);
    setInvestments(newInv);
  };

  const addLoan = () => {
    setLoans([...loans, { name: '', type: 'I Gave', amount: '', currency: activeCurs[0], owner: 'SELF' }]);
  };

  const updateLoan = (index, field, value) => {
    const newLoans = [...loans];
    newLoans[index][field] = value;
    setLoans(newLoans);
  };

  const removeLoan = (index) => {
    const newLoans = [...loans];
    newLoans.splice(index, 1);
    setLoans(newLoans);
  };

  return (
    <AmbientBackground>
      <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
        
        <View style={styles.header}>
          <TouchableOpacity onPress={handleBack} style={styles.backBtn}>
            <Ionicons name="close-outline" size={26} color={colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{isEditMode ? 'Edit Opening Balances' : 'Opening Balance Setup'}</Text>
          <View style={{ width: 30 }} />
        </View>

        <View style={styles.warningBox}>
          <Ionicons name="warning-outline" size={18} color="#F59E0B" />
          <Text style={styles.warningText}>
            {isEditMode ? 'You are editing your opening balances. Changes will immediately update your dashboard and reports.' : 'Use this wizard only when starting fresh. It creates opening balances without generating historical cashflow entries.'}
          </Text>
        </View>

        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : null}>
          <ScrollView style={styles.scrollContent} contentContainerStyle={{ paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
            
            {/* SECTION 1: START DATE */}
            <View style={styles.section}>
              <Text style={styles.sectionHeader}>1. TRACKING START DATE</Text>
              <Text style={styles.stepDescription}>
                When do you want to start tracking from? This will be your Day 1.
              </Text>
              
              <GlassCard style={styles.card}>
                <TouchableOpacity style={styles.datePickerBtn} onPress={() => setShowDatePicker(true)}>
                  <Ionicons name="calendar-outline" size={20} color={colors.primary} />
                  <Text style={styles.dateText}>{startDate.toLocaleDateString()}</Text>
                </TouchableOpacity>
              </GlassCard>

              {showDatePicker && (
                <DateTimePicker
                  value={startDate}
                  mode="date"
                  display="default"
                  themeVariant="dark"
                  onChange={(event, selectedDate) => {
                    setShowDatePicker(false);
                    if (selectedDate) setStartDate(selectedDate);
                  }}
                />
              )}
            </View>
            {/* SECTION 2: INVESTMENTS */}
            <View style={styles.section}>
              <Text style={styles.sectionHeader}>2. EXISTING INVESTMENTS</Text>
              <Text style={styles.stepDescription}>
                Add any existing investments you already have.
              </Text>
              
              {investments.map((inv, idx) => (
                <GlassCard key={idx} style={styles.builderCard}>
                  <View style={styles.builderHeader}>
                    <Text style={styles.builderTitle}>Investment #{idx + 1}</Text>
                    <TouchableOpacity onPress={() => removeInvestment(idx)}>
                      <Ionicons name="trash-outline" size={20} color={colors.danger} />
                    </TouchableOpacity>
                  </View>
                  
                  <TextInput
                    style={styles.textInput}
                    placeholder="Investment Name (e.g. S&P 500)"
                    placeholderTextColor={colors.textMuted}
                    value={inv.name}
                    onChangeText={(val) => updateInvestment(idx, 'name', val)}
                  />
                  
                  <View style={styles.row}>
                    <TextInput
                      style={[styles.numberInput, { flex: 1, marginTop: 15, textAlign: 'left' }]}
                      placeholder="Total Invested Amount"
                      placeholderTextColor={colors.textMuted}
                      keyboardType="numeric"
                      value={inv.amount}
                      onChangeText={(val) => updateInvestment(idx, 'amount', val)}
                    />
                    
                    <View style={styles.pillContainer}>
                      {activeCurs.map(c => (
                        <TouchableOpacity 
                          key={c} 
                          style={[styles.pillBtn, inv.currency === c && styles.pillActive]}
                          onPress={() => updateInvestment(idx, 'currency', c)}
                        >
                          <Text style={[styles.pillText, inv.currency === c && styles.pillTextActive]}>{c}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>

                  <View style={styles.ownerPillContainer}>
                    {OWNERS.map(o => (
                      <TouchableOpacity 
                        key={o} 
                        style={[styles.ownerPill, inv.owner === o && styles.ownerPillActive]}
                        onPress={() => updateInvestment(idx, 'owner', o)}
                      >
                        <Text style={[styles.pillText, inv.owner === o && styles.pillTextActive]}>{OWNER_LABELS[o].split(' ')[0]}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </GlassCard>
              ))}
              
              <TouchableOpacity style={styles.addBtn} onPress={addInvestment}>
                <Ionicons name="add-circle-outline" size={24} color={colors.primary} />
                <Text style={styles.addBtnText}>Add Existing Investment</Text>
              </TouchableOpacity>
            </View>

            {/* SECTION 3: LOANS */}
            <View style={styles.section}>
              <Text style={styles.sectionHeader}>3. OUTSTANDING LOANS</Text>
              <Text style={styles.stepDescription}>
                Add any current outstanding loans (both borrowed and given).
              </Text>
              
              {loans.map((loan, idx) => (
                <GlassCard key={idx} style={styles.builderCard}>
                  <View style={styles.builderHeader}>
                    <Text style={styles.builderTitle}>Loan #{idx + 1}</Text>
                    <TouchableOpacity onPress={() => removeLoan(idx)}>
                      <Ionicons name="trash-outline" size={20} color={colors.danger} />
                    </TouchableOpacity>
                  </View>
                  
                  <TextInput
                    style={styles.textInput}
                    placeholder="Person Name (e.g. John)"
                    placeholderTextColor={colors.textMuted}
                    value={loan.name}
                    onChangeText={(val) => updateLoan(idx, 'name', val)}
                  />

                  <View style={styles.pillContainer}>
                    <TouchableOpacity 
                      style={[styles.pillBtn, loan.type === 'I Gave' && styles.pillActive]}
                      onPress={() => updateLoan(idx, 'type', 'I Gave')}
                    >
                      <Text style={[styles.pillText, loan.type === 'I Gave' && styles.pillTextActive]}>I Gave</Text>
                    </TouchableOpacity>
                    <TouchableOpacity 
                      style={[styles.pillBtn, loan.type === 'I Borrowed' && styles.pillActive]}
                      onPress={() => updateLoan(idx, 'type', 'I Borrowed')}
                    >
                      <Text style={[styles.pillText, loan.type === 'I Borrowed' && styles.pillTextActive]}>I Borrowed</Text>
                    </TouchableOpacity>
                  </View>
                  
                  <View style={styles.row}>
                    <TextInput
                      style={[styles.numberInput, { flex: 1, marginTop: 15, textAlign: 'left' }]}
                      placeholder="Outstanding Amount"
                      placeholderTextColor={colors.textMuted}
                      keyboardType="numeric"
                      value={loan.amount}
                      onChangeText={(val) => updateLoan(idx, 'amount', val)}
                    />
                    
                    <View style={styles.pillContainer}>
                      {activeCurs.map(c => (
                        <TouchableOpacity 
                          key={c} 
                          style={[styles.pillBtn, loan.currency === c && styles.pillActive]}
                          onPress={() => updateLoan(idx, 'currency', c)}
                        >
                          <Text style={[styles.pillText, loan.currency === c && styles.pillTextActive]}>{c}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>

                  <View style={styles.ownerPillContainer}>
                    {OWNERS.map(o => (
                      <TouchableOpacity 
                        key={o} 
                        style={[styles.ownerPill, loan.owner === o && styles.ownerPillActive]}
                        onPress={() => updateLoan(idx, 'owner', o)}
                      >
                        <Text style={[styles.pillText, loan.owner === o && styles.pillTextActive]}>{OWNER_LABELS[o].split(' ')[0]}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </GlassCard>
              ))}
              
              <TouchableOpacity style={styles.addBtn} onPress={addLoan}>
                <Ionicons name="add-circle-outline" size={24} color={colors.primary} />
                <Text style={styles.addBtnText}>Add Existing Loan</Text>
              </TouchableOpacity>
            </View>

          </ScrollView>
        </KeyboardAvoidingView>

        <View style={styles.footer}>
          <TouchableOpacity style={styles.nextBtn} onPress={handleSave}>
            <Text style={styles.nextBtnText}>Save Opening Balances</Text>
            <Ionicons name="checkmark-circle" size={20} color="#000" />
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </AmbientBackground>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 10, paddingBottom: 15 },
  backBtn: { padding: 5, marginLeft: -5 },
  headerTitle: { ...typography.h3, color: colors.text },
  
  warningBox: { flexDirection: 'row', backgroundColor: 'rgba(245, 158, 11, 0.15)', padding: 14, marginHorizontal: 20, borderRadius: 8, marginBottom: 15, alignItems: 'center' },
  warningText: { ...typography.bodySmall, color: '#F59E0B', flex: 1, marginLeft: 10, lineHeight: 18 },
  
  scrollContent: { paddingHorizontal: 20 },
  section: { marginBottom: 30 },
  sectionHeader: { ...typography.sectionLabel, color: colors.textSecondary, marginBottom: 6 },
  stepDescription: { ...typography.bodySmall, color: colors.textMuted, marginBottom: 15 },
  
  card: { padding: 15 },
  itemCard: { padding: 15, marginBottom: 10 },
  datePickerBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.cardSolid, padding: 15, borderRadius: 12, borderWidth: 1, borderColor: colors.border },
  dateText: { ...typography.body, marginLeft: 10, color: colors.text },
  
  currencyHeader: { ...typography.h4, color: colors.primary, marginBottom: 10 },
  inputRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  ownerLabel: { ...typography.body, color: colors.text, fontSize: 16, width: 120 },
  numberInput: { ...typography.h3, color: colors.text, textAlign: 'right', borderBottomWidth: 1, borderBottomColor: colors.border, paddingVertical: 5, minWidth: 100 },
  
  builderCard: { padding: 15, marginBottom: 15, borderLeftWidth: 3, borderLeftColor: colors.primary },
  builderHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 },
  builderTitle: { ...typography.h4, color: colors.text },
  textInput: { ...typography.body, color: colors.text, borderBottomWidth: 1, borderBottomColor: colors.border, paddingVertical: 10 },
  row: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' },
  
  pillContainer: { flexDirection: 'row', gap: 10, marginTop: 15 },
  pillBtn: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 20, backgroundColor: colors.cardSolid, borderWidth: 1, borderColor: colors.border },
  pillActive: { backgroundColor: colors.primary + '30', borderColor: colors.primary },
  pillText: { ...typography.caption, color: colors.textSecondary },
  pillTextActive: { color: colors.primary, fontFamily: 'Inter_600SemiBold' },
  
  ownerPillContainer: { flexDirection: 'row', gap: 10, marginTop: 20 },
  ownerPill: { paddingVertical: 8, paddingHorizontal: 15, borderRadius: 8, backgroundColor: colors.cardSolid, flex: 1, alignItems: 'center', borderWidth: 1, borderColor: colors.border },
  ownerPillActive: { backgroundColor: colors.primary + '20', borderColor: colors.primary },
  
  addBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 15, backgroundColor: colors.cardSolid, borderRadius: 12, borderStyle: 'dashed', borderWidth: 1, borderColor: colors.border },
  addBtnText: { ...typography.body, color: colors.primary, marginLeft: 10 },
  
  footer: { padding: 20, paddingTop: 10, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: 'rgba(11,15,25,0.8)' },
  nextBtn: { backgroundColor: colors.primary, padding: 16, borderRadius: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  nextBtnText: { ...typography.h4, color: '#000' }
});

export default OpeningBalanceWizardScreen;
