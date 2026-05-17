import React from 'react';
import { View, Text, Modal, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import GlassCard from './GlassCard';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';

const fmt = (n) => parseFloat(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** Bottom-sheet style actions: Edit / Delete entry */
export function TransactionActionModal({ visible, transaction, onClose, onEdit, onRequestDelete }) {
  if (!transaction) return null;
  const isIncome = transaction.type === 'income';
  const isInvestment = transaction.type === 'investment';
  const accent = colors.primary; // Consistent accent for Edit across types

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <TouchableOpacity style={StyleSheet.absoluteFillObject} activeOpacity={1} onPress={onClose} />
        <GlassCard style={styles.sheetCard}>
          <Text style={styles.sheetTitle}>Transaction</Text>
          <Text style={styles.sheetMeta} numberOfLines={1}>
            {isIncome ? 'Income Entry' : isInvestment ? 'Investment Contribution' : 'Expense Entry'} · {transaction.currency} {fmt(transaction.amount)}
          </Text>
          <Text style={styles.sheetCat} numberOfLines={1}>
            {transaction.category}
          </Text>

          <TouchableOpacity style={[styles.sheetBtn, { borderColor: accent }]} onPress={onEdit} activeOpacity={0.82}>
            <Ionicons name="pencil-outline" size={18} color={accent} />
            <Text style={[styles.sheetBtnText, { color: accent }]}>Edit</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.sheetBtnDanger} onPress={onRequestDelete} activeOpacity={0.82}>
            <Ionicons name="trash-outline" size={18} color="#fff" />
            <Text style={styles.sheetBtnDangerText}>Delete</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.sheetCancelWrap} onPress={onClose} activeOpacity={0.7}>
            <Text style={styles.sheetCancelText}>Cancel</Text>
          </TouchableOpacity>
        </GlassCard>
      </View>
    </Modal>
  );
}

export function DeleteTransactionConfirmModal({ visible, transaction, onClose, onConfirm, deleting }) {
  if (!transaction) return null;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={deleting ? undefined : onClose}>
      <View style={styles.overlay}>
        {!deleting ? (
          <TouchableOpacity style={StyleSheet.absoluteFillObject} activeOpacity={1} onPress={onClose} />
        ) : null}
        <GlassCard style={styles.confirmCard}>
          <Text style={styles.confirmTitle}>Delete this entry?</Text>
          <Text style={styles.confirmBody}>
            This will remove the {transaction.type === 'income' ? 'income' : 'expense'} record for{' '}
            <Text style={{ fontFamily: 'Inter_700Bold' }}>{transaction.category}</Text> ({transaction.currency}{' '}
            {fmt(transaction.amount)}). This cannot be undone.
          </Text>
          <View style={styles.confirmRow}>
            <TouchableOpacity style={styles.cancelBtn} onPress={onClose} disabled={deleting} activeOpacity={0.8}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.deleteBtn} onPress={onConfirm} disabled={deleting} activeOpacity={0.85}>
              {deleting ? <ActivityIndicator color="#fff" /> : <Text style={styles.deleteBtnText}>Delete</Text>}
            </TouchableOpacity>
          </View>
        </GlassCard>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 22,
  },
  sheetCard: { padding: 20, zIndex: 10, elevation: 12, width: '100%', maxWidth: 400 },
  sheetTitle: { ...typography.h3, marginBottom: 6 },
  sheetMeta: { ...typography.bodyMedium, color: colors.textSecondary },
  sheetCat: { ...typography.bodySmall, color: colors.textMuted, marginBottom: 16 },
  sheetBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1.5,
    backgroundColor: colors.cardSolid,
    marginBottom: 10,
  },
  sheetBtnText: { fontFamily: 'Inter_700Bold', fontSize: 15 },
  sheetBtnDanger: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: colors.danger,
    marginBottom: 6,
  },
  sheetBtnDangerText: { color: '#fff', fontFamily: 'Inter_700Bold', fontSize: 15 },
  sheetCancelWrap: { paddingVertical: 10, alignItems: 'center' },
  sheetCancelText: { ...typography.bodySmall, color: colors.textMuted, fontFamily: 'Inter_600SemiBold' },

  confirmCard: { padding: 22, zIndex: 10, elevation: 12, width: '100%', maxWidth: 400 },
  confirmTitle: { ...typography.h3, marginBottom: 10 },
  confirmBody: { ...typography.bodySmall, color: colors.textSecondary, lineHeight: 20, marginBottom: 20 },
  confirmRow: { flexDirection: 'row', gap: 10 },
  cancelBtn: {
    flex: 1,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    backgroundColor: colors.cardSolid,
  },
  cancelText: { color: colors.textSecondary, fontWeight: '600', fontSize: 14 },
  deleteBtn: {
    flex: 1,
    padding: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.danger,
    minHeight: 48,
  },
  deleteBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
});
