import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    // Verificar se o usuário que está chamando é admin
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      throw new Error('Missing authorization header')
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    )

    const { data: { user: callingUser } } = await supabaseClient.auth.getUser()
    if (!callingUser) throw new Error('Not authenticated')

    // Verificar se é admin
    const { data: roleCheck } = await supabaseClient
      .from('user_roles')
      .select('role')
      .eq('user_id', callingUser.id)
      .eq('role', 'admin')
      .maybeSingle()

    if (!roleCheck) throw new Error('Not authorized - admin only')

    // Criar usuário com service_role
    const { email, password, fullName, roles } = await req.json()

    if (!email || !password || !fullName) {
      throw new Error('Email, password and fullName are required')
    }

    if (!roles || roles.length === 0) {
      throw new Error('At least one role is required')
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // Auto-confirma o email
      user_metadata: { full_name: fullName }
    })

    if (createError) throw createError

    // Profile é criado automaticamente pelo trigger handle_new_user
    // Mas precisamos substituir a role padrão 'viewer' pelas selecionadas
    if (newUser.user) {
      // Remover role padrão 'viewer'
      await supabaseAdmin
        .from('user_roles')
        .delete()
        .eq('user_id', newUser.user.id)

      // Inserir as roles selecionadas
      const roleInserts = roles.map((role: string) => ({
        user_id: newUser.user.id,
        role
      }))

      const { error: roleError } = await supabaseAdmin
        .from('user_roles')
        .insert(roleInserts)

      if (roleError) throw roleError
    }

    return new Response(
      JSON.stringify({ user: newUser.user }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    console.error('Error creating user:', error)
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
