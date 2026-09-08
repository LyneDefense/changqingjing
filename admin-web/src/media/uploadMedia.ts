import COS from 'cos-js-sdk-v5'
import {
  completeMediaUpload,
  createMediaUpload,
} from '../api/admin'
import type { AdminMedia, MediaPurpose, MediaType } from '../api/admin'

export async function uploadMedia(
  file: File,
  mediaType: MediaType,
  purpose: MediaPurpose,
  onProgress: (percent: number) => void,
): Promise<AdminMedia> {
  const task = await createMediaUpload({
    originalFilename: file.name,
    mediaType,
    contentType: file.type,
    sizeBytes: file.size,
    purpose,
  })
  const { credentials } = task.upload
  const cos = new COS({
    getAuthorization: (_options, callback) => callback({
      TmpSecretId: credentials.secretId,
      TmpSecretKey: credentials.secretKey,
      SecurityToken: credentials.sessionToken,
      StartTime: credentials.startTime,
      ExpiredTime: credentials.expiredTime,
      ScopeLimit: true,
    }),
  })
  await cos.putObject({
    Bucket: task.upload.bucket,
    Region: task.upload.region,
    Key: task.upload.objectKey,
    Body: file,
    ContentType: file.type,
    onProgress: (progress) => onProgress(Math.round(progress.percent * 100)),
  })
  const verified = await completeMediaUpload(task.media.id)
  if (verified.status !== 'READY') {
    throw new Error(`文件校验失败（${verified.failureCode ?? 'UNKNOWN'}）`)
  }
  return verified
}
