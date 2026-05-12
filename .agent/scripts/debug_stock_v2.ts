
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

async function debug() {
    console.log("--- DEBUGGING STOCK BALANCES for TRL-0001 ---");

    // 1. Find Product
    const { data: product } = await supabase
        .from('raw_materials')
        .select('*')
        .ilike('sku', '%TRL-0001%')
        .single();

    if (!product) {
        console.log("Product TRL-0001 not found");
        return;
    }
    console.log(`Product: ${product.name} (ID: ${product.id})`);
    console.log(`Units: Buy=${product.unit_buy}, Use=${product.unit_use}, Factor=${product.conversion_factor}`);

    // 2. Fetch Balances
    const { data: balances } = await supabase
        .from('inventory_balances')
        .select(`
            *,
            location:stock_locations(*)
        `)
        .eq('product_id', product.id);

    console.log("\nBalances across locations:");
    if (balances) {
        balances.forEach(b => {
            console.log(`- Location: ${b.location?.name} (Type: ${b.location?.type})`);
            console.log(`  Qty: ${b.current_quantity}, Reserved: ${b.reserved_quantity}`);
        });
    }

    // 3. Test Service logic simulation
    const locMap: Record<string, string> = {};
    const { data: locations } = await supabase.from('stock_locations').select('*');
    locations?.forEach(l => locMap[l.id] = l.type || 'internal');

    const totals = { physical: 0, reserved: 0, wip_internal: 0, wip_external: 0 };
    balances?.forEach(b => {
        const type = locMap[b.location_id] || 'internal';
        const qty = Number(b.current_quantity) || 0;
        const res = Number(b.reserved_quantity) || 0;
        if (type === 'internal') {
            totals.physical += qty;
            totals.reserved += res;
        } else if (type === 'wip_internal') totals.wip_internal += qty;
        else if (type === 'wip_external') totals.wip_external += qty;
    });

    console.log("\nCalculated Totals (Usage Unit):", totals);
    console.log("Calculated Totals (Buy Unit):", {
        physical: totals.physical / (product.conversion_factor || 1),
        reserved: totals.reserved / (product.conversion_factor || 1)
    });
}

debug();
