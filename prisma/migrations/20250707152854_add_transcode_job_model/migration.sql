-- CreateEnum
CREATE TYPE "TranscodeStatus" AS ENUM ('pending', 'processing', 'completed', 'failed', 'cancelled');

-- CreateTable
CREATE TABLE "transcode_jobs" (
    "id" SERIAL NOT NULL,
    "job_id" VARCHAR(50) NOT NULL,
    "video_id" INTEGER NOT NULL,
    "input_file" VARCHAR(500) NOT NULL,
    "output_file" VARCHAR(500),
    "preset" VARCHAR(50) NOT NULL,
    "status" "TranscodeStatus" NOT NULL DEFAULT 'pending',
    "progress" INTEGER NOT NULL DEFAULT 0,
    "estimated_duration" DOUBLE PRECISION,
    "processing_time" DOUBLE PRECISION,
    "original_file_size" BIGINT,
    "converted_file_size" BIGINT,
    "compression_ratio" DOUBLE PRECISION,
    "video_width" INTEGER,
    "video_height" INTEGER,
    "video_duration" DOUBLE PRECISION,
    "video_codec" VARCHAR(50),
    "audio_codec" VARCHAR(50),
    "error_message" TEXT,
    "retry_count" INTEGER NOT NULL DEFAULT 0,
    "started_at" TIMESTAMPTZ,
    "completed_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "transcode_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "transcode_jobs_job_id_key" ON "transcode_jobs"("job_id");

-- CreateIndex
CREATE INDEX "transcode_jobs_job_id_idx" ON "transcode_jobs"("job_id");

-- CreateIndex
CREATE INDEX "transcode_jobs_video_id_idx" ON "transcode_jobs"("video_id");

-- CreateIndex
CREATE INDEX "transcode_jobs_status_idx" ON "transcode_jobs"("status");

-- CreateIndex
CREATE INDEX "transcode_jobs_created_at_idx" ON "transcode_jobs"("created_at");

-- AddForeignKey
ALTER TABLE "transcode_jobs" ADD CONSTRAINT "transcode_jobs_video_id_fkey" FOREIGN KEY ("video_id") REFERENCES "videos"("id") ON DELETE CASCADE ON UPDATE CASCADE;
