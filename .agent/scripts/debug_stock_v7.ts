
import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';

const supabaseUrl = 'https://nqbsajpwjfvelqkasdqb.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5xYnNhanB3amZ2ZWxxa2FzZHFiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY3ODU4MjQsImV4cCI6MjA4MjM2MTgyNH0.Hgmrj9J7M5ylF5WCGT2YbS-5gWh64_kEQlGMW1Rl9MU';

async function debug() {
    let output = "--- GLOBAL STOCK SCAN ---\n";

    try {
        const client = createClient(supabaseUrl, supabaseKey);

        // Search for Viscose in all possible places
        const { data: m1 } = await client.from('raw_materials').select('*').ilike('name', '%Viscose%');
        const { data: m2 } = await client.from('products').select('*').ilike('title', '%Viscose%');
        const { data: m3 } = await client.from('product_variants').select('*').ilike('sku', '%Viscose%');

        output += `\nSearch Results:\n`;
        output += `Raw Materials: ${m1?.length}\n`;
        m1?.forEach(m => output += `  - ${m.name} [RM] | SKU: ${m.sku} | ID: ${m.id}\n`);
        output += `Products: ${m2?.length}\n`;
        m2?.forEach(m => output += `  - ${m.title} [P] | ID: ${m.id}\n`);
        output += `Variants: ${m3?.length}\n`;
        m3?.forEach(m => output += `  - ${m.sku} [V] | ID: ${m.id}\n`);

        if (m1 && m1.length > 0) {
            const vid = m1[0].id;
            const { data: bals } = await client.from('inventory_balances').select('*, location:stock_locations(name, type)').eq('product_id', vid);
            output += `\nBalances for ${m1[0].name} (${bals?.length}):\n`;
            bals?.forEach(b => {
                output += `- Loc: ${b.location?.name} (${b.location?.type}) | Qty: ${b.current_quantity} | Res: ${b.reserved_quantity}\n`;
            });
        }

    } catch (err: any) {
        output += `\nERROR: ${err.message}\n`;
    }

    fs.writeFileSync('debug_results.txt', output);
    console.log("Done");
}

debug();
