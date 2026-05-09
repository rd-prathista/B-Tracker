import React, { useEffect, useRef } from 'react';
import { Animated, Text, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';

/**
 * Usage: <Toast message="Saved!" type="success" visible={show} onHide={() => setShow(false)} />
 */
export default function Toast({ message, type = 'success', visible, onHide }) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(-30)).current; // Slides down from top

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(opacity, { toValue: 1, duration: 250, useNativeDriver: true }),
        Animated.timing(translateY, { toValue: 0, duration: 250, useNativeDriver: true }),
      ]).start(() => {
        // Auto-dismiss after 2.5s
        setTimeout(() => {
          Animated.parallel([
            Animated.timing(opacity, { toValue: 0, duration: 300, useNativeDriver: true }),
            Animated.timing(translateY, { toValue: 30, duration: 300, useNativeDriver: true }),
          ]).start(() => onHide?.());
        }, 2500);
      });
    }
  }, [visible]);

  if (!visible) return null;

  const bgColor = type === 'success' ? colors.primary : colors.danger;
  const icon = type === 'success' ? 'checkmark-circle' : 'close-circle';

  return (
    <Animated.View style={[styles.container, { opacity, transform: [{ translateY }], backgroundColor: bgColor }]}>
      <Ionicons name={icon} size={20} color="#fff" />
      <Text style={styles.text}>{message}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 54,   // Top position — always visible, above keyboard
    left: 24,
    right: 24,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 16,
    zIndex: 999,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 10,
  },
  text: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 15,
    flex: 1,
  },
});
