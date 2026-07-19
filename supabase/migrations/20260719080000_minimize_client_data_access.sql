-- The browser receives game state through narrow security-definer snapshots and
-- mutations. Direct table access is unnecessary and increases scraping and
-- accidental-mutation exposure, so retain only the catalogs actually browsed.

revoke all on public.game_profiles, public.currency_ledger, public.player_cards,
  public.starting_lineups, public.pack_openings, public.pack_opening_cards,
  public.seasons, public.season_leagues, public.league_teams, public.season_games,
  public.season_rewards, public.economy_accounts, public.market_cards,
  public.market_bids, public.market_sol_purchases, public.gridiron_cash_accounts,
  public.gridiron_cash_purchases, public.gridiron_cash_ledger,
  public.treasury_allocation, public.legal_acceptances,
  public.solana_transaction_records
from anon, authenticated;

revoke all on public.pack_definitions, public.market_listings,
  public.app_release_controls, public.legal_documents,
  public.release_allowed_countries
from anon, authenticated;

grant select on public.pack_definitions, public.market_listings to authenticated;
grant select on public.app_release_controls, public.legal_documents,
  public.release_allowed_countries to anon, authenticated;
