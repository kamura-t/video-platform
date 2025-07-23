-- CreateEnum
CREATE TYPE "Role" AS ENUM ('admin', 'curator');

-- CreateEnum
CREATE TYPE "UploadType" AS ENUM ('file', 'youtube');

-- CreateEnum
CREATE TYPE "Visibility" AS ENUM ('public', 'private', 'draft');

-- CreateEnum
CREATE TYPE "VideoStatus" AS ENUM ('processing', 'completed', 'failed', 'deleted');

-- CreateEnum
CREATE TYPE "PostType" AS ENUM ('video', 'playlist');

-- CreateEnum
CREATE TYPE "SettingType" AS ENUM ('string', 'integer', 'boolean', 'json', 'text', 'server_ip', 'file_path', 'port');

-- CreateTable
CREATE TABLE "users" (
    "id" SERIAL NOT NULL,
    "username" VARCHAR(30) NOT NULL,
    "display_name" VARCHAR(64) NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "password_hash" VARCHAR(255) NOT NULL,
    "role" "Role" NOT NULL,
    "department" VARCHAR(100),
    "profile_image_url" VARCHAR(500) DEFAULT '/images/default-avatar.png',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "failed_login_count" INTEGER NOT NULL DEFAULT 0,
    "last_failed_login_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "last_login_at" TIMESTAMPTZ,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "videos" (
    "id" SERIAL NOT NULL,
    "video_id" VARCHAR(11) NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "description" TEXT,
    "upload_type" "UploadType" NOT NULL,
    "original_filename" VARCHAR(255),
    "file_path" VARCHAR(500),
    "converted_file_path" VARCHAR(500),
    "file_size" BIGINT,
    "mime_type" VARCHAR(100),
    "youtube_url" VARCHAR(500),
    "youtube_video_id" VARCHAR(15),
    "youtube_view_count" INTEGER,
    "thumbnail_url" VARCHAR(500),
    "duration" INTEGER,
    "view_count" INTEGER NOT NULL DEFAULT 0,
    "visibility" "Visibility" NOT NULL,
    "status" "VideoStatus" NOT NULL DEFAULT 'processing',
    "uploader_id" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "published_at" TIMESTAMPTZ,

    CONSTRAINT "videos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "posts" (
    "id" SERIAL NOT NULL,
    "post_id" VARCHAR(11) NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "description" TEXT,
    "post_type" "PostType" NOT NULL,
    "video_id" INTEGER,
    "playlist_id" INTEGER,
    "visibility" "Visibility" NOT NULL,
    "creator_id" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "published_at" TIMESTAMPTZ,

    CONSTRAINT "posts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "playlists" (
    "id" SERIAL NOT NULL,
    "playlist_id" VARCHAR(11) NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "description" TEXT,
    "thumbnail_url" VARCHAR(500),
    "video_count" INTEGER NOT NULL DEFAULT 0,
    "total_duration" INTEGER DEFAULT 0,
    "creator_id" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "playlists_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "playlist_videos" (
    "id" SERIAL NOT NULL,
    "playlist_id" INTEGER NOT NULL,
    "video_id" INTEGER NOT NULL,
    "sort_order" INTEGER NOT NULL,
    "added_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "playlist_videos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "categories" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(32) NOT NULL,
    "slug" VARCHAR(100) NOT NULL,
    "description" TEXT,
    "color" VARCHAR(7),
    "video_count" INTEGER NOT NULL DEFAULT 0,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "video_categories" (
    "id" SERIAL NOT NULL,
    "video_id" INTEGER NOT NULL,
    "category_id" INTEGER NOT NULL,

    CONSTRAINT "video_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tags" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(32) NOT NULL,
    "slug" VARCHAR(32) NOT NULL,
    "video_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "tags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "video_tags" (
    "id" SERIAL NOT NULL,
    "video_id" INTEGER NOT NULL,
    "tag_id" INTEGER NOT NULL,

    CONSTRAINT "video_tags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "view_logs" (
    "id" SERIAL NOT NULL,
    "video_id" INTEGER NOT NULL,
    "session_id" VARCHAR(64),
    "user_agent" TEXT,
    "watch_duration" INTEGER,
    "completion_rate" DECIMAL(5,2),
    "referrer" VARCHAR(500),
    "viewed_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "view_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "system_settings" (
    "id" SERIAL NOT NULL,
    "setting_key" VARCHAR(100) NOT NULL,
    "setting_value" TEXT,
    "setting_type" "SettingType" NOT NULL,
    "description" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "system_settings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_username_idx" ON "users"("username");

-- CreateIndex
CREATE INDEX "users_email_idx" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_role_idx" ON "users"("role");

-- CreateIndex
CREATE INDEX "users_is_active_idx" ON "users"("is_active");

-- CreateIndex
CREATE UNIQUE INDEX "videos_video_id_key" ON "videos"("video_id");

-- CreateIndex
CREATE INDEX "videos_video_id_idx" ON "videos"("video_id");

-- CreateIndex
CREATE INDEX "videos_uploader_id_idx" ON "videos"("uploader_id");

-- CreateIndex
CREATE INDEX "videos_visibility_idx" ON "videos"("visibility");

-- CreateIndex
CREATE INDEX "videos_status_idx" ON "videos"("status");

-- CreateIndex
CREATE INDEX "videos_upload_type_idx" ON "videos"("upload_type");

-- CreateIndex
CREATE INDEX "videos_created_at_idx" ON "videos"("created_at");

-- CreateIndex
CREATE INDEX "videos_published_at_idx" ON "videos"("published_at");

-- CreateIndex
CREATE UNIQUE INDEX "posts_post_id_key" ON "posts"("post_id");

-- CreateIndex
CREATE INDEX "posts_post_id_idx" ON "posts"("post_id");

-- CreateIndex
CREATE INDEX "posts_creator_id_idx" ON "posts"("creator_id");

-- CreateIndex
CREATE INDEX "posts_post_type_idx" ON "posts"("post_type");

-- CreateIndex
CREATE INDEX "posts_visibility_idx" ON "posts"("visibility");

-- CreateIndex
CREATE INDEX "posts_published_at_idx" ON "posts"("published_at");

-- CreateIndex
CREATE UNIQUE INDEX "playlists_playlist_id_key" ON "playlists"("playlist_id");

-- CreateIndex
CREATE INDEX "playlists_playlist_id_idx" ON "playlists"("playlist_id");

-- CreateIndex
CREATE INDEX "playlists_creator_id_idx" ON "playlists"("creator_id");

-- CreateIndex
CREATE INDEX "playlist_videos_playlist_id_idx" ON "playlist_videos"("playlist_id");

-- CreateIndex
CREATE INDEX "playlist_videos_video_id_idx" ON "playlist_videos"("video_id");

-- CreateIndex
CREATE INDEX "playlist_videos_playlist_id_sort_order_idx" ON "playlist_videos"("playlist_id", "sort_order");

-- CreateIndex
CREATE UNIQUE INDEX "playlist_videos_playlist_id_video_id_key" ON "playlist_videos"("playlist_id", "video_id");

-- CreateIndex
CREATE UNIQUE INDEX "categories_name_key" ON "categories"("name");

-- CreateIndex
CREATE UNIQUE INDEX "categories_slug_key" ON "categories"("slug");

-- CreateIndex
CREATE INDEX "categories_slug_idx" ON "categories"("slug");

-- CreateIndex
CREATE INDEX "categories_sort_order_idx" ON "categories"("sort_order");

-- CreateIndex
CREATE INDEX "video_categories_video_id_idx" ON "video_categories"("video_id");

-- CreateIndex
CREATE INDEX "video_categories_category_id_idx" ON "video_categories"("category_id");

-- CreateIndex
CREATE UNIQUE INDEX "video_categories_video_id_category_id_key" ON "video_categories"("video_id", "category_id");

-- CreateIndex
CREATE UNIQUE INDEX "tags_name_key" ON "tags"("name");

-- CreateIndex
CREATE UNIQUE INDEX "tags_slug_key" ON "tags"("slug");

-- CreateIndex
CREATE INDEX "tags_name_idx" ON "tags"("name");

-- CreateIndex
CREATE INDEX "tags_slug_idx" ON "tags"("slug");

-- CreateIndex
CREATE INDEX "tags_video_count_idx" ON "tags"("video_count");

-- CreateIndex
CREATE INDEX "video_tags_video_id_idx" ON "video_tags"("video_id");

-- CreateIndex
CREATE INDEX "video_tags_tag_id_idx" ON "video_tags"("tag_id");

-- CreateIndex
CREATE UNIQUE INDEX "video_tags_video_id_tag_id_key" ON "video_tags"("video_id", "tag_id");

-- CreateIndex
CREATE INDEX "view_logs_video_id_idx" ON "view_logs"("video_id");

-- CreateIndex
CREATE INDEX "view_logs_session_id_idx" ON "view_logs"("session_id");

-- CreateIndex
CREATE INDEX "view_logs_viewed_at_idx" ON "view_logs"("viewed_at");

-- CreateIndex
CREATE UNIQUE INDEX "system_settings_setting_key_key" ON "system_settings"("setting_key");

-- CreateIndex
CREATE INDEX "system_settings_setting_key_idx" ON "system_settings"("setting_key");

-- CreateIndex
CREATE INDEX "system_settings_is_active_idx" ON "system_settings"("is_active");

-- AddForeignKey
ALTER TABLE "videos" ADD CONSTRAINT "videos_uploader_id_fkey" FOREIGN KEY ("uploader_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "posts" ADD CONSTRAINT "posts_video_id_fkey" FOREIGN KEY ("video_id") REFERENCES "videos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "posts" ADD CONSTRAINT "posts_playlist_id_fkey" FOREIGN KEY ("playlist_id") REFERENCES "playlists"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "posts" ADD CONSTRAINT "posts_creator_id_fkey" FOREIGN KEY ("creator_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "playlists" ADD CONSTRAINT "playlists_creator_id_fkey" FOREIGN KEY ("creator_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "playlist_videos" ADD CONSTRAINT "playlist_videos_playlist_id_fkey" FOREIGN KEY ("playlist_id") REFERENCES "playlists"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "playlist_videos" ADD CONSTRAINT "playlist_videos_video_id_fkey" FOREIGN KEY ("video_id") REFERENCES "videos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "video_categories" ADD CONSTRAINT "video_categories_video_id_fkey" FOREIGN KEY ("video_id") REFERENCES "videos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "video_categories" ADD CONSTRAINT "video_categories_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "video_tags" ADD CONSTRAINT "video_tags_video_id_fkey" FOREIGN KEY ("video_id") REFERENCES "videos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "video_tags" ADD CONSTRAINT "video_tags_tag_id_fkey" FOREIGN KEY ("tag_id") REFERENCES "tags"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "view_logs" ADD CONSTRAINT "view_logs_video_id_fkey" FOREIGN KEY ("video_id") REFERENCES "videos"("id") ON DELETE CASCADE ON UPDATE CASCADE;
