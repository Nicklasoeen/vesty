-- Add Marketstack as a named provider. The new enum value cannot be used
-- in the same transaction, so mappings are seeded in the next migration.

alter type public.market_data_provider add value 'marketstack';
