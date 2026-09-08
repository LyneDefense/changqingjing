import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { useState } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { AdminMedia } from '../api/admin'
import { uploadMedia } from '../media/uploadMedia'
import { MediaUploadField } from './MediaUploadField'

vi.mock('../media/uploadMedia', () => ({ uploadMedia: vi.fn() }))

const readyMedia: AdminMedia = {
  id: '7a337e9e-eaf7-4439-aa27-a97507866dc9',
  originalFilename: 'cover.png',
  mediaType: 'IMAGE',
  contentType: 'image/png',
  sizeBytes: 8,
  status: 'READY',
  purpose: 'COMPANY_COVER',
  verificationAttempts: 1,
  createdAt: '2026-09-08T08:00:00Z',
  verifiedAt: '2026-09-08T08:00:01Z',
  previewUrl: 'https://media.example/cover.png?signature=short',
}

function Harness() {
  const [mediaId, setMediaId] = useState<string>()
  return (
    <MediaUploadField
      accept="image/png"
      label="公司封面"
      mediaId={mediaId}
      mediaType="IMAGE"
      onReady={(media) => setMediaId(media.id)}
      purpose="COMPANY_COVER"
    />
  )
}

describe('MediaUploadField', () => {
  beforeEach(() => {
    vi.mocked(uploadMedia).mockImplementation(async (_file, _type, _purpose, progress) => {
      progress(72)
      return readyMedia
    })
    vi.stubGlobal('fetch', vi.fn(async () => new Response(
      JSON.stringify({ data: readyMedia }),
      { headers: { 'Content-Type': 'application/json' } },
    )))
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.clearAllMocks()
  })

  it('uploads through the media workflow and displays only a ready preview', async () => {
    const { container } = render(<Harness />)
    const input = container.querySelector('input[type="file"]') as HTMLInputElement
    const file = new File(['png-file'], 'cover.png', { type: 'image/png' })

    fireEvent.change(input, { target: { files: [file] } })

    await waitFor(() => expect(uploadMedia).toHaveBeenCalledWith(
      file,
      'IMAGE',
      'COMPANY_COVER',
      expect.any(Function),
    ))
    expect(await screen.findByAltText('cover.png')).toHaveAttribute(
      'src',
      readyMedia.previewUrl,
    )
    expect(screen.getByText('已校验')).toBeInTheDocument()
  })
})
