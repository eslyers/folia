import { NextRequest, NextResponse } from "next/server";
import { createClient as createServiceClient } from "@/lib/supabase/admin";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

// Disable edge runtime auth
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Helper to validate auth token
async function validateAuth(authHeader: string | null) {
  if (!authHeader) return { error: "No auth header", user: null };
  
  const token = authHeader.replace("Bearer ", "");
  const client = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
  
  const { data: { user }, error } = await client.auth.getUser(token);
  return { error: error?.message || null, user };
}

export async function GET() {
  try {
    // Get all tenants using service client
    const adminClient = createServiceClient();
    const { data, error } = await adminClient
      .from("tenants")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("[DEBUG] GET tenants error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ data: data || [] });
  } catch (error) {
    console.error("[DEBUG] GET error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    // Get auth from header
    const authHeader = request.headers.get("Authorization");
    const { error: authError, user } = await validateAuth(authHeader);
    
    if (authError || !user) {
      console.error("[DEBUG] Auth error:", authError);
      return NextResponse.json({ error: "Unauthorized: " + authError }, { status: 401 });
    }

    console.log("[DEBUG] Authenticated user:", user.id);

    // Verify master admin using service client
    const adminClient = createServiceClient();
    const { data: profile, error: profileError } = await adminClient
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (profileError) {
      console.error("[DEBUG] Profile error:", profileError);
    }

    if (profile?.role !== "master_admin") {
      return NextResponse.json({ error: "Forbidden: not master_admin" }, { status: 403 });
    }

    const body = await request.json();
    const { name, domain, slug, logo_url, settings } = body;

    if (!name || !slug) {
      return NextResponse.json({ error: "Nome e slug são obrigatórios" }, { status: 400 });
    }

    const { data, error } = await adminClient
      .from("tenants")
      .insert({
        name,
        domain: domain || null,
        slug: slug.toLowerCase().replace(/[^a-z0-9-]/g, "-"),
        logo_url: logo_url || null,
        settings: settings || { timezone: "America/Sao_Paulo", locale: "pt-BR", plan: "basic" },
        is_active: true,
      })
      .select()
      .single();

    if (error) {
      console.error("[DEBUG] Insert error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ data });
  } catch (error) {
    console.error("[DEBUG] POST error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const authHeader = request.headers.get("Authorization");
    const { error: authError, user } = await validateAuth(authHeader);
    
    if (authError || !user) {
      console.error("[DEBUG] PUT auth error:", authError);
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    console.log("[DEBUG] PUT authenticated user:", user.id);

    const adminClient = createServiceClient();

    const body = await request.json();
    const { id, name, domain, logo_url, settings, is_active } = body;

    console.log("[DEBUG] PUT updating tenant:", id, { name, domain, logo_url, settings, is_active });

    const { data, error } = await adminClient
      .from("tenants")
      .update({
        name,
        domain: domain || null,
        logo_url: logo_url || null,
        settings,
        is_active,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select()
      .single();

    if (error) {
      console.error("[DEBUG] PUT update error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    console.log("[DEBUG] PUT success:", data);
    return NextResponse.json({ data });
  } catch (error) {
    console.error("[DEBUG] PUT catch error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const authHeader = request.headers.get("Authorization");
    const { error: authError, user } = await validateAuth(authHeader);
    
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const adminClient = createServiceClient();

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "ID é obrigatório" }, { status: 400 });
    }

    if (id === "00000000-0000-0000-0000-000000000000") {
      return NextResponse.json({ error: "Não é possível excluir o tenant padrão" }, { status: 400 });
    }

    const { error } = await adminClient.from("tenants").delete().eq("id", id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

