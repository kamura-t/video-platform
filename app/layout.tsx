import './globals.css';
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { ThemeProvider } from '@/components/providers/theme-provider';
import { AuthProvider } from '@/components/providers/auth-provider';
import { SettingsProvider } from '@/components/providers/settings-provider';
import { CategoriesProvider } from '@/components/providers/categories-provider';
import { Toaster } from '@/components/ui/sonner';
import { prisma } from '@/lib/prisma';

const inter = Inter({ subsets: ['latin'] });

async function getSiteSettings() {
  try {
    const settings = await prisma.systemSetting.findMany({
      where: {
        settingKey: {
          in: ['site_title', 'site_logo_image']
        },
        isActive: true
      }
    });

    const settingsObj = settings.reduce((acc: Record<string, string>, setting: any) => {
      acc[setting.settingKey] = setting.settingValue;
      return acc;
    }, {} as Record<string, string>);

    return settingsObj;
  } catch (error) {
    console.error('Failed to get site settings:', error);
    return {};
  }
}

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getSiteSettings();
  const siteTitle = settings.site_title || 'VideoShare';
  const logoImage = settings.site_logo_image;

  return {
    metadataBase: new URL(process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'),
    title: `${siteTitle} - 組織向けビデオ共有プラットフォーム`,
    description: '組織内でビデオコンテンツを安全に共有・管理するプラットフォーム',
    icons: logoImage ? {
      icon: logoImage,
      shortcut: logoImage,
      apple: logoImage,
    } : undefined,
  };
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ja" suppressHydrationWarning>
      <head>
        <meta name="google" content="notranslate" />
        <meta name="google-translate-customization" content="9f841e7780177523-3214ceb76f765f38-gc38c6fe6f9d06436-c" />
      </head>
      <body className={inter.className}>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <AuthProvider>
            <SettingsProvider>
              <CategoriesProvider>
            {children}
            <Toaster />
              </CategoriesProvider>
            </SettingsProvider>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}