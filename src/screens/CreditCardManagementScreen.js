import React, { useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Modal,
  TextInput,
  Alert,
  ActivityIndicator,
  LayoutAnimation,
  Platform,
  UIManager,
  Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';
import {
  getCreditCards,
  addCreditCard,
  updateCreditCard,
  deleteCreditCard,
  checkCreditCardInUse
} from '../services/transactionService';
import AmbientBackground from '../components/AmbientBackground';
import GlassCard from '../components/GlassCard';
import FadeInView from '../components/FadeInView';
import Toast from '../components/Toast';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

export default function CreditCardManagementScreen({ navigation }) {
  const [creditCards, setCreditCards] = useState([]);
  const [loading, setLoading] = useState(false);

  // Modal States
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [confirmDeleteVisible, setConfirmDeleteVisible] = useState(false);

  // Form State
  const [selectedCard, setSelectedCard] = useState(null);
  const [ccForm, setCcForm] = useState({ id: null, name: '', last_4: '', bank_name: '', credit_limit: '', color: '', status: 'Active' });
  const [isEditing, setIsEditing] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Toast State
  const [toastVisible, setToastVisible] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [toastType, setToastType] = useState('success');

  const actionLockRef = useRef(false);

  const loadCreditCards = useCallback(() => {
    setLoading(true);
    try {
      // Pass false to get all credit cards including inactive ones
      const data = getCreditCards(false);
      setCreditCards(data);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadCreditCards();
    }, [loadCreditCards])
  );

  const showToast = (msg, type = 'success') => {
    setToastMessage(msg);
    setToastType(type);
    setToastVisible(true);
  };

  const toggleSearch = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    if (showSearch) setSearchQuery('');
    setShowSearch(!showSearch);
  };

  const handleAddPress = () => {
    setIsEditing(false);
    setSelectedCard(null);
    setCcForm({ id: null, name: '', last_4: '', bank_name: '', credit_limit: '', color: '', status: 'Active' });
    setEditModalVisible(true);
  };

  const handleEditPress = (card) => {
    setSelectedCard(card);
    setIsEditing(true);
    setCcForm({
        id: card.id,
        name: card.name,
        last_4: card.last_4 || '',
        bank_name: card.bank_name || '',
        credit_limit: card.credit_limit ? String(card.credit_limit) : '',
        color: card.color || '',
        status: card.status || 'Active'
    });
    setEditModalVisible(true);
  };

  const saveCreditCard = () => {
    if (actionLockRef.current) return;
    if (!ccForm.name.trim()) {
      Alert.alert('Error', 'Credit Card Name is required');
      return;
    }

    actionLockRef.current = true;
    try {
      if (isEditing) {
        updateCreditCard(ccForm.id, ccForm.name, ccForm.last_4, ccForm.bank_name, ccForm.credit_limit, ccForm.color, ccForm.status);
        showToast('Credit Card updated successfully');
      } else {
        addCreditCard(ccForm.name, ccForm.last_4, ccForm.bank_name, ccForm.credit_limit, ccForm.color, ccForm.status);
        showToast('Credit Card added successfully');
      }
      closeModals();
      loadCreditCards();
    } catch (e) {
      showToast('Failed to save credit card', 'error');
    } finally {
      actionLockRef.current = false;
    }
  };

  const handleDeletePress = (card) => {
    setSelectedCard(card);
    if (checkCreditCardInUse(card.id)) {
      Alert.alert('Cannot Delete', 'This credit card is linked to existing expenses. Please reassign those expenses to another credit card before deleting.');
    } else {
      setConfirmDeleteVisible(true);
    }
  };

  const confirmDelete = () => {
    if (actionLockRef.current) return;
    actionLockRef.current = true;
    try {
      deleteCreditCard(selectedCard.id);
      showToast('Credit Card deleted successfully');
      closeModals();
      loadCreditCards();
    } catch (e) {
      showToast('Failed to delete credit card', 'error');
    } finally {
      actionLockRef.current = false;
    }
  };

  const closeModals = () => {
    setEditModalVisible(false);
    setConfirmDeleteVisible(false);
    setSelectedCard(null);
  };

  return (
    <AmbientBackground>
      <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
        <Toast message={toastMessage} type={toastType} visible={toastVisible} onHide={() => setToastVisible(false)} />

        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={22} color={colors.text} />
          </TouchableOpacity>
          
          {!showSearch ? (
            <>
              <Text style={styles.title}>Credit Cards</Text>
              <TouchableOpacity onPress={toggleSearch} style={styles.headerBtn}>
                <Ionicons name="search" size={22} color={colors.text} />
              </TouchableOpacity>
              <TouchableOpacity onPress={handleAddPress} style={styles.addBtn}>
                <Ionicons name="add" size={24} color={colors.primary} />
              </TouchableOpacity>
            </>
          ) : (
            <View style={styles.searchBarContainer}>
              <TextInput
                style={styles.searchBarInput}
                placeholder="Search credit cards..."
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

        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          {loading ? (
            <ActivityIndicator color={colors.primary} style={{ marginTop: 40 }} />
          ) : creditCards.filter(c => c.name.toLowerCase().includes(searchQuery.toLowerCase())).length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="card-outline" size={40} color={colors.textMuted} />
              <Text style={styles.emptyText}>No credit cards found</Text>
            </View>
          ) : (
            creditCards
              .filter(c => c.name.toLowerCase().includes(searchQuery.toLowerCase()))
              .map((card, idx) => {
                return (
                  <FadeInView key={card.id} delay={idx * 40}>
                    <GlassCard style={[styles.cardRow, card.status === 'Inactive' && { opacity: 0.6 }]} noPadding>
                      <View style={styles.innerRow}>
                        <View style={[styles.iconBox, { backgroundColor: card.color || colors.cardSolid }]}>
                          <Ionicons name="card-outline" size={16} color={card.color ? '#fff' : colors.text} />
                        </View>
                        <View style={{ flex: 1, justifyContent: 'center' }}>
                            <Text style={styles.cardName} numberOfLines={1} ellipsizeMode="tail">{card.name}</Text>
                            {card.bank_name ? (
                                <Text style={styles.cardSubText}>{card.bank_name}{card.last_4 ? ` • ${card.last_4}` : ''}</Text>
                            ) : null}
                            <Text style={[styles.statusText, { color: card.status === 'Active' ? colors.accentTeal : colors.textMuted }]}>
                                {card.status}
                            </Text>
                        </View>
                        <View style={styles.rowActions}>
                          <TouchableOpacity style={styles.rowActionBtn} onPress={() => handleEditPress(card)}>
                            <Ionicons name="pencil-outline" size={14} color={colors.textSecondary} />
                          </TouchableOpacity>
                          <TouchableOpacity style={styles.rowActionBtn} onPress={() => handleDeletePress(card)}>
                            <Ionicons name="trash-outline" size={14} color={colors.danger} />
                          </TouchableOpacity>
                        </View>
                      </View>
                    </GlassCard>
                  </FadeInView>
                );
              })
          )}
        </ScrollView>

        <Modal visible={editModalVisible} transparent animationType="fade" onRequestClose={closeModals}>
          <View style={styles.overlay}>
            <Pressable style={StyleSheet.absoluteFillObject} onPress={closeModals} />
            <GlassCard style={styles.modalCard}>
              <Text style={styles.modalTitle}>{isEditing ? 'Edit Credit Card' : 'New Credit Card'}</Text>
              
              <ScrollView style={{ maxHeight: '80%' }} showsVerticalScrollIndicator={false}>
                <Text style={styles.label}>Card Name *</Text>
                <TextInput 
                    style={styles.input}
                    placeholder="e.g. HDFC Millennia"
                    placeholderTextColor={colors.textMuted}
                    value={ccForm.name}
                    onChangeText={(val) => setCcForm({...ccForm, name: val})}
                    maxLength={30}
                    autoFocus
                />
                
                <Text style={styles.label}>Bank Name</Text>
                <TextInput 
                    style={styles.input}
                    placeholder="e.g. HDFC Bank"
                    placeholderTextColor={colors.textMuted}
                    value={ccForm.bank_name}
                    onChangeText={(val) => setCcForm({...ccForm, bank_name: val})}
                    maxLength={30}
                />

                <Text style={styles.label}>Last 4 Digits</Text>
                <TextInput 
                    style={styles.input}
                    placeholder="e.g. 4021"
                    placeholderTextColor={colors.textMuted}
                    value={ccForm.last_4}
                    onChangeText={(val) => setCcForm({...ccForm, last_4: val})}
                    maxLength={4}
                    keyboardType="numeric"
                />

                <Text style={styles.label}>Credit Limit</Text>
                <TextInput 
                    style={styles.input}
                    placeholder="e.g. 50000"
                    placeholderTextColor={colors.textMuted}
                    value={ccForm.credit_limit}
                    onChangeText={(val) => setCcForm({...ccForm, credit_limit: val})}
                    keyboardType="numeric"
                />

                <Text style={styles.label}>Status</Text>
                <View style={styles.statusToggleContainer}>
                    <TouchableOpacity 
                        style={[styles.statusToggleBtn, ccForm.status === 'Active' && styles.statusToggleActive]}
                        onPress={() => setCcForm({...ccForm, status: 'Active'})}
                    >
                        <Text style={[styles.statusToggleText, ccForm.status === 'Active' && styles.statusToggleTextActive]}>Active</Text>
                    </TouchableOpacity>
                    <TouchableOpacity 
                        style={[styles.statusToggleBtn, ccForm.status === 'Inactive' && styles.statusToggleActive]}
                        onPress={() => setCcForm({...ccForm, status: 'Inactive'})}
                    >
                        <Text style={[styles.statusToggleText, ccForm.status === 'Inactive' && styles.statusToggleTextActive]}>Inactive</Text>
                    </TouchableOpacity>
                </View>
              </ScrollView>

              <View style={styles.modalBtns}>
                <TouchableOpacity style={styles.cancelBtn} onPress={closeModals}>
                  <Text style={styles.cancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.saveBtn} onPress={saveCreditCard}>
                  <Text style={styles.saveText}>Save</Text>
                </TouchableOpacity>
              </View>
            </GlassCard>
          </View>
        </Modal>

        <Modal visible={confirmDeleteVisible} transparent animationType="fade" onRequestClose={closeModals}>
          <View style={styles.overlay}>
            <Pressable style={StyleSheet.absoluteFillObject} onPress={closeModals} />
            <GlassCard style={styles.modalCard}>
              <Text style={styles.modalTitle}>Delete Credit Card?</Text>
              <Text style={styles.modalSub}>Are you sure you want to delete this credit card? This action cannot be undone.</Text>
              <View style={styles.modalBtns}>
                <TouchableOpacity style={styles.cancelBtn} onPress={closeModals}>
                  <Text style={styles.cancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.saveBtn, { backgroundColor: colors.danger }]} onPress={confirmDelete}>
                  <Text style={styles.saveText}>Delete</Text>
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
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 18, paddingTop: 8, paddingBottom: 14 },
  backBtn: { width: 36, height: 36, justifyContent: 'center' },
  headerBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  addBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  title: { ...typography.h2, flex: 1, marginLeft: 8 },

  searchBarContainer: { flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: colors.cardSolid, borderRadius: 12, paddingHorizontal: 12, marginLeft: 10, borderWidth: 1, borderColor: colors.border },
  searchBarInput: { flex: 1, paddingVertical: 8, color: colors.text, fontSize: 14 },
  
  scroll: { paddingHorizontal: 18, paddingBottom: 40 },
  cardRow: { marginBottom: 6, borderRadius: 12 },
  innerRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, paddingHorizontal: 10 },
  iconBox: { width: 36, height: 36, borderRadius: 8, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  cardName: { ...typography.bodyMedium, fontSize: 14, fontFamily: 'Inter_600SemiBold' },
  cardSubText: { ...typography.caption, color: colors.textSecondary, marginTop: 2 },
  statusText: { ...typography.caption, fontFamily: 'Inter_600SemiBold', marginTop: 2 },
  rowActions: { flexDirection: 'row', gap: 4 },
  rowActionBtn: { width: 28, height: 28, borderRadius: 6, backgroundColor: 'rgba(255,255,255,0.03)', alignItems: 'center', justifyContent: 'center' },

  emptyState: { alignItems: 'center', marginTop: 60 },
  emptyText: { ...typography.bodySmall, color: colors.textMuted, marginTop: 12 },

  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center', padding: 22 },
  modalCard: { width: '100%', padding: 22, borderRadius: 20 },
  modalTitle: { ...typography.h3, marginBottom: 10 },
  modalSub: { ...typography.bodySmall, color: colors.textMuted, marginBottom: 20, lineHeight: 18 },
  label: { ...typography.label, marginBottom: 8, marginTop: 12 },
  input: { backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 12, padding: 14, color: colors.text, marginBottom: 10, borderWidth: 1, borderColor: colors.border },
  
  statusToggleContainer: { flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 12, padding: 4, marginBottom: 10 },
  statusToggleBtn: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 8 },
  statusToggleActive: { backgroundColor: colors.border },
  statusToggleText: { ...typography.bodySmall, color: colors.textMuted },
  statusToggleTextActive: { color: colors.text, fontFamily: 'Inter_600SemiBold' },

  modalBtns: { flexDirection: 'row', gap: 10, marginTop: 24 },
  cancelBtn: { flex: 1, padding: 14, borderRadius: 12, borderWidth: 1, borderColor: colors.border, alignItems: 'center' },
  cancelText: { ...typography.bodyMedium, color: colors.textSecondary, fontFamily: 'Inter_600SemiBold' },
  saveBtn: { flex: 1, padding: 14, borderRadius: 12, backgroundColor: colors.primary, alignItems: 'center' },
  saveText: { ...typography.bodyMedium, color: '#fff', fontFamily: 'Inter_700Bold' },
});
