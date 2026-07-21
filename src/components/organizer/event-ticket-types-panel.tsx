import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';

import type { TicketType, TicketingMode } from '@/lib/database.types';
import { supabase } from '@/lib/supabase';
import {
  centsToDollarsInput,
  dollarsInputToCents,
  formatTicketPriceLabel,
  validateTicketTypeForm,
  type TicketTypeFormErrors,
} from '@/lib/ticket-type-price';
import { organizer, organizerOpsScreen, semantic, text } from '@/theme';
import { Radii, Spacing } from '@/constants/theme';

type EventTicketTypesPanelProps = {
  eventId: string;
  onChanged?: () => void;
};

const EMPTY_FORM = {
  name: '',
  priceDollars: '0',
  capacity: '',
  isActive: true,
};

export function EventTicketTypesPanel({ eventId, onChanged }: EventTicketTypesPanelProps) {
  const [ticketTypes, setTicketTypes] = useState<TicketType[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<TicketTypeFormErrors>({});
  const [name, setName] = useState(EMPTY_FORM.name);
  const [priceDollars, setPriceDollars] = useState(EMPTY_FORM.priceDollars);
  const [capacity, setCapacity] = useState(EMPTY_FORM.capacity);
  const [isActive, setIsActive] = useState(EMPTY_FORM.isActive);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const loadTicketTypes = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);

    const { data, error } = await supabase
      .from('ticket_types')
      .select(
        'id, event_id, name, description, price_cents, currency, capacity, sales_start_at, sales_end_at, is_active, sort_order, created_at, updated_at',
      )
      .eq('event_id', eventId)
      .order('created_at', { ascending: true });

    if (error) {
      setTicketTypes([]);
      setLoadError(error.message);
      setIsLoading(false);
      return;
    }

    setTicketTypes((data as TicketType[]) ?? []);
    setIsLoading(false);
  }, [eventId]);

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      void loadTicketTypes();
    });

    return () => cancelAnimationFrame(frame);
  }, [loadTicketTypes]);

  function resetForm() {
    setName(EMPTY_FORM.name);
    setPriceDollars(EMPTY_FORM.priceDollars);
    setCapacity(EMPTY_FORM.capacity);
    setIsActive(EMPTY_FORM.isActive);
    setEditingId(null);
    setFieldErrors({});
    setSaveError(null);
  }

  function beginEdit(ticketType: TicketType) {
    setEditingId(ticketType.id);
    setName(ticketType.name);
    setPriceDollars(centsToDollarsInput(ticketType.price_cents));
    setCapacity(ticketType.capacity != null ? String(ticketType.capacity) : '');
    setIsActive(ticketType.is_active);
    setFieldErrors({});
    setSaveError(null);
  }

  async function enableEventSales() {
    const { data: eventRow, error: eventError } = await supabase
      .from('events')
      .select('ticketing_mode')
      .eq('id', eventId)
      .maybeSingle();

    if (eventError) {
      throw new Error(eventError.message);
    }

    const currentMode = (eventRow as { ticketing_mode: TicketingMode } | null)?.ticketing_mode;
    const nextMode: TicketingMode = currentMode === 'mixed' ? 'mixed' : 'paid';

    const { error: updateError } = await supabase
      .from('events')
      .update({
        sales_enabled: true,
        ticketing_mode: nextMode,
      })
      .eq('id', eventId);

    if (updateError) {
      throw new Error(updateError.message);
    }
  }

  async function handleSave() {
    const errors = validateTicketTypeForm({
      name,
      priceDollars,
      capacity,
      isActive,
    });
    setFieldErrors(errors);

    if (Object.keys(errors).length > 0) {
      return;
    }

    const priceCents = dollarsInputToCents(priceDollars);
    if (priceCents === null) {
      setFieldErrors({ priceDollars: 'Enter a valid price like 25 or 25.00.' });
      return;
    }

    const capacityValue = Number(capacity.trim());
    setIsSaving(true);
    setSaveError(null);

    try {
      if (editingId) {
        const { error } = await supabase
          .from('ticket_types')
          .update({
            name: name.trim(),
            price_cents: priceCents,
            capacity: capacityValue,
            is_active: isActive,
          })
          .eq('id', editingId)
          .eq('event_id', eventId);

        if (error) {
          throw new Error(error.message);
        }
      } else {
        const { error } = await supabase.from('ticket_types').insert({
          event_id: eventId,
          name: name.trim(),
          price_cents: priceCents,
          capacity: capacityValue,
          is_active: isActive,
          currency: 'usd',
        });

        if (error) {
          throw new Error(error.message);
        }

        await enableEventSales();
      }

      resetForm();
      await loadTicketTypes();
      onChanged?.();
    } catch (saveFailure) {
      setSaveError(
        saveFailure instanceof Error ? saveFailure.message : 'Could not save ticket type.',
      );
    } finally {
      setIsSaving(false);
    }
  }

  async function handleToggleActive(ticketType: TicketType) {
    setTogglingId(ticketType.id);
    setSaveError(null);

    const { error } = await supabase
      .from('ticket_types')
      .update({ is_active: !ticketType.is_active })
      .eq('id', ticketType.id)
      .eq('event_id', eventId);

    if (error) {
      setSaveError(error.message);
      setTogglingId(null);
      return;
    }

    await loadTicketTypes();
    onChanged?.();
    setTogglingId(null);
  }

  return (
    <View style={styles.root}>
      <Text style={styles.title}>Ticket types</Text>
      <Text style={styles.subtitle}>Set prices and capacity for public ticket sales.</Text>

      <View style={styles.form}>
        <View style={styles.field}>
          <Text style={styles.label}>Name</Text>
          <TextInput
            autoCapitalize="words"
            editable={!isSaving}
            onChangeText={setName}
            placeholder="General Admission"
            placeholderTextColor={text.muted}
            style={[styles.input, fieldErrors.name ? styles.inputError : null]}
            testID="ticket-type-name-input"
            value={name}
          />
          {fieldErrors.name ? <Text style={styles.errorText}>{fieldErrors.name}</Text> : null}
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Price (USD)</Text>
          <TextInput
            editable={!isSaving}
            keyboardType="decimal-pad"
            onChangeText={setPriceDollars}
            placeholder="25.00"
            placeholderTextColor={text.muted}
            style={[styles.input, fieldErrors.priceDollars ? styles.inputError : null]}
            testID="ticket-type-price-input"
            value={priceDollars}
          />
          <Text style={styles.hint}>Use 0 for Free.</Text>
          {fieldErrors.priceDollars ? (
            <Text style={styles.errorText}>{fieldErrors.priceDollars}</Text>
          ) : null}
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Quantity</Text>
          <TextInput
            editable={!isSaving}
            keyboardType="number-pad"
            onChangeText={setCapacity}
            placeholder="100"
            placeholderTextColor={text.muted}
            style={[styles.input, fieldErrors.capacity ? styles.inputError : null]}
            testID="ticket-type-capacity-input"
            value={capacity}
          />
          {fieldErrors.capacity ? (
            <Text style={styles.errorText}>{fieldErrors.capacity}</Text>
          ) : null}
        </View>

        <View style={styles.toggleRow}>
          <Text style={styles.toggleLabel}>Active</Text>
          <Switch
            disabled={isSaving}
            onValueChange={setIsActive}
            trackColor={{ false: 'rgba(255,255,255,0.12)', true: 'rgba(57, 255, 20, 0.35)' }}
            thumbColor={isActive ? organizer.accent : text.muted}
            value={isActive}
          />
        </View>

        {saveError ? <Text style={styles.errorText}>{saveError}</Text> : null}

        <View style={styles.formActions}>
          <Pressable
            disabled={isSaving}
            onPress={() => void handleSave()}
            style={({ pressed }) => [
              styles.saveButton,
              pressed && !isSaving && styles.pressed,
              isSaving && styles.disabled,
            ]}
            testID="ticket-type-save-button">
            {isSaving ? (
              <ActivityIndicator color={organizer.accent} />
            ) : (
              <Text style={styles.saveButtonText}>
                {editingId ? 'Update ticket type' : 'Add ticket type'}
              </Text>
            )}
          </Pressable>
          {editingId ? (
            <Pressable
              disabled={isSaving}
              onPress={resetForm}
              style={({ pressed }) => [
                styles.cancelButton,
                pressed && !isSaving && styles.pressed,
              ]}>
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </Pressable>
          ) : null}
        </View>
      </View>

      {isLoading ? (
        <ActivityIndicator color={organizer.accent} style={styles.loader} />
      ) : loadError ? (
        <Text style={styles.errorText}>{loadError}</Text>
      ) : (
        <View style={styles.list} testID="ticket-types-list">
          {ticketTypes.length === 0 ? (
            <Text style={styles.emptyText}>No ticket types yet. Add one to enable sales.</Text>
          ) : (
            ticketTypes.map((ticketType) => (
              <View key={ticketType.id} style={styles.listRow}>
                <View style={styles.listRowMain}>
                  <Text style={styles.listName}>{ticketType.name}</Text>
                  <Text style={styles.listMeta}>
                    {formatTicketPriceLabel(ticketType.price_cents, ticketType.currency)}
                    {ticketType.capacity != null ? ` · Qty ${ticketType.capacity}` : ''}
                    {ticketType.is_active ? ' · Active' : ' · Inactive'}
                  </Text>
                </View>
                <View style={styles.listRowActions}>
                  <Pressable
                    disabled={togglingId === ticketType.id}
                    onPress={() => void handleToggleActive(ticketType)}
                    style={({ pressed }) => [
                      styles.smallButton,
                      pressed && styles.pressed,
                    ]}>
                    <Text style={styles.smallButtonText}>
                      {ticketType.is_active ? 'Deactivate' : 'Activate'}
                    </Text>
                  </Pressable>
                  <Pressable
                    disabled={isSaving}
                    onPress={() => beginEdit(ticketType)}
                    style={({ pressed }) => [
                      styles.smallButton,
                      pressed && styles.pressed,
                    ]}>
                    <Text style={styles.smallButtonText}>Edit</Text>
                  </Pressable>
                </View>
              </View>
            ))
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    gap: Spacing.three,
    marginBottom: Spacing.four,
  },
  title: {
    color: text.primary,
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  subtitle: {
    color: text.secondary,
    fontSize: 13,
    lineHeight: 18,
    marginTop: -Spacing.one,
  },
  form: {
    gap: Spacing.three,
  },
  field: {
    gap: Spacing.one,
  },
  label: {
    color: text.secondary,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  hint: {
    color: text.muted,
    fontSize: 12,
  },
  input: {
    backgroundColor: organizerOpsScreen.surface.inset,
    borderColor: organizerOpsScreen.surface.insetBorder,
    borderRadius: 12,
    borderWidth: 1,
    color: text.primary,
    fontSize: 16,
    fontWeight: '500',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
  },
  inputError: {
    borderColor: semantic.errorSoft,
  },
  toggleRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  toggleLabel: {
    color: text.primary,
    fontSize: 14,
    fontWeight: '600',
  },
  formActions: {
    gap: Spacing.two,
  },
  saveButton: {
    alignItems: 'center',
    backgroundColor: organizerOpsScreen.button.primary.backgroundColor,
    borderColor: organizerOpsScreen.button.primary.borderColor,
    borderRadius: Radii.button,
    borderWidth: organizerOpsScreen.button.primary.borderWidth,
    justifyContent: 'center',
    minHeight: organizerOpsScreen.button.minHeight,
    paddingHorizontal: Spacing.three,
  },
  saveButtonText: {
    color: organizerOpsScreen.button.primary.text,
    ...organizerOpsScreen.button.text,
  },
  cancelButton: {
    alignItems: 'center',
    borderColor: organizerOpsScreen.button.secondary.borderColor,
    borderRadius: Radii.button,
    borderWidth: organizerOpsScreen.button.secondary.borderWidth,
    justifyContent: 'center',
    minHeight: 44,
    paddingHorizontal: Spacing.three,
  },
  cancelButtonText: {
    color: organizerOpsScreen.button.secondary.text,
    fontSize: 15,
    fontWeight: '700',
  },
  loader: {
    marginTop: Spacing.two,
  },
  list: {
    gap: Spacing.two,
  },
  emptyText: {
    color: text.secondary,
    fontSize: 13,
    lineHeight: 18,
  },
  listRow: {
    backgroundColor: organizerOpsScreen.statChip.backgroundColor,
    borderColor: organizerOpsScreen.statChip.borderColor,
    borderRadius: Radii.card,
    borderWidth: 1,
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
  },
  listRowMain: {
    gap: 4,
  },
  listName: {
    color: text.primary,
    fontSize: 15,
    fontWeight: '700',
  },
  listMeta: {
    color: text.secondary,
    fontSize: 13,
    lineHeight: 18,
  },
  listRowActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  smallButton: {
    borderColor: 'rgba(255, 255, 255, 0.14)',
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one + 2,
  },
  smallButtonText: {
    color: organizer.accent,
    fontSize: 12,
    fontWeight: '700',
  },
  errorText: {
    color: semantic.errorSoft,
    fontSize: 13,
    lineHeight: 18,
  },
  pressed: {
    opacity: 0.88,
  },
  disabled: {
    opacity: 0.6,
  },
});
