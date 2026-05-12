
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

// Load env vars
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Missing Supabase credentials in .env');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function auditProductionOrder(opIdPartial: string) {
    console.log(`\n🔍 AUDITORIA FORENSE DE OP (Partial ID: ${opIdPartial})`);
    console.log('==================================================');

    // 1. Find the full OP
    const { data: ops, error: opError } = await supabase
        .from('production_orders')
        .select('*')
        .ilike('id', `%${opIdPartial}%`)
        .limit(1);

    if (opError || !ops || ops.length === 0) {
        console.error('❌ OP não encontrada:', opError?.message);
        return;
    }

    const op = ops[0];
    console.log(`✅ OP Encontrada: ${op.id}`);
    console.log(`   - Produto (Parent ID): ${op.product_id}`);
    console.log(`   - Status: ${op.status}`);
    console.log(`   - Stages Concluídos:`, op.completed_stages);

    // 2. Check Product & Variants
    console.log('\n📦 ANÁLISE DO PRODUTO (Setup)');
    const { data: variants } = await supabase
        .from('product_variants')
        .select('id, sku, inventory_quantity')
        .eq('product_id', op.product_id);

    console.log(`   - Variantes encontradas: ${variants?.length || 0}`);
    if (variants) {
        variants.forEach(v => console.log(`     -> SKU: ${v.sku} | ID: ${v.id} | Saldo: ${v.inventory_quantity}`));
    }

    // 3. Check Stock Ledger (O Rastro do Dinheiro)
    console.log('\n📒 STOCK LEDGER (Movimentações Vinculadas)');
    const { data: ledger, error: ledgerError } = await supabase
        .from('stock_ledger')
        .select(`
            id, 
            created_at, 
            movement_type, 
            quantity, 
            location_id, 
            product_id, 
            document_ref
        `)
        .ilike('document_ref', `%${op.id}%`)
        .order('created_at', { ascending: true });

    if (ledgerError) console.error('❌ Erro no Ledger:', ledgerError.message);

    if (!ledger || ledger.length === 0) {
        console.log('   ⚠️ NENHUM REGISTRO NO KARDEX PARA ESTA OP!');
    } else {
        ledger.forEach(entry => {
            const isInput = entry.quantity > 0;
            const typeIcon = isInput ? '📥 ENTRADA' : '📤 SAÍDA';
            console.log(`   ${typeIcon} [${entry.movement_type}]`);
            console.log(`     - Data: ${new Date(entry.created_at).toLocaleString()}`);
            console.log(`     - Qtd: ${entry.quantity}`);
            console.log(`     - Local ID: ${entry.location_id}`);
            console.log(`     - Produto ID: ${entry.product_id} ${entry.product_id === op.product_id ? '(Matches Parent)' : '(Different - Variant?)'}`);

            // Check if matches any variant
            const matchedVariant = variants?.find(v => v.id === entry.product_id);
            if (matchedVariant) {
                console.log(`       ✅ MATCH COM VARIANTE: ${matchedVariant.sku}`);
            } else if (entry.product_id === op.product_id) {
                console.log(`       ⚠️ ALERTA: LANÇADO NO ID DO PARENT (Perneta Invisível)`);
            } else {
                console.log(`       ❓ UNKNOWN ID`);
            }
        });
    }

    console.log('\n==================================================');
    console.log('CONCLUSÃO PRELIMINAR:');
    const hasInput = ledger?.some(l => l.quantity > 0);
    if (!hasInput) {
        console.log('🔴 FALHA CRÍTICA: Não houve lançamento de ENTRADA (Crédito).');
        console.log('   Causa Provável: RPC abortou passo 6 ou Local Default Nulo.');
    } else {
        const parentEntry = ledger?.find(l => l.quantity > 0 && l.product_id === op.product_id);
        if (parentEntry) {
            console.log('🟠 PERNETA CONFIRMADO: Entrada existe, mas no ID do PAI (Invisível).');
            console.log('   Solução Requerida: RPC precisa resolver Variante ID.');
        } else {
            console.log('🟢 SUCESSO TÉCNICO: Entrada registrada em ID válido.');
            console.log('   Verificar filtros da UI ou Local de Estoque incorreto.');
        }
    }
}

// Get ID from args or hardcode the one from screenshot
const targetOp = process.argv[2] || '985F5D9A';
auditProductionOrder(targetOp);
