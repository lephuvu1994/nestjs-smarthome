/*
  Warnings:

  - A unique constraint covering the columns `[deviceToken]` on the table `t_hardware_registry` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `deviceToken` to the `t_hardware_registry` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "t_hardware_registry" ADD COLUMN     "deviceToken" TEXT NOT NULL,
ADD COLUMN     "mqttBroker" TEXT,
ADD COLUMN     "mqttPassword" TEXT,
ADD COLUMN     "mqttUsername" TEXT;

-- CreateTable
CREATE TABLE "t_system_config" (
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "description" TEXT,

    CONSTRAINT "t_system_config_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE UNIQUE INDEX "t_hardware_registry_deviceToken_key" ON "t_hardware_registry"("deviceToken");
