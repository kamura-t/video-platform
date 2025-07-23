import { prisma } from '@/lib/prisma'
import { createSuccessResponse, createErrorResponse } from '@/lib/api-response'

export async function GET() {
  try {
    const categories = await prisma.category.findMany({
      orderBy: [
        { sortOrder: 'asc' },
        { name: 'asc' }
      ]
    })

    return createSuccessResponse(categories)
  } catch (error) {
    console.error('Categories API Error:', error)
    return createErrorResponse('カテゴリの取得に失敗しました', 500)
  }
} 