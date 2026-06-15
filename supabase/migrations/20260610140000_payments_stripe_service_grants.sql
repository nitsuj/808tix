-- Edge Functions use service_role client to call create_pending_order.

grant execute on function public.create_pending_order(uuid, text, uuid, integer, text, text)
  to service_role;
