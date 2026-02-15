/*
  Warnings:

  - The values [MQTT_WIFI] on the enum `DeviceProtocol` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "DeviceProtocol_new" AS ENUM ('MQTT', 'ZIGBEE', 'GSM_4G', 'VIRTUAL');
ALTER TABLE "public"."t_device" ALTER COLUMN "protocol" DROP DEFAULT;
ALTER TABLE "t_device" ALTER COLUMN "protocol" TYPE "DeviceProtocol_new" USING ("protocol"::text::"DeviceProtocol_new");
ALTER TYPE "DeviceProtocol" RENAME TO "DeviceProtocol_old";
ALTER TYPE "DeviceProtocol_new" RENAME TO "DeviceProtocol";
DROP TYPE "public"."DeviceProtocol_old";
ALTER TABLE "t_device" ALTER COLUMN "protocol" SET DEFAULT 'MQTT';
COMMIT;

-- AlterTable
ALTER TABLE "t_device" ALTER COLUMN "protocol" SET DEFAULT 'MQTT';
