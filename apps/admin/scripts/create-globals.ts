/**
 * Script to create Header and Footer global content
 * This will populate the Header and Footer globals to remove warnings
 */

import { getRevealUI } from '@revealui/core';
import config from '../revealui.config.js';

async function createGlobals() {
  console.log('🚀 Creating Header and Footer globals...\n');

  try {
    const revealui = await getRevealUI({ config });

    // Create/Update Header Global
    console.log('📝 Creating Header global...');
    try {
      const existingHeader = await revealui.findGlobal({
        slug: 'header',
        depth: 0,
      });

      if (existingHeader) {
        console.log('✅ Header global already exists');
        console.log('   Current nav items:', existingHeader.navItems?.length || 0);
      }
    } catch (_error) {
      // Header doesn't exist, create it
      console.log('   Header not found, creating...');
      await revealui.updateGlobal({
        slug: 'header',
        data: {
          navItems: [
            {
              link: {
                type: 'custom',
                label: 'Home',
                url: '/',
                newTab: false,
              },
            },
            {
              link: {
                type: 'custom',
                label: 'Posts',
                url: '/posts',
                newTab: false,
              },
            },
            {
              link: {
                type: 'custom',
                label: 'Admin',
                url: '/admin',
                newTab: false,
              },
            },
          ],
        },
      });
      console.log('✅ Header global created successfully!');
      console.log('   Added 3 navigation items: Home, Posts, Admin');
    }

    // Create/Update Footer Global
    console.log('\n📝 Creating Footer global...');
    try {
      const existingFooter = await revealui.findGlobal({
        slug: 'footer',
        depth: 0,
      });

      if (existingFooter) {
        console.log('✅ Footer global already exists');
        console.log('   Current nav items:', existingFooter.navItems?.length || 0);
      }
    } catch (_error) {
      // Footer doesn't exist, create it
      console.log('   Footer not found, creating...');
      await revealui.updateGlobal({
        slug: 'footer',
        data: {
          navItems: [
            {
              link: {
                type: 'custom',
                label: 'Privacy Policy',
                url: '/privacy',
              },
            },
            {
              link: {
                type: 'custom',
                label: 'Terms of Service',
                url: '/terms',
              },
            },
            {
              link: {
                type: 'custom',
                label: 'Contact',
                url: '/contact',
              },
            },
          ],
        },
      });
      console.log('✅ Footer global created successfully!');
      console.log('   Added 3 navigation items: Privacy, Terms, Contact');
    }

    console.log('\n🎉 All globals created successfully!');
    console.log('\n📋 Summary:');
    console.log('  • Header: Navigation with Home, Posts, Admin links');
    console.log('  • Footer: Links for Privacy Policy, Terms, Contact');
    console.log('\n💡 Visit http://localhost:4000/admin/globals/header to edit');
    console.log('💡 Visit http://localhost:4000/admin/globals/footer to edit');
    console.log('\n✨ The "Global not found" warnings should now be gone!');

    process.exit(0);
  } catch (error) {
    console.error('\n❌ Error creating globals:', error);
    console.error('\n💡 Make sure the dev server is running: pnpm dev:admin');
    process.exit(1);
  }
}

createGlobals();
