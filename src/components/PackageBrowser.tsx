import React, { useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import type { Product } from '../api/catalog';
import { useAppSettings } from '../state/AppSettingsContext';

// FR-301 - the "choose" state of the web's PackageBrowser.tsx state machine
// (docs/Architecture.md -> "The checkout state machine"). Display + filter
// only for now - Buy Now / discount code / payment are later FRs (FR-302+);
// this component grows into the rest of that state machine then, it isn't
// redesigned.
export type PackageBrowserProps = {
  products: Product[];
};

const ALL_FILTER = 'all';

function dataSizeLabel(product: Product): string {
  return product.is_unlimited ? 'Unlimited' : `${product.data_amount_gb} GB`;
}

function validityLabel(product: Product): string {
  return `${product.validity_days} days`;
}

export default function PackageBrowser({ products }: PackageBrowserProps) {
  const { t, formatPrice } = useAppSettings();
  const [dataSizeFilter, setDataSizeFilter] = useState(ALL_FILTER);
  const [validityFilter, setValidityFilter] = useState(ALL_FILTER);

  const dataSizeOptions = useMemo(() => {
    const seen = new Map<string, number>();
    for (const p of products) {
      const label = dataSizeLabel(p);
      if (!seen.has(label)) seen.set(label, p.is_unlimited ? Number.MAX_SAFE_INTEGER : p.data_amount_gb);
    }
    return Array.from(seen.entries())
      .sort(([, a], [, b]) => a - b)
      .map(([label]) => label);
  }, [products]);

  const validityOptions = useMemo(() => {
    const seen = new Set<number>();
    for (const p of products) seen.add(p.validity_days);
    return Array.from(seen).sort((a, b) => a - b);
  }, [products]);

  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      if (dataSizeFilter !== ALL_FILTER && dataSizeLabel(p) !== dataSizeFilter) return false;
      if (validityFilter !== ALL_FILTER && String(p.validity_days) !== validityFilter) return false;
      return true;
    });
  }, [products, dataSizeFilter, validityFilter]);

  function renderChip(
    options: string[],
    selected: string,
    onSelect: (value: string) => void,
    testIdPrefix: string,
    allLabel: string
  ) {
    const allOptions = [ALL_FILTER, ...options];
    return (
      <View style={styles.chipRow}>
        {allOptions.map((value) => {
          const isSelected = value === selected;
          return (
            <Pressable
              key={value}
              onPress={() => onSelect(value)}
              accessibilityRole="button"
              accessibilityLabel={value === ALL_FILTER ? allLabel : value}
              style={[styles.chip, isSelected && styles.chipSelected]}
              testID={`${testIdPrefix}-${value}`}
            >
              <Text style={[styles.chipText, isSelected && styles.chipTextSelected]}>
                {value === ALL_FILTER ? allLabel : value}
              </Text>
            </Pressable>
          );
        })}
      </View>
    );
  }

  function renderProduct({ item }: { item: Product }) {
    return (
      <View style={styles.card} testID={`package-${item.id}`}>
        {item.is_featured && (
          <Text style={styles.featuredBadge} testID={`package-featured-${item.id}`}>
            {t('checkout', 'package_featured_badge', 'Recommended')}
          </Text>
        )}
        <Text style={styles.cardTitle}>{item.title_en}</Text>
        <Text style={styles.cardMeta}>
          {dataSizeLabel(item)} · {validityLabel(item)}
        </Text>
        <Text style={styles.cardPrice}>{formatPrice(item.retail_price)}</Text>
      </View>
    );
  }

  return (
    <View style={styles.container} testID="package-browser">
      {renderChip(
        dataSizeOptions,
        dataSizeFilter,
        setDataSizeFilter,
        'filter-data-size',
        t('checkout', 'filter_all_data_sizes', 'All sizes')
      )}
      {renderChip(
        validityOptions.map(String),
        validityFilter,
        setValidityFilter,
        'filter-validity',
        t('checkout', 'filter_all_validity', 'All validity')
      )}

      {filteredProducts.length === 0 ? (
        <Text style={styles.empty} testID="package-browser-empty">
          {t('checkout', 'package_filter_empty', 'No packages match these filters.')}
        </Text>
      ) : (
        <FlatList
          data={filteredProducts}
          keyExtractor={(item) => item.id}
          renderItem={renderProduct}
          testID="package-browser-list"
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
  chip: {
    minHeight: 36,
    paddingHorizontal: 12,
    justifyContent: 'center',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#D0D5DD',
  },
  chipSelected: { backgroundColor: '#1D4ED8', borderColor: '#1D4ED8' },
  chipText: { fontSize: 13, color: '#344054' },
  chipTextSelected: { color: '#fff', fontWeight: '600' },
  card: {
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
  cardTitle: { fontSize: 16, fontWeight: '600' },
  cardMeta: { fontSize: 13, color: '#667085', marginTop: 2 },
  cardPrice: { fontSize: 16, fontWeight: '700', marginTop: 6 },
  empty: { color: '#667085', marginTop: 8 },
});
