/*
  Warnings:

  - You are about to drop the column `audio_codec` on the `transcode_jobs` table. All the data in the column will be lost.
  - You are about to drop the column `compression_ratio` on the `transcode_jobs` table. All the data in the column will be lost.
  - You are about to drop the column `converted_file_size` on the `transcode_jobs` table. All the data in the column will be lost.
  - You are about to drop the column `estimated_duration` on the `transcode_jobs` table. All the data in the column will be lost.
  - You are about to drop the column `original_file_size` on the `transcode_jobs` table. All the data in the column will be lost.
  - You are about to drop the column `processing_time` on the `transcode_jobs` table. All the data in the column will be lost.
  - You are about to drop the column `retry_count` on the `transcode_jobs` table. All the data in the column will be lost.
  - You are about to drop the column `video_codec` on the `transcode_jobs` table. All the data in the column will be lost.
  - You are about to drop the column `video_duration` on the `transcode_jobs` table. All the data in the column will be lost.
  - You are about to drop the column `video_height` on the `transcode_jobs` table. All the data in the column will be lost.
  - You are about to drop the column `video_width` on the `transcode_jobs` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "transcode_jobs" DROP COLUMN "audio_codec",
DROP COLUMN "compression_ratio",
DROP COLUMN "converted_file_size",
DROP COLUMN "estimated_duration",
DROP COLUMN "original_file_size",
DROP COLUMN "processing_time",
DROP COLUMN "retry_count",
DROP COLUMN "video_codec",
DROP COLUMN "video_duration",
DROP COLUMN "video_height",
DROP COLUMN "video_width";
