
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://nqbsajpwjfvelqkasdqb.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5xYnNhanB3amZ2ZWxxa2FzZHFiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY3ODU4MjQsImV4cCI6MjA4MjM2MTgyNH0.Hgmrj9J7M5ylF5WCGT2YbS-5gWh64_kEQlGMW1Rl9MU';

const supabase = createClient(supabaseUrl, supabaseKey);

async function auditProductionOrder(opIdPartial: string) {
    console.log(`\n🔍 AUDITORIA FORENSE DE OP (Partial ID: ${opIdPartial})`);
    console.log('==================================================');

    // 1. Find the full OP
    const { data: ops, error: opError } = await supabase
        .from('production_orders')
        .select('*')
        .eq('id', '985F5D9A-581A-4FB9-8DF7-B38023D785A9')
        .limit(1);

    if (opError) console.error('DB Error:', opError);
    // console.log('Raw OP Data:', JSON.stringify(ops, null, 2));

    if (opError || !ops || ops.length === 0) {
        console.error('❌ OP não encontrada. Verifique o ID.');
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
            console.log(`     - Produto ID: ${entry.product_id}`);

            // Check match
            const matchedVariant = variants?.find(v => v.id === entry.product_id);
            if (matchedVariant) {
                console.log(`       ✅ MATCH COM VARIANTE: ${matchedVariant.sku}`);
            } else if (entry.product_id === op.product_id) {
                console.log(`       ⚠️ WARNING: LANÇADO NO PARENT ID (Fantasma)`);
            } else {
                // Check if it matches Raw Material
                console.log(`       ℹ️ Insumo/Outro`);
            }
        });
    }
}

// Hardcoded OP from screenshot
auditProductionOrder('985F5D9A');
