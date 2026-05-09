import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';
import { setAppCurrency } from '../services/authService';
import FadeInView from '../components/FadeInView';
import AmbientBackground from '../components/AmbientBackground';
import GlassCard from '../components/GlassCard';

const CURRENCIES = [
  { code: 'AED', name: 'UAE Dirham',    symbol: 'د.إ', color: colors.primary },
  { code: 'INR', name: 'Indian Rupee',  symbol: '₹',   color: colors.accentTeal },
];

export default function CurrencySetupScreen({ navigation, route }) {
  const [currency, setCurrency] = useState('AED');
  const [error, setError]       = useState('');

  const handleFinish = () => {
    try {
      setAppCurrency(currency);
      route.params?.onRegisterSuccess?.();
    } catch (e) { setError('Failed to set currency: ' + e.message); }
  };

  return (
    <AmbientBackground>
      <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          <FadeInView delay={0}>
            <Text style={styles.title}>Select Currency</Text>
            <Text style={styles.subtitle}>Your default for new transactions</Text>
          </FadeInView>

          <FadeInView delay={120}>
            <GlassCard style={styles.card}>
              <Text style={styles.cardTitle}>Step 3 — Currency</Text>
              <Text style={[typography.bodySmall, { marginBottom: 20, lineHeight: 20 }]}>
                You can add transactions in both AED and INR individually. This sets your preferred default.
              </Text>

              <View style={styles.currencyRow}>
                {CURRENCIES.map((cur) => {
                  const isSelected = currency === cur.code;
                  return (
                    <TouchableOpacity
                      key={cur.code}
                      activeOpacity={0.8}
                      style={[styles.currencyOption, isSelected && { borderColor: cur.color, backgroundColor: cur.color + '18' }]}
                      onPress={() => setCurrency(cur.code)}
                    >
                      {isSelected && (
                        <View style={[styles.checkmark, { backgroundColor: cur.color }]}>
                          <Ionicons name="checkmark" size={12} color="#fff" />
                        </View>
                      )}
                      <Text style={[styles.currencySymbol, { color: isSelected ? cur.color : colors.textSecondary }]}>{cur.symbol}</Text>
                      <Text style={[styles.currencyCode, { color: isSelected ? cur.color : colors.text }]}>{cur.code}</Text>
                      <Text style={styles.currencyName}>{cur.name}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {error ? <Text style={styles.errorText}>{error}</Text> : null}

              <TouchableOpacity style={styles.btn} activeOpacity={0.82} onPress={handleFinish}>
                <LinearGradient colors={[colors.primary, colors.primaryDark]} style={styles.btnGrad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
                  <Text style={styles.btnText}>Complete Setup →</Text>
                </LinearGradient>
              </TouchableOpacity>
            </GlassCard>
          </FadeInView>
        </ScrollView>
      </SafeAreaView>
    </AmbientBackground>
  );
}

const styles = StyleSheet.create({
  safe:   { flex: 1 },
  scroll: { paddingHorizontal: 22, paddingBottom: 40, flexGrow: 1, justifyContent: 'center' },

  title:    { ...typography.screenTitle, textAlign: 'center', marginBottom: 6 },
  subtitle: { ...typography.bodySmall,  textAlign: 'center', marginBottom: 32 },

  card:      { marginBottom: 14 },
  cardTitle: { ...typography.h3, marginBottom: 8 },

  currencyRow: { flexDirection: 'row', gap: 14, marginBottom: 24 },
  currencyOption: {
    flex: 1, alignItems: 'center', paddingVertical: 20,
    borderRadius: 18, borderWidth: 2, borderColor: colors.border,
    backgroundColor: colors.cardSolid, position: 'relative',
  },
  checkmark: {
    position: 'absolute', top: 10, right: 10,
    width: 20, height: 20, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
  },
  currencySymbol: { fontSize: 28, fontWeight: '700', marginBottom: 4 },
  currencyCode:   { ...typography.h2, marginBottom: 4 },
  currencyName:   { ...typography.bodySmall, textAlign: 'center' },

  btn:     { borderRadius: 12, overflow: 'hidden' },
  btnGrad: { paddingVertical: 14, alignItems: 'center' },
  btnText: { ...typography.buttonPrimary },
  errorText: { ...typography.bodySmall, color: colors.danger, marginBottom: 12 },
});
