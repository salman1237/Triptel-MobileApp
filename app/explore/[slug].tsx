import React from 'react';
import { ActivityIndicator, Image, StyleSheet, Text, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useLocalSearchParams } from 'expo-router';
import { getDestination } from '../../src/api/catalog';
import { useAppSettings } from '../../src/state/AppSettingsContext';
import PackageBrowser from '../../src/components/PackageBrowser';

export default function CountryLandingScreen() {
  const { t, formatPrice } = useAppSettings();
  const { slug } = useLocalSearchParams<{ slug: string }>();

  const destinationQuery = useQuery({
    queryKey: ['catalog', 'destination', slug],
    queryFn: () => getDestination(slug),
    enabled: Boolean(slug),
  });

  if (destinationQuery.isLoading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator testID="country-loading" />
      </View>
    );
  }

  if (destinationQuery.isError || !destinationQuery.data) {
    return (
      <View style={styles.container}>
        <Text style={styles.error} testID="country-error">
          {t('explore', 'country_load_error', "Couldn't load this destination. Pull to try again.")}
        </Text>
      </View>
    );
  }

  const { country, products } = destinationQuery.data;
  const cheapestPrice = products.length > 0 ? Math.min(...products.map((p) => p.retail_price)) : null;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        {country.flag_url && (
          <Image source={{ uri: country.flag_url }} style={styles.flag} accessibilityLabel={country.name_en} />
        )}
        <Text style={styles.countryName}>{country.name_en}</Text>
        <Text style={styles.packageCount} testID="country-package-count">
          {t('explore', 'country_package_count', `${products.length} packages available`)}
        </Text>
        {cheapestPrice !== null && (
          <Text style={styles.cheapestPrice} testID="country-cheapest-price">
            {t('explore', 'country_from_price', 'From')} {formatPrice(cheapestPrice)}
          </Text>
        )}
      </View>

      {products.length === 0 ? (
        <Text style={styles.empty} testID="country-no-packages">
          {t('explore', 'country_no_packages', 'No packages are available for this destination yet.')}
        </Text>
      ) : (
        <PackageBrowser products={products} countrySlug={slug} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingTop: 16, paddingHorizontal: 16 },
  header: { marginBottom: 16 },
  flag: { width: 48, height: 32, borderRadius: 4, marginBottom: 8 },
  countryName: { fontSize: 24, fontWeight: '700' },
  packageCount: { fontSize: 14, color: '#667085', marginTop: 4 },
  cheapestPrice: { fontSize: 16, fontWeight: '600', marginTop: 4 },
  error: { color: '#B42318' },
  empty: { color: '#667085' },
});
