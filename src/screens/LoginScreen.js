import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, KeyboardAvoidingView, Platform, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';
import { loginEmail, loginPIN, devResetApp } from '../services/authService';
import FadeInView from '../components/FadeInView';
import AmbientBackground from '../components/AmbientBackground';
import GlassCard from '../components/GlassCard';
import Toast from '../components/Toast';
import { authenticateBiometrics, isBiometricsEnabledInSettings } from '../services/biometricService';

export default function LoginScreen({ navigation, route }) {
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [pin, setPin]           = useState('');

  const [showPassword, setShowPassword] = useState(false);
  const [showPin, setShowPin]           = useState(false);

  const [emailError, setEmailError] = useState('');
  const [pinError, setPinError]     = useState('');
  const [toastMsg, setToastMsg]     = useState('');
  const [toastVisible, setToastVisible] = useState(false);
  const [isBiometricEnabled, setIsBiometricEnabled] = useState(false);


  const showToast = (msg) => { setToastMsg(msg); setToastVisible(true); };

  React.useEffect(() => {
    const enabled = isBiometricsEnabledInSettings();
    setIsBiometricEnabled(enabled);

    const tryBiometrics = async () => {
      if (enabled) {
        const success = await authenticateBiometrics();
        if (success) {
          route.params?.onLoginSuccess?.();
        }
      }
    };
    
    // Small delay to allow splash/fade-in to look better
    const timer = setTimeout(tryBiometrics, 600);
    return () => clearTimeout(timer);
  }, []);


  const handleBiometricAuth = async () => {
    const success = await authenticateBiometrics();
    if (success) {
      route.params?.onLoginSuccess?.();
    }
  };


  const handleEmailLogin = async () => {
    setEmailError('');
    if (!email || !password) return setEmailError('Please enter email and password');
    try {
      const ok = await loginEmail(email.trim(), password);
      if (ok) { route.params?.onLoginSuccess?.(); }
      else { setEmailError('Invalid email or password'); setPassword(''); }
    } catch (e) { setEmailError('Login failed: ' + e.message); }
  };

  const handlePinLogin = async () => {
    setPinError('');
    if (pin.length !== 4) return setPinError('PIN must be 4 digits');
    try {
      const ok = await loginPIN(pin);
      if (ok) { route.params?.onLoginSuccess?.(); }
      else { setPinError('Invalid PIN'); setPin(''); }
    } catch (e) { setPinError('Login failed: ' + e.message); }
  };

  const handleReset = () => {
    Alert.alert('Reset App', 'This deletes all data and allows re-registration. Continue?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Yes, Reset', style: 'destructive', onPress: async () => {
        await devResetApp();
        route.params?.onReset?.();
      }},
    ]);
  };

  return (
    <AmbientBackground>
      <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
        <Toast message={toastMsg} type="error" visible={toastVisible} onHide={() => setToastVisible(false)} />
        <KeyboardAvoidingView style={styles.kav} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <ScrollView
            contentContainerStyle={styles.scroll}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <FadeInView delay={0}>
              <Text style={styles.title}>Welcome Back</Text>
              <Text style={styles.subtitle}>Sign in to your account</Text>
            </FadeInView>

            {/* Email Login */}
            <FadeInView delay={120}>
              <GlassCard style={styles.card}>
                <Text style={styles.cardTitle}>Email Login</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Email address"
                  placeholderTextColor={colors.textMuted}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  value={email}
                  onChangeText={setEmail}
                />
                <View style={styles.passRow}>
                  <TextInput
                    style={styles.passInput}
                    placeholder="Password"
                    placeholderTextColor={colors.textMuted}
                    secureTextEntry={!showPassword}
                    value={password}
                    onChangeText={setPassword}
                  />
                  <TouchableOpacity onPress={() => setShowPassword(v => !v)} style={styles.eye}>
                    <Ionicons name={showPassword ? 'eye-off' : 'eye'} size={20} color={colors.textMuted} />
                  </TouchableOpacity>
                </View>
                {emailError ? <Text style={styles.errorText}>{emailError}</Text> : null}
                <TouchableOpacity style={styles.btn} activeOpacity={0.82} onPress={handleEmailLogin}>
                  <Text style={styles.btnText}>Login</Text>
                </TouchableOpacity>
              </GlassCard>
            </FadeInView>

            <FadeInView delay={240}>
              <Text style={styles.orText}>— or —</Text>
            </FadeInView>

            {/* PIN Login */}
            <FadeInView delay={360}>
              <GlassCard style={styles.card}>
                <Text style={styles.cardTitle}>Quick PIN</Text>
                <View style={styles.passRow}>
                  <TextInput
                    style={styles.passInput}
                    placeholder="4-digit PIN"
                    placeholderTextColor={colors.textMuted}
                    keyboardType="numeric"
                    maxLength={4}
                    secureTextEntry={!showPin}
                    value={pin}
                    onChangeText={setPin}
                  />
                  <TouchableOpacity onPress={() => setShowPin(v => !v)} style={styles.eye}>
                    <Ionicons name={showPin ? 'eye-off' : 'eye'} size={20} color={colors.textMuted} />
                  </TouchableOpacity>
                </View>
                {pinError ? <Text style={styles.errorText}>{pinError}</Text> : null}
                <TouchableOpacity style={styles.btn} activeOpacity={0.82} onPress={handlePinLogin}>
                  <Text style={styles.btnText}>Login with PIN</Text>
                </TouchableOpacity>
              </GlassCard>
            </FadeInView>

            {isBiometricEnabled && (
              <FadeInView delay={480}>
                <TouchableOpacity onPress={handleBiometricAuth} style={styles.biometricBtn} activeOpacity={0.7}>
                  <Ionicons name="finger-print" size={32} color={colors.primary} />
                  <Text style={styles.biometricText}>Tap for Biometrics</Text>
                </TouchableOpacity>
              </FadeInView>
            )}

            <FadeInView delay={isBiometricEnabled ? 560 : 480}>

              <TouchableOpacity onPress={handleReset} style={styles.resetBtn} activeOpacity={0.6}>
                <Text style={styles.resetText}>Register New Account (Reset Data)</Text>
              </TouchableOpacity>
            </FadeInView>

          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </AmbientBackground>
  );
}

const styles = StyleSheet.create({
  safe:     { flex: 1 },
  kav:      { flex: 1 },
  scroll:   { paddingHorizontal: 22, paddingBottom: 40, flexGrow: 1, justifyContent: 'center' },

  title:    { ...typography.screenTitle, textAlign: 'center', marginBottom: 6 },
  subtitle: { ...typography.bodySmall,  textAlign: 'center', marginBottom: 32 },

  card:      { marginBottom: 14 },
  cardTitle: { ...typography.h3, marginBottom: 16 },

  input: {
    ...typography.inputText,
    backgroundColor: colors.background, borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 13,
    borderWidth: 1, borderColor: colors.border, marginBottom: 12,
  },
  passRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.background, borderRadius: 12,
    borderWidth: 1, borderColor: colors.border, marginBottom: 12,
  },
  passInput: { ...typography.inputText, flex: 1, paddingHorizontal: 14, paddingVertical: 13 },
  eye:       { padding: 13 },

  btn:     { backgroundColor: colors.primary, borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 4 },
  btnText: { ...typography.buttonPrimary },

  orText:    { ...typography.sectionLabel, textAlign: 'center', marginVertical: 12 },
  errorText: { ...typography.bodySmall, color: colors.danger, marginBottom: 10, marginTop: -6 },

  resetBtn:  { alignItems: 'center', marginTop: 20, padding: 8 },
  resetText: { ...typography.buttonSecondary },

  biometricBtn: { alignItems: 'center', marginTop: 12, gap: 8 },
  biometricText: { ...typography.caption, color: colors.primary, fontFamily: 'Inter_700Bold' },
});

