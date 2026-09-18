// test_admin_apis.mjs
import http from 'http';

function request(urlPath, method = 'GET', data = null) {
  return new Promise((resolve, reject) => {
    const payload = data ? JSON.stringify(data) : null;
    const req = http.request(
      {
        hostname: process.env.API_HOST || 'localhost',
        port: process.env.API_PORT || 3001,
        path: urlPath,
        method: method,
        headers: {
          'Content-Type': 'application/json',
          ...(payload ? { 'Content-Length': Buffer.byteLength(payload) } : {}),
        },
      },
      (res) => {
        let body = '';
        res.on('data', (chunk) => (body += chunk));
        res.on('end', () => {
          try {
            resolve({ statusCode: res.statusCode, body: JSON.parse(body) });
          } catch (e) {
            resolve({ statusCode: res.statusCode, rawBody: body });
          }
        });
      }
    );
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

async function runApiVerification() {
  console.log('====================================================');
  console.log('🧪 WELLO ADMIN & PUBLIC API INTEGRATION TESTER');
  console.log('====================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, label) {
    if (condition) {
      console.log(`  ✅ PASS: ${label}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${label}`);
      failed++;
    }
  }

  try {
    // 1. Public Categories
    console.log('📌 Testing 1: Public Categories API (/api/categories)');
    const catRes = await request('/api/categories');
    assert(catRes.statusCode === 200, 'GET /api/categories returns 200 OK');
    assert(Array.isArray(catRes.body?.categories), 'Categories array returned');

    // 2. Submit Category Request
    console.log('\n📌 Testing 2: Submit Category Request (/api/category-requests)');
    const reqRes = await request('/api/category-requests', 'POST', {
      userEmail: 'freelancer@example.com',
      requestedName: '3D Motion Graphics',
      description: 'CGI, Blender, 3D character design and motion rendering',
      reason: 'Needed for high value client gig',
    });
    assert(reqRes.statusCode === 200, 'POST /api/category-requests returns 200 OK');
    assert(reqRes.body?.success === true, 'Category request created successfully');
    const createdReqId = reqRes.body?.request?.id;

    // 3. Admin Category Requests List
    console.log('\n📌 Testing 3: Admin Category Requests List (/api/admin/category-requests)');
    const adminReqs = await request('/api/admin/category-requests');
    assert(adminReqs.statusCode === 200, 'GET /api/admin/category-requests returns 200 OK');
    assert(Array.isArray(adminReqs.body?.requests), 'Admin requests list returned');
    assert(adminReqs.body?.requests.some(r => r.requestedName === '3D Motion Graphics'), 'Submitted request is present in admin queue');

    // 4. Admin Approve Category Request
    if (createdReqId) {
      console.log('\n📌 Testing 4: Admin Approve Category Request (/api/admin/category-requests)');
      const approveRes = await request('/api/admin/category-requests', 'POST', {
        requestId: createdReqId,
        action: 'APPROVE',
      });
      assert(approveRes.statusCode === 200, 'POST /api/admin/category-requests (APPROVE) returns 200 OK');
      assert(approveRes.body?.success === true, 'Category request marked APPROVED and created in master categories');
    }

    // 5. Admin Category Intelligence
    console.log('\n📌 Testing 5: Category Intelligence (/api/admin/categories/intelligence)');
    const intelRes = await request('/api/admin/categories/intelligence');
    assert(intelRes.statusCode === 200, 'GET /api/admin/categories/intelligence returns 200 OK');
    assert(Array.isArray(intelRes.body?.intelligence) && intelRes.body.intelligence.length > 0, 'Category intelligence metrics calculated');

    // 6. Admin Stats Dashboard
    console.log('\n📌 Testing 6: Admin Dashboard Stats (/api/admin/stats)');
    const statsRes = await request('/api/admin/stats');
    assert(statsRes.statusCode === 200, 'GET /api/admin/stats returns 200 OK');
    assert(typeof statsRes.body?.stats?.totalUsers === 'number', 'Total users metric returned');

    // 7. Admin Funnel Engine
    console.log('\n📌 Testing 7: Admin Funnel Analytics (/api/admin/funnel)');
    const funnelRes = await request('/api/admin/funnel');
    assert(funnelRes.statusCode === 200, 'GET /api/admin/funnel returns 200 OK');
    assert(Array.isArray(funnelRes.body?.funnel) && funnelRes.body.funnel.length === 11, '11 Funnel stages returned');

    // 8. Admin Jobs Moderation
    console.log('\n📌 Testing 8: Admin Jobs Moderation (/api/admin/jobs)');
    const jobsRes = await request('/api/admin/jobs');
    assert(jobsRes.statusCode === 200, 'GET /api/admin/jobs returns 200 OK');
    assert(Array.isArray(jobsRes.body?.jobs), 'Jobs list returned');

    // 9. Admin Audit Logs
    console.log('\n📌 Testing 9: Admin Audit Logs (/api/admin/audit-logs)');
    const logsRes = await request('/api/admin/audit-logs');
    assert(logsRes.statusCode === 200, 'GET /api/admin/audit-logs returns 200 OK');
    assert(Array.isArray(logsRes.body?.logs), 'Audit logs array returned');

    // 10. Admin Roles Manager
    console.log('\n📌 Testing 10: Admin Roles Manager (/api/admin/roles)');
    const rolesRes = await request('/api/admin/roles');
    assert(rolesRes.statusCode === 200, 'GET /api/admin/roles returns 200 OK');
    assert(Array.isArray(rolesRes.body?.roles), 'Roles array returned');
    assert(rolesRes.body?.roles.some(r => r.roleKey === 'SUPER_ADMIN'), 'Super Admin role present');

    console.log('\n====================================================');
    console.log(`🏁 API TEST SUITE COMPLETE: ${passed} PASSED, ${failed} FAILED`);
    console.log('====================================================');
  } catch (err) {
    console.error('❌ Network / execution error during test run:', err);
  }
}

runApiVerification();
