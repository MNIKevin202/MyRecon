-- Add transport protocol selector (SFTP or FTP) to server profiles
ALTER TABLE "ServerProfile" ADD COLUMN "sftpProtocol" TEXT NOT NULL DEFAULT 'SFTP';
