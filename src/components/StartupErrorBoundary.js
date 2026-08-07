import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  StatusBar,
  Alert,
  Platform,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';

export default class StartupErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      copied: false,
    };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('CRITICAL STARTUP ERROR CAUGHT BY BOUNDARY:', error, errorInfo);
    this.setState({ errorInfo });
  }

  handleCopy = async () => {
    const { error, errorInfo } = this.state;
    const fullMessage = [
      `=== B TRACKER STARTUP ERROR ===`,
      `Message: ${error?.message || String(error)}`,
      `File/Stack:`,
      error?.stack || 'No JS stack available',
      `Component Stack:`,
      errorInfo?.componentStack || 'No component stack available',
    ].join('\n\n');

    try {
      if (Clipboard && Clipboard.setStringAsync) {
        await Clipboard.setStringAsync(fullMessage);
      } else if (Clipboard && Clipboard.setString) {
        Clipboard.setString(fullMessage);
      }
      this.setState({ copied: true });
      setTimeout(() => this.setState({ copied: false }), 3000);
    } catch (e) {
      Alert.alert('Error Details', fullMessage);
    }
  };

  handleRetry = () => {
    this.setState({ hasError: false, error: null, errorInfo: null, copied: false });
  };

  render() {
    if (this.state.hasError) {
      const errorMsg = this.state.error?.message || String(this.state.error || 'Unknown Error');
      const stack = this.state.error?.stack || this.state.errorInfo?.componentStack || '';

      return (
        <SafeAreaView style={styles.container}>
          <StatusBar barStyle="light-content" backgroundColor="#0F172A" />
          <View style={styles.header}>
            <Text style={styles.warningBadge}>⚠️ DIAGNOSTIC MODE</Text>
            <Text style={styles.title}>Startup Error</Text>
            <Text style={styles.subtitle}>
              An unexpected error occurred after authentication. Details are displayed below.
            </Text>
          </View>

          <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
            <View style={styles.card}>
              <Text style={styles.cardLabel}>ERROR MESSAGE</Text>
              <Text style={styles.errorText}>{errorMsg}</Text>

              {stack ? (
                <>
                  <Text style={[styles.cardLabel, { marginTop: 16 }]}>AFFECTED LOCATION / STACK TRACE</Text>
                  <View style={styles.codeBox}>
                    <Text style={styles.codeText}>{stack}</Text>
                  </View>
                </>
              ) : null}
            </View>
          </ScrollView>

          <View style={styles.footer}>
            <TouchableOpacity style={styles.copyBtn} activeOpacity={0.8} onPress={this.handleCopy}>
              <Text style={styles.copyBtnText}>
                {this.state.copied ? '✓ Copied to Clipboard!' : '📋 Copy Error Details'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.retryBtn} activeOpacity={0.8} onPress={this.handleRetry}>
              <Text style={styles.retryBtnText}>🔄 Retry Startup</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      );
    }

    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 12,
  },
  warningBadge: {
    color: '#F59E0B',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1,
    marginBottom: 6,
  },
  title: {
    color: '#EF4444',
    fontSize: 26,
    fontWeight: '800',
  },
  subtitle: {
    color: '#94A3B8',
    fontSize: 13,
    marginTop: 4,
    lineHeight: 18,
  },
  scroll: {
    flex: 1,
    paddingHorizontal: 20,
  },
  scrollContent: {
    paddingVertical: 12,
  },
  card: {
    backgroundColor: '#1E293B',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#334155',
  },
  cardLabel: {
    color: '#38BDF8',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  errorText: {
    color: '#F1F5F9',
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 20,
  },
  codeBox: {
    backgroundColor: '#090D16',
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: '#1E293B',
    marginTop: 4,
  },
  codeText: {
    color: '#A7F3D0',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontSize: 11,
    lineHeight: 16,
  },
  footer: {
    padding: 20,
    gap: 10,
  },
  copyBtn: {
    backgroundColor: '#6366F1',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  copyBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  retryBtn: {
    backgroundColor: '#334155',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  retryBtnText: {
    color: '#F8FAFC',
    fontSize: 15,
    fontWeight: '600',
  },
});
