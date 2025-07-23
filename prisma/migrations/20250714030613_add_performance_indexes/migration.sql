-- CreateIndex
CREATE INDEX "videos_view_count_idx" ON "videos"("view_count");

-- CreateIndex
CREATE INDEX "videos_visibility_created_at_idx" ON "videos"("visibility", "created_at");

-- CreateIndex
CREATE INDEX "videos_visibility_view_count_idx" ON "videos"("visibility", "view_count");

-- CreateIndex
CREATE INDEX "videos_uploader_id_created_at_idx" ON "videos"("uploader_id", "created_at");
