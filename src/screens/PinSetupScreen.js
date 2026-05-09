import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';
import { registerPIN } from '../services/authService';
import FadeInView from '../components/FadeInView';
import AmbientBackground from '../components/AmbientBackground';
import GlassCard from '../components/GlassCard';

export default function PinSetupScreen({ navigation, route }) {
  const [pin, setPin]             = useState('');
  const [confirmPin, setConfirm]  = useState('');
  const [showPin, setShowPin]     = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError]         = useState('');

  const handleSetup = async () => {
    setError('');
    if (pin.length !== 4)    return setError('PIN must be exactly 4 digits');
    if (pin !== confirmPin)  return setError('PINs do not match');
    try {
      await registerPIN(pin);
      navigation.navigate('CurrencySetup', { onRegisterSuccess: route.params?.onRegisterSuccess });
    } catch (e) { setError('Failed to save PIN: ' + e.message); }
  };

  return (
    <AmbientBackground>
      <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
        <KeyboardAvoidingView style={styles.kav} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

            <FadeInView delay={0}>
              <Text style={styles.title}>Set Your PIN</Text>
              <Text style={styles.subtitle}>Used for quick daily access</Text>
            </FadeInView>

            <FadeInView delay={120}>
              <GlassCard style={styles.card}>
                <Text style={styles.cardTitle}>Step 2 — Quick Access PIN</Text>

                <View style={styles.passRow}>
                  <TextInput style={styles.passInput} placeholder="Enter 4-digit PIN" placeholderTextColor={colors.textMuted} keyboardType="numeric" maxLength={4} secureTextEntry={!showPin} value={pin} onChangeText={setPin} />
                  <TouchableOpacity onPress={() => setShowPin(v => !v)} style={styles.eye}>
                    <Ionicons name={showPin ? 'eye-off' : 'eye'} size={20} color={colors.textMuted} />
                  </TouchableOpacity>
                </View>

                <View style={styles.passRow}>
                  <TextInput style={styles.passInput} placeholder="Confirm PIN" placeholderTextColor={colors.textMuted} keyboardType="numeric" maxLength={4} secureTextEntry={!showConfirm} value={confirmPin} onChangeText={setConfirm} />
                  <TouchableOpacity onPress={() => setShowConfirm(v => !v)} style={styles.eye}>
                    <Ionicons name={showConfirm ? 'eye-off' : 'eye'} size={20} color={colors.textMuted} />
                  </TouchableOpacity>
                </View>

                {error ? <Text style={styles.errorText}>{error}</Text> : null}

                <TouchableOpacity style={styles.btn} activeOpacity={0.82} onPress={handleSetup}>
                  <Text style={styles.btnText}>Continue to Currency →</Text>
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
