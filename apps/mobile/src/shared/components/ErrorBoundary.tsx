import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert } from 'react-native';
import * as Clipboard from 'expo-clipboard';

interface Props {
  children: React.ReactNode;
  name: string; // Name to identify which boundary caught the error
  onBack?: () => void; // Optional callback to navigate back
}

interface State {
  hasError: boolean;
  error: Error | null;
  componentStack: string;
  showDetails: boolean;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, componentStack: '', showDetails: false };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Store component stack for display
    this.setState({ componentStack: errorInfo.componentStack || '' });

    console.error(`🚨 [ErrorBoundary:${this.props.name}] Caught error:`, {
      error: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
    });
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null, componentStack: '', showDetails: false });
  };

  handleBack = () => {
    // Reset error state first, then navigate back
    this.setState({ hasError: false, error: null, componentStack: '', showDetails: false }, () => {
      this.props.onBack?.();
    });
  };

  toggleDetails = () => {
    this.setState(prev => ({ showDetails: !prev.showDetails }));
  };

  handleCopy = async () => {
    const { error, componentStack } = this.state;
    const { name } = this.props;

    const errorText = [
      `Error in: ${name}`,
      `Message: ${error?.message || 'Unknown error'}`,
      '',
      '--- Component Stack ---',
      componentStack || 'N/A',
      '',
      '--- Error Stack ---',
      error?.stack || 'N/A',
    ].join('\n');

    await Clipboard.setStringAsync(errorText);
    Alert.alert('Copied', 'Error details copied to clipboard');
  };

  render() {
    if (this.state.hasError) {
      const { error, componentStack, showDetails } = this.state;
      const { name, onBack } = this.props;

      return (
        <View style={styles.container}>
          <View style={styles.iconContainer}>
            <Text style={styles.icon}>⚠️</Text>
          </View>

          <Text style={styles.title}>Something went wrong</Text>
          <Text style={styles.subtitle}>Error in {name}</Text>

          <View style={styles.errorBox}>
            <Text style={styles.errorMessage} numberOfLines={showDetails ? undefined : 3}>
              {error?.message || 'Unknown error'}
            </Text>
          </View>

          <View style={styles.buttonRow}>
            {onBack && (
              <TouchableOpacity style={styles.backButton} onPress={this.handleBack}>
                <Text style={styles.backButtonText}>← Go Back</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity style={styles.retryButton} onPress={this.handleRetry}>
              <Text style={styles.retryButtonText}>Try Again</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.detailsRow}>
            <TouchableOpacity style={styles.detailsToggle} onPress={this.toggleDetails}>
              <Text style={styles.detailsToggleText}>
                {showDetails ? 'Hide Details' : 'Show Details'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.copyButton} onPress={this.handleCopy}>
              <Text style={styles.copyButtonText}>Copy Error</Text>
            </TouchableOpacity>
          </View>

          {showDetails && (
            <ScrollView style={styles.stackContainer}>
              {componentStack && (
                <>
                  <Text style={styles.stackHeader}>Component Stack:</Text>
                  <Text style={styles.stackTrace}>{componentStack}</Text>
                </>
              )}
              {error?.stack && (
                <>
                  <Text style={[styles.stackHeader, componentStack ? styles.stackHeaderMargin : null]}>
                    Error Stack:
                  </Text>
                  <Text style={styles.stackTrace}>{error.stack}</Text>
                </>
              )}
            </ScrollView>
          )}
        </View>
      );
    }

    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    backgroundColor: '#f9fafb',
  },
  iconContainer: {
    marginBottom: 16,
  },
  icon: {
    fontSize: 48,
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 20,
  },
  errorBox: {
    backgroundColor: '#fef2f2',
    borderRadius: 8,
    padding: 16,
    width: '100%',
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#fecaca',
  },
  errorMessage: {
    fontSize: 14,
    color: '#991b1b',
    fontFamily: 'monospace',
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  backButton: {
    backgroundColor: '#e5e7eb',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
  },
  backButtonText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#374151',
  },
  retryButton: {
    backgroundColor: '#3b82f6',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#ffffff',
  },
  detailsRow: {
    flexDirection: 'row',
    gap: 16,
    alignItems: 'center',
  },
  detailsToggle: {
    padding: 8,
  },
  detailsToggleText: {
    fontSize: 14,
    color: '#6b7280',
    textDecorationLine: 'underline',
  },
  copyButton: {
    backgroundColor: '#10b981',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  copyButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#ffffff',
  },
  stackContainer: {
    maxHeight: 300,
    width: '100%',
    marginTop: 12,
    backgroundColor: '#f3f4f6',
    borderRadius: 8,
    padding: 12,
  },
  stackHeader: {
    fontSize: 12,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 4,
  },
  stackHeaderMargin: {
    marginTop: 16,
  },
  stackTrace: {
    fontSize: 10,
    fontFamily: 'monospace',
    color: '#4b5563',
  },
});
