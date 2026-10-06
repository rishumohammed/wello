import { createRequire } from 'module'
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const require = createRequire(path.resolve(__dirname, '../backend/package.json'))

const knex = require('knex')
const dotenv = require('dotenv')

dotenv.config({ path: path.resolve(__dirname, '../.env') })


const db = knex({
  client: 'mysql2',
  connection: {
    host: process.env.DB_HOST || process.env.MYSQL_HOST || '127.0.0.1',
    port: Number(process.env.DB_PORT || process.env.MYSQL_PORT || 3306),
    user: process.env.DB_USER || process.env.MYSQL_USER || 'root',
    password: process.env.DB_PASSWORD !== undefined ? process.env.DB_PASSWORD : (process.env.MYSQL_PASSWORD || ''),
    database: process.env.DB_NAME || process.env.MYSQL_DATABASE || 'wello',
  },
})


async function run() {
  try {
    const roles = await db('admin_roles').select('*').orderBy('id', 'asc')
    const permissions = await db('admin_permissions').select('*').orderBy('module', 'asc').orderBy('permission_key', 'asc')
    const rolePermissions = await db('admin_role_permissions').select('*')

    const roleKeys = roles.map(r => r.role_key)
    const rolePermMap = new Map()
    for (const rp of rolePermissions) {
      const key = `${rp.role_key}:${rp.permission_key}`
      rolePermMap.set(key, true)
    }

    let markdown = `# Wello — Database Seeded RBAC Matrix\n\n`
    markdown += `*Generated dynamically from authoritative MySQL tables \`admin_roles\`, \`admin_permissions\`, and \`admin_role_permissions\`.*\n\n`

    // Table Header
    markdown += `| Module | Permission Key | Permission Description | ${roleKeys.map(r => `**${r}**`).join(' | ')} |\n`
    markdown += `| :--- | :--- | :--- | ${roleKeys.map(() => ':---:').join(' | ')} |\n`

    for (const p of permissions) {
      const row = [
        p.module || 'System',
        `\`${p.permission_key}\``,
        p.description || '',
      ]

      for (const rk of roleKeys) {
        if (rk === 'SUPER_ADMIN') {
          row.push('✅ *(All)*')
        } else {
          const has = rolePermMap.has(`${rk}:${p.permission_key}`)
          row.push(has ? '✅' : '❌')
        }
      }

      markdown += `| ${row.join(' | ')} |\n`
    }

    console.log(markdown)

    // Save to docs/rbac_matrix.md
    const outPath = path.resolve(__dirname, '../docs/RBAC_MATRIX.md')
    if (!fs.existsSync(path.dirname(outPath))) {
      fs.mkdirSync(path.dirname(outPath), { recursive: true })
    }
    fs.writeFileSync(outPath, markdown, 'utf-8')
    console.log(`\n✅ Saved RBAC matrix to ${outPath}`)

    await db.destroy()
    process.exit(0)
  } catch (err) {
    console.error('Error generating RBAC matrix:', err)
    await db.destroy()
    process.exit(1)
  }
}

run()
