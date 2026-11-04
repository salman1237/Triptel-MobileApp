import React, { useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { getCountries } from '../../src/api/catalog';
import type { Country } from '../../src/api/catalog';
import { useAppSettings } from '../../src/state/AppSettingsContext';
import { useDebouncedValue } from '../../src/lib/useDebouncedValue';

// Matches the web Home page's debounce - see D:\eSim\frontend\src\app\page.tsx.
const SEARCH_DEBOUNCE_MS = 300;

export default function HomeScreen() {
  const { t } = useAppSettings();
  const router = useRouter();
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search.trim(), SEARCH_DEBOUNCE_MS);
  const isSearching = debouncedSearch.length > 0;

  const popularQuery = useQuery({
    queryKey: ['catalog', 'countries', 'popular'],
    queryFn: () => getCountries({ popularOnly: true }),
  });

  const searchQuery = useQuery({
    queryKey: ['catalog', 'countries', 'search', debouncedSearch],
    queryFn: () => getCountries({ search: debouncedSearch }),
    enabled: isSearching,
  });

  const activeQuery = isSearching ? searchQuery : popularQuery;
  const countries = activeQuery.data ?? [];

  function openCountry(country: Country) {
    // app/explore/[slug].tsx doesn't exist yet (FR-203) - this is the route
    // it will live at per docs/Architecture.md -> "Folder layout".
    router.push(`/explore/${country.slug}`);
  }

  function renderItem({ item }: { item: Country }) {
    return (
      <Pressable
        onPress={() => openCountry(item)}
        accessibilityRole="button"
        accessibilityLabel={t('home', 'country_item_a11y_label', `Explore eSIM packages for ${item.name_en}`)}
        style={styles.item}
        testID={`country-${item.iso2}`}
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
        placeholder={t('home', 'search_placeholder', 'Search destinations')}
        accessibilityLabel={t('home', 'search_placeholder', 'Search destinations')}
        style={styles.input}
        testID="destination-search-input"
      />

      <Text style={styles.heading}>
        {isSearching
          ? t('home', 'search_results_heading', 'Search results')
          : t('home', 'popular_destinations_heading', 'Popular Destinations')}
      </Text>

      {activeQuery.isLoading && <ActivityIndicator testID="destinations-loading" />}

      {activeQuery.isError && (
        <Text style={styles.error} testID="destinations-error">
          {t('home', 'load_error', "Couldn't load destinations. Pull to try again.")}
        </Text>
      )}

      {!activeQuery.isLoading && !activeQuery.isError && countries.length === 0 && (
        <Text style={styles.empty} testID="destinations-empty">
          {isSearching
            ? t('home', 'search_empty', 'No destinations match your search.')
            : t('home', 'popular_empty', 'No popular destinations yet.')}
        </Text>
      )}

      <FlatList data={countries} keyExtractor={(item) => item.iso2} renderItem={renderItem} testID="destinations-list" />
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
  heading: { fontSize: 18, fontWeight: '600', marginBottom: 8 },
  item: { minHeight: 44, justifyContent: 'center', paddingVertical: 12 },
  itemText: { fontSize: 16 },
  error: { color: '#B42318', marginBottom: 8 },
  empty: { color: '#667085', marginBottom: 8 },
});
