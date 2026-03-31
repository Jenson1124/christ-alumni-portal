import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

Deno.serve(async () => {
  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  // Create the user
  const { data: userData, error: createError } = await supabaseAdmin.auth.admin.createUser({
    email: "director@university.com",
    password: "123456",
    email_confirm: true,
    user_metadata: { full_name: "Director" },
  });

  if (createError) {
    return new Response(JSON.stringify({ error: createError.message }), { status: 400 });
  }

  // Assign director role
  const { error: roleError } = await supabaseAdmin
    .from("user_roles")
    .insert({ user_id: userData.user.id, role: "director" });

  if (roleError) {
    return new Response(JSON.stringify({ error: roleError.message }), { status: 400 });
  }

  return new Response(JSON.stringify({ success: true, user_id: userData.user.id }), { status: 200 });
});
