-- AlterTable
ALTER TABLE "t_user" ADD COLUMN     "otp_code" TEXT,
ADD COLUMN     "otp_expire" TIMESTAMP(3);
