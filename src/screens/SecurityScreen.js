import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';
import { updatePIN, updatePassword } from '../services/authService';
import AmbientBackground from '../components/AmbientBackground';
import GlassCard from '../components/GlassCard';

export default function SecurityScreen({ navigation, route }) {
  const { type } = route.params; // 'pin' or 'password'
  const [value, setValue] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showValue, setShowValue] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleUpdate = async () => {
    if (!value) return Alert.alert('Error', `Please enter a new ${type}`);
    if (value !== confirm) return Alert.alert('Error', `${type === 'pin' ? 'PINs' : 'Passwords'} do not match`);

    setLoading(true);
    try {
      if (type === 'pin') {
        if (value.length !== 4) {
          setLoading(false);
          return Alert.alert('Error', 'PIN must be exactly 4 digits');
        }
        await updatePIN(value);
      } else {
        if (value.length < 6) {
          setLoading(false);
          return Alert.alert('Error', 'Password must be at least 6 characters');
        }
        await updatePassword(value);
      }
      Alert.alert('Success', `${type === 'pin' ? 'PIN' : 'Password'} updated successfully`);
      navigation.goBack();
    } catch (e) {
      Alert.alert('Error', 'Update failed: ' + e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AmbientBackground>
      <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={22} color={colors.text} />
          </TouchableOpacity>
          <Text style={styles.title}>Update {type === 'pin' ? 'PIN' : 'Password'}</Text>
          <View style={{ width: 36 }} />
        </View>

        <View style={styles.content}>
          <GlassCard style={styles.card}>
            <Text style={styles.label}>New {type === 'pin' ? '4-Digit PIN' : 'Password'}</Text>
            <View style={styles.inputContainer}>
              <TextInput
                style={styles.input}
                value={value}
                onChangeText={setValue}
                secureTextEntry={!showValue}
                keyboardType={type === 'pin' ? 'numeric' : 'default'}
                maxLength={type === 'pin' ? 4 : 32}
                placeholder={`Enter new ${type}`}
                placeholderTextColor={colors.textMuted}
              />
              <TouchableOpacity style={styles.eyeBtn} onPress={() => setShowValue(!showValue)}>
                <Ionicons name={showValue ? 'eye-off-outline' : 'eye-outline'} size={20} color={colors.textMuted} />
              </TouchableOpacity>
            </View>

            <Text style={[styles.label, { marginTop: 20 }]}>Confirm New {type === 'pin' ? 'PIN' : 'Password'}</Text>
            <View style={styles.inputContainer}>
              <TextInput
                style={styles.input}
                value={confirm}
                onChangeText={setConfirm}
                secureTextEntry={!showConfirm}
                keyboardType={type === 'pin' ? 'numeric' : 'default'}
                maxLength={type === 'pin' ? 4 : 32}
                placeholder={`Confirm new ${type}`}
                placeholderTextColor={colors.textMuted}
              />
              <TouchableOpacity style={styles.eyeBtn} onPress={() => setShowConfirm(!showConfirm)}>
                <Ionicons name={showConfirm ? 'eye-off-outline' : 'eye-outline'} size={20} color={colors.textMuted} />
              </TouchableOpacity>
            </View>

            <TouchableOpacity style={styles.btn} onPress={handleUpdate} disabled={loading}>
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.btnText}>Update {type === 'pin' ? 'PIN' : 'Password'}</Text>
              )}
            </TouchableOpacity>
          </GlassCard>
        </View>
      </SafeAreaView>
    </AmbientBackground>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 18, paddingTop: 8, paddingBottom: 14 },
  backBtn: { width: 36, height: 36, justifyContent: 'center' },
  title: { ...typography.h2 },
  content: { padding: 18 },
  card: { padding: 20 },
  label: { ...typography.label, marginBottom: 8 },
  inputContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.cardSolid, borderRadius: 12, borderWidth: 1, borderColor: colors.border },
  input: { flex: 1, padding: 14, color: colors.text, fontSize: 16 },
  eyeBtn: { padding: 12 },
  btn: { backgroundColor: colors.primary, padding: 16, borderRadius: 12, alignItems: 'center', marginTop: 30, height: 55, justifyContent: 'center' },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});
