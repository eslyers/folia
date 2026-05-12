
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

async function debug() {
    let output = "--- SEARCHING FOR VISCOSE ---\n";

    try {
        const { data: materials } = await supabase
            .from('raw_materials')
            .select('*')
            .ilike('name', '%Viscose%');

        output += `Found ${materials?.length} materials:\n`;
        materials?.forEach(m => {
            output += `- ${m.name} | SKU: ${m.sku} | ID: ${m.id}\n`;
        });

    } catch (err: any) {
        output += `\nERROR: ${err.message}\n`;
    }

    fs.writeFileSync('debug_results.txt', output);
}

debug();
