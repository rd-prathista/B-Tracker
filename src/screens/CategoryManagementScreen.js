import React, { useState, useEffect, useCallback, useRef } from 'react';
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
  getCategories,
  addCategory,
  updateCategory,
  safeDeleteCategory,
  getCategoryUsage,
  getCategoryTransactions,
  reassignTransactionCategory,
  bulkReassignCategory,
} from '../services/transactionService';
import AmbientBackground from '../components/AmbientBackground';
import GlassCard from '../components/GlassCard';
import FadeInView from '../components/FadeInView';
import Toast from '../components/Toast';
import { ICON_OPTIONS } from '../constants/Icons';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const TABS = ['Income', 'Expense', 'Investment'];



export default function CategoryManagementScreen({ navigation }) {
  const [activeTab, setActiveTab] = useState('Expense');
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(false);

  // Modal States
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [dependencyModalVisible, setDependencyModalVisible] = useState(false);
  const [confirmDeleteVisible, setConfirmDeleteVisible] = useState(false);

  // Active Category State
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [editName, setEditName] = useState('');
  const [editIcon, setEditIcon] = useState('ellipse-outline');
  const [isEditing, setIsEditing] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');


  // Dependency/Reassignment State
  const [usage, setUsage] = useState({ count: 0, total: 0 });
  const [linkedTransactions, setLinkedTransactions] = useState([]);
  const [showBulkReassign, setShowBulkReassign] = useState(false);
  const [bulkTargetCategory, setBulkTargetCategory] = useState('');

  // Toast State
  const [toastVisible, setToastVisible] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [toastType, setToastType] = useState('success');

  const actionLockRef = useRef(false);

  const loadCategories = useCallback(() => {
    setLoading(true);
    try {
      const data = getCategories(activeTab.toLowerCase());
      setCategories(data);
    } finally {
      setLoading(false);
    }
  }, [activeTab]);

  useFocusEffect(
    useCallback(() => {
      loadCategories();
    }, [loadCategories])
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
    setEditName('');
    setEditIcon('ellipse-outline');
    setEditModalVisible(true);
  };

  const handleEditPress = (cat) => {
    setSelectedCategory(cat);
    setIsEditing(true);
    setEditName(cat.name);
    setEditIcon(cat.icon);
    setEditModalVisible(true);
  };

  const saveCategory = () => {
    if (actionLockRef.current) return;
    if (!editName.trim()) {
      Alert.alert('Error', 'Name is required');
      return;
    }

    actionLockRef.current = true;
    try {
      if (isEditing) {
        const u = getCategoryUsage(selectedCategory.name, activeTab.toLowerCase());
        if (u.count > 0 && editName.trim() !== selectedCategory.name) {
             Alert.alert(
               'Update Category',
               'This category is already used in transactions. Changes will reflect across reports and history.',
               [
                 { text: 'Cancel', onPress: () => { actionLockRef.current = false; } },
                 { text: 'Update', onPress: () => performUpdate() }
               ]
             );
        } else {
            performUpdate();
        }
      } else {
        addCategory(editName, activeTab.toLowerCase(), editIcon);
        showToast('Category added successfully');
        closeModals();
        loadCategories();
      }
    } catch (e) {
      showToast('Failed to add category', 'error');
    } finally {
      actionLockRef.current = false;
    }
  };

  const performUpdate = () => {
    try {
        updateCategory(selectedCategory.id, selectedCategory.name, editName, activeTab.toLowerCase(), editIcon);
        showToast('Category updated successfully');
        closeModals();
        loadCategories();
    } catch (e) {
        showToast('Unable to update category', 'error');
    }
  };

  const handleDeletePress = (cat) => {
    setSelectedCategory(cat);
    const u = getCategoryUsage(cat.name, activeTab.toLowerCase());
    setUsage(u);

    if (u.count > 0) {
      setLinkedTransactions(getCategoryTransactions(cat.name, activeTab.toLowerCase()));
      setDependencyModalVisible(true);
    } else {
      setConfirmDeleteVisible(true);
    }
  };

  const confirmDeleteNoEntries = () => {
    if (actionLockRef.current) return;
    actionLockRef.current = true;
    try {
      safeDeleteCategory(selectedCategory.id);
      showToast('Category deleted successfully');
      closeModals();
      loadCategories();
    } catch (e) {
      showToast('Failed to delete category', 'error');
    } finally {
      actionLockRef.current = false;
    }
  };

  const handleBulkReassign = () => {
    if (!bulkTargetCategory) {
      Alert.alert('Error', 'Please select a target category');
      return;
    }
    if (actionLockRef.current) return;
    actionLockRef.current = true;

    try {
      bulkReassignCategory(activeTab.toLowerCase(), selectedCategory.name, bulkTargetCategory);
      showToast(`Reassigned ${usage.count} entries to ${bulkTargetCategory}`);
      
      const newUsage = getCategoryUsage(selectedCategory.name, activeTab.toLowerCase());
      if (newUsage.count === 0) {
        safeDeleteCategory(selectedCategory.id);
        showToast('Bulk migration completed');
        closeModals();
        loadCategories();
      } else {
          setUsage(newUsage);
      }
    } catch (e) {
      showToast('Failed to reassign entries', 'error');
    } finally {
      actionLockRef.current = false;
    }
  };

  const handleIndividualReassign = (txId, newCat) => {
    if (actionLockRef.current) return;
    actionLockRef.current = true;

    try {
      reassignTransactionCategory(activeTab.toLowerCase(), txId, newCat);
      
      const updatedList = linkedTransactions.filter(t => t.id !== txId);
      setLinkedTransactions(updatedList);
      
      const newUsage = getCategoryUsage(selectedCategory.name, activeTab.toLowerCase());
      setUsage(newUsage);

      if (newUsage.count === 0) {
        safeDeleteCategory(selectedCategory.id);
        showToast('Entries reassigned successfully');
        closeModals();
        loadCategories();
      }
    } catch (e) {
      showToast('Unable to reassign entry', 'error');
    } finally {
      actionLockRef.current = false;
    }
  };

  const closeModals = () => {
    setEditModalVisible(false);
    setDependencyModalVisible(false);
    setConfirmDeleteVisible(false);
    setShowBulkReassign(false);
    setBulkTargetCategory('');
    setSelectedCategory(null);
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
              <Text style={styles.title}>Categories</Text>
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
                placeholder="Search categories..."
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


        <View style={styles.tabsRow}>
          {TABS.map(tab => (
            <TouchableOpacity 
                key={tab} 
                style={[styles.tabBtn, activeTab === tab && styles.tabBtnActive]} 
                onPress={() => setActiveTab(tab)}
            >
              <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>{tab}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          {loading ? (
            <ActivityIndicator color={colors.primary} style={{ marginTop: 40 }} />
          ) : categories.filter(c => c.name.toLowerCase().includes(searchQuery.toLowerCase())).length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="search-outline" size={40} color={colors.textMuted} />
              <Text style={styles.emptyText}>No categories found</Text>
            </View>
          ) : (
            categories
              .filter(c => c.name.toLowerCase().includes(searchQuery.toLowerCase()))
              .map((cat, idx) => {
                return (
                  <FadeInView key={cat.id} delay={idx * 40}>
                    <GlassCard style={styles.catRow} noPadding>
                      <View style={styles.innerRow}>
                        <View style={[styles.iconBox, { backgroundColor: colors.cardSolid }]}>
                          <Ionicons name={cat.icon || 'ellipse-outline'} size={16} color={colors.text} />
                        </View>
                        <Text style={styles.catName} numberOfLines={1} ellipsizeMode="tail">{cat.name}</Text>
                        <View style={styles.rowActions}>
                          <TouchableOpacity style={styles.rowActionBtn} onPress={() => handleEditPress(cat)}>
                            <Ionicons name="pencil-outline" size={14} color={colors.textSecondary} />
                          </TouchableOpacity>
                          <TouchableOpacity style={styles.rowActionBtn} onPress={() => handleDeletePress(cat)}>
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
              <Text style={styles.modalTitle}>{isEditing ? 'Edit Category' : 'New Category'}</Text>
              <TextInput 
                style={styles.input}
                placeholder="Category Name"
                placeholderTextColor={colors.textMuted}
                value={editName}
                onChangeText={setEditName}
                maxLength={30}
                autoFocus
              />
              <Text style={styles.label}>Pick an Icon</Text>
              <ScrollView style={{ maxHeight: 180 }} nestedScrollEnabled>
                <View style={styles.iconGrid}>
                  {ICON_OPTIONS.map(icon => (
                    <TouchableOpacity 
                        key={icon} 
                        style={[styles.iconOpt, editIcon === icon && { borderColor: colors.primary, backgroundColor: colors.primary + '20' }]} 
                        onPress={() => setEditIcon(icon)}
                    >
                      <Ionicons name={icon} size={20} color={editIcon === icon ? colors.primary : colors.textMuted} />
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>
              <View style={styles.modalBtns}>
                <TouchableOpacity style={styles.cancelBtn} onPress={closeModals}>
                  <Text style={styles.cancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.saveBtn} onPress={saveCategory}>
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
              <Text style={styles.modalTitle}>Delete Category?</Text>
              <Text style={styles.modalSub}>There are no linked entries. Are you sure you want to delete this category?</Text>
              <View style={styles.modalBtns}>
                <TouchableOpacity style={styles.cancelBtn} onPress={closeModals}>
                  <Text style={styles.cancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.saveBtn, { backgroundColor: colors.danger }]} onPress={confirmDeleteNoEntries}>
                  <Text style={styles.saveText}>Delete</Text>
                </TouchableOpacity>
              </View>
            </GlassCard>
          </View>
        </Modal>

        <Modal visible={dependencyModalVisible} transparent animationType="fade" onRequestClose={closeModals}>
          <View style={styles.overlay}>
             <Pressable style={StyleSheet.absoluteFillObject} onPress={closeModals} />
             <GlassCard style={styles.dependencyCard}>
                <Text style={styles.modalTitle}>Category in Use</Text>
                <Text style={styles.modalSub}>
                    This category has <Text style={{fontFamily: 'Inter_700Bold', color: colors.text}}>{usage.count} transactions</Text>. 
                    You must reassign them before deleting.
                </Text>

                <View style={styles.optionToggle}>
                    <TouchableOpacity style={[styles.optBtn, !showBulkReassign && styles.optBtnActive]} onPress={() => setShowBulkReassign(false)}>
                        <Text style={[styles.optText, !showBulkReassign && styles.optTextActive]}>Individually</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.optBtn, showBulkReassign && styles.optBtnActive]} onPress={() => setShowBulkReassign(true)}>
                        <Text style={[styles.optText, showBulkReassign && styles.optTextActive]}>Bulk Move</Text>
                    </TouchableOpacity>
                </View>

                {showBulkReassign ? (
                    <View style={styles.bulkBox}>
                        <Text style={styles.label}>Move all entries to:</Text>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 15 }}>
                            <View style={styles.pillRow}>
                                {categories.filter(c => c.name !== selectedCategory?.name).map(c => (
                                    <TouchableOpacity 
                                        key={c.id} 
                                        style={[styles.pill, bulkTargetCategory === c.name && styles.pillActive]} 
                                        onPress={() => setBulkTargetCategory(c.name)}
                                    >
                                        <Text style={[styles.pillText, bulkTargetCategory === c.name && styles.pillTextActive]}>{c.name}</Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        </ScrollView>
                        <TouchableOpacity style={styles.bulkApplyBtn} onPress={handleBulkReassign}>
                            <Text style={styles.bulkApplyText}>Apply & Delete Category</Text>
                        </TouchableOpacity>
                    </View>
                ) : (
                    <ScrollView style={{ maxHeight: 300 }}>
                        {linkedTransactions.map(tx => (
                            <View key={tx.id} style={styles.txReassignRow}>
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.txAmt}>{tx.currency} {tx.amount}</Text>
                                    <Text style={styles.txDate}>{new Date(tx.date).toLocaleDateString()}</Text>
                                </View>
                                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ maxWidth: '60%' }}>
                                    <View style={styles.pillRowSmall}>
                                        {categories.filter(c => c.name !== selectedCategory?.name).map(c => (
                                            <TouchableOpacity 
                                                key={c.id} 
                                                style={styles.pillSmall} 
                                                onPress={() => handleIndividualReassign(tx.id, c.name)}
                                            >
                                                <Text style={styles.pillTextSmall}>{c.name}</Text>
                                            </TouchableOpacity>
                                        ))}
                                    </View>
                                </ScrollView>
                            </View>
                        ))}
                    </ScrollView>
                )}

                <TouchableOpacity style={styles.closeBtn} onPress={closeModals}>
                    <Text style={styles.closeBtnText}>Cancel</Text>
                </TouchableOpacity>
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

  
  tabsRow: { flexDirection: 'row', paddingHorizontal: 18, marginBottom: 16, gap: 10 },
  tabBtn: { flex: 1, paddingVertical: 10, borderRadius: 12, alignItems: 'center', backgroundColor: colors.cardSolid, borderWidth: 1, borderColor: colors.border },
  tabBtnActive: { backgroundColor: colors.border, borderColor: colors.primary + '40' },
  tabText: { ...typography.bodySmall, fontFamily: 'Inter_600SemiBold', fontSize: 13, color: colors.textSecondary },
  tabTextActive: { color: colors.text, fontFamily: 'Inter_700Bold' },

  scroll: { paddingHorizontal: 18, paddingBottom: 40 },
  catRow: { marginBottom: 6, borderRadius: 12 },
  innerRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6, paddingHorizontal: 10 },
  iconBox: { width: 28, height: 28, borderRadius: 6, alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  catName: { ...typography.bodyMedium, flex: 1, fontSize: 13, fontFamily: 'Inter_600SemiBold' },
  rowActions: { flexDirection: 'row', gap: 4 },
  rowActionBtn: { width: 28, height: 28, borderRadius: 6, backgroundColor: 'rgba(255,255,255,0.03)', alignItems: 'center', justifyContent: 'center' },

  emptyState: { alignItems: 'center', marginTop: 60 },
  emptyText: { ...typography.bodySmall, color: colors.textMuted },

  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center', padding: 22 },
  modalCard: { width: '100%', padding: 22, borderRadius: 20 },
  modalTitle: { ...typography.h3, marginBottom: 10 },
  modalSub: { ...typography.bodySmall, color: colors.textMuted, marginBottom: 20, lineHeight: 18 },
  label: { ...typography.label, marginBottom: 8, marginTop: 12 },
  input: { backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 12, padding: 14, color: colors.text, marginBottom: 10, borderWidth: 1, borderColor: colors.border },
  
  iconGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingVertical: 8 },
  iconOpt: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.03)', borderWidth: 1.5, borderColor: colors.border },
  
  modalBtns: { flexDirection: 'row', gap: 10, marginTop: 24 },
  cancelBtn: { flex: 1, padding: 14, borderRadius: 12, borderWidth: 1, borderColor: colors.border, alignItems: 'center' },
  cancelText: { ...typography.bodyMedium, color: colors.textSecondary, fontFamily: 'Inter_600SemiBold' },
  saveBtn: { flex: 1, padding: 14, borderRadius: 12, backgroundColor: colors.primary, alignItems: 'center' },
  saveText: { ...typography.bodyMedium, color: '#fff', fontFamily: 'Inter_700Bold' },

  dependencyCard: { width: '100%', padding: 22, borderRadius: 24 },
  optionToggle: { flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 14, padding: 4, marginBottom: 18 },
  optBtn: { flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: 'center' },
  optBtnActive: { backgroundColor: colors.border },
  optText: { ...typography.bodySmall, color: colors.textMuted },
  optTextActive: { color: colors.text, fontFamily: 'Inter_700Bold' },

  bulkBox: { paddingVertical: 10 },
  pillRow: { flexDirection: 'row', gap: 8, paddingVertical: 4 },
  pill: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: colors.border },
  pillActive: { borderColor: colors.primary, backgroundColor: colors.primary + '20' },
  pillText: { ...typography.bodySmall, color: colors.textSecondary },
  pillTextActive: { color: colors.primary, fontFamily: 'Inter_700Bold' },
  bulkApplyBtn: { backgroundColor: colors.primary, padding: 16, borderRadius: 14, alignItems: 'center', marginTop: 12 },
  bulkApplyText: { color: '#fff', fontFamily: 'Inter_700Bold' },

  txReassignRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)' },
  txAmt: { ...typography.bodyMedium, fontFamily: 'Inter_700Bold' },
  txDate: { ...typography.caption, color: colors.textMuted },
  pillRowSmall: { flexDirection: 'row', gap: 6, paddingLeft: 10 },
  pillSmall: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 12, backgroundColor: colors.cardSolid, borderWidth: 1, borderColor: colors.border },
  pillTextSmall: { fontSize: 10, color: colors.textSecondary, fontFamily: 'Inter_600SemiBold' },

  closeBtn: { marginTop: 20, padding: 10, alignItems: 'center' },
  closeBtnText: { color: colors.textMuted, fontSize: 13, fontFamily: 'Inter_600SemiBold' },
});
