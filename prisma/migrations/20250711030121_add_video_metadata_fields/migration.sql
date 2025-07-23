-- AlterTable
ALTER TABLE "videos" ADD COLUMN     "audio_bitrate" INTEGER,
ADD COLUMN     "audio_channels" INTEGER,
ADD COLUMN     "audio_codec" VARCHAR(20),
ADD COLUMN     "audio_sample_rate" INTEGER,
ADD COLUMN     "compression_ratio" DECIMAL(5,2),
ADD COLUMN     "converted_file_size" BIGINT,
ADD COLUMN     "video_bitrate" INTEGER,
ADD COLUMN     "video_codec" VARCHAR(20),
ADD COLUMN     "video_frame_rate" DECIMAL(5,2),
ADD COLUMN     "video_resolution" VARCHAR(20);

-- CreateIndex
CREATE INDEX "videos_duration_idx" ON "videos"("duration");

-- CreateIndex
CREATE INDEX "videos_video_codec_idx" ON "videos"("video_codec");

-- CreateIndex
CREATE INDEX "videos_video_resolution_idx" ON "videos"("video_resolution");
