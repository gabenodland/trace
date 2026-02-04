/**
 * SubscriptionScreen
 *
 * Shows subscription status, Pro features, and upgrade option.
 * Displays current tier with option to upgrade for free users.
 */

import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Platform, StatusBar, Linking, Alert } from "react-native";
import { useTheme } from "../shared/contexts/ThemeContext";
import { useNavigation } from "../shared/contexts/NavigationContext";
import { useSubscription } from "../shared/hooks/useSubscription";
import { themeBase } from "../shared/theme/themeBase";
import { Icon } from "../shared/components";

// Feature list for Pro subscription - only features that actually exist
const PRO_FEATURES = [
  {
    icon: "sync",
    title: "Cloud Sync",
    description: "Sync entries across all your devices",
  },
  {
    icon: "location",
    title: "Location Features",
    description: "Auto location detection and place search",
  },
  {
    icon: "theme",
    title: "Premium Themes",
    description: "5 additional themes including Synthwave",
  },
  {
    icon: "font",
    title: "Premium Fonts",
    description: "12 additional fonts from serif to monospace",
  },
  {
    icon: "unlimited",
    title: "Unlimited Entries",
    description: "No limits on entries, streams, or tags",
  },
];

function FeatureIcon({ icon, color }: { icon: string; color: string }) {
  const iconMap: { [key: string]: string } = {
    sync: "RefreshCw",
    backup: "CloudUpload",
    location: "MapPin",
    theme: "Palette",
    font: "Type",
    stats: "BarChart3",
    search: "Search",
    history: "Clock",
    widget: "Grid",
    image: "Image",
    unlimited: "Infinity",
  };

  const iconName = iconMap[icon] || "Star";
  return <Icon name={iconName as any} size={24} color={color} />;
}

export function SubscriptionScreen() {
  const theme = useTheme();
  const { navigate } = useNavigation();
  const { isPro, isDevMode, expiresAt, tier } = useSubscription();

  const isSubscribed = isPro || isDevMode;

  const handleUpgrade = () => {
    // TODO: Implement react-native-iap for iOS/Android
    Alert.alert(
      'Coming Soon',
      'In-app purchases will be available soon. Thank you for your interest in Trace Pro!',
      [{ text: 'OK' }]
    );
  };

  const formatExpiryDate = () => {
    if (!expiresAt) return null;
    return expiresAt.toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background.secondary }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: theme.colors.background.primary }]}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigate("back")}
          activeOpacity={0.7}
        >
          <Icon name="ChevronLeft" size={24} color={theme.colors.text.primary} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.colors.text.primary, fontFamily: theme.typography.fontFamily.semibold }]}>
          Trace Pro
        </Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Hero Section */}
        <View style={[styles.heroSection, { backgroundColor: theme.colors.functional.accent }]}>
          <View style={styles.heroIcon}>
            <Icon name="Star" size={48} color="#fff" />
          </View>
          <Text style={[styles.heroTitle, { fontFamily: theme.typography.fontFamily.bold }]}>
            {isSubscribed ? "You have Pro!" : "Upgrade to Pro"}
          </Text>
          <Text style={[styles.heroSubtitle, { fontFamily: theme.typography.fontFamily.regular }]}>
            {isSubscribed
              ? isDevMode
                ? "Developer access enabled"
                : expiresAt
                  ? `Active until ${formatExpiryDate()}`
                  : "Full access to all features"
              : "Unlock the full power of Trace"
            }
          </Text>
        </View>

        {/* Price Section (only for non-subscribers) */}
        {!isSubscribed && (
          <View style={[styles.priceSection, { backgroundColor: theme.colors.background.primary }, theme.shadows.sm]}>
            <Text style={[styles.priceLabel, { color: theme.colors.text.secondary, fontFamily: theme.typography.fontFamily.medium }]}>
              Annual Subscription
            </Text>
            <View style={styles.priceRow}>
              <Text style={[styles.priceAmount, { color: theme.colors.text.primary, fontFamily: theme.typography.fontFamily.bold }]}>
                $39.99
              </Text>
              <Text style={[styles.pricePeriod, { color: theme.colors.text.secondary, fontFamily: theme.typography.fontFamily.regular }]}>
                /year
              </Text>
            </View>
            <Text style={[styles.priceNote, { color: theme.colors.text.tertiary, fontFamily: theme.typography.fontFamily.regular }]}>
              That's just $3.33/month
            </Text>
          </View>
        )}

        {/* Features List */}
        <View style={styles.featuresSection}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text.tertiary, fontFamily: theme.typography.fontFamily.semibold }]}>
            {isSubscribed ? "YOUR PRO FEATURES" : "WHAT YOU GET"}
          </Text>
          <View style={[styles.featuresList, { backgroundColor: theme.colors.background.primary }, theme.shadows.sm]}>
            {PRO_FEATURES.map((feature, index) => (
              <View
                key={feature.icon}
                style={[
                  styles.featureItem,
                  index < PRO_FEATURES.length - 1 && [styles.featureItemBorder, { borderBottomColor: theme.colors.border.light }],
                ]}
              >
                <View style={[styles.featureIconContainer, { backgroundColor: theme.colors.functional.accentLight }]}>
                  <FeatureIcon icon={feature.icon} color={theme.colors.functional.accent} />
                </View>
                <View style={styles.featureContent}>
                  <Text style={[styles.featureTitle, { color: theme.colors.text.primary, fontFamily: theme.typography.fontFamily.semibold }]}>
                    {feature.title}
                  </Text>
                  <Text style={[styles.featureDescription, { color: theme.colors.text.secondary, fontFamily: theme.typography.fontFamily.regular }]}>
                    {feature.description}
                  </Text>
                </View>
                {isSubscribed && (
                  <Icon name="Check" size={20} color={theme.colors.functional.complete} />
                )}
              </View>
            ))}
          </View>
        </View>

        {/* Manage Subscription (for subscribers) */}
        {isSubscribed && !isDevMode && (
          <View style={styles.manageSection}>
            <Text style={[styles.sectionTitle, { color: theme.colors.text.tertiary, fontFamily: theme.typography.fontFamily.semibold }]}>
              MANAGE SUBSCRIPTION
            </Text>
            <View style={[styles.manageCard, { backgroundColor: theme.colors.background.primary }, theme.shadows.sm]}>
              <TouchableOpacity
                style={styles.manageRow}
                onPress={() => {
                  // TODO: Open Stripe Customer Portal
                  // Linking.openURL('https://billing.stripe.com/p/login/YOUR_PORTAL_ID');
                }}
                activeOpacity={0.7}
              >
                <View style={styles.manageRowContent}>
                  <Icon name="CreditCard" size={22} color={theme.colors.text.secondary} />
                  <View style={styles.manageRowText}>
                    <Text style={[styles.manageRowTitle, { color: theme.colors.text.primary, fontFamily: theme.typography.fontFamily.medium }]}>
                      Update Payment Method
                    </Text>
                    <Text style={[styles.manageRowSubtitle, { color: theme.colors.text.secondary, fontFamily: theme.typography.fontFamily.regular }]}>
                      Change your card on file
                    </Text>
                  </View>
                </View>
                <Icon name="ChevronRight" size={20} color={theme.colors.text.tertiary} />
              </TouchableOpacity>
              <View style={[styles.manageDivider, { backgroundColor: theme.colors.border.light }]} />
              <TouchableOpacity
                style={styles.manageRow}
                onPress={() => {
                  // TODO: Open Stripe Customer Portal to cancellation
                  // Linking.openURL('https://billing.stripe.com/p/login/YOUR_PORTAL_ID');
                }}
                activeOpacity={0.7}
              >
                <View style={styles.manageRowContent}>
                  <Icon name="LogOut" size={22} color={theme.colors.functional.overdue} />
                  <View style={styles.manageRowText}>
                    <Text style={[styles.manageRowTitle, { color: theme.colors.functional.overdue, fontFamily: theme.typography.fontFamily.medium }]}>
                      Cancel Subscription
                    </Text>
                    <Text style={[styles.manageRowSubtitle, { color: theme.colors.text.secondary, fontFamily: theme.typography.fontFamily.regular }]}>
                      Access continues until {formatExpiryDate() || 'end of period'}
                    </Text>
                  </View>
                </View>
                <Icon name="ChevronRight" size={20} color={theme.colors.text.tertiary} />
              </TouchableOpacity>
            </View>
            <Text style={[styles.manageNote, { color: theme.colors.text.tertiary, fontFamily: theme.typography.fontFamily.regular }]}>
              Opens Stripe billing portal in your browser
            </Text>
          </View>
        )}

        {/* Upgrade Button (only for non-subscribers) */}
        {!isSubscribed && (
          <View style={styles.upgradeSection}>
            <TouchableOpacity
              style={[styles.upgradeButton, { backgroundColor: theme.colors.functional.accent }]}
              onPress={handleUpgrade}
              activeOpacity={0.8}
            >
              <Text style={[styles.upgradeButtonText, { fontFamily: theme.typography.fontFamily.semibold }]}>
                Upgrade to Pro - $39.99/year
              </Text>
            </TouchableOpacity>
            <Text style={[styles.termsText, { color: theme.colors.text.tertiary, fontFamily: theme.typography.fontFamily.regular }]}>
              Subscription renews annually. Cancel anytime.
            </Text>
          </View>
        )}

        {/* Free Tier Info (only for non-subscribers) */}
        {!isSubscribed && (
          <View style={styles.freeSection}>
            <Text style={[styles.sectionTitle, { color: theme.colors.text.tertiary, fontFamily: theme.typography.fontFamily.semibold }]}>
              FREE TIER INCLUDES
            </Text>
            <View style={[styles.freeList, { backgroundColor: theme.colors.background.primary }, theme.shadows.sm]}>
              <View style={styles.freeItem}>
                <Text style={[styles.freeItemText, { color: theme.colors.text.primary, fontFamily: theme.typography.fontFamily.regular }]}>
                  Up to 100 entries
                </Text>
              </View>
              <View style={[styles.freeItem, { borderTopWidth: 1, borderTopColor: theme.colors.border.light }]}>
                <Text style={[styles.freeItemText, { color: theme.colors.text.primary, fontFamily: theme.typography.fontFamily.regular }]}>
                  3 themes (Light, Dark, Sepia)
                </Text>
              </View>
              <View style={[styles.freeItem, { borderTopWidth: 1, borderTopColor: theme.colors.border.light }]}>
                <Text style={[styles.freeItemText, { color: theme.colors.text.primary, fontFamily: theme.typography.fontFamily.regular }]}>
                  3 fonts (Inter, Roboto, Open Sans)
                </Text>
              </View>
              <View style={[styles.freeItem, { borderTopWidth: 1, borderTopColor: theme.colors.border.light }]}>
                <Text style={[styles.freeItemText, { color: theme.colors.text.primary, fontFamily: theme.typography.fontFamily.regular }]}>
                  3 streams
                </Text>
              </View>
            </View>
          </View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: Platform.OS === "ios" ? 60 : (StatusBar.currentHeight || 0) + 16,
    paddingBottom: themeBase.spacing.md,
    paddingHorizontal: themeBase.spacing.md,
  },
  backButton: {
    padding: themeBase.spacing.sm,
  },
  headerTitle: {
    fontSize: 17,
  },
  headerSpacer: {
    width: 40,
  },
  content: {
    flex: 1,
  },
  heroSection: {
    padding: themeBase.spacing.xl,
    alignItems: "center",
  },
  heroIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: themeBase.spacing.md,
  },
  heroTitle: {
    fontSize: 28,
    color: "#fff",
    marginBottom: themeBase.spacing.xs,
  },
  heroSubtitle: {
    fontSize: 16,
    color: "rgba(255,255,255,0.9)",
    textAlign: "center",
  },
  priceSection: {
    margin: themeBase.spacing.lg,
    padding: themeBase.spacing.lg,
    borderRadius: 12,
    alignItems: "center",
  },
  priceLabel: {
    fontSize: 14,
    marginBottom: themeBase.spacing.xs,
  },
  priceRow: {
    flexDirection: "row",
    alignItems: "baseline",
  },
  priceAmount: {
    fontSize: 36,
  },
  pricePeriod: {
    fontSize: 18,
    marginLeft: 4,
  },
  priceNote: {
    fontSize: 14,
    marginTop: themeBase.spacing.xs,
  },
  featuresSection: {
    paddingHorizontal: themeBase.spacing.lg,
    marginBottom: themeBase.spacing.lg,
  },
  sectionTitle: {
    fontSize: 12,
    letterSpacing: 1,
    marginBottom: themeBase.spacing.sm,
    marginLeft: themeBase.spacing.xs,
  },
  featuresList: {
    borderRadius: 12,
    overflow: "hidden",
  },
  featureItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: themeBase.spacing.md,
  },
  featureItemBorder: {
    borderBottomWidth: 1,
  },
  featureIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    marginRight: themeBase.spacing.md,
  },
  featureContent: {
    flex: 1,
  },
  featureTitle: {
    fontSize: 15,
    marginBottom: 2,
  },
  featureDescription: {
    fontSize: 13,
  },
  upgradeSection: {
    paddingHorizontal: themeBase.spacing.lg,
    marginBottom: themeBase.spacing.xl,
  },
  upgradeButton: {
    paddingVertical: themeBase.spacing.md,
    borderRadius: 12,
    alignItems: "center",
  },
  upgradeButtonText: {
    color: "#fff",
    fontSize: 16,
  },
  termsText: {
    fontSize: 12,
    textAlign: "center",
    marginTop: themeBase.spacing.sm,
  },
  freeSection: {
    paddingHorizontal: themeBase.spacing.lg,
  },
  freeList: {
    borderRadius: 12,
    overflow: "hidden",
  },
  freeItem: {
    padding: themeBase.spacing.md,
  },
  freeItemText: {
    fontSize: 14,
  },
  manageSection: {
    paddingHorizontal: themeBase.spacing.lg,
    marginBottom: themeBase.spacing.lg,
  },
  manageCard: {
    borderRadius: 12,
    overflow: "hidden",
  },
  manageRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: themeBase.spacing.md,
  },
  manageRowContent: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  manageRowText: {
    marginLeft: themeBase.spacing.md,
    flex: 1,
  },
  manageRowTitle: {
    fontSize: 15,
  },
  manageRowSubtitle: {
    fontSize: 13,
    marginTop: 2,
  },
  manageDivider: {
    height: 1,
    marginLeft: 54,
  },
  manageNote: {
    fontSize: 12,
    textAlign: "center",
    marginTop: themeBase.spacing.sm,
  },
});
