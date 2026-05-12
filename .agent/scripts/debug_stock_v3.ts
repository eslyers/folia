
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

async function debug() {
    let output = "--- DEBUGGING STOCK BALANCES for TRL-0001 ---\n";

    try {
        // 1. Find Product
        const { data: product } = await supabase
            .from('raw_materials')
            .select('*')
            .ilike('sku', '%TRL-0001%')
            .single();

        if (!product) {
            output += "Product TRL-0001 not found\n";
            fs.writeFileSync('debug_results.txt', output);
            return;
        }
        output += `Product: ${product.name} (ID: ${product.id})\n`;
        output += `Units: Buy=${product.unit_buy}, Use=${product.unit_use}, Factor=${product.conversion_factor}\n`;

        // 2. Fetch Balances
        const { data: balances } = await supabase
            .from('inventory_balances')
            .select(`
                *,
                location:stock_locations(*)
            `)
            .eq('product_id', product.id);

        output += "\nBalances across locations:\n";
        if (balances) {
            balances.forEach(b => {
                output += `- Location: ${b.location?.name} (Type: ${b.location?.type})\n`;
                output += `  Qty: ${b.current_quantity}, Reserved: ${b.reserved_quantity}\n`;
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

        output += `\nCalculated Totals (Usage Unit): ${JSON.stringify(totals)}\n`;
        output += `Calculated Totals (Buy Unit): ${JSON.stringify({
            physical: totals.physical / (product.conversion_factor || 1),
            reserved: totals.reserved / (product.conversion_factor || 1)
        })}\n`;

    } catch (err: any) {
        output += `\nERROR: ${err.message}\n`;
    }

    fs.writeFileSync('debug_results.txt', output);
    console.log("Results written to debug_results.txt");
}

debug();
