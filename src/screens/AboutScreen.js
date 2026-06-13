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
              B Tracker is an offline-first financial manager designed for private family use to track cross-currency (AED & INR) finances, categories, and investments with complete privacy.
            </Text>

            <Text style={styles.h2}>How to Use B Tracker</Text>

            <Text style={styles.sectionTitle}>💰 Cash Flow Tracking</Text>
            <Text style={styles.bodySmall}>
              • Add transactions (Income / Expense) via the Quick Add button.{"\n"}
              • Switch currency between AED & INR seamlessly.{"\n"}
              • Edit or delete entries directly from the dashboard and ledger feeds.
            </Text>

            <Text style={styles.sectionTitle}>📈 Dual-Mode Investments</Text>
            <Text style={styles.bodySmall}>
              • <Text style={styles.bold}>Setup Mode:</Text> Define a master scheme name, recurring amount, tenure (Months/Years), start date, and notes. This automatically logs the initial payment.{"\n"}
              • <Text style={styles.bold}>Contribution Mode:</Text> In the Investments view under reports, expand the card and click "Add Invest" to easily log subsequent payments.{"\n"}
              • <Text style={styles.bold}>Closed/Completed Schemes:</Text> Cards automatically lock to completed status when tenure is met, moving to the Archived view so no accidental entries are added.
            </Text>

            <Text style={styles.sectionTitle}>🎨 Custom Category Management</Text>
            <Text style={styles.bodySmall}>
              • Manage categories for Income, Expense, and Investments.{"\n"}
              • Create custom categories and assign unique vector icons.
            </Text>

            <Text style={styles.sectionTitle}>☁️ Cloud Sync Backup & Restore</Text>
            <Text style={styles.bodySmall}>
              • Register a secure sync profile in Settings using Email/Password.{"\n"}
              • Back up all local data securely to your private cloud storage bucket.{"\n"}
              • Overwrite local data to restore from any device at any time.
            </Text>

            <Text style={styles.h2}>Privacy First</Text>
            <Text style={styles.body}>
              B Tracker holds your privacy paramount. Your data is stored locally in an on-device SQLite database. Cloud backups run only at your request, sending your data securely directly to your private cloud bucket.
            </Text>

            <View style={styles.footer}>
              <Text style={styles.versionLabel}>Version 1.2.0 (Gold)</Text>
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
  h2: { ...typography.h3, marginTop: 28, marginBottom: 12, color: colors.primary },
  sectionTitle: { ...typography.bodyMedium, fontFamily: 'Inter_700Bold', color: colors.text, marginTop: 14, marginBottom: 6 },
  body: { ...typography.bodyMedium, color: colors.textMuted, lineHeight: 22 },
  bodySmall: { ...typography.bodySmall, color: colors.textMuted, lineHeight: 20, paddingLeft: 6 },
  bold: { fontFamily: 'Inter_700Bold', color: colors.text },
  footer: { marginTop: 40, alignItems: 'center', borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 20 },
  versionLabel: { ...typography.label, color: colors.textSecondary },
  copyright: { ...typography.caption, color: colors.textMuted, marginTop: 4 },
});
