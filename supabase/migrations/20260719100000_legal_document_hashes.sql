update public.legal_documents set content_sha256='a14c2893374c23d3cd5c499b87ae4912a12e39b68226b2e3fbd7736e434c78b5'
where code='terms' and version='beta-2026-07-19';
update public.legal_documents set content_sha256='53a3ac090518be7ccd38161cb818c51619b73855e9264f83759272cb482eff99'
where code='privacy' and version='beta-2026-07-19';
update public.legal_documents set content_sha256='656ae4c692dc01b2855919727574878afdb4248c7748c218b9a1908874958c1d'
where code='contest_rules' and version='beta-2026-07-19';
update public.legal_documents set content_sha256='b42d9dd837ec8da72a0f1e3b9f7b4f85660517191a44be8bdd2662b8201c5e20'
where code='purchase_policy' and version='beta-2026-07-19';

do $$
begin
  if exists(select 1 from public.legal_documents where is_current and content_sha256 is null) then
    raise exception 'Every current legal document must have a recorded source hash';
  end if;
end;
$$;
