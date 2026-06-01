import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

import { loadApplePassConfig } from './certs.ts';
import { buildSignedPkpass, type PublicPassRow } from './pass-model.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
};

const PKPASS_CONTENT_TYPE = 'application/vnd.apple.pkpass';

function jsonError(status: number, message: string, code: string): Response {
  return new Response(JSON.stringify({ ok: false, message, code }), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function isValidSecureToken(token: string): boolean {
  return /^[a-f0-9]{64}$/i.test(token);
}

function extractSecureToken(request: Request): string | null {
  const url = new URL(request.url);
  const fromQuery = url.searchParams.get('token')?.trim() ?? '';

  if (fromQuery) {
    return fromQuery;
  }

  return null;
}

async function fetchPassByToken(secureToken: string): Promise<PublicPassRow | null> {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('SUPABASE_URL or SUPABASE_ANON_KEY is not configured.');
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey);
  const { data, error } = await supabase.rpc('get_pass_by_token', {
    p_secure_token: secureToken,
  });

  if (error) {
    throw new Error(`get_pass_by_token failed: ${error.message}`);
  }

  if (!data || typeof data !== 'object') {
    return null;
  }

  return data as PublicPassRow;
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (request.method !== 'GET') {
    return jsonError(405, 'Method not allowed.', 'METHOD_NOT_ALLOWED');
  }

  const secureToken = extractSecureToken(request);

  if (!secureToken) {
    return jsonError(400, 'Missing token query parameter.', 'TOKEN_MISSING');
  }

  if (!isValidSecureToken(secureToken)) {
    return jsonError(400, 'Invalid pass token.', 'TOKEN_INVALID');
  }

  let pass: PublicPassRow | null;

  try {
    pass = await fetchPassByToken(secureToken);
  } catch (error) {
    console.error('[wallet-apple] pass_lookup_failed', error);
    return jsonError(500, 'Could not load pass.', 'PASS_LOOKUP_FAILED');
  }

  if (!pass) {
    return jsonError(404, 'Pass not found.', 'PASS_NOT_FOUND');
  }

  if (pass.secure_token !== secureToken) {
    return jsonError(500, 'Pass token mismatch.', 'PASS_TOKEN_MISMATCH');
  }

  let config;

  try {
    config = loadApplePassConfig();
  } catch (error) {
    console.error('[wallet-apple] apple_config_missing', error);
    return jsonError(500, 'Apple Wallet signing is not configured.', 'APPLE_CONFIG_MISSING');
  }

  try {
    const pkpassBytes = await buildSignedPkpass(pass, config);

    return new Response(pkpassBytes, {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': PKPASS_CONTENT_TYPE,
        'Content-Disposition': 'attachment; filename="808tix.pkpass"',
        'Cache-Control': 'private, no-store',
      },
    });
  } catch (error) {
    console.error('[wallet-apple] pkpass_build_failed', error);
    const message = error instanceof Error ? error.message : 'Unknown signing error';
    return jsonError(500, `Could not build Apple Wallet pass: ${message}`, 'PKPASS_BUILD_FAILED');
  }
});
