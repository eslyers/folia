-- Migration 008: Add webhook_configs for Slack/Teams integration
-- Enables notifications to Slack and Microsoft Teams via webhooks

-- =====================================================
-- TABLE: webhook_configs
-- =====================================================
CREATE TABLE IF NOT EXISTS webhook_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000',
  name TEXT NOT NULL,
  channel TEXT NOT NULL CHECK (channel IN ('slack', 'teams')),
  webhook_url TEXT NOT NULL,
  events TEXT[] NOT NULL DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Trigger for updated_at
CREATE TRIGGER webhook_configs_updated_at
  BEFORE UPDATE ON webhook_configs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- RLS for webhook_configs
ALTER TABLE webhook_configs ENABLE ROW LEVEL SECURITY;

-- Tenant admins can manage webhook configs
CREATE POLICY "tenant_admins_manage_webhooks" ON webhook_configs
  FOR ALL USING (
    is_tenant_admin(auth.uid()) AND get_user_tenant(auth.uid()) = tenant_id
  );

-- Service role can do everything
CREATE POLICY "service_role_webhooks" ON webhook_configs
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_webhook_configs_tenant_id ON webhook_configs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_webhook_configs_channel ON webhook_configs(channel);
CREATE INDEX IF NOT EXISTS idx_webhook_configs_is_active ON webhook_configs(is_active);

-- =====================================================
-- HELPER: Send notification to Slack/Teams webhook
-- =====================================================
CREATE OR REPLACE FUNCTION send_webhook_notification(
  p_tenant_id UUID,
  p_event TEXT,
  p_payload JSONB
)
RETURNS void AS $$
DECLARE
  v_webhook RECORD;
  v_payload JSONB;
  v_response TEXT;
BEGIN
  -- Find active webhooks for this event in this tenant
  FOR v_webhook IN
    SELECT id, channel, webhook_url
    FROM webhook_configs
    WHERE tenant_id = p_tenant_id
      AND is_active = true
      AND channel = ANY(events)
  LOOP
    -- Format payload based on channel type
    IF v_webhook.channel = 'slack' THEN
      v_payload := jsonb_build_object(
        'text', format_webhook_message_slack(p_event, p_payload)
      );
    ELSIF v_webhook.channel = 'teams' THEN
      v_payload := jsonb_build_object(
        'type', 'message',
        'attachments', jsonb_build_array(
          jsonb_build_object(
            'contenttype', 'application/vnd.microsoft.card.adaptive',
            'content', format_webhook_message_teams(p_event, p_payload)
          )
        )
      );
    END IF;

    -- Log the attempt (actual HTTP call is done in application layer)
    INSERT INTO audit_log (user_id, action, table_name, record_id, new_value, tenant_id)
    VALUES (
      NULL,
      'webhook_sent',
      'webhook_configs',
      v_webhook.id,
      jsonb_build_object(
        'event', p_event,
        'channel', v_webhook.channel,
        'payload', p_payload
      ),
      p_tenant_id
    );
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- FORMAT HELPERS (return text, used by send_webhook_notification)
-- =====================================================
CREATE OR REPLACE FUNCTION format_webhook_message_slack(p_event TEXT, p_payload JSONB)
RETURNS TEXT AS $$
BEGIN
  CASE p_event
    WHEN 'leave_request_created' THEN
      RETURN format('🎉 *Novo Pedido de Férias*\n👤 *%s*\n📅 De %s até %s\n📝 %s dias',
        p_payload->>'user_name',
        p_payload->>'start_date',
        p_payload->>'end_date',
        p_payload->>'days_count'
      );
    WHEN 'leave_request_approved' THEN
      RETURN format('✅ *Pedido Aprovado*\n👤 *%s*\n📅 De %s até %s\n✅ Aprovado por %s',
        p_payload->>'user_name',
        p_payload->>'start_date',
        p_payload->>'end_date',
        p_payload->>'approver_name'
      );
    WHEN 'leave_request_rejected' THEN
      RETURN format('❌ *Pedido Rejeitado*\n👤 *%s*\n📅 De %s até %s\n📝 Motivo: %s',
        p_payload->>'user_name',
        p_payload->>'start_date',
        p_payload->>'end_date',
        COALESCE(p_payload->>'rejection_reason', 'Não informado')
      );
    ELSE
      RETURN format('📢 FOLIA: %s', p_event);
  END CASE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION format_webhook_message_teams(p_event TEXT, p_payload JSONB)
RETURNS JSONB AS $$
BEGIN
  CASE p_event
    WHEN 'leave_request_created' THEN
      RETURN jsonb_build_object(
        'type', 'AdaptiveCard',
        'body', jsonb_build_array(
          jsonb_build_object('type', 'TextBlock', 'size', 'Large', 'weight', 'Bolder', 'text', '🎉 Novo Pedido de Férias'),
          jsonb_build_object('type', 'FactSet', 'facts', jsonb_build_array(
            jsonb_build_object('title', 'Funcionário', 'value', p_payload->>'user_name'),
            jsonb_build_object('title', 'Período', 'value', format('%s até %s', p_payload->>'start_date', p_payload->>'end_date')),
            jsonb_build_object('title', 'Dias', 'value', p_payload->>'days_count')
          ))
        )
      );
    WHEN 'leave_request_approved' THEN
      RETURN jsonb_build_object(
        'type', 'AdaptiveCard',
        'body', jsonb_build_array(
          jsonb_build_object('type', 'TextBlock', 'size', 'Large', 'weight', 'Bolder', 'text', '✅ Pedido Aprovado'),
          jsonb_build_object('type', 'FactSet', 'facts', jsonb_build_array(
            jsonb_build_object('title', 'Funcionário', 'value', p_payload->>'user_name'),
            jsonb_build_object('title', 'Aprovado por', 'value', p_payload->>'approver_name')
          ))
        )
      );
    WHEN 'leave_request_rejected' THEN
      RETURN jsonb_build_object(
        'type', 'AdaptiveCard',
        'body', jsonb_build_array(
          jsonb_build_object('type', 'TextBlock', 'size', 'Large', 'weight', 'Bolder', 'text', '❌ Pedido Rejeitado'),
          jsonb_build_object('type', 'FactSet', 'facts', jsonb_build_array(
            jsonb_build_object('title', 'Funcionário', 'value', p_payload->>'user_name'),
            jsonb_build_object('title', 'Motivo', 'value', COALESCE(p_payload->>'rejection_reason', 'Não informado'))
          ))
        )
      );
    ELSE
      RETURN jsonb_build_object(
        'type', 'AdaptiveCard',
        'body', jsonb_build_array(
          jsonb_build_object('type', 'TextBlock', 'text', format('📢 FOLIA: %s', p_event))
        )
      );
  END CASE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
