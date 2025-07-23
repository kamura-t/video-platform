import { NextRequest, NextResponse } from 'next/server';
import { gpuTranscoderClient } from '@/lib/gpu-transcoder';

export async function GET(request: NextRequest) {
  try {
    console.log('🔍 GPU変換サーバー状態確認開始');
    
    // GPU変換サーバーの状態を取得
    const systemStatus = await gpuTranscoderClient.getSystemStatus();
    
    console.log('✅ GPU変換サーバー状態取得成功:', {
      available: systemStatus.capacity.availableForNewJobs,
      gpuUtilization: systemStatus.system.gpu.utilization,
      queueStatus: systemStatus.queue
    });
    
    return NextResponse.json({
      success: true,
      data: {
        server: {
          available: systemStatus.capacity.availableForNewJobs,
          gpuUtilization: systemStatus.system.gpu.utilization,
          gpuMemory: {
            used: systemStatus.system.gpu.memoryUsed,
            total: systemStatus.system.gpu.memoryTotal
          },
          temperature: systemStatus.system.gpu.temperature,
          powerDraw: (systemStatus.system.gpu as any).powerDraw || 0
        },
        system: {
          ramUsage: systemStatus.system.system.ramUsage,
          tmpfsUsage: systemStatus.system.system.tmpfsUsage,
          loadAverage: systemStatus.system.system.loadAverage
        },
        queue: systemStatus.queue,
        performance: systemStatus.performance
      }
    });
    
  } catch (error) {
    console.error('❌ GPU変換サーバー状態確認エラー:', error);
    
    return NextResponse.json({
      success: false,
      error: 'GPU変換サーバーとの通信に失敗しました',
      details: {
        message: error instanceof Error ? error.message : 'Unknown error',
        status: error instanceof Error && 'response' in error ? (error as any).response?.status : 'Unknown'
      }
    }, { status: 503 });
  }
} 