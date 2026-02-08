/*
  Warnings:

  - You are about to drop the column `created_at` on the `t_user` table. All the data in the column will be lost.
  - You are about to drop the column `updated_at` on the `t_user` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[phone]` on the table `t_user` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `updated_at` to the `t_user` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "t_user" DROP COLUMN "created_at",
DROP COLUMN "updated_at",
ADD COLUMN     "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "last_accuracy" DOUBLE PRECISION,
ADD COLUMN     "last_altitude" DOUBLE PRECISION,
ADD COLUMN     "last_latitude" DOUBLE PRECISION,
ADD COLUMN     "last_location_changed" TIMESTAMP(3),
ADD COLUMN     "last_longitude" DOUBLE PRECISION,
ADD COLUMN     "lastname" TEXT,
ADD COLUMN     "phone" TEXT,
ADD COLUMN     "updated_at" TIMESTAMP(3) NOT NULL,
ALTER COLUMN "email" DROP NOT NULL,
ALTER COLUMN "role" SET DEFAULT 'USER';

-- CreateIndex
CREATE UNIQUE INDEX "t_user_phone_key" ON "t_user"("phone");
