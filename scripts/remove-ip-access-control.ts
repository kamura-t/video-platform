#!/usr/bin/env tsx

import { prisma } from '../lib/prisma'

async function removeIpAccessControl() {
  try {
    console.log('🗑️  Removing IP-based access control settings...')
    
    // Remove the IP-based setting from system_settings
    const result = await prisma.systemSetting.deleteMany({
      where: {
        settingKey: 'private_video_allowed_ips'
      }
    })
    
    console.log(`✅ Removed ${result.count} IP access control setting(s)`)
    
    console.log('📋 Summary:')
    console.log('- Removed private_video_allowed_ips setting from database')
    console.log('- School-restricted videos now use login-based access only')
    console.log('- IP-based access control has been completely removed')
    
  } catch (error) {
    console.error('❌ Error removing IP access control:', error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

// Run the script
removeIpAccessControl()