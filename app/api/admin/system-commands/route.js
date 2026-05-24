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

    const { command, tableName, userId } = await req.json()

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

      // Delete non-superadmin profiles
      const { error: profileError } = await db
        .from('profiles')
        .delete()
        .neq('role', 'superadmin')
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

      return NextResponse.json({
        success: true,
        message: `System data cleared successfully. Deleted ${deletedCount} auth users and all associate table records.`
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
          .neq('role', 'superadmin') // Keep superadmin profile
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

    return NextResponse.json({ error: 'Invalid command' }, { status: 400 })
  } catch (err) {
    console.error('System command error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
