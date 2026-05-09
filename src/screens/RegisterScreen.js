import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';
import { registerEmail } from '../services/authService';
import FadeInView from '../components/FadeInView';
import AmbientBackground from '../components/AmbientBackground';
import GlassCard from '../components/GlassCard';

export default function RegisterScreen({ navigation, route }) {
  const [email, setEmail]               = useState('');
  const [password, setPassword]         = useState('');
  const [confirmPassword, setConfirm]   = useState('');
  const [showPass, setShowPass]         = useState(false);
  const [showConfirm, setShowConfirm]   = useState(false);
  const [error, setError]               = useState('');

  const handleRegister = async () => {
    setError('');
    if (!email.trim())              return setError('Email cannot be empty');
    if (!password)                  return setError('Password cannot be empty');
    if (password !== confirmPassword) return setError('Passwords do not match');
    try {
      await registerEmail(email.trim(), password);
      navigation.navigate('PinSetup', { onRegisterSuccess: route.params?.onRegisterSuccess });
    } catch (e) { setError('Registration failed: ' + e.message); }
  };

  return (
    <AmbientBackground>
      <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
        <KeyboardAvoidingView style={styles.kav} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

            <FadeInView delay={0}>
              <Text style={styles.title}>Create Account</Text>
              <Text style={styles.subtitle}>Set up your B Tracker profile</Text>
            </FadeInView>

            <FadeInView delay={120}>
              <GlassCard style={styles.card}>
                <Text style={styles.cardTitle}>Step 1 — Account Details</Text>

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
                  <TextInput style={styles.passInput} placeholder="Password" placeholderTextColor={colors.textMuted} secureTextEntry={!showPass} value={password} onChangeText={setPassword} />
                  <TouchableOpacity onPress={() => setShowPass(v => !v)} style={styles.eye}>
                    <Ionicons name={showPass ? 'eye-off' : 'eye'} size={20} color={colors.textMuted} />
                  </TouchableOpacity>
                </View>

                <View style={styles.passRow}>
                  <TextInput style={styles.passInput} placeholder="Confirm password" placeholderTextColor={colors.textMuted} secureTextEntry={!showConfirm} value={confirmPassword} onChangeText={setConfirm} />
                  <TouchableOpacity onPress={() => setShowConfirm(v => !v)} style={styles.eye}>
                    <Ionicons name={showConfirm ? 'eye-off' : 'eye'} size={20} color={colors.textMuted} />
                  </TouchableOpacity>
                </View>

                {error ? <Text style={styles.errorText}>{error}</Text> : null}

                <TouchableOpacity style={styles.btn} activeOpacity={0.82} onPress={handleRegister}>
                  <Text style={styles.btnText}>Continue to PIN Setup →</Text>
                </TouchableOpacity>
              </GlassCard>
            </FadeInView>

          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </AmbientBackground>
  );
}

const styles = StyleSheet.create({
  safe:   { flex: 1 },
  kav:    { flex: 1 },
  scroll: { paddingHorizontal: 22, paddingBottom: 40, flexGrow: 1, justifyContent: 'center' },

  title:    { ...typography.screenTitle, textAlign: 'center', marginBottom: 6 },
  subtitle: { ...typography.bodySmall,  textAlign: 'center', marginBottom: 32 },

  card:      { marginBottom: 14 },
  cardTitle: { ...typography.h3, marginBottom: 16 },

  input: {
    ...typography.inputText, backgroundColor: colors.background,
    borderRadius: 12, paddingHorizontal: 14, paddingVertical: 13,
    borderWidth: 1, borderColor: colors.border, marginBottom: 12,
  },
  passRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.background, borderRadius: 12,
    borderWidth: 1, borderColor: colors.border, marginBottom: 12,
  },
  passInput: { ...typography.inputText, flex: 1, paddingHorizontal: 14, paddingVertical: 13 },
  eye:       { padding: 13 },

  btn:       { backgroundColor: colors.primary, borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 4 },
  btnText:   { ...typography.buttonPrimary },
  errorText: { ...typography.bodySmall, color: colors.danger, marginBottom: 10, marginTop: -6 },
});
