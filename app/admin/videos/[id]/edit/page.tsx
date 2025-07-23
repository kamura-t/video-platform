import VideoEditClient from './video-edit-client';

interface PageProps {
  params: Promise<{
    id: string;
  }>;
}

export default async function VideoEditPage({ params }: PageProps) {
  const resolvedParams = await params;
  
  return <VideoEditClient id={resolvedParams.id} />;
} 