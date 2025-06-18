
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface TeamRequest {
  action: 'create_team' | 'add_member' | 'remove_member' | 'share_server' | 'unshare_server' | 'get_teams' | 'get_team_members' | 'get_shared_servers'
  teamName?: string
  teamId?: string
  userEmail?: string
  userId?: string
  serverId?: string
  canEdit?: boolean
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Get the authorization header
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      throw new Error('No authorization header')
    }

    // Verify the JWT token
    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token)
    
    if (authError || !user) {
      throw new Error('Unauthorized')
    }

    const { action, teamName, teamId, userEmail, userId, serverId, canEdit }: TeamRequest = await req.json()

    console.log(`Team operation: ${action} for user ${user.id}`)

    switch (action) {
      case 'create_team': {
        if (!teamName) {
          throw new Error('Team name is required')
        }

        const { data: team, error: teamError } = await supabaseClient
          .from('teams')
          .insert({
            name: teamName,
            created_by: user.id
          })
          .select()
          .single()

        if (teamError) throw teamError

        // Add creator as owner
        const { error: memberError } = await supabaseClient
          .from('team_members')
          .insert({
            team_id: team.id,
            user_id: user.id,
            role: 'owner'
          })

        if (memberError) throw memberError

        return new Response(JSON.stringify({ success: true, team }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      case 'add_member': {
        if (!teamId || !userEmail) {
          throw new Error('Team ID and user email are required')
        }

        // First check if current user is team owner/admin
        const { data: membership } = await supabaseClient
          .from('team_members')
          .select('role')
          .eq('team_id', teamId)
          .eq('user_id', user.id)
          .single()

        if (!membership || (membership.role !== 'owner' && membership.role !== 'admin')) {
          throw new Error('Insufficient permissions')
        }

        // Find user by email
        const { data: userData, error: userError } = await supabaseClient.auth.admin.listUsers()
        if (userError) throw userError

        const targetUser = userData.users.find(u => u.email === userEmail)
        if (!targetUser) {
          throw new Error('User not found')
        }

        // Add to team
        const { error: addError } = await supabaseClient
          .from('team_members')
          .insert({
            team_id: teamId,
            user_id: targetUser.id,
            role: 'member'
          })

        if (addError) {
          if (addError.code === '23505') { // Unique constraint violation
            throw new Error('User is already a team member')
          }
          throw addError
        }

        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      case 'remove_member': {
        if (!teamId || !userId) {
          throw new Error('Team ID and user ID are required')
        }

        // Check permissions
        const { data: membership } = await supabaseClient
          .from('team_members')
          .select('role')
          .eq('team_id', teamId)
          .eq('user_id', user.id)
          .single()

        if (!membership || (membership.role !== 'owner' && membership.role !== 'admin')) {
          throw new Error('Insufficient permissions')
        }

        const { error: removeError } = await supabaseClient
          .from('team_members')
          .delete()
          .eq('team_id', teamId)
          .eq('user_id', userId)

        if (removeError) throw removeError

        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      case 'share_server': {
        if (!serverId || !teamId) {
          throw new Error('Server ID and team ID are required')
        }

        // Check if user owns the server
        const { data: server } = await supabaseClient
          .from('ftp_servers')
          .select('user_id')
          .eq('id', serverId)
          .single()

        if (!server || server.user_id !== user.id) {
          throw new Error('Server not found or insufficient permissions')
        }

        // Share with team
        const { error: shareError } = await supabaseClient
          .from('ftp_servers')
          .update({ shared_with_team: teamId })
          .eq('id', serverId)

        if (shareError) throw shareError

        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      case 'get_teams': {
        const { data: teams, error: teamsError } = await supabaseClient
          .from('teams')
          .select(`
            *,
            team_members!inner(role)
          `)
          .eq('team_members.user_id', user.id)

        if (teamsError) throw teamsError

        return new Response(JSON.stringify({ teams }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      case 'get_team_members': {
        if (!teamId) {
          throw new Error('Team ID is required')
        }

        const { data: members, error: membersError } = await supabaseClient
          .from('team_members')
          .select(`
            *,
            teams!inner(*)
          `)
          .eq('team_id', teamId)
          .eq('teams.id', teamId)

        if (membersError) throw membersError

        return new Response(JSON.stringify({ members }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      default:
        throw new Error('Invalid action')
    }

  } catch (error) {
    console.error('Team operation error:', error)
    return new Response(JSON.stringify({ 
      error: error.message || 'Internal server error' 
    }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
