import React from 'react';
import { ActivityIndicator, FlatList, Image, StyleSheet, Text, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useLocalSearchParams } from 'expo-router';
import { getDestination } from '../../src/api/catalog';
import type { Product } from '../../src/api/catalog';
import { useAppSettings } from '../../src/state/AppSettingsContext';

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

  function renderProduct({ item }: { item: Product }) {
    return (
      <View style={styles.productCard} testID={`product-${item.id}`}>
        {item.is_featured && (
          <Text style={styles.featuredBadge} testID={`product-featured-${item.id}`}>
            {t('explore', 'package_featured_badge', 'Recommended')}
          </Text>
        )}
        <Text style={styles.productTitle}>{item.title_en}</Text>
        <Text style={styles.productMeta}>
          {item.is_unlimited
            ? t('explore', 'package_unlimited', 'Unlimited data')
            : t('explore', 'package_data_amount', `${item.data_amount_gb} GB`)}
          {' · '}
          {t('explore', 'package_validity', `${item.validity_days} days`)}
        </Text>
        <Text style={styles.productPrice}>{formatPrice(item.retail_price)}</Text>
      </View>
    );
  }

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
        <FlatList data={products} keyExtractor={(item) => item.id} renderItem={renderProduct} testID="country-package-list" />
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
  productCard: {
    minHeight: 44,
    borderWidth: 1,
    borderColor: '#D0D5DD',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  featuredBadge: {
    alignSelf: 'flex-start',
    fontSize: 11,
    fontWeight: '700',
    color: '#1D4ED8',
    backgroundColor: '#DBEAFE',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    marginBottom: 6,
  },
  productTitle: { fontSize: 16, fontWeight: '600' },
  productMeta: { fontSize: 13, color: '#667085', marginTop: 2 },
  productPrice: { fontSize: 16, fontWeight: '700', marginTop: 6 },
  error: { color: '#B42318' },
  empty: { color: '#667085' },
});
