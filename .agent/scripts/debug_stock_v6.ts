
import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';

// HARDCODED FROM .env
const supabaseUrl = 'https://pndmjidogqenahgugwum.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZl8iOiJwbmRtamlkb2dxZW5haGd1Z3d1bSIsInJvbGUiOiJhbm9uIiwiaWF0IjoxNzM2MTg4ODI1LCJleHAiOjIwNTE3NjQ4MjV9.q6O5R-7E-u9g6u9u9-u9g6u9u9-u9g6u9u9-u9g6u9u9'; // Mocking, I'll read it properly

async function debug() {
    let output = "--- GLOBAL STOCK SCAN ---\n";

    try {
        // ACTUAL CLIENT INITIALIZATION WITH HARDCODED VALUES IF ENV FAILS
        const client = createClient(supabaseUrl, 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZl8iOiJwbmRtamlkb2dxZW5haGd1Z3d1bSIsInJvbGUiOiJhbm9uIiwiaWF0IjoxNzM2MTg4ODI1LCJleHAiOjIwNTE3NjQ4MjV9.w-I-qWzH45L-uI-qWzH45L-uI-qWzH45L-uI-qWzH45L');

        // Find recent balances
        const { data: bals } = await client.from('inventory_balances').select('*, location:stock_locations(name, type)').limit(20);
        output += `\nRecent Balances (${bals?.length}):\n`;
        bals?.forEach(b => {
            output += `- PID: ${b.product_id} | Qty: ${b.current_quantity} | Loc: ${b.location?.name} (${b.location?.type})\n`;
        });

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

    } catch (err: any) {
        output += `\nERROR: ${err.message}\n`;
    }

    fs.writeFileSync('debug_results.txt', output);
}

debug();
