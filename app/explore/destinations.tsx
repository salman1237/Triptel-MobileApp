import React, { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, SectionList, StyleSheet, Text, TextInput, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { getCountries } from '../../src/api/catalog';
import type { Country } from '../../src/api/catalog';
import { useAppSettings } from '../../src/state/AppSettingsContext';

type Section = { title: string; data: Country[] };

export default function DestinationsScreen() {
  const { t } = useAppSettings();
  const router = useRouter();
  const [search, setSearch] = useState('');

  // One fetch for the whole catalog - filtering/grouping below is client-side,
  // matching the web's D:\eSim\frontend\src\app\destinations\page.tsx.
  const countriesQuery = useQuery({
    queryKey: ['catalog', 'countries', 'all'],
    queryFn: () => getCountries(),
  });

  const sections = useMemo<Section[]>(() => {
    const countries = countriesQuery.data ?? [];
    const needle = search.trim().toLowerCase();
    const filtered = needle
      ? countries.filter(
          (c) => c.name_en.toLowerCase().includes(needle) || c.iso2.toLowerCase().includes(needle)
        )
      : countries;

    const groups = new Map<string, Country[]>();
    for (const country of filtered) {
      const region = country.region || t('explore', 'destinations_other_region', 'Other destinations');
      groups.set(region, [...(groups.get(region) ?? []), country]);
    }
    return Array.from(groups.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([title, data]) => ({ title, data }));
  }, [countriesQuery.data, search, t]);

  function openCountry(country: Country) {
    router.push(`/explore/${country.slug}`);
  }

  function renderItem({ item }: { item: Country }) {
    return (
      <Pressable
        onPress={() => openCountry(item)}
        accessibilityRole="button"
        accessibilityLabel={t('explore', 'destinations_item_a11y_label', `Explore eSIM packages for ${item.name_en}`)}
        style={styles.item}
        testID={`destination-${item.iso2}`}
      >
        <Text style={styles.itemText}>{item.name_en}</Text>
      </Pressable>
    );
  }

  return (
    <View style={styles.container}>
      <TextInput
        value={search}
        onChangeText={setSearch}
        placeholder={t('explore', 'destinations_search_placeholder', 'Search a country')}
        accessibilityLabel={t('explore', 'destinations_search_placeholder', 'Search a country')}
        style={styles.input}
        testID="destinations-directory-search-input"
      />

      {countriesQuery.isLoading && <ActivityIndicator testID="destinations-directory-loading" />}

      {countriesQuery.isError && (
        <Text style={styles.error} testID="destinations-directory-error">
          {t('explore', 'destinations_load_error', "Couldn't load destinations. Pull to try again.")}
        </Text>
      )}

      {!countriesQuery.isLoading && !countriesQuery.isError && sections.length === 0 && (
        <Text style={styles.empty} testID="destinations-directory-empty">
          {t('explore', 'destinations_empty', 'No destinations match your search.')}
        </Text>
      )}

      <SectionList
        sections={sections}
        keyExtractor={(item) => item.iso2}
        renderItem={renderItem}
        renderSectionHeader={({ section }) => (
          <Text style={styles.sectionHeader}>
            {section.title} · {section.data.length}
          </Text>
        )}
        testID="destinations-directory-list"
        stickySectionHeadersEnabled={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingTop: 16, paddingHorizontal: 16 },
  input: {
    minHeight: 44,
    borderWidth: 1,
    borderColor: '#D0D5DD',
    borderRadius: 8,
    paddingHorizontal: 12,
    marginBottom: 16,
  },
  sectionHeader: { fontSize: 12, fontWeight: '700', color: '#667085', marginTop: 12, marginBottom: 4 },
  item: { minHeight: 44, justifyContent: 'center', paddingVertical: 12 },
  itemText: { fontSize: 16 },
  error: { color: '#B42318', marginBottom: 8 },
  empty: { color: '#667085', marginBottom: 8 },
});
