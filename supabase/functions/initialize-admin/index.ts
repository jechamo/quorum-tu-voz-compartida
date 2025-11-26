import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Check if admin already exists
    const { data: configData } = await supabaseClient
      .from('system_config')
      .select('value')
      .eq('key', 'admin_created')
      .maybeSingle();

    if (configData && configData.value === 'true') {
      return new Response(
        JSON.stringify({ message: 'Admin already exists' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create admin user with service role
    const adminPhone = '679656914';
    const adminEmail = `${adminPhone}@quorum.app`;
    const adminPassword = 'JCC1211jcc';

    const { data: authData, error: authError } = await supabaseClient.auth.admin.createUser({
      email: adminEmail,
      password: adminPassword,
      email_confirm: true,
      user_metadata: {
        phone: adminPhone,
        username: 'admin',
      },
    });

    if (authError) {
      console.error('Auth error:', authError);
      throw authError;
    }

    if (!authData.user) {
      throw new Error('No user created');
    }

    console.log('Admin user created:', authData.user.id);

    // Get "Ninguno/Apolítico" party ID
    const { data: partyData } = await supabaseClient
      .from('parties')
      .select('id')
      .eq('name', 'Ninguno/Apolítico')
      .single();

    // Create profile
    const { error: profileError } = await supabaseClient.from('profiles').insert({
      id: authData.user.id,
      phone: adminPhone,
      username: 'admin',
      gender: 'masculino',
      age: 30,
      party_id: partyData?.id || null,
    });

    if (profileError) {
      console.error('Profile error:', profileError);
      throw profileError;
    }

    console.log('Admin profile created');

    // Assign admin role
    const { error: roleError } = await supabaseClient.from('user_roles').insert({
      user_id: authData.user.id,
      role: 'admin',
    });

    if (roleError) {
      console.error('Role error:', roleError);
      throw roleError;
    }

    console.log('Admin role assigned');

    // Mark admin as created
    await supabaseClient
      .from('system_config')
      .upsert({ key: 'admin_created', value: 'true' });

    console.log('Admin initialization complete');

    return new Response(
      JSON.stringify({
        message: 'Admin user created successfully',
        phone: adminPhone,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
