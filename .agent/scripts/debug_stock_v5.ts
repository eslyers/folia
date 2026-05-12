
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

async function debug() {
    let output = "--- DATABASE DUMP (FIRST 5) ---\n";

    try {
        const { data: mats } = await supabase
            .from('raw_materials')
            .select('id, name, sku')
            .limit(10);

        output += `\nRAW MATERIALS (Top 10):\n`;
        mats?.forEach(m => {
            output += `- ${m.name} | SKU: ${m.sku} | ID: ${m.id}\n`;
        });

        const { data: prods } = await supabase
            .from('products')
            .select('id, title, handle')
            .limit(10);

        output += `\nPRODUCTS (Top 10):\n`;
        prods?.forEach(p => {
            output += `- ${p.title} | Handle: ${p.handle} | ID: ${p.id}\n`;
        });

    } catch (err: any) {
        output += `\nERROR: ${err.message}\n`;
    }

    fs.writeFileSync('debug_results.txt', output);
}

debug();
