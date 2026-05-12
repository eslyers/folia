
import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';

const supabaseUrl = 'https://nqbsajpwjfvelqkasdqb.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5xYnNhanB3amZ2ZWxxa2FzZHFiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY3ODU4MjQsImV4cCI6MjA4MjM2MTgyNH0.Hgmrj9J7M5ylF5WCGT2YbS-5gWh64_kEQlGMW1Rl9MU';

async function debug() {
    let output = "--- TOTAL DB DUMP ---\n";
    const client = createClient(supabaseUrl, supabaseKey);

    try {
        const { data: mats, error } = await client.from('raw_materials').select('*');
        if (error) {
            output += `ERROR in raw_materials: ${error.message}\n`;
        } else {
            output += `Found ${mats?.length} raw materials.\n`;
            mats?.slice(0, 20).forEach(m => {
                output += `- ${m.name} | SKU: ${m.sku} | Company: ${m.company_id}\n`;
            });
        }

        const { data: companies } = await client.from('companies').select('*');
        output += `\nCompanies: ${companies?.length}\n`;
        companies?.forEach(c => output += `- ${c.name} | ID: ${c.id}\n`);

    } catch (err: any) {
        output += `\nCATCH ERROR: ${err.message}\n`;
    }

    fs.writeFileSync('debug_results.txt', output);
    console.log("Done");
}

debug();
