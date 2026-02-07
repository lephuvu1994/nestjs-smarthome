/*
  Warnings:

  - You are about to drop the `post_images` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `posts` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `users` table. If the table is not empty, all the data it contains will be lost.

*/
-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'USER');

-- CreateEnum
CREATE TYPE "SharePermission" AS ENUM ('ADMIN', 'EDITOR', 'VIEWER');

-- CreateEnum
CREATE TYPE "DeviceFeatureCategory" AS ENUM ('light', 'switch', 'sensor', 'camera', 'switchDoor');

-- DropForeignKey
ALTER TABLE "post_images" DROP CONSTRAINT "post_images_post_id_fkey";

-- DropForeignKey
ALTER TABLE "posts" DROP CONSTRAINT "posts_author_id_fkey";

-- DropTable
DROP TABLE "post_images";

-- DropTable
DROP TABLE "posts";

-- DropTable
DROP TABLE "users";

-- DropEnum
DROP TYPE "PostStatus";

-- DropEnum
DROP TYPE "Role";

-- CreateTable
CREATE TABLE "t_session" (
    "id" UUID NOT NULL,
    "hashedRefreshToken" TEXT NOT NULL,
    "deviceName" TEXT,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "userId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "t_session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "t_user" (
    "id" UUID NOT NULL,
    "firstname" TEXT,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "t_user_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "t_home" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "radius" INTEGER NOT NULL DEFAULT 100,
    "owner_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "t_home_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "t_home_member" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "home_id" UUID NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'MEMBER',

    CONSTRAINT "t_home_member_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "t_room" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "home_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "t_room_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "t_device" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "external_id" TEXT NOT NULL,
    "selector" TEXT NOT NULL,
    "owner_id" UUID NOT NULL,
    "home_id" UUID,
    "room_id" UUID,
    "hardware_id" UUID,
    "service_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "t_device_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "t_device_share" (
    "id" UUID NOT NULL,
    "device_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "permission" "SharePermission" NOT NULL DEFAULT 'EDITOR',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "t_device_share_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "t_service" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "status" TEXT,

    CONSTRAINT "t_service_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "t_device_feature" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "selector" TEXT NOT NULL,
    "external_id" TEXT NOT NULL,
    "category" "DeviceFeatureCategory" NOT NULL,
    "type" TEXT NOT NULL,
    "min" DOUBLE PRECISION,
    "max" DOUBLE PRECISION,
    "unit" TEXT,
    "read_only" BOOLEAN NOT NULL DEFAULT false,
    "last_value" DOUBLE PRECISION,
    "last_value_string" TEXT,
    "device_id" UUID NOT NULL,

    CONSTRAINT "t_device_feature_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "t_device_feature_state" (
    "id" UUID NOT NULL,
    "value" DOUBLE PRECISION,
    "value_text" TEXT,
    "feature_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "t_device_feature_state_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "t_device_param" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "device_id" UUID NOT NULL,

    CONSTRAINT "t_device_param_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "t_location" (
    "id" UUID NOT NULL,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "accuracy" DOUBLE PRECISION,
    "battery" INTEGER,
    "user_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "t_location_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "t_scene" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "triggers" JSONB NOT NULL DEFAULT '[]',
    "actions" JSONB NOT NULL DEFAULT '[]',
    "home_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "t_scene_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "t_calendar" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "user_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "t_calendar_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "t_calendar_event" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "start" TIMESTAMP(3) NOT NULL,
    "end" TIMESTAMP(3) NOT NULL,
    "all_day" BOOLEAN NOT NULL DEFAULT false,
    "calendar_id" UUID NOT NULL,

    CONSTRAINT "t_calendar_event_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "t_variable" (
    "id" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "service_id" UUID,

    CONSTRAINT "t_variable_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "t_partner" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "t_partner_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "t_device_model" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "featureSpecs" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "t_device_model_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "t_license_quota" (
    "id" UUID NOT NULL,
    "partnerId" UUID NOT NULL,
    "deviceModelId" UUID NOT NULL,
    "maxQuantity" INTEGER NOT NULL DEFAULT 0,
    "activatedCount" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "t_license_quota_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "t_hardware_registry" (
    "id" UUID NOT NULL,
    "hmac" TEXT NOT NULL,
    "partnerId" UUID NOT NULL,
    "deviceModelId" UUID NOT NULL,
    "firmwareVer" TEXT,
    "ipAddress" TEXT,
    "isBanned" BOOLEAN NOT NULL DEFAULT false,
    "activatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "t_hardware_registry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "t_session_hashedRefreshToken_key" ON "t_session"("hashedRefreshToken");

-- CreateIndex
CREATE INDEX "t_session_userId_idx" ON "t_session"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "t_user_email_key" ON "t_user"("email");

-- CreateIndex
CREATE UNIQUE INDEX "t_home_member_user_id_home_id_key" ON "t_home_member"("user_id", "home_id");

-- CreateIndex
CREATE UNIQUE INDEX "t_device_selector_key" ON "t_device"("selector");

-- CreateIndex
CREATE UNIQUE INDEX "t_device_hardware_id_key" ON "t_device"("hardware_id");

-- CreateIndex
CREATE UNIQUE INDEX "t_device_external_id_service_id_key" ON "t_device"("external_id", "service_id");

-- CreateIndex
CREATE UNIQUE INDEX "t_device_share_device_id_user_id_key" ON "t_device_share"("device_id", "user_id");

-- CreateIndex
CREATE UNIQUE INDEX "t_service_name_key" ON "t_service"("name");

-- CreateIndex
CREATE UNIQUE INDEX "t_device_feature_selector_key" ON "t_device_feature"("selector");

-- CreateIndex
CREATE INDEX "t_device_feature_state_feature_id_created_at_idx" ON "t_device_feature_state"("feature_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "t_location_user_id_created_at_idx" ON "t_location"("user_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "t_calendar_event_start_end_idx" ON "t_calendar_event"("start", "end");

-- CreateIndex
CREATE UNIQUE INDEX "t_variable_key_key" ON "t_variable"("key");

-- CreateIndex
CREATE UNIQUE INDEX "t_partner_code_key" ON "t_partner"("code");

-- CreateIndex
CREATE UNIQUE INDEX "t_device_model_code_key" ON "t_device_model"("code");

-- CreateIndex
CREATE UNIQUE INDEX "t_license_quota_partnerId_deviceModelId_key" ON "t_license_quota"("partnerId", "deviceModelId");

-- CreateIndex
CREATE UNIQUE INDEX "t_hardware_registry_hmac_key" ON "t_hardware_registry"("hmac");

-- AddForeignKey
ALTER TABLE "t_session" ADD CONSTRAINT "t_session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "t_user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "t_home" ADD CONSTRAINT "t_home_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "t_user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "t_home_member" ADD CONSTRAINT "t_home_member_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "t_user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "t_home_member" ADD CONSTRAINT "t_home_member_home_id_fkey" FOREIGN KEY ("home_id") REFERENCES "t_home"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "t_room" ADD CONSTRAINT "t_room_home_id_fkey" FOREIGN KEY ("home_id") REFERENCES "t_home"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "t_device" ADD CONSTRAINT "t_device_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "t_user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "t_device" ADD CONSTRAINT "t_device_home_id_fkey" FOREIGN KEY ("home_id") REFERENCES "t_home"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "t_device" ADD CONSTRAINT "t_device_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "t_room"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "t_device" ADD CONSTRAINT "t_device_hardware_id_fkey" FOREIGN KEY ("hardware_id") REFERENCES "t_hardware_registry"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "t_device" ADD CONSTRAINT "t_device_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "t_service"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "t_device_share" ADD CONSTRAINT "t_device_share_device_id_fkey" FOREIGN KEY ("device_id") REFERENCES "t_device"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "t_device_share" ADD CONSTRAINT "t_device_share_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "t_user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "t_device_feature" ADD CONSTRAINT "t_device_feature_device_id_fkey" FOREIGN KEY ("device_id") REFERENCES "t_device"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "t_device_feature_state" ADD CONSTRAINT "t_device_feature_state_feature_id_fkey" FOREIGN KEY ("feature_id") REFERENCES "t_device_feature"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "t_device_param" ADD CONSTRAINT "t_device_param_device_id_fkey" FOREIGN KEY ("device_id") REFERENCES "t_device"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "t_location" ADD CONSTRAINT "t_location_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "t_user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "t_scene" ADD CONSTRAINT "t_scene_home_id_fkey" FOREIGN KEY ("home_id") REFERENCES "t_home"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "t_calendar" ADD CONSTRAINT "t_calendar_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "t_user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "t_calendar_event" ADD CONSTRAINT "t_calendar_event_calendar_id_fkey" FOREIGN KEY ("calendar_id") REFERENCES "t_calendar"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "t_license_quota" ADD CONSTRAINT "t_license_quota_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "t_partner"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "t_license_quota" ADD CONSTRAINT "t_license_quota_deviceModelId_fkey" FOREIGN KEY ("deviceModelId") REFERENCES "t_device_model"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "t_hardware_registry" ADD CONSTRAINT "t_hardware_registry_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "t_partner"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "t_hardware_registry" ADD CONSTRAINT "t_hardware_registry_deviceModelId_fkey" FOREIGN KEY ("deviceModelId") REFERENCES "t_device_model"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
