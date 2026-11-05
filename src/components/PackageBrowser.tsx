import React, { useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import type { Product } from '../api/catalog';
import { useAppSettings } from '../state/AppSettingsContext';
import { useAuth } from '../state/AuthContext';
import { checkDiscountCode, previewDiscount } from '../api/discounts';
import type { DiscountCheckResult } from '../api/discounts';
import { getMyWallets } from '../api/wallets';
import { checkoutWithWallet } from '../api/orders';
import { waitForOrder } from '../lib/waitForOrder';
import { ApiError } from '../lib/apiClient';
import DiscountCodeBox from './DiscountCodeBox';
import PaymentMethodChooser from './PaymentMethodChooser';
import CheckoutFlowModal, { type CheckoutFlowStage } from './CheckoutFlowModal';

// FR-301/FR-302/FR-303/FR-304/FR-305 - the "choose" and wallet-checkout
// states of the web's PackageBrowser.tsx state machine
// (docs/Architecture.md -> "The checkout state machine"). Display, filter,
// discount-code pre-check/exact preview, the wallet-vs-gateway decision,
// and (FR-305) actually charging the wallet and reaching a
// success/preparing/error outcome. The gateway path itself (FR-306) is
// still a later FR - choosing it here only records the choice.
export type PackageBrowserProps = {
  products: Product[];
};

const ALL_FILTER = 'all';

type GenericDiscount = {
  discount_type: 'PERCENT' | 'FIXED';
  value: string;
  max_discount_amount: string | null;
};

// A rough, client-side estimate from the public (pre-login) code check -
// just enough to show "you'll save about this much" on every card. The real
// amount is always recomputed per-product, authoritatively, by
// /discounts/preview (FR-303) once the customer actually buys - see
// docs/Rules.md -> "Payment & checkout".
function estimateDiscount(price: number, generic: GenericDiscount): number {
  if (generic.discount_type === 'PERCENT') {
    let amount = (price * parseFloat(generic.value)) / 100;
    if (generic.max_discount_amount) amount = Math.min(amount, parseFloat(generic.max_discount_amount));
    return Math.min(amount, price);
  }
  return Math.min(parseFloat(generic.value), price);
}

function dataSizeLabel(product: Product): string {
  return product.is_unlimited ? 'Unlimited' : `${product.data_amount_gb} GB`;
}

function validityLabel(product: Product): string {
  return `${product.validity_days} days`;
}

type ExactPreview = { discount_amount: number; total: number };

export default function PackageBrowser({ products }: PackageBrowserProps) {
  const { t, formatPrice } = useAppSettings();
  const { status: authStatus, token } = useAuth();
  const [dataSizeFilter, setDataSizeFilter] = useState(ALL_FILTER);
  const [validityFilter, setValidityFilter] = useState(ALL_FILTER);

  const [discountCode, setDiscountCode] = useState('');
  const [checkingCode, setCheckingCode] = useState(false);
  const [codeError, setCodeError] = useState<string | null>(null);
  const [checkedOk, setCheckedOk] = useState<{ code: string; note: string } | null>(null);
  const [genericDiscount, setGenericDiscount] = useState<GenericDiscount | null>(null);

  // FR-303 - the exact, server-verified amount for a specific product, once
  // a signed-in user asks for it. Keyed by product id since each product
  // can qualify for a different amount (per-product/per-country scope, caps).
  const [exactPreviews, setExactPreviews] = useState<Record<string, ExactPreview>>({});
  const [previewingProductId, setPreviewingProductId] = useState<string | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);

  // FR-304 - which path a Buy Now tap resolved to, per product. The wallet
  // check happens again, for real, on this same product right before the
  // chooser opens - a card's badge/estimate is never trusted as the final
  // payable amount. See docs/Rules.md -> "Payment & checkout".
  const [buyingProductId, setBuyingProductId] = useState<string | null>(null);
  const [buyError, setBuyError] = useState<string | null>(null);
  const [chooserState, setChooserState] = useState<{ product: Product; payableAmount: number; walletBalance: number } | null>(
    null
  );
  const [goingToGatewayProductId, setGoingToGatewayProductId] = useState<string | null>(null);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<{ productId: string; method: 'GATEWAY' } | null>(null);

  // FR-305 - the wallet-checkout execution state (working -> preparing |
  // success | error). Kept separate from `chooserState` above: the chooser
  // is "which method", this is "how the chosen one (wallet) is going".
  const [flow, setFlow] = useState<CheckoutFlowStage | null>(null);
  const [flowProduct, setFlowProduct] = useState<Product | null>(null);

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

  async function handleApplyCode() {
    const typed = discountCode.trim();
    if (!typed) return;
    setCheckingCode(true);
    setCodeError(null);
    // A new code invalidates any exact preview confirmed against the old one.
    setExactPreviews({});
    setPreviewError(null);
    try {
      const result: DiscountCheckResult = await checkDiscountCode(typed);
      if (result.valid) {
        setGenericDiscount({
          discount_type: result.discount_type,
          value: result.value,
          max_discount_amount: result.max_discount_amount,
        });
        setCheckedOk({
          code: result.code,
          note: result.scoped
            ? t('checkout', 'discount_code_scoped_note', 'exact savings confirmed once you sign in to buy')
            : result.discount_type === 'PERCENT'
              ? `${result.value}% off`
              : `${formatPrice(parseFloat(result.value))} off`,
        });
      } else {
        setGenericDiscount(null);
        setCheckedOk(null);
        setCodeError(result.reason);
      }
    } catch {
      setGenericDiscount(null);
      setCheckedOk(null);
      setCodeError(t('checkout', 'discount_code_network_error', "Couldn't check that code. Try again."));
    } finally {
      setCheckingCode(false);
    }
  }

  function handleClearCode() {
    setDiscountCode('');
    setCodeError(null);
    setCheckedOk(null);
    setGenericDiscount(null);
    setExactPreviews({});
    setPreviewError(null);
  }

  async function handleConfirmExact(product: Product) {
    const typed = discountCode.trim();
    if (!typed || !token) return;
    setPreviewingProductId(product.id);
    setPreviewError(null);
    try {
      const result = await previewDiscount(token, typed, product.id);
      if (result.valid) {
        setExactPreviews((prev) => ({
          ...prev,
          [product.id]: { discount_amount: parseFloat(result.discount_amount), total: parseFloat(result.total) },
        }));
      } else {
        setPreviewError(result.reason);
      }
    } catch (err) {
      setPreviewError(
        err instanceof ApiError && typeof err.detail === 'string'
          ? err.detail
          : t('checkout', 'discount_preview_network_error', "Couldn't confirm the exact price. Try again.")
      );
    } finally {
      setPreviewingProductId(null);
    }
  }

  async function handleBuyNow(product: Product) {
    // Not signed in: resuming the exact purchase after login (FR-106) isn't
    // built yet - see docs/Architecture.md -> "The checkout state machine".
    // Not acting here (rather than guessing a redirect) until that exists.
    if (authStatus !== 'authenticated' || !token) return;

    setBuyingProductId(product.id);
    setBuyError(null);
    setGoingToGatewayProductId(null);
    const payableAmount = exactPreviews[product.id]?.total ?? product.retail_price;
    try {
      const wallets = await getMyWallets(token);
      const spendable = wallets
        .filter((w) => (w.wallet_type === 'DEFAULT' || w.wallet_type === 'REWARD') && !w.is_frozen)
        .reduce((sum, w) => sum + w.balance, 0);

      if (spendable >= payableAmount) {
        setChooserState({ product, payableAmount, walletBalance: spendable });
      } else {
        // Wallet can't cover it - straight to the gateway, no chooser.
        // FR-306 (actually starting the gateway flow) isn't built yet.
        setGoingToGatewayProductId(product.id);
      }
    } catch {
      setBuyError(t('checkout', 'buy_now_network_error', "Couldn't check your wallet balance. Try again."));
    } finally {
      setBuyingProductId(null);
    }
  }

  function handleChoosePaymentMethod(method: 'WALLET' | 'GATEWAY') {
    if (!chooserState) return;
    const { product } = chooserState;
    setChooserState(null);
    if (method === 'GATEWAY') {
      // FR-306 (actually starting the gateway flow) isn't built yet - this
      // only records the choice.
      setSelectedPaymentMethod({ productId: product.id, method: 'GATEWAY' });
      return;
    }
    payByWallet(product);
  }

  // FR-305 - ported from the web's payByWallet() (docs/Architecture.md ->
  // "The checkout state machine"): POST /orders/checkout, then poll briefly
  // for the common case (eSIM lands within a few seconds); on timeout, show
  // "preparing" (not a failure - see "Lessons from the web app") and keep
  // polling quietly in the background so the screen can still upgrade to
  // success if the customer is still looking at it.
  async function payByWallet(product: Product) {
    if (!token) return;
    setFlowProduct(product);
    setFlow({ stage: 'working' });
    const appliedCode = checkedOk ? discountCode.trim() : undefined;
    try {
      const accepted = await checkoutWithWallet(token, product.id, appliedCode);
      let order;
      try {
        order = await waitForOrder(token, accepted.id, { timeoutMs: 12000 });
      } catch {
        setFlow({ stage: 'preparing' });
        waitForOrder(token, accepted.id, { timeoutMs: 170000 })
          .then((later) => {
            if (later.status !== 'COMPLETED') return;
            setFlow((prev) => (prev && prev.stage === 'preparing' ? { stage: 'success', order: later } : prev));
          })
          .catch(() => {});
        return;
      }
      if (order.status === 'COMPLETED') {
        setFlow({ stage: 'success', order });
      } else {
        setFlow({
          stage: 'error',
          message: t(
            'checkout',
            'wallet_checkout_provisioning_failed',
            "We couldn't set up this eSIM with the network. The full amount has been refunded to your wallet."
          ),
        });
      }
    } catch (err) {
      setFlow({
        stage: 'error',
        message:
          err instanceof ApiError && typeof err.detail === 'string'
            ? err.detail
            : t('checkout', 'wallet_checkout_network_error', 'Purchase failed. If your wallet was charged, it has been refunded.'),
      });
    }
  }

  function handleCloseFlow() {
    setFlow(null);
    setFlowProduct(null);
  }

  function handleRetryFlow() {
    if (!flowProduct) return;
    const product = flowProduct;
    setFlow(null);
    handleBuyNow(product);
  }

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
    const exact = exactPreviews[item.id];
    const estimatedDiscountedPrice = genericDiscount
      ? item.retail_price - estimateDiscount(item.retail_price, genericDiscount)
      : null;
    const canConfirmExact =
      genericDiscount && !exact && authStatus === 'authenticated' && discountCode.trim() !== '';
    const isPreviewingThis = previewingProductId === item.id;
    const isBuyingThis = buyingProductId === item.id;
    const isGoingToGateway = goingToGatewayProductId === item.id;
    const selectedMethodForThis = selectedPaymentMethod?.productId === item.id ? selectedPaymentMethod.method : null;

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
        {exact ? (
          <View>
            <View style={styles.priceRow}>
              <Text style={styles.cardPriceStruck}>{formatPrice(item.retail_price)}</Text>
              <Text style={styles.cardPrice} testID={`package-exact-price-${item.id}`}>
                {formatPrice(exact.total)}
              </Text>
            </View>
            <Text style={styles.confirmedLabel} testID={`package-exact-confirmed-${item.id}`}>
              {t('checkout', 'discount_exact_confirmed', 'Exact price confirmed')}
            </Text>
          </View>
        ) : estimatedDiscountedPrice !== null ? (
          <View style={styles.priceRow}>
            <Text style={styles.cardPriceStruck}>{formatPrice(item.retail_price)}</Text>
            <Text style={styles.cardPrice} testID={`package-discounted-price-${item.id}`}>
              {formatPrice(estimatedDiscountedPrice)}
            </Text>
          </View>
        ) : (
          <Text style={styles.cardPrice}>{formatPrice(item.retail_price)}</Text>
        )}

        {canConfirmExact && (
          <Pressable
            onPress={() => handleConfirmExact(item)}
            disabled={isPreviewingThis}
            accessibilityRole="button"
            accessibilityLabel={t('checkout', 'discount_confirm_exact', 'See exact price')}
            style={[styles.confirmButton, isPreviewingThis && styles.buttonDisabled]}
            testID={`package-confirm-exact-${item.id}`}
          >
            {isPreviewingThis ? (
              <ActivityIndicator size="small" />
            ) : (
              <Text style={styles.confirmButtonText}>{t('checkout', 'discount_confirm_exact', 'See exact price')}</Text>
            )}
          </Pressable>
        )}

        {authStatus === 'authenticated' && (
          <Pressable
            onPress={() => handleBuyNow(item)}
            disabled={isBuyingThis}
            accessibilityRole="button"
            accessibilityLabel={t('checkout', 'buy_now', 'Buy Now')}
            style={[styles.buyButton, isBuyingThis && styles.buttonDisabled]}
            testID={`package-buy-now-${item.id}`}
          >
            {isBuyingThis ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.buyButtonText}>{t('checkout', 'buy_now', 'Buy Now')}</Text>
            )}
          </Pressable>
        )}

        {isGoingToGateway && (
          <Text style={styles.gatewayNote} testID={`package-going-to-gateway-${item.id}`}>
            {t(
              'checkout',
              'buy_now_going_to_gateway',
              "Your wallet doesn't cover this - continuing to card/mobile banking."
            )}
          </Text>
        )}

        {selectedMethodForThis && (
          <Text style={styles.gatewayNote} testID={`package-selected-method-${item.id}`}>
            {t('checkout', 'buy_now_selected_gateway', 'Paying with card/mobile banking')}
          </Text>
        )}
      </View>
    );
  }

  return (
    <View style={styles.container} testID="package-browser">
      <DiscountCodeBox
        value={discountCode}
        onChangeValue={setDiscountCode}
        checking={checkingCode}
        checkedOk={checkedOk}
        error={codeError}
        onApply={handleApplyCode}
        onClear={handleClearCode}
      />

      {previewError && (
        <Text style={styles.previewError} testID="discount-preview-error">
          {previewError}
        </Text>
      )}

      {buyError && (
        <Text style={styles.previewError} testID="buy-now-error">
          {buyError}
        </Text>
      )}

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

      {chooserState && (
        <PaymentMethodChooser
          visible
          payableAmount={chooserState.payableAmount}
          walletBalance={chooserState.walletBalance}
          onChooseWallet={() => handleChoosePaymentMethod('WALLET')}
          onChooseGateway={() => handleChoosePaymentMethod('GATEWAY')}
          onCancel={() => setChooserState(null)}
        />
      )}

      <CheckoutFlowModal flow={flow} onClose={handleCloseFlow} onRetry={handleRetryFlow} />
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
  priceRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 },
  cardPriceStruck: { fontSize: 13, color: '#98A2B3', textDecorationLine: 'line-through' },
  confirmedLabel: { fontSize: 11, color: '#027A48', fontWeight: '600', marginTop: 2 },
  confirmButton: {
    minHeight: 36,
    marginTop: 8,
    paddingHorizontal: 12,
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'flex-start',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#1D4ED8',
  },
  buttonDisabled: { opacity: 0.6 },
  confirmButtonText: { color: '#1D4ED8', fontSize: 12, fontWeight: '700' },
  previewError: { color: '#B42318', marginBottom: 8, fontSize: 12 },
  buyButton: {
    minHeight: 40,
    marginTop: 8,
    paddingHorizontal: 14,
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'flex-start',
    borderRadius: 8,
    backgroundColor: '#1D4ED8',
  },
  buyButtonText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  gatewayNote: { fontSize: 11, color: '#667085', marginTop: 6 },
  empty: { color: '#667085', marginTop: 8 },
});
