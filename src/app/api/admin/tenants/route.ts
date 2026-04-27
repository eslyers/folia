import { NextRequest, NextResponse } from "next/server";
import { createClient as createServiceClient } from "@/lib/supabase/admin";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { logAction, createNotification } from "@/lib/logging";

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
  console.log("[DEBUG] GET /api/admin/tenants - FUNCTION CALLED AT ALL");
  return NextResponse.json({ data: [], message: "GET working" });
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

    // Log action
    await logAction("create", "tenants", { tenantId: data.id, name, slug }, user.id);

    // Notify master_admins
    const adminClient = createServiceClient();
    const { data: allAdmins } = await adminClient
      .from("profiles")
      .select("id")
      .eq("role", "master_admin");
    if (allAdmins) {
      for (const admin of allAdmins) {
        await createNotification(admin.id, "Empresa criada", `A empresa "${name}" foi adicionada ao sistema`, "success");
      }
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
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const adminClient = createServiceClient();

    const body = await request.json();
    const { id, name, domain, logo_url, settings, is_active } = body;

    const { data, error } = await adminClient
      .from("tenants")
      .update({
        name,
        domain: domain || null,
        logo_url: logo_url || null,
        settings,
        is_active,
      })
      .eq("id", id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Log action
    await logAction("update", "tenants", { tenantId: id, name, is_active }, user.id);

    // Notify master_admins
    const adminClient = createServiceClient();
    const { data: allAdmins } = await adminClient
      .from("profiles")
      .select("id")
      .eq("role", "master_admin");
    if (allAdmins) {
      for (const admin of allAdmins) {
        await createNotification(admin.id, "Empresa atualizada", `A empresa "${name}" teve seus dados alterados`, "info");
      }
    }

    return NextResponse.json({ data });
  } catch (error) {
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

    // Log action
    await logAction("delete", "tenants", { tenantId: id }, user.id);

    // Notify master_admins
    const adminClient = createServiceClient();
    const { data: allAdmins } = await adminClient
      .from("profiles")
      .select("id")
      .eq("role", "master_admin");
    if (allAdmins) {
      for (const admin of allAdmins) {
        await createNotification(admin.id, "Empresa excluída", `Uma empresa foi removida do sistema (ID: ${id})`, "warning");
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
