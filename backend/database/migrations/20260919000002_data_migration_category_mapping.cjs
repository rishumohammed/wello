// backend/database/migrations/20260919000002_data_migration_category_mapping.cjs
/**
 * Data Migration: Map string service categories in projects to category_id foreign keys
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function(knex) {
  // Ensure base categories are present for mapping
  const existingCategories = await knex('categories').select('id', 'name', 'slug')
  
  // Mapping dictionary: [lowerCase String Keyword] -> Category Name
  const categoryKeywords = {
    'web': 'Software & Web Development',
    'software': 'Software & Web Development',
    'dev': 'Software & Web Development',
    'frontend': 'Software & Web Development',
    'backend': 'Software & Web Development',
    'design': 'UI/UX & Visual Design',
    'ui': 'UI/UX & Visual Design',
    'ux': 'UI/UX & Visual Design',
    'graphic': 'UI/UX & Visual Design',
    'branding': 'UI/UX & Visual Design',
    'content': 'Content & Copywriting',
    'copy': 'Content & Copywriting',
    'writing': 'Content & Copywriting',
    'marketing': 'Digital Marketing & SEO',
    'seo': 'Digital Marketing & SEO',
    'growth': 'Digital Marketing & SEO',
    'video': 'Video Production & Animation',
    'animation': 'Video Production & Animation',
    '3d': 'Video Production & Animation',
    'consulting': 'Software & Web Development',
    'e-commerce': 'Software & Web Development',
  }

  // Find all projects that have a service_category string or NULL category_id
  const projects = await knex('projects').select('id', 'service_category', 'name', 'category_id')

  for (const proj of projects) {
    if (proj.category_id) continue // Already mapped

    const searchTarget = (proj.service_category || proj.name || '').toLowerCase()
    let matchedCategoryName = 'Software & Web Development' // Default fallback

    for (const [kw, catName] of Object.entries(categoryKeywords)) {
      if (searchTarget.includes(kw)) {
        matchedCategoryName = catName
        break
      }
    }

    const matchedCat = existingCategories.find(c => c.name.toLowerCase() === matchedCategoryName.toLowerCase())
    if (matchedCat) {
      await knex('projects')
        .where({ id: proj.id })
        .update({ category_id: matchedCat.id })
    }
  }
}

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = async function(knex) {
  // Revert category_id to NULL
  await knex('projects').update({ category_id: null })
}
