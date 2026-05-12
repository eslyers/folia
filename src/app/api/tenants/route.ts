import { NextRequest, NextResponse } from "next/server";
import { createClient as createServiceClient } from "@/lib/supabase/admin";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { logAction, createNotification } from "@/lib/logging";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// =====================================================
// Auth helper — validates Bearer token + master_admin role
// The middleware handles cookie-based sessions for page routes.
// This helper is for API route clients that send Authorization headers.
// =====================================================
async function validateMasterAdmin(
  authHeader: string | null
): Promise<
  | { user: { id: string }; error: null }
  | { user: null; error: NextResponse }
> {
  if (!authHeader?.startsWith("Bearer ")) {
    return {
      user: null,
      error: NextResponse.json({ error: "Unauthorized: missing token" }, { status: 401 }),
    };
  }

  const token = authHeader.replace("Bearer ", "");

  // Use anon client with user token to validate identity
  const anonClient = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const { data: { user }, error: authError } = await anonClient.auth.getUser(token);

  if (authError || !user) {
    return {
      user: null,
      error: NextResponse.json({ error: "Unauthorized: invalid token" }, { status: 401 }),
    };
  }

  // Always verify role from DB using service client (cannot be spoofed)
  const adminClient = createServiceClient();
  const { data: profile, error: profileError } = await adminClient
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profileError || !profile) {
    return {
      user: null,
      error: NextResponse.json({ error: "Profile not found" }, { status: 403 }),
    };
  }

  if (profile.role !== "master_admin") {
    return {
      user: null,
      error: NextResponse.json(
        { error: "Forbidden: master_admin required" },
        { status: 403 }
      ),
    };
  }

  return { user: { id: user.id }, error: null };
}

// =====================================================
// Helper — notify all master_admins (parallel)
// =====================================================
async function notifyMasterAdmins(
  adminClient: ReturnType<typeof createServiceClient>,
  title: string,
  message: string,
  type: "success" | "info" | "warning" = "info"
) {
  const { data: admins } = await adminClient
    .from("profiles")
    .select("id")
    .eq("role", "master_admin");

  if (!admins?.length) return;

  await Promise.allSettled(
    admins.map((admin: { id: string }) => createNotification(admin.id, title, message, type))
  );
}

// =====================================================
// GET /api/tenants — List all tenants (master_admin only)
// =====================================================
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("Authorization");
  const auth = await validateMasterAdmin(authHeader);
  if (auth.error) return auth.error;

  try {
    const adminClient = createServiceClient();
    const { data, error } = await adminClient
      .from("tenants")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ data: data || [] });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// =====================================================
// POST /api/tenants — Create tenant (master_admin only)
// =====================================================
export async function POST(request: NextRequest) {
  const authHeader = request.headers.get("Authorization");
  const auth = await validateMasterAdmin(authHeader);
  if (auth.error) return auth.error;

  try {
    const adminClient = createServiceClient();
    const body = await request.json();
    const { name, domain, slug, logo_url, settings } = body;

    if (!name || !slug) {
      return NextResponse.json(
        { error: "Nome e slug são obrigatórios" },
        { status: 400 }
      );
    }

    const { data, error } = await adminClient
      .from("tenants")
      .insert({
        name,
        domain: domain || null,
        slug: slug.toLowerCase().replace(/[^a-z0-9-]/g, "-"),
        logo_url: logo_url || null,
        settings: settings || {
          timezone: "America/Sao_Paulo",
          locale: "pt-BR",
          plan: "basic",
        },
        is_active: true,
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    await logAction("create", "tenants", { tenantId: data.id, name, slug }, auth.user.id);
    await notifyMasterAdmins(
      adminClient,
      "Empresa criada",
      `A empresa "${name}" foi adicionada ao sistema`,
      "success"
    );

    return NextResponse.json({ data });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// =====================================================
// PUT /api/tenants — Update tenant (master_admin only)
// =====================================================
export async function PUT(request: NextRequest) {
  const authHeader = request.headers.get("Authorization");
  const auth = await validateMasterAdmin(authHeader);
  if (auth.error) return auth.error;

  try {
    const adminClient = createServiceClient();
    const body = await request.json();
    const { id, name, domain, logo_url, settings, is_active } = body;

    if (!id) {
      return NextResponse.json({ error: "ID é obrigatório" }, { status: 400 });
    }

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
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    await logAction("update", "tenants", { tenantId: id, name, is_active }, auth.user.id);
    await notifyMasterAdmins(
      adminClient,
      "Empresa atualizada",
      `A empresa "${name}" teve seus dados alterados`,
      "info"
    );

    return NextResponse.json({ data });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// =====================================================
// DELETE /api/tenants — Delete tenant (master_admin only)
// =====================================================
export async function DELETE(request: NextRequest) {
  const authHeader = request.headers.get("Authorization");
  const auth = await validateMasterAdmin(authHeader);
  if (auth.error) return auth.error;

  try {
    const adminClient = createServiceClient();
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "ID é obrigatório" }, { status: 400 });
    }

    if (id === "00000000-0000-0000-0000-000000000000") {
      return NextResponse.json(
        { error: "Não é possível excluir o tenant padrão" },
        { status: 400 }
      );
    }

    const { error } = await adminClient.from("tenants").delete().eq("id", id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    await logAction("delete", "tenants", { tenantId: id }, auth.user.id);
    await notifyMasterAdmins(
      adminClient,
      "Empresa excluída",
      `Uma empresa foi removida do sistema (ID: ${id})`,
      "warning"
    );

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
