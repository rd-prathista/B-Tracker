import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { colors } from '../theme/colors';

export default function AmbientBackground({ children }) {
  const pulseAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 8000, // Slow breathing effect
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 0,
          duration: 8000,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, [pulseAnim]);

  const scale1 = pulseAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.1],
  });
  
  const scale2 = pulseAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [1.1, 1],
  });

  return (
    <View style={styles.container}>
      {/* Background Base */}
      <View style={styles.baseBg} />

      {/* Ambient Animated Orbs */}
      <Animated.View style={[styles.orb, styles.orb1, { transform: [{ scale: scale1 }] }]}>
        <LinearGradient
          colors={[colors.accentTeal + '40', 'transparent']}
          style={StyleSheet.absoluteFill}
          start={{ x: 0.5, y: 0.5 }}
          end={{ x: 1, y: 1 }}
        />
      </Animated.View>
      
      <Animated.View style={[styles.orb, styles.orb2, { transform: [{ scale: scale2 }] }]}>
        <LinearGradient
          colors={[colors.accentIndigo + '30', 'transparent']}
          style={StyleSheet.absoluteFill}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        />
      </Animated.View>

      {/* Blur Overlay to soften the orbs heavily */}
      <BlurView intensity={100} style={StyleSheet.absoluteFill} tint="dark" />

      {/* Foreground Content */}
      <View style={styles.content}>
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.backgroundDark,
  },
  baseBg: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.background,
  },
  orb: {
    position: 'absolute',
    width: 400,
    height: 400,
    borderRadius: 200,
  },
  orb1: {
    top: -100,
    left: -100,
  },
  orb2: {
    bottom: -100,
    right: -100,
  },
  content: {
    flex: 1,
    zIndex: 10,
  },
});
