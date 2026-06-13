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
import { getAppSettings, updateAppSettings } from '../database/db';
import AmbientBackground from '../components/AmbientBackground';
import GlassCard from '../components/GlassCard';
import FadeInView from '../components/FadeInView';
import { checkBiometricsAvailability, isBiometricsEnabledInSettings } from '../services/biometricService';

export default function SettingsScreen({ navigation, route }) {
  const { onLogout } = route.params || {};
  const [syncLoading, setSyncLoading] = useState(false);
  const [lastSync, setLastSync] = useState(null);
  const [userEmail, setUserEmail] = useState(null);

  // Auth Modal State
  const [authModalVisible, setAuthModalVisible] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);
  const [pendingAction, setPendingAction] = useState(null); // 'backup' or 'restore'
  
  // Entry Preferences
  const [currencyMode, setCurrencyMode] = useState('AED');
  const [currencyModalVisible, setCurrencyModalVisible] = useState(false);
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
            </GlassCard>
          </FadeInView>


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
});


