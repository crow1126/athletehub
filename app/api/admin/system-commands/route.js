import { NextResponse } from 'next/server'
import { createServiceClient, getRequester, isSuperadmin } from '@/lib/serverAuth'

const SUPER_ADMIN_EMAIL = 'samuelwobil11@gmail.com'

export async function POST(req) {
  try {
    const db = createServiceClient()
    const requester = await getRequester(req, db)

    if (requester.error) {
      return NextResponse.json({ error: requester.error }, { status: requester.status })
    }

    if (!isSuperadmin(requester.profile)) {
      return NextResponse.json({ error: 'Forbidden: Superadmin privilege required' }, { status: 403 })
    }

    const { command, tableName, userId, teamId } = await req.json()

    if (!command) {
      return NextResponse.json({ error: 'command parameter is required' }, { status: 400 })
    }

    if (command === 'clear_all') {
      console.log('Initiating full system data wipe (excluding superadmin)...')

      const tables = [
        'billing_events',
        'subscriptions',
        'staff_logins',
        'scouting_reports',
        'transfers',
        'contracts',
        'performance_stats',
        'training_sessions',
        'injuries',
        'coaches',
        'athletes'
      ]

      // Delete child tables data
      for (const table of tables) {
        const { error } = await db
          .from(table)
          .delete()
          .neq('id', '00000000-0000-0000-0000-000000000000') // Deletes all rows
        if (error) {
          console.error(`Error deleting table ${table}:`, error.message)
          return NextResponse.json({ error: `Failed to clear table ${table}: ${error.message}` }, { status: 500 })
        }
      }

      // Delete non-superadmin profiles (by email, not only role)
      const { error: profileError } = await db
        .from('profiles')
        .delete()
        .neq('email', SUPER_ADMIN_EMAIL.toLowerCase())
      if (profileError) {
        console.error('Error deleting profiles:', profileError.message)
        return NextResponse.json({ error: `Failed to clear profiles: ${profileError.message}` }, { status: 500 })
      }

      // Delete all teams
      const { error: teamError } = await db
        .from('teams')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000')
      if (teamError) {
        console.error('Error deleting teams:', teamError.message)
        return NextResponse.json({ error: `Failed to clear teams: ${teamError.message}` }, { status: 500 })
      }

      // Fetch and delete all non-superadmin auth users
      const { data: { users }, error: listError } = await db.auth.admin.listUsers()
      if (listError) {
        console.error('Error listing auth users:', listError.message)
        return NextResponse.json({ error: `Failed to fetch users list: ${listError.message}` }, { status: 500 })
      }

      let deletedCount = 0
      for (const user of users) {
        if (user.email !== SUPER_ADMIN_EMAIL) {
          const { error: delError } = await db.auth.admin.deleteUser(user.id)
          if (delError) {
            console.error(`Error deleting auth user ${user.email}:`, delError.message)
          } else {
            deletedCount++
          }
        }
      }

      // Re-ensure superadmin profile after wipe
      const superAuth = users?.find(u => u.email?.toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase())
      if (superAuth) {
        await db.from('profiles').upsert({
          id: superAuth.id,
          email: SUPER_ADMIN_EMAIL.toLowerCase(),
          full_name: superAuth.user_metadata?.full_name || 'Super Admin',
          role: 'superadmin',
          is_active: true,
          registration_status: 'approved',
          team_id: null,
        }, { onConflict: 'id' })
      }

      return NextResponse.json({
        success: true,
        message: `System data cleared successfully. Deleted ${deletedCount} auth users and all associate table records. Superadmin preserved.`
      })
    }

    if (command === 'clear_table') {
      if (!tableName) {
        return NextResponse.json({ error: 'tableName parameter is required' }, { status: 400 })
      }

      const allowedTables = [
        'profiles',
        'athletes',
        'coaches',
        'injuries',
        'training_sessions',
        'performance_stats',
        'contracts',
        'transfers',
        'scouting_reports',
        'staff_logins',
        'subscriptions',
        'billing_events',
        'teams'
      ]

      if (!allowedTables.includes(tableName)) {
        return NextResponse.json({ error: 'Invalid or forbidden table name' }, { status: 400 })
      }

      console.log(`Clearing table: ${tableName}`)

      if (tableName === 'profiles') {
        const { error } = await db
          .from('profiles')
          .delete()
          .neq('email', SUPER_ADMIN_EMAIL.toLowerCase())
        if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      } else {
        const { error } = await db
          .from(tableName)
          .delete()
          .neq('id', '00000000-0000-0000-0000-000000000000') // Deletes all rows
        if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      }

      return NextResponse.json({
        success: true,
        message: `Table "${tableName}" cleared successfully (superadmin records preserved).`
      })
    }

    if (command === 'delete_user') {
      if (!userId) {
        return NextResponse.json({ error: 'userId parameter is required' }, { status: 400 })
      }

      // Check if user is superadmin
      const { data: authData, error: authError } = await db.auth.admin.getUserById(userId)
      if (authError || !authData?.user) {
        return NextResponse.json({ error: 'User auth record not found.' }, { status: 404 })
      }

      if (authData.user.email === SUPER_ADMIN_EMAIL) {
        return NextResponse.json({ error: 'Cannot delete the superadmin account.' }, { status: 400 })
      }

      console.log(`Deleting user: ${authData.user.email} (${userId})`)

      // Delete auth user (will cascade to profile if foreign keys exist, or we delete profile next)
      const { error: deleteAuthErr } = await db.auth.admin.deleteUser(userId)
      if (deleteAuthErr) {
        return NextResponse.json({ error: `Auth deletion failed: ${deleteAuthErr.message}` }, { status: 500 })
      }

      // Delete profile explicitly to be safe
      await db.from('profiles').delete().eq('id', userId)

      return NextResponse.json({
        success: true,
        message: `User ${authData.user.email} deleted successfully.`
      })
    }

    if (command === 'delete_team') {
      if (!teamId) {
        return NextResponse.json({ error: 'teamId parameter is required' }, { status: 400 })
      }

      // Check if team exists
      const { data: teamData, error: teamFetchError } = await db
        .from('teams')
        .select('name')
        .eq('id', teamId)
        .maybeSingle()

      if (teamFetchError) {
        return NextResponse.json({ error: `Failed to fetch team: ${teamFetchError.message}` }, { status: 500 })
      }
      if (!teamData) {
        return NextResponse.json({ error: 'Team record not found.' }, { status: 404 })
      }

      console.log(`Deleting team: ${teamData.name} (${teamId}) and purging roots data...`)

      // 1. Get and process team profiles
      const { data: profiles, error: profilesError } = await db
        .from('profiles')
        .select('id, email')
        .eq('team_id', teamId)

      if (profilesError) {
        return NextResponse.json({ error: `Failed to list team profiles: ${profilesError.message}` }, { status: 500 })
      }

      let deletedAuthUsers = 0
      if (profiles && profiles.length > 0) {
        for (const profile of profiles) {
          if (profile.email?.toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase()) {
            // Keep superadmin and just remove their association
            await db.from('profiles').update({ team_id: null }).eq('id', profile.id)
          } else {
            // Delete Auth user
            const { error: delAuthErr } = await db.auth.admin.deleteUser(profile.id)
            if (delAuthErr) {
              console.error(`Failed to delete auth user ${profile.email}:`, delAuthErr.message)
            } else {
              deletedAuthUsers++
            }
            // Delete Profile explicitly
            await db.from('profiles').delete().eq('id', profile.id)
          }
        }
      }

      // 2. Find team's athletes
      const { data: athletes, error: athletesError } = await db
        .from('athletes')
        .select('id')
        .eq('team_id', teamId)

      if (athletesError) {
        return NextResponse.json({ error: `Failed to list athletes: ${athletesError.message}` }, { status: 500 })
      }

      const athleteIds = athletes?.map(a => a.id) || []

      // 3. Purge dependent children tables
      if (athleteIds.length > 0) {
        await db.from('performance_stats').delete().in('athlete_id', athleteIds)
        await db.from('injuries').delete().in('athlete_id', athleteIds)
        await db.from('scouting_reports').delete().in('athlete_id', athleteIds)
        await db.from('contracts').delete().in('athlete_id', athleteIds)
        await db.from('transfers').delete().in('athlete_id', athleteIds)
      }

      // 4. Purge team direct dependencies
      await db.from('contracts').delete().eq('team_id', teamId)
      await db.from('transfers').delete().eq('from_team_id', teamId)
      await db.from('transfers').delete().eq('to_team_id', teamId)
      await db.from('coaches').delete().eq('team_id', teamId)
      await db.from('training_sessions').delete().eq('team_id', teamId)
      await db.from('staff_logins').delete().eq('team_id', teamId)
      await db.from('subscriptions').delete().eq('team_id', teamId)
      await db.from('billing_events').delete().eq('team_id', teamId)
      await db.from('athletes').delete().eq('team_id', teamId)

      // 5. Delete the team itself
      const { error: deleteTeamErr } = await db
        .from('teams')
        .delete()
        .eq('id', teamId)

      if (deleteTeamErr) {
        return NextResponse.json({ error: `Failed to delete team record: ${deleteTeamErr.message}` }, { status: 500 })
      }

      return NextResponse.json({
        success: true,
        message: `Team "${teamData.name}" and all associated roots data (athletes, contracts, coaches, subscriptions) were successfully deleted. Preserved superadmin.`
      })
    }

    return NextResponse.json({ error: 'Invalid command' }, { status: 400 })
  } catch (err) {
    console.error('System command error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
