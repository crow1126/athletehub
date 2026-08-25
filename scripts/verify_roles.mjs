import { ROLE_PERMISSIONS, canAccess } from '../lib/auth.js';

console.log('=== APEX TRACK ROLE ACCESS & DASHBOARD MATRIX ===\n');

const roles = ['superadmin', 'admin', 'coach', 'physio', 'analyst', 'scout', 'player', 'accountant'];
const allModules = [
  'superadmin', 'dashboard', 'player-hub', 'notices', 'athletes', 'coaches', 
  'schedule', 'injuries', 'performance', 'scouting', 'contracts', 'reports', 
  'settings', 'billing', 'transfers'
];

const dashboardDestinations = {
  superadmin: '/superadmin',
  admin: '/dashboard',
  coach: '/dashboard',
  physio: '/dashboard',
  analyst: '/dashboard',
  scout: '/dashboard',
  accountant: '/dashboard',
  player: '/player-hub',
};

let errors = 0;

roles.forEach(role => {
  const allowed = ROLE_PERMISSIONS[role] || [];
  const primaryDashboard = dashboardDestinations[role];
  const primaryModule = primaryDashboard.replace('/', '');

  console.log(`Role: [${role.toUpperCase()}]`);
  console.log(`  -> Primary Landing: ${primaryDashboard}`);
  console.log(`  -> Accessible Modules (${allowed.length}): ${allowed.join(', ')}`);

  // Check if primary module is accessible
  if (!canAccess(role, primaryModule)) {
    console.error(`  [ERROR] Primary dashboard module '${primaryModule}' is NOT in ROLE_PERMISSIONS for '${role}'!`);
    errors++;
  } else {
    console.log(`  [OK] Can access primary landing module.`);
  }

  // Verify non-player cannot access player-hub in permissions and player cannot access superadmin/dashboard
  if (role === 'player') {
    if (canAccess(role, 'dashboard')) {
      console.error(`  [ERROR] Player should NOT have access to staff 'dashboard'`);
      errors++;
    }
    if (canAccess(role, 'superadmin')) {
      console.error(`  [ERROR] Player should NOT have access to 'superadmin'`);
      errors++;
    }
  } else if (role !== 'superadmin') {
    if (canAccess(role, 'player-hub')) {
      console.error(`  [ERROR] Staff role '${role}' should NOT have 'player-hub' in ROLE_PERMISSIONS`);
      errors++;
    }
    if (canAccess(role, 'superadmin')) {
      console.error(`  [ERROR] Role '${role}' should NOT have 'superadmin' access`);
      errors++;
    }
  }

  console.log('');
});

console.log(`=== AUDIT COMPLETE: ${errors === 0 ? 'ALL CHECKS PASSED (0 ERRORS)' : `${errors} ERRORS FOUND`} ===`);
