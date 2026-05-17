import React, { useEffect, useRef } from 'react';
import { Animated, Text, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';

/**
 * Usage: <Toast message="Saved!" type="success" visible={show} onHide={() => setShow(false)} />
 */
export default function Toast({ message, type = 'success', visible, onHide }) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(-50)).current; 

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(opacity, { toValue: 1, duration: 400, useNativeDriver: true }),
        Animated.timing(translateY, { toValue: 0, duration: 400, useNativeDriver: true }),
      ]).start(() => {
        setTimeout(() => {
          Animated.parallel([
            Animated.timing(opacity, { toValue: 0, duration: 300, useNativeDriver: true }),
            Animated.timing(translateY, { toValue: -20, duration: 300, useNativeDriver: true }),
          ]).start(() => onHide?.());
        }, 2200);
      });
    } else {
      opacity.setValue(0);
      translateY.setValue(-50);
    }
  }, [visible]);

  if (!visible) return null;

  const bgColor = type === 'success' ? colors.primary : colors.danger;
  const icon = type === 'success' ? 'checkmark-circle' : 'close-circle';

  return (
    <Animated.View style={[styles.container, { opacity, transform: [{ translateY }], backgroundColor: bgColor }]}>
      <Ionicons name={icon} size={18} color="#fff" />
      <Text style={styles.text}>{message}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 60,
    left: 20,
    right: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    zIndex: 9999,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 8,
  },
  text: { color: '#fff', fontWeight: '700', fontSize: 13, flex: 1 },
});
