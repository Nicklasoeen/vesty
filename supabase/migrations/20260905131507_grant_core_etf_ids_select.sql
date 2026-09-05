-- The estimated-lots view is security_invoker and needs the CORE ETF id list.
grant execute on function private.core_v1_etf_target_ids() to authenticated;
