import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert, ActivityIndicator, Modal, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';
import { 
  uploadToFirebase, 
  downloadFromFirebase, 
  getLastFirebaseSyncTimestamp,
  firebaseEmailAuth,
  getLoggedInEmail,
  firebaseLogout
} from '../services/firebaseSyncService';
import { getAppSettings, updateAppSettings, getActiveCurrencies, activateCurrency, deactivateCurrency, getDb } from '../database/db';
import AmbientBackground from '../components/AmbientBackground';
import GlassCard from '../components/GlassCard';
import FadeInView from '../components/FadeInView';
import { checkBiometricsAvailability, isBiometricsEnabledInSettings } from '../services/biometricService';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import DateTimePicker from '@react-native-community/datetimepicker';

export default function SettingsScreen({ navigation, route }) {
  const { onLogout } = route.params || {};
  const [syncLoading, setSyncLoading] = useState(false);
  const [lastSync, setLastSync] = useState(null);
  const [userEmail, setUserEmail] = useState(null);
  // Export Transactions
  const [exportModalVisible, setExportModalVisible] = useState(false);
  const [exportRange, setExportRange] = useState('this_month'); // 'this_month' | 'prev_month' | 'custom'
  const [exportFromDate, setExportFromDate] = useState(new Date());
  const [exportToDate, setExportToDate] = useState(new Date());
  const [showFromPicker, setShowFromPicker] = useState(false);
  const [showToPicker, setShowToPicker] = useState(false);
  const [exportLoading, setExportLoading] = useState(false);

  // Auth Modal State
  const [authModalVisible, setAuthModalVisible] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);
  const [pendingAction, setPendingAction] = useState(null); // 'backup' or 'restore'
  
  // Entry Preferences
  const [currencyMode, setCurrencyMode] = useState('AED');
  const [currencyModalVisible, setCurrencyModalVisible] = useState(false);
  const [activeCurs, setActiveCurs] = useState([]);
  const [currencyManageModalVisible, setCurrencyManageModalVisible] = useState(false);
  const [settingLoading, setSettingLoading] = useState(false);

  // Biometrics
  const [biometricsAvailable, setBiometricsAvailable] = useState(false);
  const [biometricsEnabled, setBiometricsEnabled] = useState(false);



  useEffect(() => {
    loadSyncInfo();
  }, []);

  const loadSyncInfo = async () => {
    const ts = await getLastFirebaseSyncTimestamp();
    if (ts) setLastSync(new Date(ts).toLocaleString());
    const savedEmail = await getLoggedInEmail();
    setUserEmail(savedEmail);

    const settings = getAppSettings();
    if (settings?.default_currency_mode) {
      setCurrencyMode(settings.default_currency_mode);
    }
    setActiveCurs(getActiveCurrencies());
    setBiometricsEnabled(!!settings?.biometrics_enabled);

    const available = await checkBiometricsAvailability();
    setBiometricsAvailable(available);
  };



  const handleAuth = async () => {
    if (!email || !password) {
      Alert.alert('Error', 'Please enter both email and password.');
      return;
    }

    setSyncLoading(true);
    try {
      await firebaseEmailAuth(email, password, isRegistering);
      setAuthModalVisible(false);
      setUserEmail(email);
      
      // Run the pending action
      if (pendingAction === 'backup') await performBackup();
      if (pendingAction === 'restore') await performRestore();
      
      setPendingAction(null);
    } catch (e) {
      Alert.alert('Auth Error', e.message);
    } finally {
      setSyncLoading(false);
    }
  };

  const performBackup = async () => {
    setSyncLoading(true);
    try {
      await uploadToFirebase();
      await loadSyncInfo();
      Alert.alert('Success', 'Data backed up to Cloud successfully!');
    } catch (e) {
      if (e.message.includes('logged in')) {
        setPendingAction('backup');
        setAuthModalVisible(true);
      } else {
        Alert.alert('Sync Error', e.message);
      }
    } finally {
      setSyncLoading(false);
    }
  };

  const performRestore = async () => {
    setSyncLoading(true);
    try {
      await downloadFromFirebase();
      Alert.alert('Success', 'Data restored! Please restart the app.');
      navigation.navigate('Dashboard');
    } catch (e) {
      if (e.message.includes('logged in')) {
        setPendingAction('restore');
        setAuthModalVisible(true);
      } else {
        Alert.alert('Restore Error', e.message);
      }
    } finally {
      setSyncLoading(false);
    }
  };

  const handleCloudSync = async () => {
    if (!userEmail) {
      setPendingAction('backup');
      setAuthModalVisible(true);
    } else {
      await performBackup();
    }
  };

  const handleCloudRestore = async () => {
    Alert.alert(
      'Restore from Cloud',
      'This will OVERWRITE all local data. Proceed?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Restore', 
          style: 'destructive',
          onPress: async () => {
            if (!userEmail) {
              setPendingAction('restore');
              setAuthModalVisible(true);
            } else {
              await performRestore();
            }
          }
        }
      ]
    );
  };

  const handleSwitchAccount = async () => {
    await firebaseLogout();
    setUserEmail(null);
    setAuthModalVisible(true);
  };

  const handleResetData = () => {
    Alert.alert(
      'Reset All Data',
      'WARNING: This will permanently delete ALL local transactions, categories, and your PIN. This cannot be undone. Proceed?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Reset Everything', 
          style: 'destructive',
          onPress: async () => {
            try {
              clearDatabase();
              await firebaseLogout();
              Alert.alert('App Reset', 'All data has been cleared. The app will now restart.');
              // Reset the navigation to start from scratch
              navigation.reset({
                index: 0,
                routes: [{ name: 'Auth' }], // Assuming 'Auth' is the setup screen
              });
            } catch (e) {
              Alert.alert('Reset Error', e.message);
            }
          }
        }
      ]
    );
  };

  const handleLogout = () => {
    Alert.alert('Logout', 'Are you sure you want to logout?', [
      { text: 'Cancel', style: 'cancel' },
      { 
        text: 'Logout', 
        style: 'destructive',
        onPress: () => {
          if (onLogout) onLogout();
        } 
      }
    ]);
  };

  const handleToggleBiometrics = async () => {
    if (settingLoading) return;
    setSettingLoading(true);
    try {
      const newVal = !biometricsEnabled ? 1 : 0;
      updateAppSettings('biometrics_enabled', newVal);
      setBiometricsEnabled(!!newVal);
    } catch (e) {
      Alert.alert('Error', 'Failed to update biometric setting');
    } finally {
      setSettingLoading(true); // Wait, should be false, but I want to prevent double taps
      setTimeout(() => setSettingLoading(false), 500);
    }
  };

  const handleCurrencyModeSelect = async (mode) => {

    if (settingLoading) return;
    setSettingLoading(true);
    try {
      updateAppSettings('default_currency_mode', mode);
      setCurrencyMode(mode);
      setCurrencyModalVisible(false);
    } catch (e) {
      Alert.alert('Error', 'Failed to update setting');
    } finally {
      setSettingLoading(false);
    }
  };

  // ── EXPORT TRANSACTIONS ────────────────────────────────────────────────────
  const getExportDateRange = () => {
    const now = new Date();
    if (exportRange === 'this_month') {
      const from = new Date(now.getFullYear(), now.getMonth(), 1);
      const to   = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      return { from, to };
    }
    if (exportRange === 'prev_month') {
      const from = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const to   = new Date(now.getFullYear(), now.getMonth(), 0);
      return { from, to };
    }
    return { from: exportFromDate, to: exportToDate };
  };

  const toSQLDate = (d) => d.toISOString().split('T')[0];

  const buildFileName = () => {
    const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const now = new Date();
    if (exportRange === 'this_month') {
      return `BTracker_${MONTHS[now.getMonth()]}_${now.getFullYear()}.json`;
    }
    if (exportRange === 'prev_month') {
      const d = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      return `BTracker_${MONTHS[d.getMonth()]}_${d.getFullYear()}.json`;
    }
    return `BTracker_${toSQLDate(exportFromDate)}_to_${toSQLDate(exportToDate)}.json`;
  };

  const handleExportTransactions = async () => {
    try {
      setExportLoading(true);
      const db = getDb();
      const { from, to } = getExportDateRange();
      const fromStr = toSQLDate(from);
      const toStr   = toSQLDate(to);

      const query = (table, dateCol) =>
        db.getAllSync(
          `SELECT * FROM ${table} WHERE date(${dateCol}) >= ? AND date(${dateCol}) <= ?`,
          [fromStr, toStr]
        );

      // Borrowing repayments need a join to get the repayment date
      const borrowingRepayments = db.getAllSync(
        `SELECT r.* FROM loan_repayments r
         JOIN loans l ON r.loan_id = l.id
         WHERE l.type = 'I Borrowed'
           AND date(r.date) >= ? AND date(r.date) <= ?`,
        [fromStr, toStr]
      );

      const payload = {
        app_version: '1.0',
        exported_at: new Date().toISOString(),
        from_date:   fromStr,
        to_date:     toStr,
        income:                   query('income',                    'date'),
        expenses:                 query('expenses',                  'date'),
        investments:              query('investments',               'start_date'),
        investment_contributions: query('investment_contributions',  'contribution_date'),
        borrowing:                query('loans',                     'start_date'),
        borrowing_repayments:     borrowingRepayments,
      };

      const json     = JSON.stringify(payload, null, 2);
      const fileName = buildFileName();
      const fileUri  = FileSystem.documentDirectory + fileName;

      await FileSystem.writeAsStringAsync(fileUri, json, { encoding: 'utf8' });

      setExportModalVisible(false);

      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(fileUri, {
          mimeType: 'application/json',
          dialogTitle: `Save ${fileName}`,
          UTI: 'public.json',
        });
      } else {
        Alert.alert('Exported', `Saved as:\n${fileName}`);
      }
    } catch (e) {
      console.error('Export error:', e);
      Alert.alert('Export Failed', e.message || 'Unknown error');
    } finally {
      setExportLoading(false);
    }
  };
  // ── END EXPORT TRANSACTIONS ────────────────────────────────────────────────

  // ── TEMPORARY DEBUG EXPORT (DISABLED — export complete) ────────────────────
  /*
  const handleExportJSON = async () => {
    try {
      setExportLoading(true);
      const db = getDb();

      const readTable = (table) => {
        try { return db.getAllSync(`SELECT * FROM ${table}`); }
        catch (e) { return []; }
      };

      const payload = {
        exportedAt: new Date().toISOString(),
        income:                   readTable('income'),
        expenses:                 readTable('expenses'),
        investments:              readTable('investments'),
        investment_contributions: readTable('investment_contributions'),
        loans:                    readTable('loans'),
        loan_repayments:          readTable('loan_repayments'),
        categories:               readTable('categories'),
        reminders:                readTable('reminders'),
        credit_cards:             readTable('credit_cards'),
      };

      const json = JSON.stringify(payload, null, 2);
      const fileUri = FileSystem.documentDirectory + 'BTracker_Live_Export.json';
      await FileSystem.writeAsStringAsync(fileUri, json, { encoding: 'utf8' });

      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(fileUri, {
          mimeType: 'application/json',
          dialogTitle: 'Save BTracker_Live_Export.json',
          UTI: 'public.json',
        });
      } else {
        Alert.alert('Exported', `File saved to:\n${fileUri}`);
      }
    } catch (e) {
      console.error('Export failed:', e);
      Alert.alert('Export Failed', e.message || 'Unknown error');
    } finally {
      setExportLoading(false);
    }
  };
  */
  // ── END TEMPORARY DEBUG EXPORT ──────────────────────────────────────────────

  const getCurrencyModeLabel = (mode) => {
    if (mode === 'ask') return 'Ask Every Time';
    if (mode === 'INR') return 'Default to INR';
    if (mode === 'AED') return 'Default to AED';
    return mode;
  };

  const SettingItem = ({ icon, label, sublabel, onPress, color = colors.text, rightContent, disabled = false }) => (
    <TouchableOpacity style={[styles.item, disabled && { opacity: 0.5 }]} onPress={onPress} activeOpacity={0.7} disabled={disabled}>
      <View style={[styles.iconWrap, { backgroundColor: color + '15' }]}>
        <Ionicons name={icon} size={18} color={color} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.label, { color }]}>{label}</Text>
        {sublabel ? <Text style={styles.sublabel}>{sublabel}</Text> : null}
      </View>
      {rightContent || <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />}
    </TouchableOpacity>
  );


  return (
    <AmbientBackground>
      <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={22} color={colors.text} />
          </TouchableOpacity>
          <Text style={styles.title}>Settings</Text>
          <View style={{ width: 36 }} />
        </View>

        <ScrollView contentContainerStyle={styles.scroll}>
          <FadeInView delay={0}>
            <Text style={typography.sectionLabel}>ACCOUNT & SECURITY</Text>
            <GlassCard style={styles.group}>
              <SettingItem icon="key-outline" label="Change Password" onPress={() => navigation.navigate('Security', { type: 'password' })} />
              <View style={styles.divider} />
              <SettingItem icon="lock-closed-outline" label="Change PIN" onPress={() => navigation.navigate('Security', { type: 'pin' })} />
              <View style={styles.divider} />
              <SettingItem icon="list-outline" label="Manage Categories" onPress={() => navigation.navigate('CategoryManagement')} />
              
              {biometricsAvailable && (
                <>
                  <View style={styles.divider} />
                  <SettingItem 
                    icon="finger-print-outline" 
                    label="Biometric Login" 
                    sublabel={biometricsEnabled ? 'Enabled' : 'Disabled'}
                    onPress={handleToggleBiometrics}
                    rightContent={
                       <View style={[styles.toggleTrack, biometricsEnabled && styles.toggleTrackActive]}>
                          <View style={[styles.toggleThumb, biometricsEnabled && styles.toggleThumbActive]} />
                       </View>
                    }
                  />
                </>
              )}
            </GlassCard>

          </FadeInView>

          <FadeInView delay={100}>
            <View style={styles.sectionHeaderRow}>
              <Text style={typography.sectionLabel}>CLOUD SYNC</Text>
              {syncLoading && <ActivityIndicator size="small" color={colors.accentTeal} />}
            </View>
            <GlassCard style={styles.group}>
              {userEmail ? (
                <View style={styles.userInfo}>
                  <Text style={styles.userText}>Logged in as: {userEmail}</Text>
                  <TouchableOpacity onPress={handleSwitchAccount}>
                    <Text style={styles.switchText}>Switch Account</Text>
                  </TouchableOpacity>
                </View>
              ) : null}

              <SettingItem 
                icon="cloud-upload-outline" 
                label="Backup to Cloud" 
                color={colors.accentTeal}
                disabled={syncLoading}
                onPress={handleCloudSync} 
              />
              <View style={styles.divider} />
              <SettingItem 
                icon="cloud-download-outline" 
                label="Restore from Cloud" 
                color={colors.success}
                disabled={syncLoading}
                onPress={handleCloudRestore} 
              />
              
              {lastSync && (
                <View style={styles.syncMeta}>
                  <Ionicons name="time-outline" size={12} color={colors.textMuted} />
                  <Text style={styles.syncTime}>Last synced: {lastSync}</Text>
                </View>
              )}
            </GlassCard>
            <Text style={styles.hint}>Secure cloud backup via Firebase (No Google ID needed).</Text>
          </FadeInView>

          <FadeInView delay={150}>
            <Text style={[typography.sectionLabel, { marginTop: 20 }]}>ENTRY PREFERENCES</Text>
            <GlassCard style={styles.group}>
              <SettingItem 
                icon="cash-outline" 
                label="Default Currency Behavior" 
                sublabel={getCurrencyModeLabel(currencyMode)}
                onPress={() => setCurrencyModalVisible(true)} 
              />
              <View style={styles.divider} />
              <SettingItem 
                icon="settings-outline" 
                label="Currency Management" 
                sublabel={`${activeCurs.join(', ')} Active`}
                onPress={() => setCurrencyManageModalVisible(true)} 
              />
            </GlassCard>
          </FadeInView>

          {/* ── EXPORT TRANSACTIONS ── */}
          <FadeInView delay={175}>
            <Text style={[typography.sectionLabel, { marginTop: 20 }]}>DATA EXPORT</Text>
            <GlassCard style={styles.group}>
              <SettingItem
                icon="download-outline"
                label="Export Transactions"
                sublabel="Export income, expenses, investments & loans as JSON"
                color={colors.accentIndigo}
                onPress={() => setExportModalVisible(true)}
              />
            </GlassCard>
            <Text style={styles.hint}>Export your transaction records for backup or Excel conversion.</Text>
          </FadeInView>

          {/* ── END TEMPORARY ── */}

          <FadeInView delay={200}>
            <Text style={[typography.sectionLabel, { marginTop: 20 }]}>APP</Text>
            <GlassCard style={styles.group}>
              <SettingItem icon="information-circle-outline" label="About B Tracker" onPress={() => navigation.navigate('About')} />
              <View style={styles.divider} />
              <SettingItem icon="log-out-outline" label="Logout" color={colors.danger} onPress={handleLogout} />
            </GlassCard>
          </FadeInView>
        </ScrollView>

        <Modal
          animationType="slide"
          transparent={true}
          visible={authModalVisible}
          onRequestClose={() => setAuthModalVisible(false)}
        >
          <View style={styles.modalOverlay}>
            <GlassCard style={styles.modalContent}>
              <Text style={styles.modalTitle}>{isRegistering ? 'Create Cloud Account' : 'Login to Cloud'}</Text>
              <Text style={styles.modalSub}>Use any email and password to secure your backups.</Text>
              
              <TextInput
                style={styles.input}
                placeholder="Email Address"
                placeholderTextColor={colors.textMuted}
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
              />
              
              <TextInput
                style={styles.input}
                placeholder="Password"
                placeholderTextColor={colors.textMuted}
                value={password}
                onChangeText={setPassword}
                secureTextEntry
              />

              <TouchableOpacity style={styles.primaryBtn} onPress={handleAuth}>
                {syncLoading ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryBtnText}>{isRegistering ? 'Create Account' : 'Login'}</Text>}
              </TouchableOpacity>

              <TouchableOpacity onPress={() => setIsRegistering(!isRegistering)}>
                <Text style={styles.toggleText}>
                  {isRegistering ? 'Already have a cloud account? Login' : "Don't have a cloud account? Register"}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.cancelBtn} onPress={() => setAuthModalVisible(false)}>
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
            </GlassCard>
          </View>
        </Modal>

        {/* Currency Mode Selector Modal */}
        <Modal
          animationType="fade"
          transparent={true}
          visible={currencyModalVisible}
          onRequestClose={() => setCurrencyModalVisible(false)}
        >
          <View style={styles.modalOverlay}>
            <GlassCard style={styles.modalContent}>
              <Text style={styles.modalTitle}>Default Currency Behavior</Text>
              <Text style={styles.modalSub}>Choose how the currency is selected when adding a new transaction.</Text>
              
              <View style={styles.optionList}>
                {['ask', 'INR', 'AED'].map((mode) => (
                  <TouchableOpacity 
                    key={mode} 
                    style={[styles.optionBtn, currencyMode === mode && styles.optionBtnActive]} 
                    onPress={() => handleCurrencyModeSelect(mode)}
                  >
                    <View style={styles.optionInfo}>
                      <Text style={[styles.optionText, currencyMode === mode && styles.optionTextActive]}>
                        {getCurrencyModeLabel(mode)}
                      </Text>
                    </View>
                    {currencyMode === mode && <Ionicons name="checkmark-circle" size={20} color={colors.accentTeal} />}
                  </TouchableOpacity>
                ))}
              </View>

              <TouchableOpacity style={styles.cancelBtn} onPress={() => setCurrencyModalVisible(false)}>
                <Text style={styles.cancelText}>Close</Text>
              </TouchableOpacity>
            </GlassCard>
          </View>
        </Modal>

        {/* Currency Management Modal */}
        <Modal
          animationType="fade"
          transparent={true}
          visible={currencyManageModalVisible}
          onRequestClose={() => setCurrencyManageModalVisible(false)}
        >
          <View style={styles.modalOverlay}>
            <GlassCard style={styles.modalContent}>
              <Text style={styles.modalTitle}>Currency Management</Text>
              <Text style={styles.modalSub}>
                Active currencies are visible throughout the app. Deactivating a currency will temporarily hide all its data and entries from active screens without deleting any data. At least one currency must remain active.
              </Text>
              
              <View style={styles.optionList}>
                {['AED', 'INR'].map((code) => {
                  const isActive = activeCurs.includes(code);
                  const isOnlyActive = activeCurs.length === 1 && isActive;

                  const toggleActive = () => {
                    if (isOnlyActive) return;
                    if (isActive) {
                      deactivateCurrency(code);
                    } else {
                      activateCurrency(code);
                    }
                    const updated = getActiveCurrencies();
                    setActiveCurs(updated);
                    // Adjust default currency if it was deactivated
                    const currentDefault = getAppSettings()?.default_currency_mode || 'AED';
                    if (!updated.includes(currentDefault) && updated.length > 0) {
                      setCurrencyMode(updated[0]);
                      updateAppSettings('default_currency_mode', updated[0]);
                    }
                  };

                  return (
                    <TouchableOpacity 
                      key={code} 
                      style={[styles.optionBtn, isOnlyActive && { opacity: 0.5 }]} 
                      onPress={toggleActive}
                      disabled={isOnlyActive}
                    >
                      <View style={styles.optionInfo}>
                        <Text style={[styles.optionText, isActive && styles.optionTextActive]}>
                          {code === 'AED' ? 'AED (United Arab Emirates Dirham)' : 'INR (Indian Rupee)'}
                        </Text>
                      </View>
                      <View style={[styles.toggleTrack, isActive && styles.toggleTrackActive]}>
                        <View style={[styles.toggleThumb, isActive && styles.toggleThumbActive]} />
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <TouchableOpacity style={[styles.cancelBtn, { marginTop: 16 }]} onPress={() => setCurrencyManageModalVisible(false)}>
                <Text style={styles.cancelText}>Close</Text>
              </TouchableOpacity>
            </GlassCard>
          </View>
        </Modal>

        {/* ── EXPORT TRANSACTIONS MODAL ── */}
        <Modal
          animationType="slide"
          transparent={true}
          visible={exportModalVisible}
          onRequestClose={() => setExportModalVisible(false)}
        >
          <View style={styles.modalOverlay}>
            <GlassCard style={styles.modalContent}>
              <Text style={styles.modalTitle}>Export Transactions</Text>
              <Text style={styles.modalSub}>Select the date range for your export.</Text>

              {/* Range Options */}
              {[
                { key: 'this_month', label: 'This Month' },
                { key: 'prev_month', label: 'Previous Month' },
                { key: 'custom',     label: 'Custom Date Range' },
              ].map(opt => (
                <TouchableOpacity
                  key={opt.key}
                  style={[styles.exportOption, exportRange === opt.key && styles.exportOptionActive]}
                  onPress={() => setExportRange(opt.key)}
                >
                  <View style={[styles.exportRadio, exportRange === opt.key && styles.exportRadioActive]}>
                    {exportRange === opt.key && <View style={styles.exportRadioDot} />}
                  </View>
                  <Text style={[styles.exportOptionText, exportRange === opt.key && { color: colors.text }]}>
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              ))}

              {/* Custom Date Pickers */}
              {exportRange === 'custom' && (
                <View style={styles.customDates}>
                  <TouchableOpacity style={styles.datePill} onPress={() => setShowFromPicker(true)}>
                    <Ionicons name="calendar-outline" size={14} color={colors.accentIndigo} />
                    <Text style={styles.datePillText}>From: {toSQLDate(exportFromDate)}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.datePill} onPress={() => setShowToPicker(true)}>
                    <Ionicons name="calendar-outline" size={14} color={colors.accentIndigo} />
                    <Text style={styles.datePillText}>To: {toSQLDate(exportToDate)}</Text>
                  </TouchableOpacity>
                  {showFromPicker && (
                    <DateTimePicker
                      value={exportFromDate}
                      mode="date"
                      display="default"
                      maximumDate={exportToDate}
                      onChange={(_, d) => { setShowFromPicker(false); if (d) setExportFromDate(d); }}
                    />
                  )}
                  {showToPicker && (
                    <DateTimePicker
                      value={exportToDate}
                      mode="date"
                      display="default"
                      minimumDate={exportFromDate}
                      maximumDate={new Date()}
                      onChange={(_, d) => { setShowToPicker(false); if (d) setExportToDate(d); }}
                    />
                  )}
                </View>
              )}

              {/* Actions */}
              <TouchableOpacity
                style={[styles.primaryBtn, { marginTop: 20, backgroundColor: colors.accentIndigo }, exportLoading && { opacity: 0.7 }]}
                onPress={handleExportTransactions}
                disabled={exportLoading}
              >
                {exportLoading
                  ? <ActivityIndicator color="#fff" />
                  : <Text style={styles.primaryBtnText}>Export JSON</Text>
                }
              </TouchableOpacity>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setExportModalVisible(false)} disabled={exportLoading}>
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
            </GlassCard>
          </View>
        </Modal>
        {/* ── END EXPORT MODAL ── */}

      </SafeAreaView>

    </AmbientBackground>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 18, paddingTop: 8, paddingBottom: 14 },
  backBtn: { width: 36, height: 36, justifyContent: 'center' },
  title: { ...typography.h2 },
  scroll: { paddingHorizontal: 18, paddingBottom: 40 },
  sectionHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 20 },
  group: { paddingVertical: 4, paddingHorizontal: 12, marginTop: 10 },
  item: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12 },
  iconWrap: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  label: { ...typography.bodyMedium },
  sublabel: { ...typography.caption, color: colors.accentTeal, marginTop: 1 },
  divider: { height: 1, backgroundColor: colors.border, marginLeft: 46 },
  hint: { ...typography.caption, color: colors.textMuted, marginTop: 8, marginLeft: 6, marginBottom: 10 },

  syncMeta: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 10, borderTopWidth: 1, borderTopColor: colors.border, marginTop: 4, marginLeft: 34 },
  syncTime: { ...typography.caption, color: colors.textMuted },
  userInfo: { paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.border, marginBottom: 4 },
  userText: { ...typography.caption, color: colors.accentTeal, fontFamily: 'Inter_700Bold' },
  switchText: { ...typography.caption, color: colors.textMuted, marginTop: 2, textDecorationLine: 'underline' },
  
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  modalContent: { width: '100%', padding: 24, borderRadius: 20 },
  modalTitle: { ...typography.h3, marginBottom: 8 },
  modalSub: { ...typography.caption, color: colors.textMuted, marginBottom: 20 },
  input: { backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 12, padding: 14, color: colors.text, marginBottom: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  primaryBtn: { backgroundColor: colors.accentTeal, borderRadius: 12, padding: 16, alignItems: 'center', marginTop: 8 },
  primaryBtnText: { color: '#fff', fontFamily: 'Inter_700Bold' },
  cancelBtn: { marginTop: 16, alignItems: 'center' },
  cancelText: { color: colors.textMuted },
  toggleText: { textAlign: 'center', marginTop: 16, color: colors.accentTeal, fontSize: 13 },
 
  optionList: { marginTop: 10 },
  optionBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 14, paddingHorizontal: 16, borderRadius: 12, marginBottom: 8, backgroundColor: 'rgba(255,255,255,0.03)', borderWidth: 1, borderColor: 'transparent' },
  optionBtnActive: { borderColor: colors.accentTeal + '50', backgroundColor: colors.accentTeal + '10' },
  optionInfo: { flex: 1 },
  optionText: { ...typography.bodyMedium, color: colors.textSecondary },
  optionTextActive: { color: colors.text, fontFamily: 'Inter_700Bold' },

  toggleTrack: { width: 36, height: 20, borderRadius: 10, backgroundColor: colors.border, padding: 2, justifyContent: 'center' },
  toggleTrackActive: { backgroundColor: colors.accentTeal + '80' },
  toggleThumb: { width: 16, height: 16, borderRadius: 8, backgroundColor: colors.textMuted },
  toggleThumbActive: { backgroundColor: colors.accentTeal, transform: [{ translateX: 16 }] },

  // Export Transactions modal
  exportOption: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 4, borderRadius: 10, marginBottom: 4 },
  exportOptionActive: { backgroundColor: colors.accentIndigo + '12' },
  exportOptionText: { ...typography.bodyMedium, color: colors.textSecondary, marginLeft: 12 },
  exportRadio: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: colors.textMuted, alignItems: 'center', justifyContent: 'center' },
  exportRadioActive: { borderColor: colors.accentIndigo },
  exportRadioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.accentIndigo },
  customDates: { marginTop: 10, gap: 10 },
  datePill: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.accentIndigo + '15', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, borderWidth: 1, borderColor: colors.accentIndigo + '30' },
  datePillText: { ...typography.bodyMedium, color: colors.text },
});


