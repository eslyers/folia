import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { webhook_url, channel, test_event, test_payload } = body;

    if (!webhook_url || !channel || !test_event) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    let payload: any;

    if (channel === "slack") {
      const messages: Record<string, string> = {
        leave_request_created: `🎉 *Teste: Novo Pedido de Férias*\n👤 *${test_payload?.user_name || "Teste Usuário"}*\n📅 De ${test_payload?.start_date || "2026-04-20"} até ${test_payload?.end_date || "2026-04-22"}\n📝 ${test_payload?.days_count || 3} dias`,
        leave_request_approved: `✅ *Teste: Pedido Aprovado*\n👤 *${test_payload?.user_name || "Teste Usuário"}*\n✅ Aprovado por ${test_payload?.approver_name || "Admin"}`,
        leave_request_rejected: `❌ *Teste: Pedido Rejeitado*\n👤 *${test_payload?.user_name || "Teste Usuário"}*\n📝 Motivo: ${test_payload?.rejection_reason || "Teste de rejeição"}`,
        leave_request_cancelled: `ℹ️ *Teste: Pedido Cancelado*\n👤 *${test_payload?.user_name || "Teste Usuário"}*`,
      };

      payload = {
        text: messages[test_event] || `📢 FOLIA Test: ${test_event}`,
      };
    } else if (channel === "teams") {
      const adaptiveCards: Record<string, any> = {
        leave_request_created: {
          type: "message",
          attachments: [{
            contentType: "application/vnd.microsoft.card.adaptive",
            content: {
              type: "AdaptiveCard",
              body: [
                { type: "TextBlock", size: "Large", weight: "Bolder", text: "🎉 Teste: Novo Pedido de Férias" },
                { type: "FactSet", facts: [
                  { title: "Funcionário", value: test_payload?.user_name || "Teste Usuário" },
                  { title: "Período", value: `${test_payload?.start_date || "2026-04-20"} até ${test_payload?.end_date || "2026-04-22"}` },
                  { title: "Dias", value: String(test_payload?.days_count || 3) },
                ]},
              ],
            },
          }],
        },
        leave_request_approved: {
          type: "message",
          attachments: [{
            contentType: "application/vnd.microsoft.card.adaptive",
            content: {
              type: "AdaptiveCard",
              body: [
                { type: "TextBlock", size: "Large", weight: "Bolder", text: "✅ Teste: Pedido Aprovado" },
                { type: "FactSet", facts: [
                  { title: "Funcionário", value: test_payload?.user_name || "Teste Usuário" },
                  { title: "Aprovado por", value: test_payload?.approver_name || "Admin" },
                ]},
              ],
            },
          }],
        },
        leave_request_rejected: {
          type: "message",
          attachments: [{
            contentType: "application/vnd.microsoft.card.adaptive",
            content: {
              type: "AdaptiveCard",
              body: [
                { type: "TextBlock", size: "Large", weight: "Bolder", text: "❌ Teste: Pedido Rejeitado" },
                { type: "FactSet", facts: [
                  { title: "Funcionário", value: test_payload?.user_name || "Teste Usuário" },
                  { title: "Motivo", value: test_payload?.rejection_reason || "Teste de rejeição" },
                ]},
              ],
            },
          }],
        },
        leave_request_cancelled: {
          type: "message",
          attachments: [{
            contentType: "application/vnd.microsoft.card.adaptive",
            content: {
              type: "AdaptiveCard",
              body: [
                { type: "TextBlock", size: "Large", weight: "Bolder", text: "ℹ️ Teste: Pedido Cancelado" },
                { type: "FactSet", facts: [
                  { title: "Funcionário", value: test_payload?.user_name || "Teste Usuário" },
                ]},
              ],
            },
          }],
        },
      };

      payload = adaptiveCards[test_event] || {
        type: "message",
        attachments: [{
          contentType: "application/vnd.microsoft.card.adaptive",
          content: {
            type: "AdaptiveCard",
            body: [{ type: "TextBlock", text: `📢 FOLIA Test: ${test_event}` }],
          },
        }],
      };
    } else {
      return NextResponse.json({ error: "Invalid channel" }, { status: 400 });
    }

    // Send the test webhook
    const response = await fetch(webhook_url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const text = await response.text().catch(() => "Unknown error");
      return NextResponse.json(
        { error: `Webhook returned ${response.status}: ${text}` },
        { status: 200 } // Return 200 but with error in body since webhook APIs vary
      );
    }

    return NextResponse.json({ success: true, message: "Test notification sent" });
  } catch (error: any) {
    return NextResponse.json(
      { error: `Failed to send test: ${error.message}` },
      { status: 500 }
    );
  }
}
