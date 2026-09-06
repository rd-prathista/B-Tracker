import React, { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { View, ActivityIndicator } from 'react-native';
import * as Updates from 'expo-updates';
import {
  useFonts,
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  Inter_800ExtraBold,
} from '@expo-google-fonts/inter';
import AppNavigator from './src/navigation/AppNavigator';
import StartupErrorBoundary from './src/components/StartupErrorBoundary';
import { initDatabase } from './src/database/db';
import { colors } from './src/theme/colors';

export default function App() {
  const [dbReady, setDbReady] = React.useState(false);
  const [fontsLoaded] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    Inter_800ExtraBold,
  });

  useEffect(() => {
    try {
      initDatabase();
    } catch (e) {
      console.error('App initDatabase error:', e);
    } finally {
      setDbReady(true);
    }
  }, []);

  useEffect(() => {
    async function checkAndApplyUpdates() {
      if (__DEV__) return;
      try {
        const update = await Updates.checkForUpdateAsync();
        if (update.isAvailable) {
          await Updates.fetchUpdateAsync();
          await Updates.reloadAsync();
        }
      } catch (e) {
        console.log('[OTA Updates] Launch check error:', e);
      }
    }
    checkAndApplyUpdates();
  }, []);

  // Wait for fonts & database initialization before rendering to avoid racing queries
  if (!fontsLoaded || !dbReady) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <StatusBar style="light" backgroundColor={colors.background} />
      <StartupErrorBoundary>
        <AppNavigator />
      </StartupErrorBoundary>
    </SafeAreaProvider>
  );
}
