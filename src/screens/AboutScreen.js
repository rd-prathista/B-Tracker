import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';
import AmbientBackground from '../components/AmbientBackground';
import GlassCard from '../components/GlassCard';

export default function AboutScreen({ navigation }) {
  return (
    <AmbientBackground>
      <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={22} color={colors.text} />
          </TouchableOpacity>
          <Text style={styles.title}>About B Tracker</Text>
          <View style={{ width: 36 }} />
        </View>

        <ScrollView contentContainerStyle={styles.scroll}>
          <GlassCard style={styles.card}>
            <Text style={styles.h1}>Premium Family Finance</Text>
            <Text style={styles.body}>
              B Tracker is a lightweight, offline-first fintech application designed for high-density mobile usage. 
              Created for private family use to track cross-currency (AED & INR) finances with ease.
            </Text>

            <Text style={styles.h2}>Key Features</Text>
            <View style={styles.featureRow}>
              <Ionicons name="checkmark-circle" size={18} color={colors.primary} />
              <Text style={styles.featureText}>Isolated AED & INR Balance Tracking</Text>
            </View>
            <View style={styles.featureRow}>
              <Ionicons name="checkmark-circle" size={18} color={colors.primary} />
              <Text style={styles.featureText}>Monthly Net Result History Grouping</Text>
            </View>
            <View style={styles.featureRow}>
              <Ionicons name="checkmark-circle" size={18} color={colors.primary} />
              <Text style={styles.featureText}>Advanced Category spending insights</Text>
            </View>

            <Text style={styles.h2}>Privacy & Sync</Text>
            <Text style={styles.body}>
              Your data never leaves your device unless you manually sync with Google Drive. 
              Syncing creates a private JSON backup in your personal Drive app data folder.
            </Text>

            <Text style={styles.h2}>Support</Text>
            <Text style={styles.body}>
              Designed for simple, reliable financial oversight. No ads, no tracking, just finance.
            </Text>

            <View style={styles.footer}>
              <Text style={styles.versionLabel}>Version 1.0.0 (Gold)</Text>
              <Text style={styles.copyright}>© 2026 B Tracker Team</Text>
            </View>
          </GlassCard>
        </ScrollView>
      </SafeAreaView>
    </AmbientBackground>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 18, paddingTop: 8, paddingBottom: 14 },
  backBtn: { width: 36, height: 36, justifyContent: 'center' },
  title: { ...typography.h2 },
  scroll: { padding: 18 },
  card: { padding: 20 },
  h1: { ...typography.h1, fontSize: 20, marginBottom: 12 },
  h2: { ...typography.h3, marginTop: 24, marginBottom: 8, color: colors.textSecondary },
  body: { ...typography.bodyMedium, color: colors.textMuted, lineHeight: 22 },
  featureRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 10 },
  featureText: { ...typography.bodySmall, color: colors.text },
  footer: { marginTop: 40, alignItems: 'center', borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 20 },
  versionLabel: { ...typography.label, color: colors.textSecondary },
  copyright: { ...typography.caption, color: colors.textMuted, marginTop: 4 },
});
