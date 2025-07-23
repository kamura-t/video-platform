import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * IPアドレスからアクセス元を判定する
 */
export function getClientIP(request: NextRequest): string {
  // プロキシ経由の場合のIPアドレス取得
  const forwarded = request.headers.get('x-forwarded-for');
  const realIP = request.headers.get('x-real-ip');
  
  if (forwarded) {
    // X-Forwarded-Forの最初のIPを取得
    return forwarded.split(',')[0].trim();
  }
  
  if (realIP) {
    return realIP;
  }
  
  // 直接アクセスの場合（request.ipは削除されたため、remote-addrのみ使用）
  const ip = request.headers.get('remote-addr') || '127.0.0.1';
  return ip;
}

/**
 * IPアドレスがCIDR範囲内かチェック
 */
export function isIPInRange(ip: string, cidr: string): boolean {
  try {
    const [network, prefixLength] = cidr.split('/');
    const prefix = parseInt(prefixLength, 10);
    
    // IPv4の場合のみサポート
    if (!network.includes('.') || !ip.includes('.')) {
      return false;
    }
    
    const ipNum = ipToNumber(ip);
    const networkNum = ipToNumber(network);
    const mask = (0xFFFFFFFF << (32 - prefix)) >>> 0;
    
    return (ipNum & mask) === (networkNum & mask);
  } catch (error) {
    console.error('IP range check error:', error);
    return false;
  }
}

/**
 * IPv4アドレスを数値に変換
 */
function ipToNumber(ip: string): number {
  return ip.split('.').reduce((acc, octet) => (acc << 8) + parseInt(octet, 10), 0) >>> 0;
}

/**
 * プライベート動画のアクセス権限をチェック
 */
export async function checkPrivateVideoAccess(request: NextRequest): Promise<boolean> {
  try {
    const clientIP = getClientIP(request);
    
    // IPv6のローカルホストは特別に処理
    if (clientIP === '::1') {
      // IPv6のローカルホストは127.0.0.1として扱う
      const ipv4Localhost = '127.0.0.1';
      
      // システム設定から許可IPレンジを取得
      const setting = await prisma.systemSetting.findUnique({
        where: { settingKey: 'private_video_allowed_ips' }
      });
      
      if (!setting || !setting.settingValue) {
        console.warn('Private video allowed IPs setting not found or null');
        return false;
      }
      
      let allowedRanges: string[] = [];
      try {
        allowedRanges = JSON.parse(setting.settingValue);
      } catch (error) {
        console.error('Failed to parse allowed IP ranges:', error);
        return false;
      }
      
      // IPv6ローカルホストの場合、127.0.0.1として範囲チェック
      for (const range of allowedRanges) {
        if (isIPInRange(ipv4Localhost, range)) {
          return true;
        }
      }
      
      return false;
    }
    
    // IPv4アドレスの通常処理
    // システム設定から許可IPレンジを取得
    const setting = await prisma.systemSetting.findUnique({
      where: { settingKey: 'private_video_allowed_ips' }
    });
    
    if (!setting) {
      console.warn('Private video allowed IPs setting not found');
      return false;
    }
    
    if (!setting.settingValue) {
      console.warn('Private video allowed IPs setting value is null');
      return false;
    }
    
    let allowedRanges: string[] = [];
    try {
      allowedRanges = JSON.parse(setting.settingValue);
    } catch (error) {
      console.error('Failed to parse allowed IP ranges:', error);
      return false;
    }
    
    // 各IPレンジをチェック（ローカルホストも含む）
    for (const range of allowedRanges) {
      if (isIPInRange(clientIP, range)) {
        return true;
      }
    }
    
    console.log(`Private video access denied for IP: ${clientIP}`);
    return false;
    
  } catch (error) {
    console.error('Private video access check error:', error);
    return false;
  }
}

/**
 * 組織内ネットワークかどうかを判定
 */
export function isOrganizationNetwork(ip: string): boolean {
  // 一般的な組織内ネットワークのIPレンジ
  const organizationRanges = [
    '192.168.0.0/16',   // プライベートネットワーク
    '172.16.0.0/12',    // プライベートネットワーク
    '10.0.0.0/8',       // プライベートネットワーク
    '127.0.0.0/8',      // ローカルホスト
  ];
  
  return organizationRanges.some(range => isIPInRange(ip, range));
} 